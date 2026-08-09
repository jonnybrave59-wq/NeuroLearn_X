from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Activity, AnswerChoice, Question, StudentProfile, User


def registration_payload():
    return {
        "student_id": "ONB901",
        "first_name": "Onboarding",
        "last_name": "Learner",
        "email": "onboarding.learner@example.edu",
        "username": "onboarding.learner",
        "password": "Secure!Pass7",
        "confirm_password": "Secure!Pass7",
        "grade_level": "Grade 12",
        "section": "STEM O",
        "accept_terms": True,
    }


def test_new_learner_sees_onboarding_once_and_returning_demo_does_not(client):
    payload = registration_payload()
    created = client.post("/api/auth/register/student", json=payload)
    assert created.status_code == 201, created.text
    login = client.post(
        "/api/auth/login",
        json={
            "participant_code": payload["student_id"],
            "password": payload["password"],
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    dashboard = client.get("/api/student/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["onboarding"]["completed"] is False

    completed = client.post("/api/student/onboarding/complete")
    assert completed.status_code == 200
    assert completed.json()["completed"] is True
    completed_at = completed.json()["completed_at"]
    repeated = client.post("/api/student/onboarding/complete")
    assert repeated.status_code == 200
    assert repeated.json()["completed_at"] == completed_at
    assert client.get("/api/student/dashboard").json()["onboarding"]["completed"] is True

    client.post("/api/auth/logout")
    demo_login = client.post(
        "/api/auth/login",
        json={
            "participant_code": "STEM001",
            "password": "LearnX!2026",
            "expected_role": "student",
        },
    )
    assert demo_login.status_code == 200
    assert client.get("/api/student/dashboard").json()["onboarding"]["completed"] is True


def test_onboarding_diagnostic_has_exactly_30_mc_items_and_updates_results(client):
    payload = registration_payload()
    client.post("/api/auth/logout")
    login = client.post(
        "/api/auth/login",
        json={
            "participant_code": payload["student_id"],
            "password": payload["password"],
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    status = client.get("/api/student/onboarding-diagnostic")
    assert status.status_code == 200, status.text
    assert status.json()["item_count"] == 30
    activity_id = status.json()["activity_id"]
    activity = client.get(f"/api/student/activities/{activity_id}")
    assert activity.status_code == 200
    data = activity.json()
    assert data["is_onboarding_diagnostic"] is True
    assert len(data["questions"]) == 30
    assert all(item["question_type"] == "Multiple choice" for item in data["questions"])
    assert all(len(item["choices"]) >= 2 for item in data["questions"])

    responses = []
    with SessionLocal() as db:
        for index, item in enumerate(data["questions"]):
            choices = list(
                db.scalars(
                    select(AnswerChoice)
                    .where(AnswerChoice.question_id == item["id"])
                    .order_by(AnswerChoice.position)
                )
            )
            selected = (
                next(choice for choice in choices if choice.is_correct)
                if index % 2 == 0
                else next(choice for choice in choices if not choice.is_correct)
            )
            responses.append(
                {
                    "question_id": item["id"],
                    "selected_choice_id": selected.id,
                    "response_seconds": 20,
                    "hint_opened": False,
                    "skipped": False,
                    "answer_changes": 0,
                }
            )
    submitted = client.post(
        "/api/student/attempts",
        json={
            "activity_id": activity_id,
            "started_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
            "responses": responses,
        },
    )
    assert submitted.status_code == 201, submitted.text
    result = submitted.json()
    assert result["summary"]["questions_completed"] == 30
    assert result["summary"]["analysis_type"] == "NeuroLearn-X onboarding diagnostic analysis"
    rated = client.post(
        f"/api/student/attempts/{result['attempt_id']}/mental-effort",
        json={"rating": 5},
    )
    assert rated.status_code == 200, rated.text
    assert rated.json()["analysis_complete"] is True
    assert rated.json()["pathway_updated"] is True

    dashboard = client.get("/api/student/dashboard").json()
    assert dashboard["diagnostic"]["completed"] is True
    assert dashboard["diagnostic"]["analysis_complete"] is True
    assert dashboard["diagnostic"]["latest_result"]["cognitive_load_category"] == "Moderate"
    assert dashboard["mastery"]
    assert dashboard["gaps"]
    assert dashboard["target"] is not None
    assert dashboard["pathway"] is not None

    with SessionLocal() as db:
        activity_row = db.scalar(
            select(Activity).where(Activity.is_onboarding_diagnostic.is_(True))
        )
        assert activity_row.id == activity_id
        assert db.scalar(
            select(func.count(Question.id)).where(
                Question.activity_id == activity_id,
                Question.active.is_(True),
            )
        ) == 30
        user = db.scalar(select(User).where(User.participant_code == "ONB901"))
        profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == user.id))
        assert profile.onboarding_completed_at is not None
