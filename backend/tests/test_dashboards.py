DEVICE_KEY = {"X-Device-Key": "dev-device-key-1"}


def login(client, email, password="ayu12345"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}


def scanned_case(client, uid="CARD-1001"):
    return client.post("/api/rfid/scans", json={"uid": uid}, headers=DEVICE_KEY).json()["case"]["id"]


def assigned_case(client, hospital_id=1):
    case_id = scanned_case(client)
    res = client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": hospital_id},
        headers=login(client, "driver@ayu.test"),
    )
    assert res.status_code == 200
    return case_id


def make_case(hospital_id, ambulance_id=2):
    from app.database import SessionLocal
    from app.models import EmergencyCase

    with SessionLocal() as db:
        case = EmergencyCase(
            patient_id=1,
            ambulance_id=ambulance_id,
            hospital_id=hospital_id,
            priority="high",
            status="hospital_selected",
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        return case.id


def test_hospital_list_requires_hospital_role(client):
    assert client.get("/api/hospital/cases").status_code == 401
    assert client.get("/api/hospital/cases", headers=login(client, "driver@ayu.test")).status_code == 403
    assert client.get("/api/hospital/cases", headers=login(client, "admin@ayu.test")).status_code == 403


def test_hospital_list_only_own_assigned_cases(client):
    other = make_case(hospital_id=2)
    own = assigned_case(client, hospital_id=1)

    res = client.get("/api/hospital/cases", headers=login(client, "hospital@ayu.test"))
    assert res.status_code == 200
    ids = [row["id"] for row in res.json()]
    assert own in ids
    assert other not in ids
    row = next(row for row in res.json() if row["id"] == own)
    assert row["patient"]["name"] == "Ravi Kumar"
    assert row["hospital_id"] == 1


def test_hospital_list_newest_first(client):
    first = assigned_case(client)
    second = make_case(hospital_id=1)

    res = client.get("/api/hospital/cases", headers=login(client, "hospital@ayu.test"))
    ids = [row["id"] for row in res.json()]
    assert ids == sorted(ids, reverse=True)
    assert ids.index(second) < ids.index(first)


def test_doctor_list_matches_hospital_scope(client):
    other = make_case(hospital_id=2)
    own = assigned_case(client, hospital_id=1)

    res = client.get("/api/doctor/cases", headers=login(client, "doctor@ayu.test"))
    assert res.status_code == 200
    ids = [row["id"] for row in res.json()]
    assert own in ids
    assert other not in ids
    assert client.get("/api/doctor/cases", headers=login(client, "driver@ayu.test")).status_code == 403


def test_admin_lists_have_no_secrets(client):
    headers = login(client, "admin@ayu.test")
    users = client.get("/api/admin/users", headers=headers)
    assert users.status_code == 200
    assert users.json()
    assert all("password_hash" not in row for row in users.json())

    patients = client.get("/api/admin/patients", headers=headers)
    assert patients.status_code == 200
    assert [row["name"] for row in patients.json()] == ["Ravi Kumar"]
    assert all("allergies" not in row and "conditions" not in row for row in patients.json())

    assert client.get("/api/admin/hospitals", headers=headers).status_code == 200
    assert client.get("/api/admin/ambulances", headers=headers).status_code == 200


def test_admin_endpoints_require_admin(client):
    headers = login(client, "driver@ayu.test")
    for path in ("/api/admin/overview", "/api/admin/users", "/api/admin/patients"):
        assert client.get(path, headers=headers).status_code == 403


def test_admin_overview_counts_match_seed(client):
    res = client.get("/api/admin/overview", headers=login(client, "admin@ayu.test"))
    assert res.status_code == 200
    assert res.json() == {
        "users": 5,
        "hospitals": 2,
        "ambulances": 2,
        "patients": 1,
        "cases": 0,
    }


def test_admin_can_list_read_and_update_any_case(client):
    case_id = scanned_case(client)
    admin = login(client, "admin@ayu.test")

    cases = client.get("/api/admin/cases", headers=admin)
    assert cases.status_code == 200
    assert any(row["id"] == case_id and row["patient"]["name"] == "Ravi Kumar" for row in cases.json())

    detail = client.get(f"/api/admin/cases/{case_id}", headers=admin)
    assert detail.status_code == 200
    assert detail.json()["medical_record"]["summary"]

    update = client.patch(
        f"/api/admin/cases/{case_id}",
        json={
            "hospital_id": 2,
            "status": "hospital_selected",
            "priority": "critical",
            "emergency_category": "respiratory",
            "ambulance_status": "arrived",
            "prep_status": "ready",
        },
        headers=admin,
    )
    assert update.status_code == 200
    assert update.json()["hospital_id"] == 2
    assert update.json()["status"] == "hospital_selected"
    assert update.json()["priority"] == "critical"
    assert update.json()["emergency_category"] == "respiratory"
    assert update.json()["ambulance_status"] == "arrived"
    assert update.json()["prep_status"] == "ready"


def test_admin_case_updates_validate_hospital_and_fields(client):
    case_id = scanned_case(client)
    admin = login(client, "admin@ayu.test")

    invalid_hospital = client.patch(
        f"/api/admin/cases/{case_id}",
        json={"hospital_id": 999},
        headers=admin,
    )
    invalid_status = client.patch(
        f"/api/admin/cases/{case_id}",
        json={"status": "not-a-status"},
        headers=admin,
    )
    assert invalid_hospital.status_code == 404
    assert invalid_status.status_code == 422
