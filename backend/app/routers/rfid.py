import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.access import AMBULANCE_ROLES
from app.config import ENV
from app.database import get_db
from app.models import Ambulance, EmergencyCase, MedicalRecord, Patient, RfidCard
from app.realtime import emit_case
from app.security import get_current_user, require_roles
from app.serializers import case_public, patient_public, record_public

router = APIRouter(prefix="/api/rfid", tags=["rfid"])

ACTIVE_CASE_STATUSES = ("open", "hospital_selected", "acknowledged")
RFID_ONLINE_WINDOW = timedelta(seconds=45)


class ScanBody(BaseModel):
    uid: str = Field(min_length=1, max_length=64)


def latest_record(db: Session, patient_id: int) -> MedicalRecord | None:
    return (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc(), MedicalRecord.id.desc())
        .first()
    )


def device_ambulance(db: Session, device_key: str | None) -> Ambulance:
    if not device_key:
        raise HTTPException(status_code=401, detail="Missing device key")
    for ambulance in db.query(Ambulance).filter(Ambulance.is_active.is_(True)):
        if secrets.compare_digest(ambulance.device_key, device_key):
            return ambulance
    raise HTTPException(status_code=401, detail="Invalid device key")


def scan_patient(db: Session, ambulance: Ambulance, uid: str) -> dict:
    card = db.query(RfidCard).filter(RfidCard.uid == uid.strip()).first()
    if not card or not card.active:
        raise HTTPException(status_code=404, detail="Card not found")

    patient = db.get(Patient, card.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Card not found")

    case = (
        db.query(EmergencyCase)
        .filter(
            EmergencyCase.patient_id == patient.id,
            EmergencyCase.ambulance_id == ambulance.id,
            EmergencyCase.status.in_(ACTIVE_CASE_STATUSES),
        )
        .order_by(EmergencyCase.id.desc())
        .first()
    )
    if not case:
        case = EmergencyCase(
            patient_id=patient.id,
            ambulance_id=ambulance.id,
            priority="high",
            status="open",
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        emit_case("case:created", case, {"patient": patient_public(patient)})

    return {
        "patient": patient_public(patient),
        "medical_record": record_public(latest_record(db, patient.id)),
        "case": case_public(case),
        "card_uid": card.uid,
    }


@router.post("/scans")
def scan(
    body: ScanBody,
    x_device_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ambulance = device_ambulance(db, x_device_key)
    return scan_patient(db, ambulance, body.uid)


@router.post("/heartbeat")
def heartbeat(
    x_device_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ambulance = device_ambulance(db, x_device_key)
    ambulance.rfid_last_seen = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}


@router.get("/status")
def reader_status(
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    ambulance = db.get(Ambulance, user.ambulance_id)
    if ambulance is None or not ambulance.is_active:
        raise HTTPException(status_code=403, detail="No active ambulance is assigned")

    last_seen = ambulance.rfid_last_seen
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    connected = (
        last_seen is not None
        and datetime.now(timezone.utc) - last_seen <= RFID_ONLINE_WINDOW
    )
    return {"connected": connected}


@router.post("/demo-scans")
def demo_scan(
    body: ScanBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    if ENV not in ("dev", "test"):
        raise HTTPException(status_code=404, detail="Demo scan is unavailable")
    ambulance = db.get(Ambulance, user.ambulance_id)
    if ambulance is None or not ambulance.is_active:
        raise HTTPException(status_code=403, detail="No active ambulance is assigned")
    return scan_patient(db, ambulance, body.uid)
