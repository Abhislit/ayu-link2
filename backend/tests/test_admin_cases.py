DEVICE_KEY = {"X-Device-Key": "dev-device-key-1"}


def login(client, email, password="ayu12345"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}


def scanned_case_id(client):
    res = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY)
    return res.json()["case"]["id"]


def test_only_admin_can_remove_all_cases(client):
    scanned_case_id(client)
    for email in ("driver@ayu.test", "hospital@ayu.test", "doctor@ayu.test"):
        res = client.delete("/api/admin/cases", headers=login(client, email))
        assert res.status_code == 403
    assert client.get("/api/admin/overview", headers=login(client, "admin@ayu.test")).json()["cases"] == 1


def test_admin_removes_every_case(client):
    first_case_id = scanned_case_id(client)
    admin = login(client, "admin@ayu.test")

    res = client.delete("/api/admin/cases", headers=admin)
    assert res.status_code == 200
    assert res.json()["cases"] == 1

    assert client.get("/api/admin/cases", headers=admin).json() == []
    assert client.get("/api/admin/overview", headers=admin).json()["cases"] == 0

    # scanning afterwards opens a fresh case (ids are reused once the table is empty)
    res = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY)
    assert res.status_code == 200
    assert res.json()["case"]["status"] == "open"
