from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def now():
    return datetime.now(timezone.utc)


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    address: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Ambulance(Base):
    __tablename__ = "ambulances"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_number: Mapped[str] = mapped_column(String(40), unique=True)
    device_key: Mapped[str] = mapped_column(String(120), unique=True)
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    rfid_last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32))
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    ambulance_id: Mapped[int | None] = mapped_column(ForeignKey("ambulances.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str] = mapped_column(String(16), default="")
    blood_group: Mapped[str] = mapped_column(String(8), default="")
    conditions: Mapped[str] = mapped_column(Text, default="")
    allergies: Mapped[str] = mapped_column(Text, default="")
    aadhaar: Mapped[str] = mapped_column(String(16), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(String(255), default="")
    emergency_contact: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    records: Mapped[list["MedicalRecord"]] = relationship(back_populates="patient")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    medications: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    patient: Mapped[Patient] = relationship(back_populates="records")


class RfidCard(Base):
    __tablename__ = "rfid_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    uid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class EmergencyCase(Base):
    __tablename__ = "emergency_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    ambulance_id: Mapped[int] = mapped_column(ForeignKey("ambulances.id"), index=True)
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    priority: Mapped[str] = mapped_column(String(16), default="high")
    emergency_category: Mapped[str] = mapped_column(String(24), default="unknown", server_default="unknown")
    status: Mapped[str] = mapped_column(String(24), default="open")
    ambulance_status: Mapped[str] = mapped_column(String(24), default="en_route", server_default="en_route")
    prep_status: Mapped[str] = mapped_column(String(24), default="pending")
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acknowledged_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    patient: Mapped[Patient] = relationship()
    ambulance: Mapped[Ambulance] = relationship()
    hospital: Mapped[Hospital | None] = relationship()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("emergency_cases.id"), index=True)
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sender_role: Mapped[str] = mapped_column(String(32), default="system")
    sender: Mapped[User | None] = relationship()
    kind: Mapped[str] = mapped_column(String(16), default="text")
    text: Mapped[str] = mapped_column(Text, default="")
    audio_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    audio_mime: Mapped[str | None] = mapped_column(String(80), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ack_status: Mapped[str] = mapped_column(String(16), default="sent")
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("emergency_cases.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    detail: Mapped[str] = mapped_column(Text, default="")
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
