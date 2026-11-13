DEVICE_KEY = {"X-Device-Key": "dev-device-key-1"}


def login(client, email, password="ayu12345"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}


def scanned_case_id(client):
    return client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY).json()[
        "case"
    ]["id"]


def test_hospitals_requires_ambulance_role(client):
    assert client.get("/api/hospitals").status_code == 401
    assert client.get("/api/hospitals", headers=login(client, "hospital@ayu.test")).status_code == 403
    res = client.get("/api/hospitals", headers=login(client, "driver@ayu.test"))
    assert res.status_code == 200
    assert {h["name"] for h in res.json()} >= {"City General", "St. Mary"}


def test_driver_case_detail_has_patient_and_records(client):
    case_id = scanned_case_id(client)
    res = client.get(f"/api/cases/{case_id}", headers=login(client, "driver@ayu.test"))
    assert res.status_code == 200
    body = res.json()
    assert body["patient"]["name"] == "Ravi Kumar"
    assert body["medical_record"]["summary"]
    assert body["ambulance"]["vehicle_number"] == "AMB-01"
    assert body["hospital"] is None


def test_ambulance_current_case(client):
    case_id = scanned_case_id(client)
    res = client.get("/api/ambulance/case", headers=login(client, "driver@ayu.test"))
    assert res.status_code == 200
    assert res.json()["id"] == case_id


def test_admin_can_read_any_case(client):
    case_id = scanned_case_id(client)
    res = client.get(
        f"/api/cases/{case_id}",
        headers=login(client, "admin@ayu.test"),
    )
    assert res.status_code == 200
    assert res.json()["patient"]["name"] == "Ravi Kumar"


def test_hospital_sees_case_only_after_assignment(client):
    case_id = scanned_case_id(client)
    headers = login(client, "hospital@ayu.test")

    assert client.get(f"/api/cases/{case_id}", headers=headers).status_code == 404

    res = client.post(
        f"/api/cases/{case_id}/hospital", json={"hospital_id": 1}, headers=login(client, "driver@ayu.test")
    )
    assert res.status_code == 200
    assert res.json()["status"] == "hospital_selected"
    assert res.json()["hospital_id"] == 1

    res = client.get(f"/api/cases/{case_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["case"]["status"] == "hospital_selected"


def test_hospital_selection_writes_event(client):
    from app.database import SessionLocal
    from app.models import CaseEvent

    case_id = scanned_case_id(client)
    client.post(
        f"/api/cases/{case_id}/hospital", json={"hospital_id": 2}, headers=login(client, "driver@ayu.test")
    )
    with SessionLocal() as db:
        event = (
            db.query(CaseEvent)
            .filter(CaseEvent.case_id == case_id, CaseEvent.kind == "hospital_selected")
            .first()
        )
        assert event is not None
        assert event.actor_id == 2


def test_hospital_selection_rejects_foreign_case(client):
    case_id = scanned_case_id(client)
    other = client.post(
        "/api/rfid/scans", json={"uid": "CARD-1001"}, headers={"X-Device-Key": "dev-device-key-2"}
    ).json()["case"]["id"]
    res = client.post(
        f"/api/cases/{other}/hospital", json={"hospital_id": 1}, headers=login(client, "driver@ayu.test")
    )
    assert res.status_code == 404
    assert case_id != other


def test_ambulance_can_update_and_hospital_can_read_movement_status(client):
    case_id = scanned_case_id(client)
    driver_headers = login(client, "driver@ayu.test")
    update = client.patch(
        f"/api/cases/{case_id}/ambulance-status",
        json={"status": "arrived"},
        headers=driver_headers,
    )
    assert update.status_code == 200
    assert update.json()["ambulance_status"] == "arrived"

    client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": 1},
        headers=driver_headers,
    )
    hospital_case = client.get(
        f"/api/cases/{case_id}",
        headers=login(client, "hospital@ayu.test"),
    ).json()["case"]
    assert hospital_case["ambulance_status"] == "arrived"


