from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import (
    Activity,
    ActivityConcept,
    AnswerChoice,
    LearningSummary,
    MisconceptionHistory,
    PathwayVersion,
    Question,
    TutoringSession,
)


def test_recommendation_explanation_is_structured_and_versioned(student_client):
    response = student_client.get("/api/student/pathways")
    assert response.status_code == 200
    selected = next(item for item in response.json() if item["selected"])
    decision = selected["decision_explanation"]
    assert decision["mastery_threshold"] == 0.75
    assert decision["target_competency"]["name"]
    assert decision["prerequisite_chain"]
    assert decision["cognitive_load"]["category"] in {"Low", "Moderate", "High"}
    assert decision["estimated_time_minutes"] >= 0
    assert decision["adaptive_pathway_score"] == selected["adaptive_pathway_score"]
    assert decision["confidence"]["level"] in {"Low", "Moderate", "High"}
    assert decision["alternatives_not_selected"]
    assert selected["versions"]
    with SessionLocal() as db:
        assert db.scalar(select(func.count(PathwayVersion.id))) > 0


def test_repeated_validated_misconception_changes_support_and_pauses(student_client):
    with SessionLocal() as db:
        activity = db.scalar(
            select(Activity)
            .join(ActivityConcept, ActivityConcept.activity_id == Activity.id)
            .where(
                Activity.title == "Algebraic Expressions Guided Lab",
                Activity.active.is_(True),
            )
        )
        activity_id = activity.id
    started = student_client.post(
        "/api/student/tutoring-sessions",
        json={"activity_id": activity_id, "mode": "guided"},
    )
    assert started.status_code == 201, started.text
    session = started.json()
    observed = []
    result = None
    for _ in range(10):
        question_id = session["question"]["id"]
        with SessionLocal() as db:
            mapped = db.scalar(
                select(AnswerChoice).where(
                    AnswerChoice.question_id == question_id,
                    AnswerChoice.misconception_id.is_not(None),
                    AnswerChoice.mapping_status.in_(["Teacher reviewed", "Validated"]),
                )
            )
            correct = db.scalar(
                select(AnswerChoice).where(
                    AnswerChoice.question_id == question_id,
                    AnswerChoice.is_correct.is_(True),
                )
            )
        choice = mapped or correct
        answered = student_client.post(
            f"/api/student/tutoring-sessions/{session['id']}/responses",
            json={
                "question_id": question_id,
                "selected_choice_id": choice.id,
                "response_seconds": 8,
                "hint_opened": False,
                "answer_changes": 0,
            },
        )
        assert answered.status_code == 200, answered.text
        body = answered.json()
        if body["feedback"].get("misconception"):
            observed.append(body["feedback"]["misconception"])
        if body["completed"]:
            result = body["result"]
            break
        session = body["session"]
        if len(observed) == 2:
            assert session["scaffolding_level"] >= 2
            assert session["current_difficulty"] == "Easy"
    assert result is not None
    assert len(observed) == 3
    assert observed[-1]["pattern_confidence"] == "High"
    with SessionLocal() as db:
        stored = db.get(TutoringSession, session["id"])
        assert stored.status == "Paused"
        assert stored.stop_reason == "Repeated misconception requires remediation"
        assert db.scalar(
            select(func.count(MisconceptionHistory.id)).where(
                MisconceptionHistory.tutoring_session_id == stored.id
            )
        ) == 3
        summary = db.scalar(
            select(LearningSummary).where(
                LearningSummary.tutoring_session_id == stored.id
            )
        )
        assert summary.summary["misconceptions"][0]["evidence_count"] == 3


def test_unsupported_wrong_choice_is_not_diagnosed(student_client):
    with SessionLocal() as db:
        question = db.scalar(
            select(Question)
            .join(AnswerChoice, AnswerChoice.question_id == Question.id)
            .where(
                Question.activity_id.is_not(None),
                AnswerChoice.is_correct.is_(False),
                AnswerChoice.misconception_id.is_(None),
            )
            .order_by(Question.id)
        )
        activity = db.get(Activity, question.activity_id)
        questions = list(
            db.scalars(
                select(Question)
                .where(Question.activity_id == activity.id, Question.active.is_(True))
                .order_by(Question.position)
            )
        )
        choices = []
        unsupported_question_id = None
        for row in questions:
            unsupported = db.scalar(
                select(AnswerChoice).where(
                    AnswerChoice.question_id == row.id,
                    AnswerChoice.is_correct.is_(False),
                    AnswerChoice.misconception_id.is_(None),
                )
            )
            selected = unsupported or db.scalar(
                select(AnswerChoice).where(
                    AnswerChoice.question_id == row.id,
                    AnswerChoice.is_correct.is_(True),
                )
            )
            if unsupported:
                unsupported_question_id = row.id
            choices.append((row.id, selected.id))
    response = student_client.post(
        "/api/student/attempts",
        json={
            "activity_id": activity.id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "responses": [
                {
                    "question_id": question_id,
                    "selected_choice_id": choice_id,
                    "response_seconds": 5,
                    "hint_opened": False,
                    "skipped": False,
                    "answer_changes": 0,
                }
                for question_id, choice_id in choices
            ],
        },
    )
    assert response.status_code == 201, response.text
    item = next(
        item for item in response.json()["items"]
        if item["question_id"] == unsupported_question_id
    )
    assert item["correct"] is False
    assert item["misconception"] is None
    assert "no teacher-reviewed distractor mapping" in item["diagnostic_note"].lower()


def test_teacher_can_review_misconceptions_and_store_intervention(teacher_client):
    rules = teacher_client.get("/api/teacher/misconceptions")
    assert rules.status_code == 200
    rule = rules.json()[0]
    students = teacher_client.get("/api/teacher/students").json()
    student = students[0]
    response = teacher_client.post(
        "/api/teacher/interventions",
        json={
            "student_id": student["id"],
            "concept_id": rule["concept_id"],
            "misconception_id": rule["id"],
            "assigned_activity_id": rule["suggested_activity_id"],
            "action_type": "Assign remediation",
            "note": "Use the teacher-reviewed scaffold and reassess with a different item.",
        },
    )
    assert response.status_code == 201, response.text
    detail = teacher_client.get(f"/api/teacher/students/{student['id']}").json()
    assert any(
        item["id"] == response.json()["id"]
        for item in detail["interventions"]
    )
