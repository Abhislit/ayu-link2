from app.config import DEMO_RESET_KEY
from app.database import SessionLocal
from app.models import EmergencyCase, Patient, User

KEY = {"X-Demo-Reset-Key": DEMO_RESET_KEY}
DEVICE = {"X-Device-Key": "dev-device-key-1"}


def counts():
    with SessionLocal() as db:
        return (
            db.query(User).count(),
            db.query(Patient).count(),
            db.query(EmergencyCase).count(),
        )


def test_reset_rejects_missing_key(client):
    assert client.post("/api/demo/reset").status_code == 403


def test_reset_rejects_wrong_key(client):
    assert client.post("/api/demo/reset", headers={"X-Demo-Reset-Key": "nope"}).status_code == 403


def test_reset_restores_seeded_data(client):
    scan = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE)
    assert scan.status_code == 200
    users, patients, cases = counts()
    assert cases == 1

    res = client.post("/api/demo/reset", headers=KEY)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "reset"

    users_after, patients_after, cases_after = counts()
    assert cases_after == 0
    assert body["users"] == users_after >= users
    assert body["patients"] == patients_after >= patients


def test_reset_is_idempotent(client):
    first = client.post("/api/demo/reset", headers=KEY)
    second = client.post("/api/demo/reset", headers=KEY)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["users"] == second.json()["users"]
    assert first.json()["patients"] == second.json()["patients"]
