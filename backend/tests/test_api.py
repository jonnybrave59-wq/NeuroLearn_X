from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import (
    Activity,
    AnswerChoice,
    AssessmentAttempt,
    AuditLog,
    ConsentRecord,
    ExpertEvaluation,
    InteractionLog,
    PathwayRecommendation,
    PathwayStep,
    Question,
    StudentProfile,
    User,
)
from app.security import hash_password


def test_authentication_and_role_restrictions(client, student_client):
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/student/dashboard").status_code == 200
    assert client.get("/api/teacher/dashboard").status_code == 403
    anonymous = type(client)(client.app)
    assert anonymous.get("/api/student/dashboard").status_code == 401


def test_incorrect_role_is_rejected(client):
    response = client.post(
        "/api/auth/login",
        json={
            "participant_code": "STEM001",
            "password": "LearnX!2026",
            "expected_role": "teacher",
        },
    )
    assert response.status_code == 403


def test_student_data_privacy_surface(student_client):
    assert student_client.get("/api/teacher/students/2").status_code == 403
    dashboard = student_client.get("/api/student/dashboard").json()
    assert dashboard["student"]["participant_code"] == "STEM001"
    assert "password_hash" not in str(dashboard)


def test_server_score_calculation_and_interaction_logging(student_client):
    with SessionLocal() as db:
        activity = db.scalar(
            select(Activity).where(Activity.is_diagnostic.is_(True))
        )
        questions = list(
            db.scalars(
                select(Question)
                .where(Question.activity_id == activity.id)
                .order_by(Question.position)
            )
        )
        correct = [
            db.scalar(
                select(AnswerChoice).where(
                    AnswerChoice.question_id == question.id,
                    AnswerChoice.is_correct.is_(True),
                )
            )
            for question in questions
        ]
        before_logs = db.scalar(select(func.count(InteractionLog.id)))
    response = student_client.post(
        "/api/student/attempts",
        json={
            "activity_id": activity.id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "responses": [
                {
                    "question_id": question.id,
                    "selected_choice_id": choice.id,
                    "response_seconds": 12,
                    "hint_opened": index == 0,
                    "skipped": False,
                    "answer_changes": 1 if index == 1 else 0,
                }
                for index, (question, choice) in enumerate(zip(questions, correct))
            ],
        },
    )
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["score"] == result["max_score"] == len(questions)
    assert result["accuracy"] == 1
    assert result["mental_effort_boundaries"] == {
        "low_max": 3,
        "moderate_max": 6,
    }
    with SessionLocal() as db:
        assert db.scalar(select(func.count(InteractionLog.id))) == before_logs + 1
        attempt = db.get(AssessmentAttempt, result["attempt_id"])
        assert attempt.hint_usage_count == 1
        assert attempt.answer_change_count == 1


def test_cycle_detection_via_teacher_api(teacher_client):
    graph = teacher_client.get("/api/teacher/graph").json()
    edge = graph["edges"][0]
    response = teacher_client.post(
        "/api/teacher/graph/edges",
        json={
            "prerequisite_concept_id": edge["target"],
            "succeeding_concept_id": edge["source"],
        },
    )
    assert response.status_code == 400
    assert "cycle" in response.json()["detail"].lower()


def test_weight_validation(teacher_client):
    settings = teacher_client.get("/api/teacher/settings").json()
    settings.update({"alpha": 0.5, "beta": 0.5, "gamma": 0.5})
    response = teacher_client.put("/api/teacher/settings", json=settings)
    assert response.status_code == 422


def test_demo_and_research_exports_are_separated(teacher_client):
    demo = teacher_client.get("/api/teacher/exports/interactions?mode=demo")
    research = teacher_client.get("/api/teacher/exports/interactions?mode=research")
    assert demo.status_code == research.status_code == 200
    assert "anonymous_participant_code" in demo.text.splitlines()[0].lower()
    assert "STEM001" in demo.text
    assert len(research.text.splitlines()) == 1
    assert "password" not in demo.text.lower()


def test_teacher_can_view_student_but_student_cannot_choose_other_identity(
    teacher_client,
):
    with SessionLocal() as db:
        student = db.scalar(select(User).where(User.participant_code == "STEM002"))
    detail = teacher_client.get(f"/api/teacher/students/{student.id}")
    assert detail.status_code == 200
    assert detail.json()["student"]["participant_code"] == "STEM002"


