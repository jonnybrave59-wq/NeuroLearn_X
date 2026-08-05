from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB = Path(__file__).resolve().parents[1] / "test_neurolearnx.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["CREATE_TABLES_ON_STARTUP"] = "1"
os.environ["SECRET_KEY"] = "test-secret-only"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_database  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_database():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db, train_model=False)
    yield
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def student_client(client):
    response = client.post(
        "/api/auth/login",
        json={
            "participant_code": "STEM001",
            "password": "LearnX!2026",
            "expected_role": "student",
        },
    )
    assert response.status_code == 200
    return client


@pytest.fixture()
def teacher_client(client):
    response = client.post(
        "/api/auth/login",
        json={
            "participant_code": "TEACHER01",
            "password": "NeuroTeach!2026",
            "expected_role": "teacher",
        },
    )
    assert response.status_code == 200
    return client

