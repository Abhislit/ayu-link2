from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.access import AMBULANCE_ROLES, get_case_for_user
from app.database import get_db
from app.models import CaseEvent, EmergencyCase, Hospital
from app.realtime import emit_case
from app.routers.rfid import ACTIVE_CASE_STATUSES, latest_record
from app.security import get_current_user, require_roles
from app.serializers import (
    ambulance_public,
    case_public,
    hospital_public,
    patient_public,
    record_public,
)

router = APIRouter(prefix="/api", tags=["cases"])


class SelectHospitalBody(BaseModel):
    hospital_id: int


class AmbulanceStatusBody(BaseModel):
    status: Literal["en_route", "arrived"]


class EmergencyCategoryBody(BaseModel):
    category: Literal["unknown", "trauma", "cardiac", "respiratory", "obstetric", "other"]


def case_detail(db: Session, case: EmergencyCase) -> dict:
    return {
        "case": case_public(case),
        "patient": patient_public(case.patient),
        "medical_record": record_public(latest_record(db, case.patient_id)),
        "ambulance": ambulance_public(case.ambulance),
        "hospital": hospital_public(case.hospital),
    }


@router.get("/ambulance/case")
def current_case(
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    case = (
        db.query(EmergencyCase)
        .filter(
            EmergencyCase.ambulance_id == user.ambulance_id,
            EmergencyCase.status.in_(ACTIVE_CASE_STATUSES),
        )
        .order_by(EmergencyCase.id.desc())
        .first()
    )
    if case is None:
        raise HTTPException(status_code=404, detail="No active case")
    return case_public(case)


@router.get("/ambulance/cases")
def ambulance_cases(
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    cases = (
        db.query(EmergencyCase)
        .filter(
            EmergencyCase.ambulance_id == user.ambulance_id,
            EmergencyCase.status.in_(ACTIVE_CASE_STATUSES),
        )
        .order_by(EmergencyCase.id.desc())
        .all()
    )
    return [
        {**case_public(case), "patient": patient_public(case.patient)}
        for case in cases
    ]


@router.get("/cases/{case_id}")
def read_case(
    case_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    case = get_case_for_user(db, case_id, user)
    return case_detail(db, case)


@router.post("/cases/{case_id}/hospital")
def select_hospital(
    case_id: int,
    body: SelectHospitalBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    case = get_case_for_user(db, case_id, user)

    hospital = db.get(Hospital, body.hospital_id)
    if hospital is None or not hospital.is_active:
        raise HTTPException(status_code=404, detail="Hospital not found")

    case.hospital_id = hospital.id
    case.status = "hospital_selected"
    db.add(CaseEvent(case_id=case.id, kind="hospital_selected", detail=hospital.name, actor_id=user.id))
    db.commit()
    db.refresh(case)
    emit_case("case:updated", case)
    return case_public(case)


@router.patch("/cases/{case_id}/ambulance-status")
def update_ambulance_status(
    case_id: int,
    body: AmbulanceStatusBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    case = get_case_for_user(db, case_id, user)
    case.ambulance_status = body.status
    db.add(
        CaseEvent(
            case_id=case.id,
            kind="ambulance_status",
            detail=body.status,
            actor_id=user.id,
        )
    )
    db.commit()
    db.refresh(case)
    emit_case("case:updated", case)
    return case_public(case)


@router.patch("/cases/{case_id}/emergency-category")
def update_emergency_category(
    case_id: int,
    body: EmergencyCategoryBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*AMBULANCE_ROLES)),
):
    case = get_case_for_user(db, case_id, user)
    case.emergency_category = body.category
    db.add(
        CaseEvent(
            case_id=case.id,
            kind="emergency_category",
            detail=body.category,
            actor_id=user.id,
        )
    )
    db.commit()
    db.refresh(case)
    emit_case("case:updated", case)
    return case_public(case)


@router.post("/cases/{case_id}/close")
def close_case(
    case_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles("doctor", "admin")),
):
    case = get_case_for_user(db, case_id, user)
    if case.status == "closed":
        raise HTTPException(status_code=409, detail="Case is already closed")
    if user.role == "doctor" and (
        case.status != "acknowledged" or case.ambulance_status != "arrived"
    ):
        raise HTTPException(
            status_code=409,
            detail="The hospital must acknowledge the case and the ambulance must arrive before a doctor can close it",
        )

    case.status = "closed"
    db.add(
        CaseEvent(
            case_id=case.id,
            kind="closed",
            detail="Case closed",
            actor_id=user.id,
        )
    )
    db.commit()
    db.refresh(case)
    emit_case("case:updated", case)
    return case_public(case)