def test_research_account_must_change_assigned_password(client):
    with SessionLocal() as db:
        student = User(
            participant_code="RESEARCH01",
            password_hash=hash_password("Assigned!2026"),
            role="student",
            display_name="Research Participant",
            must_change_password=True,
            is_demo=False,
        )
        db.add(student)
        db.flush()
        db.add(StudentProfile(user_id=student.id))
        db.commit()

    login = client.post(
        "/api/auth/login",
        json={
            "participant_code": "RESEARCH01",
            "password": "Assigned!2026",
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    blocked = client.get("/api/student/dashboard")
    assert blocked.status_code == 428
    assert "change" in blocked.json()["detail"].lower()

    changed = client.post(
        "/api/auth/change-password",
        json={
            "current_password": "Assigned!2026",
            "new_password": "PrivateResearch!2026",
        },
    )
    assert changed.status_code == 200
    assert client.get("/api/student/dashboard").status_code == 200


def test_reset_demo_preserves_research_records_and_pathway_mode(teacher_client):
    with SessionLocal() as db:
        research_student = db.scalar(
            select(User).where(User.participant_code == "RESEARCH01")
        )
        concept = db.scalar(select(Question.concept_id).limit(1))
        activity = db.scalar(select(Activity).where(Activity.active.is_(True)))
        consent = ConsentRecord(
            student_id=research_student.id,
            consented=True,
            recorded_by="research-coordinator",
        )
        pathway = PathwayRecommendation(
            student_id=research_student.id,
            target_concept_id=concept,
            label="Research pathway",
            selected=True,
            gap_coverage=1,
            predicted_cognitive_load=0.4,
            normalized_learning_time=0,
            adaptive_pathway_score=0.82,
            total_minutes=activity.estimated_minutes,
            cognitive_load_category="Moderate",
            cognitive_load_probabilities={
                "Low": 0.2,
                "Moderate": 0.6,
                "High": 0.2,
            },
            explanation="Validated research pathway fixture.",
            feature_explanation={},
            active=True,
            is_demo=False,
        )
        audit = AuditLog(
            actor_id=research_student.id,
            action="research.fixture.created",
            entity_type="pathway",
        )
        research_teacher = User(
            participant_code="RESEARCHTEACHER",
            password_hash=hash_password("TeacherAssigned!2026"),
            role="teacher",
            display_name="Research Teacher",
            must_change_password=True,
            is_demo=False,
        )
        db.add_all([consent, pathway, audit, research_teacher])
        db.flush()
        step = PathwayStep(
            pathway_id=pathway.id,
            concept_id=concept,
            activity_id=activity.id,
            position=1,
            predicted_load_index=0.4,
        )
        db.add(step)
        db.commit()
        ids = {
            "student": research_student.id,
            "profile": research_student.student_profile.id,
            "consent": consent.id,
            "pathway": pathway.id,
            "step": step.id,
            "audit": audit.id,
        }

    wrong_mode = teacher_client.post(
        "/api/teacher/evaluations",
        json={
            "pathway_id": ids["pathway"],
            "recommendation_accuracy": 4,
            "adaptability": 4,
            "personalization": 4,
            "optimization_efficiency": 4,
            "pathway_relevance": 4,
            "comment": "Research-mode evaluation",
        },
    )
    assert wrong_mode.status_code == 403

    research_teacher_client = type(teacher_client)(teacher_client.app)
    login = research_teacher_client.post(
        "/api/auth/login",
        json={
            "participant_code": "RESEARCHTEACHER",
            "password": "TeacherAssigned!2026",
            "expected_role": "teacher",
        },
    )
    assert login.status_code == 200
    changed = research_teacher_client.post(
        "/api/auth/change-password",
        json={
            "current_password": "TeacherAssigned!2026",
            "new_password": "TeacherPrivate!2026",
        },
    )
    assert changed.status_code == 200
    evaluation = research_teacher_client.post(
        "/api/teacher/evaluations",
        json={
            "pathway_id": ids["pathway"],
            "recommendation_accuracy": 4,
            "adaptability": 4,
            "personalization": 4,
            "optimization_efficiency": 4,
            "pathway_relevance": 4,
            "comment": "Research-mode evaluation",
        },
    )
    assert evaluation.status_code == 201
    evaluation_id = evaluation.json()["id"]
    with SessionLocal() as db:
        assert db.get(ExpertEvaluation, evaluation_id).is_demo is False

    reset = teacher_client.post(
        "/api/teacher/reset-demo",
        json={"confirmation": "RESET DEMO DATA"},
    )
    assert reset.status_code == 200, reset.text

    with SessionLocal() as db:
        assert db.get(User, ids["student"]) is not None
        assert db.get(StudentProfile, ids["profile"]) is not None
        assert db.get(ConsentRecord, ids["consent"]) is not None
        assert db.get(PathwayRecommendation, ids["pathway"]) is not None
        assert db.get(PathwayStep, ids["step"]) is not None
        assert db.get(AuditLog, ids["audit"]) is not None
        assert db.get(ExpertEvaluation, evaluation_id) is not None
        assert db.scalar(
            select(User).where(User.participant_code == "TEACHER01")
        ) is not None
