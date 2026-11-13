from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import EmergencyCase, User

AMBULANCE_ROLES = ("ambulance_driver", "ambulance_staff")
HOSPITAL_ROLES = ("hospital_staff", "doctor")
CASE_ROLES = AMBULANCE_ROLES + HOSPITAL_ROLES


def get_case_for_user(db: Session, case_id: int, user: User) -> EmergencyCase:
    if user.role == "admin":
        case = db.get(EmergencyCase, case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found")
        return case
    if user.role not in CASE_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden")
    case = db.get(EmergencyCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.role in AMBULANCE_ROLES:
        if case.ambulance_id != user.ambulance_id:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        if case.hospital_id is None:
            raise HTTPException(status_code=404, detail="Case not found")
        if case.hospital_id != user.hospital_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    return case
