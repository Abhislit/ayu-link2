DEVICE_KEY = {"X-Device-Key": "dev-device-key-1"}


def test_known_uid_returns_patient_record_and_case(client):
    res = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY)
    assert res.status_code == 200
    body = res.json()
    assert body["card_uid"] == "CARD-1001"
    assert body["patient"]["name"] == "Ravi Kumar"
    assert "Penicillin" in body["patient"]["allergies"]
    assert body["medical_record"]["summary"]
    assert body["case"]["id"] > 0
    assert body["case"]["status"] == "open"
    assert body["case"]["ambulance_id"] == 1


def test_rescan_reuses_open_case(client):
    first = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY).json()
    second = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY).json()
    assert first["case"]["id"] == second["case"]["id"]


def test_unknown_uid_is_404(client):
    res = client.post("/api/rfid/scans", json={"uid": "CARD-NOPE"}, headers=DEVICE_KEY)
    assert res.status_code == 404


def test_physical_card_uids_map_to_distinct_patients(client):
    from app.database import SessionLocal
    from app.seed import RFID_PATIENTS, seed_rfid_patients

    with SessionLocal() as db:
        seed_rfid_patients(db)

    patient_ids = set()
    for uid, expected_name, *_ in RFID_PATIENTS:
        res = client.post("/api/rfid/scans", json={"uid": uid}, headers=DEVICE_KEY)
        assert res.status_code == 200
        patient = res.json()["patient"]
        assert patient["name"] == expected_name
        patient_ids.add(patient["id"])

    assert len(patient_ids) == len(RFID_PATIENTS)


def test_inactive_card_is_404(client):
    from app.database import SessionLocal
    from app.models import Patient, RfidCard

    with SessionLocal() as db:
        patient_id = db.query(Patient).first().id
        db.add(RfidCard(uid="CARD-DEAD", patient_id=patient_id, active=False))
        db.commit()

    res = client.post("/api/rfid/scans", json={"uid": "CARD-DEAD"}, headers=DEVICE_KEY)
    assert res.status_code == 404


def test_bad_device_key_is_401(client):
    res = client.post(
        "/api/rfid/scans", json={"uid": "CARD-1001"}, headers={"X-Device-Key": "wrong"}
    )
    assert res.status_code == 401


def test_missing_device_key_is_401(client):
    res = client.post("/api/rfid/scans", json={"uid": "CARD-1001"})
    assert res.status_code == 401


def test_authenticated_ambulance_can_simulate_scan(client):
    token = client.post(
        "/api/auth/login", json={"email": "driver@ayu.test", "password": "ayu12345"}
    ).json()["token"]
    res = client.post(
        "/api/rfid/demo-scans",
        json={"uid": "CARD-1001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["patient"]["name"] == "Ravi Kumar"


def test_demo_scan_is_ambulance_only(client):
    token = client.post(
        "/api/auth/login", json={"email": "hospital@ayu.test", "password": "ayu12345"}
    ).json()["token"]
    res = client.post(
        "/api/rfid/demo-scans",
        json={"uid": "CARD-1001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_authenticated_ambulance_staff_can_simulate_scan(client):
    token = client.post(
        "/api/auth/login", json={"email": "staff@ayu.test", "password": "ayu12345"}
    ).json()["token"]
    res = client.post(
        "/api/rfid/demo-scans",
        json={"uid": "CARD-1001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["case"]["ambulance_id"] == 1
