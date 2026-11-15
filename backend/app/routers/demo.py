import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import DEMO_RESET_KEY
from app.database import get_db
from app.models import (
    Ambulance,
    CaseEvent,
    EmergencyCase,
    Hospital,
    MedicalRecord,
    Message,
    Patient,
    RfidCard,
    User,
)
from app.seed import seed_demo, seed_rfid_patients

router = APIRouter(prefix="/api/demo", tags=["demo"])

# Children before parents so foreign keys never block the wipe.
WIPE_ORDER = [
    CaseEvent,
    Message,
    EmergencyCase,
    MedicalRecord,
    RfidCard,
    Patient,
    User,
    Ambulance,
    Hospital,
]


@router.post("/reset")
def reset_demo(
    x_demo_reset_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if (
        not DEMO_RESET_KEY
        or not x_demo_reset_key
        or not secrets.compare_digest(x_demo_reset_key, DEMO_RESET_KEY)
    ):
        raise HTTPException(status_code=403, detail="Demo reset is not enabled")

    for model in WIPE_ORDER:
        db.query(model).delete()
    db.commit()

    seed_demo(db)
    seed_rfid_patients(db)
    db.commit()

    return {
        "status": "reset",
        "users": db.query(User).count(),
        "patients": db.query(Patient).count(),
    }