def test_only_assigned_ambulance_can_update_movement_status(client):
    case_id = scanned_case_id(client)
    hospital = client.patch(
        f"/api/cases/{case_id}/ambulance-status",
        json={"status": "arrived"},
        headers=login(client, "hospital@ayu.test"),
    )
    invalid = client.patch(
        f"/api/cases/{case_id}/ambulance-status",
        json={"status": "in a hurry"},
        headers=login(client, "driver@ayu.test"),
    )
    assert hospital.status_code == 403
    assert invalid.status_code == 422


def test_ambulance_status_update_preserves_case_acknowledgement(client):
    case_id = scanned_case_id(client)
    driver_headers = login(client, "driver@ayu.test")
    client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": 1},
        headers=driver_headers,
    )
    client.post(
        f"/api/cases/{case_id}/acknowledge",
        headers=login(client, "hospital@ayu.test"),
    )

    update = client.patch(
        f"/api/cases/{case_id}/ambulance-status",
        json={"status": "arrived"},
        headers=driver_headers,
    )
    assert update.status_code == 200
    assert update.json()["status"] == "acknowledged"


def test_doctor_can_close_case_after_acknowledgement_and_ambulance_arrival(client):
    case_id = scanned_case_id(client)
    driver = login(client, "driver@ayu.test")
    client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": 1},
        headers=driver,
    )
    client.post(
        f"/api/cases/{case_id}/acknowledge",
        headers=login(client, "hospital@ayu.test"),
    )
    early_close = client.post(
        f"/api/cases/{case_id}/close",
        headers=login(client, "doctor@ayu.test"),
    )
    assert early_close.status_code == 409

    client.patch(
        f"/api/cases/{case_id}/ambulance-status",
        json={"status": "arrived"},
        headers=driver,
    )

    res = client.post(
        f"/api/cases/{case_id}/close",
        headers=login(client, "doctor@ayu.test"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "closed"


def test_doctor_cannot_close_before_hospital_acknowledgement_and_arrival(client):
    case_id = scanned_case_id(client)
    driver = login(client, "driver@ayu.test")
    client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": 1},
        headers=driver,
    )

    res = client.post(
        f"/api/cases/{case_id}/close",
        headers=login(client, "doctor@ayu.test"),
    )
    assert res.status_code == 409
    assert "acknowledge" in res.json()["detail"]


def test_admin_can_close_case_without_handoff_prerequisites(client):
    case_id = scanned_case_id(client)
    res = client.post(
        f"/api/cases/{case_id}/close",
        headers=login(client, "admin@ayu.test"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "closed"


def test_scanning_patient_after_case_closes_opens_a_new_case(client):
    first_case_id = scanned_case_id(client)
    closed = client.post(
        f"/api/cases/{first_case_id}/close",
        headers=login(client, "admin@ayu.test"),
    )
    assert closed.status_code == 200

    next_case_id = scanned_case_id(client)
    assert next_case_id != first_case_id


def test_only_doctor_or_admin_can_close_case(client):
    case_id = scanned_case_id(client)
    for email in ("driver@ayu.test", "hospital@ayu.test"):
        res = client.post(
            f"/api/cases/{case_id}/close",
            headers=login(client, email),
        )
        assert res.status_code == 403


def test_ambulance_sets_emergency_category_for_hospital(client):
    case_id = scanned_case_id(client)
    driver_headers = login(client, "driver@ayu.test")
    update = client.patch(
        f"/api/cases/{case_id}/emergency-category",
        json={"category": "trauma"},
        headers=driver_headers,
    )
    assert update.status_code == 200
    assert update.json()["emergency_category"] == "trauma"

    client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": 1},
        headers=driver_headers,
    )
    hospital_case = client.get(
        f"/api/cases/{case_id}",
        headers=login(client, "hospital@ayu.test"),
    ).json()["case"]
    assert hospital_case["emergency_category"] == "trauma"
