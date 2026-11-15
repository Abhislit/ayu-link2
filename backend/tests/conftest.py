import os
import tempfile

os.environ["AYU_ENV"] = "test"
os.environ["AYU_DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["AYU_SECRET"] = "test-secret"
os.environ["AYU_STORAGE_DIR"] = tempfile.mkdtemp()
os.environ["AYU_DEMO_RESET_KEY"] = "test-reset-key"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def fresh_db(client):
    from app.database import Base, SessionLocal, engine
    from app.seed import seed_demo

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo(db)
    yield
