import asyncio
from contextlib import asynccontextmanager
import os
from pathlib import Path

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text

from app import realtime
from app.config import CORS_ORIGINS, ENV
from app.database import Base, SessionLocal, engine
from app.routers import admin, auth, cases, doctor, hospital, hospitals, messages, rfid, voice
from app.seed import seed_demo, seed_rfid_patients


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ambulance_columns = {
        column["name"] for column in inspect(engine).get_columns("ambulances")
    }
    if "rfid_last_seen" not in ambulance_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE ambulances ADD COLUMN rfid_last_seen DATETIME")
            )
    case_columns = {
        column["name"] for column in inspect(engine).get_columns("emergency_cases")
    }
    if "ambulance_status" not in case_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE emergency_cases ADD COLUMN ambulance_status "
                    "VARCHAR(24) NOT NULL DEFAULT 'en_route'"
                )
            )
    if "emergency_category" not in case_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE emergency_cases ADD COLUMN emergency_category "
                    "VARCHAR(24) NOT NULL DEFAULT 'unknown'"
                )
            )
    patient_columns = {
        column["name"] for column in inspect(engine).get_columns("patients")
    }
    patient_migrations = {
        "aadhaar": "VARCHAR(16) NOT NULL DEFAULT ''",
        "phone": "VARCHAR(20) NOT NULL DEFAULT ''",
        "address": "VARCHAR(255) NOT NULL DEFAULT ''",
        "emergency_contact": "VARCHAR(160) NOT NULL DEFAULT ''",
    }
    with engine.begin() as connection:
        for name, ddl in patient_migrations.items():
            if name not in patient_columns:
                connection.execute(
                    text(f"ALTER TABLE patients ADD COLUMN {name} {ddl}")
                )
    if ENV == "dev":
        with SessionLocal() as db:
            seed_demo(db)
            seed_rfid_patients(db)
    realtime._loop = asyncio.get_running_loop()
    try:
        yield
    finally:
        realtime._loop = None


app = FastAPI(title="AYU-LINK API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(rfid.router)
app.include_router(hospitals.router)
app.include_router(cases.router)
app.include_router(messages.router)
app.include_router(voice.router)
app.include_router(hospital.router)
app.include_router(doctor.router)
app.include_router(admin.router)

# socketio_path=None: the mount already strips "/socket.io", so route the
# remaining scope to Socket.IO and let it dispatch on the Engine.IO query.
app.mount("/socket.io", socketio.ASGIApp(realtime.sio, socketio_path=None))

@app.get("/api/health")
def health():
    return {"status": "ok"}


if os.getenv("AYU_SERVE_FRONTEND", "false").lower() == "true":
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    index_file = frontend_dist / "index.html"
    if not index_file.is_file():
        raise RuntimeError("AYU_SERVE_FRONTEND is enabled, but frontend/dist/index.html is missing")

    @app.get("/", include_in_schema=False)
    def frontend_index():
        return FileResponse(index_file)

    @app.get("/{frontend_path:path}", include_in_schema=False)
    def frontend_route(frontend_path: str):
        if (
            frontend_path == "api"
            or frontend_path.startswith("api/")
            or frontend_path == "socket.io"
            or frontend_path.startswith("socket.io/")
        ):
            raise HTTPException(status_code=404)
        path = (frontend_dist / frontend_path).resolve()
        try:
            path.relative_to(frontend_dist.resolve())
        except ValueError as exc:
            raise HTTPException(status_code=404) from exc
        return FileResponse(path if path.is_file() else index_file)
