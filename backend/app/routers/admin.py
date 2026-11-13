from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ambulance, CaseEvent, EmergencyCase, Hospital, Patient, User, now
from app.realtime import emit_case
from app.routers.cases import case_detail
from app.security import require_roles
from app.serializers import ambulance_public, case_public, hospital_public, patient_public

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_roles("admin")


class AdminCaseUpdate(BaseModel):
    status: Literal["open", "hospital_selected", "acknowledged", "closed"] | None = None
    hospital_id: int | None = None
    priority: Literal["low", "normal", "high", "critical"] | None = None
    emergency_category: Literal["unknown", "trauma", "cardiac", "respiratory", "obstetric", "other"] | None = None
    ambulance_status: Literal["en_route", "arrived"] | None = None
    prep_status: Literal["pending", "requested", "preparing", "ready"] | None = None


@router.get("/overview")
def overview(db: Session = Depends(get_db), user=Depends(admin_only)):
    return {
        "users": db.query(User).count(),
        "hospitals": db.query(Hospital).count(),
        "ambulances": db.query(Ambulance).count(),
        "patients": db.query(Patient).count(),
        "cases": db.query(EmergencyCase).count(),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), user=Depends(admin_only)):
    return [
        {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "role": row.role,
            "hospital_id": row.hospital_id,
            "ambulance_id": row.ambulance_id,
            "is_active": row.is_active,
        }
        for row in db.query(User).order_by(User.id)
    ]


@router.get("/hospitals")
def list_hospitals(db: Session = Depends(get_db), user=Depends(admin_only)):
    return [hospital_public(row) for row in db.query(Hospital).order_by(Hospital.id)]


@router.get("/ambulances")
def list_ambulances(db: Session = Depends(get_db), user=Depends(admin_only)):
    return [ambulance_public(row) for row in db.query(Ambulance).order_by(Ambulance.id)]


@router.get("/patients")
def list_patients(db: Session = Depends(get_db), user=Depends(admin_only)):
    return [
        {
            "id": row.id,
            "name": row.name,
            "age": row.age,
            "sex": row.sex,
            "blood_group": row.blood_group,
        }
        for row in db.query(Patient).order_by(Patient.id)
    ]


@router.get("/cases")
def list_cases(db: Session = Depends(get_db), user=Depends(admin_only)):
    rows = db.query(EmergencyCase).order_by(EmergencyCase.created_at.desc(), EmergencyCase.id.desc()).all()
    return [
        {
            **case_public(case),
            "patient": patient_public(case.patient),
        }
        for case in rows
    ]


@router.patch("/cases/{case_id}")
def update_case(
    case_id: int,
    body: AdminCaseUpdate,
    db: Session = Depends(get_db),
    user=Depends(admin_only),
):
    case = db.get(EmergencyCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    changes = body.model_dump(exclude_unset=True)
    if "hospital_id" in changes and changes["hospital_id"] is not None:
        hospital = db.get(Hospital, changes["hospital_id"])
        if hospital is None or not hospital.is_active:
            raise HTTPException(status_code=404, detail="Hospital not found")
    if any(value is None for key, value in changes.items() if key != "hospital_id"):
        raise HTTPException(status_code=422, detail="Case updates cannot be null")
    if not changes:
        raise HTTPException(status_code=400, detail="At least one case field is required")

    for field, value in changes.items():
        setattr(case, field, value)
        if field == "status" and value == "acknowledged":
            case.acknowledged_at = now()
            case.acknowledged_by_id = user.id
        db.add(
            CaseEvent(
                case_id=case.id,
                kind=f"admin_{field}",
                detail=f"{field} set to {value}",
                actor_id=user.id,
            )
        )
    db.commit()
    db.refresh(case)
    emit_case("case:updated", case)
    return case_public(case)


@router.get("/cases/{case_id}")
def read_case(
    case_id: int,
    db: Session = Depends(get_db),
    user=Depends(admin_only),
):
    case = db.get(EmergencyCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_detail(db, case)
