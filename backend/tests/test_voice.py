import math
import struct
import wave
from io import BytesIO

from app.database import SessionLocal
from app.models import User
from app.security import hash_password

DEVICE_KEY = {"X-Device-Key": "dev-device-key-1"}
WEBM = ("note.webm", b"\x1aE\xdf\xa3fake-opus-bytes", "audio/webm;codecs=opus")


def login(client, email, password="ayu12345"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}


def make_case(client, hospital_id=1):
    case_id = client.post("/api/rfid/scans", json={"uid": "CARD-1001"}, headers=DEVICE_KEY).json()[
        "case"
    ]["id"]
    res = client.post(
        f"/api/cases/{case_id}/hospital",
        json={"hospital_id": hospital_id},
        headers=login(client, "driver@ayu.test"),
    )
    assert res.status_code == 200
    return case_id


def upload(client, case_id, headers, file=WEBM, duration="12"):
    return client.post(
        f"/api/cases/{case_id}/messages/voice",
        files={"file": file},
        data={"duration_seconds": duration},
        headers=headers,
    )


def wav_test_tone():
    sample_rate = 8000
    samples = (
        struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / sample_rate)))
        for i in range(sample_rate)
    )
    output = BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(b"".join(samples))
    return output.getvalue()


def test_voice_message_uploaded(client):
    case_id = make_case(client)
    res = upload(client, case_id, login(client, "driver@ayu.test"))
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "voice"
    assert body["duration_seconds"] == 12
    assert body["sender_role"] == "ambulance_driver"
    assert body["ack_status"] == "sent"

    listed = client.get(f"/api/cases/{case_id}/messages", headers=login(client, "driver@ayu.test"))
    assert any(m["kind"] == "voice" for m in listed.json())


def test_voice_wrong_mime_rejected(client):
    case_id = make_case(client)
    res = upload(
        client,
        case_id,
        login(client, "driver@ayu.test"),
        file=("note.txt", b"hello", "text/plain"),
    )
    assert res.status_code == 415


def test_voice_too_large_rejected(client):
    case_id = make_case(client)
    big = ("big.webm", b"0" * (11 * 1024 * 1024), "audio/webm")
    res = upload(client, case_id, login(client, "driver@ayu.test"), file=big)
    assert res.status_code == 413


def test_voice_duration_over_limit_rejected(client):
    case_id = make_case(client)
    res = upload(client, case_id, login(client, "driver@ayu.test"), duration="121")
    assert res.status_code == 400


def test_voice_audio_streams_back(client):
    case_id = make_case(client)
    headers = login(client, "driver@ayu.test")
    tone = wav_test_tone()
    message = upload(
        client,
        case_id,
        headers,
        file=("test-tone.wav", tone, "audio/wav"),
        duration="1",
    ).json()

    res = client.get(f"/api/cases/{case_id}/messages/{message['id']}/audio", headers=headers)
    assert res.status_code == 200
    assert res.content == tone
    assert res.headers["content-type"].startswith("audio/wav")


def test_voice_requires_auth(client):
    case_id = make_case(client)
    assert upload(client, case_id, {}).status_code == 401


def test_voice_foreign_hospital_forbidden(client):
    case_id = make_case(client, hospital_id=1)
    with SessionLocal() as db:
        db.add(
            User(
                name="St Mary ER",
                email="mary@ayu.test",
                password_hash=hash_password("ayu12345"),
                role="hospital_staff",
                hospital_id=2,
            )
        )
        db.commit()

    res = upload(client, case_id, login(client, "mary@ayu.test"))
    assert res.status_code == 403


def test_doctor_cannot_send_voice_reply(client):
    case_id = make_case(client, hospital_id=1)
    res = upload(client, case_id, login(client, "doctor@ayu.test"))
    assert res.status_code == 403
