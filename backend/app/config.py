import os
from datetime import timedelta
from pathlib import Path

ENV = os.getenv("AYU_ENV", "dev")
DATABASE_URL = os.getenv("AYU_DATABASE_URL", "sqlite:///./ayu.db")
SECRET = os.getenv("AYU_SECRET")
if not SECRET:
    if ENV != "dev":
        raise RuntimeError("AYU_SECRET must be set outside the development environment")
    SECRET = "dev-insecure-secret-change-me"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "AYU_CORS_ORIGIN",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
STORAGE_DIR = Path(
    os.getenv("AYU_STORAGE_DIR", str(Path(__file__).resolve().parent.parent / "storage"))
)
TOKEN_TTL = timedelta(hours=12)
DEMO_RESET_KEY = os.getenv("AYU_DEMO_RESET_KEY", "")
