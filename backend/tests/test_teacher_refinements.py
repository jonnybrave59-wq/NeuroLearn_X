from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import (
    Activity,
    CognitiveLoadPrediction,
    Assessment,
    AssessmentAttempt,
    AssessmentQuestion,
    Concept,
    InteractionLog,
    MentalEffortRating,
    PathwayRecommendation,
    PrerequisiteEdge,
    Question,
    StudentProfile,
    User,
)
from app.security import hash_password


def question_payload(concept_id: int, prompt: str) -> dict:
    return {
        "concept_id": concept_id,
        "prompt": prompt,
        "question_type": "Multiple choice",
        "correct_answer": "Correct",
        "explanation": "Verified explanation",
        "hint": "Review the concept",
        "difficulty": "Moderate",
        "cognitive_level": "Understand",
        "subject": "General Physics",
        "topic": "Teacher refinement test",
        "learning_competency": "Explain the tested relationship.",
        "choices": [
            {"text": "Correct", "is_correct": True},
            {"text": "Incorrect", "is_correct": False},
        ],
        "status": "Ready",
    }


def assessment_payload(question_id: int, title: str) -> dict:
    return {
        "title": title,
        "description": "Transactional deletion test",
        "subject": "General Physics",
        "topic": "Teacher refinement test",
        "question_ids": [question_id],
        "status": "Draft",
        "mastery_threshold": 0.75,
        "maximum_attempts": 1,
        "student_ids": [],
        "sections": [],
        "allow_retake": False,
    }


def test_concept_edit_updates_status_and_preserves_graph_relationships(teacher_client):
    existing = teacher_client.get("/api/teacher/concepts").json()[0]
    created = teacher_client.post(
        "/api/teacher/concepts",
        json={
            "code": "NX-EDIT",
            "name": "Editable concept",
            "description": "Original description",
            "subject": "General Physics",
            "difficulty": 2,
            "active": True,
        },
    )
    assert created.status_code == 201, created.text
    concept = created.json()
    edge = teacher_client.post(
        "/api/teacher/graph/edges",
        json={
            "prerequisite_concept_id": existing["id"],
            "succeeding_concept_id": concept["id"],
        },
    )
    assert edge.status_code == 201, edge.text
    updated = teacher_client.put(
        f"/api/teacher/concepts/{concept['id']}",
        json={
            "code": "nx-edit-2",
            "name": "Edited concept",
            "description": "Updated persisted description",
            "subject": "General Mathematics",
            "difficulty": 4,
            "active": False,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["code"] == "NX-EDIT-2"
    assert updated.json()["active"] is False
    assert updated.json()["difficulty"] == 4
    duplicate = teacher_client.put(
        f"/api/teacher/concepts/{concept['id']}",
        json={
            "code": existing["code"],
            "name": "Duplicate code",
            "description": "Must be rejected",
            "subject": "General Physics",
            "difficulty": 2,
            "active": True,
        },
    )
    assert duplicate.status_code == 409
    with SessionLocal() as db:
        relationship = db.get(PrerequisiteEdge, edge.json()["id"])
        assert relationship.prerequisite_concept_id == existing["id"]
        assert relationship.succeeding_concept_id == concept["id"]


def test_reported_load_and_deactivated_student_filtering(teacher_client, client):
    student = teacher_client.get(
        "/api/teacher/students", params={"search": "STEM001"}
    ).json()[0]
    reported = teacher_client.get(
        f"/api/teacher/students/{student['id']}/reported-cognitive-load"
    )
    assert reported.status_code == 200
    values = reported.json()
    assert values["history"]
    assert all(1 <= row["rating"] <= 9 for row in values["history"])
    assert values["average_rating"] == pytest.approx(
        sum(row["rating"] for row in values["history"]) / len(values["history"])
    )
    created = client.post(
        "/api/auth/register/student",
        json={
            "student_id": "DEACT401",
            "first_name": "Deactivate",
            "last_name": "Test",
            "email": "deact401@example.edu",
            "username": "deact401",
            "password": "Secure!Pass7",
            "confirm_password": "Secure!Pass7",
            "grade_level": "Grade 12",
            "section": "STEM A",
            "accept_terms": True,
        },
    )
    assert created.status_code == 201
    student_id = created.json()["student"]["id"]
    assert teacher_client.post(
        f"/api/teacher/students/{student_id}/actions", json={"action": "deactivate"}
    ).status_code == 200
    assert teacher_client.get(
        "/api/teacher/students", params={"search": "DEACT401"}
    ).json() == []
    shown = teacher_client.get(
        "/api/teacher/students",
        params={"search": "DEACT401", "include_deactivated": True},
    ).json()
    assert len(shown) == 1 and shown[0]["account_status"] == "Deactivated"
    dashboard = teacher_client.get("/api/teacher/dashboard").json()
    assert all(row["participant_code"] != "DEACT401" for row in dashboard["recent_students"])
    removed = teacher_client.post(
        f"/api/teacher/students/{student_id}/actions", json={"action": "remove"}
    )
    assert removed.status_code == 200 and removed.json()["deleted"] is True
    with SessionLocal() as db:
        assert db.get(User, student_id) is None


def test_question_and_assessment_hard_deletes_are_transactional(teacher_client):
    concept = teacher_client.get("/api/teacher/concepts?include_archived=false").json()[0]
    question = teacher_client.post(
        "/api/teacher/question-bank",
        json=question_payload(concept["id"], "Question dependency deletion title"),
    )
    assert question.status_code == 201, question.text
    assessment = teacher_client.post(
        "/api/teacher/assessments",
        json=assessment_payload(question.json()["id"], "Question dependency assessment"),
    )
    assert assessment.status_code == 201
    blocked = teacher_client.delete(f"/api/teacher/question-bank/{question.json()['id']}")
    assert blocked.status_code == 409 and "belongs to" in blocked.json()["detail"]
    deleted = teacher_client.delete(
        f"/api/teacher/question-bank/{question.json()['id']}",
        params={"detach_from_assessments": True},
    )
    assert deleted.status_code == 200
    with SessionLocal() as db:
        assert db.get(Question, question.json()["id"]) is None
        assert db.scalar(
            select(func.count(AssessmentQuestion.id)).where(
                AssessmentQuestion.assessment_id == assessment.json()["id"]
            )
        ) == 0
    assert teacher_client.delete(
        f"/api/teacher/assessments/{assessment.json()['id']}"
    ).status_code == 200

    with SessionLocal() as db:
        teacher = db.scalar(select(User).where(User.participant_code == "TEACHER01"))
        learner = db.scalar(select(User).where(User.participant_code == "STEM002"))
        concept_row = db.get(Concept, concept["id"])
        activity = Activity(
            title="Assessment with learner evidence",
            description="Deletion fixture",
            activity_type="Assessment",
            difficulty=2,
            estimated_minutes=10,
            instructions="Complete",
            active=True,
            is_demo=True,
        )
        db.add(activity)
        db.flush()
        linked = Assessment(
            title="Assessment evidence deletion",
            description="Deletion fixture",
            subject=concept_row.subject,
            topic=concept_row.name,
            status="Closed",
            mastery_threshold=0.75,
            maximum_attempts=1,
            created_by=teacher.id,
            activity_id=activity.id,
        )
        db.add(linked)
        db.flush()
        now = datetime.now(timezone.utc)
        attempt = AssessmentAttempt(
            student_id=learner.id,
            activity_id=activity.id,
            score=4,
            max_score=5,
            accuracy=0.8,
            started_at=now,
            submitted_at=now,
            total_seconds=300,
            is_demo=True,
        )
        db.add(attempt)
        db.flush()
        db.add_all([
            InteractionLog(
                student_id=learner.id,
                activity_id=activity.id,
                concept_id=concept_row.id,
                attempt_id=attempt.id,
                score=4,
                max_score=5,
                response_accuracy=0.8,
                average_response_seconds=60,
                total_completion_seconds=300,
                number_of_attempts=1,
                skipped_items=0,
                hint_usage_count=0,
                start_time=now,
                submission_time=now,
                is_demo=True,
            ),
            MentalEffortRating(
                student_id=learner.id,
                attempt_id=attempt.id,
                rating=4,
                category="Moderate",
                is_demo=True,
            ),
        ])
        db.commit()
        assessment_id, attempt_id, activity_id = linked.id, attempt.id, activity.id
    warning = teacher_client.delete(f"/api/teacher/assessments/{assessment_id}")
    assert warning.status_code == 409 and "learner attempt" in warning.json()["detail"]
    confirmed = teacher_client.delete(
        f"/api/teacher/assessments/{assessment_id}",
        params={"confirm_learner_record_deletion": True},
    )
    assert confirmed.status_code == 200
    with SessionLocal() as db:
        assert db.get(Assessment, assessment_id) is None
        assert db.get(AssessmentAttempt, attempt_id) is None
        assert db.get(Activity, activity_id).active is False


def test_activity_delete_bulk_archive_and_question_bulk_edit_are_persistent(teacher_client):
    concept = teacher_client.get("/api/teacher/concepts?include_archived=false").json()[0]
    activity_ids = []
    for title in ("Bulk activity one", "Bulk activity two"):
        created = teacher_client.post("/api/teacher/activities", json={
            "title": title,
            "description": "Persistent transactional activity fixture",
            "activity_type": "practice",
            "difficulty": 2,
            "estimated_minutes": 10,
            "instructions": "Complete the activity.",
            "concept_ids": [concept["id"]],
        })
        assert created.status_code == 201, created.text
        assert created.json()["dependencies"] == {
            "assigned_students": 0, "attempts": 0, "results": 0, "pathway_steps": 0
        }
        activity_ids.append(created.json()["id"])
    archived = teacher_client.post("/api/teacher/activities/bulk", json={
        "activity_ids": activity_ids, "action": "archive"
    })
    assert archived.status_code == 200 and archived.json()["archived"] == 2
    deleted = teacher_client.delete(
        "/api/teacher/activities/bulk-delete",
        params=[("activity_ids", value) for value in activity_ids],
    )
    assert deleted.status_code == 200, deleted.text
    with SessionLocal() as db:
        assert all(db.get(Activity, value) is None for value in activity_ids)

    first = teacher_client.post(
        "/api/teacher/question-bank",
        json=question_payload(concept["id"], "Bulk metadata question one"),
    ).json()
    second = teacher_client.post(
        "/api/teacher/question-bank",
        json=question_payload(concept["id"], "Bulk metadata question two"),
    ).json()
    prompts = {first["id"]: first["prompt"], second["id"]: second["prompt"]}
    edited = teacher_client.patch("/api/teacher/question-bank/bulk-edit", json={
        "question_ids": list(prompts),
        "difficulty": "Challenging",
        "status": "Draft",
        "cognitive_level": "Analyze",
        "learning_competency": "Analyze evidence using the shared competency.",
    })
    assert edited.status_code == 200, edited.text
    assert edited.json()["updated"] == 2
    assert all(item["prompt"] == prompts[item["id"]] for item in edited.json()["items"])
    assert all(item["difficulty"] == "Challenging" for item in edited.json()["items"])
    deleted_questions = teacher_client.delete(
        "/api/teacher/question-bank/bulk-delete",
        params=[("question_ids", value) for value in prompts],
    )
    assert deleted_questions.status_code == 200


def test_mathematics_material_is_identified_and_missing_ai_configuration_is_explicit(
    teacher_client, monkeypatch
):
    material = (
        b"Linear Equations\nLearning Objective: Solve a linear equation and verify the solution. "
        b"A linear equation uses a variable and equality. Example: solve 3x + 6 = 21 by "
        b"subtracting 6 from both sides, then divide by 3. The solution is x = 5."
    )
    uploaded = teacher_client.post(
        "/api/teacher/documents",
        files={"file": ("linear-equations.txt", material, "text/plain")},
    )
    assert uploaded.status_code == 201, uploaded.text
    document = uploaded.json()
    assert document["analysis"]["detected_subject"] == "Mathematics"
    assert document["analysis"]["formulas"]
    monkeypatch.delenv("AI_PROVIDER")
    monkeypatch.delenv("AI_MODEL")
    monkeypatch.delenv("AI_API_KEY")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    configuration = teacher_client.get("/api/teacher/ai/configuration")
    assert configuration.status_code == 200
    assert configuration.json()["configured"] is False
    concept = next(
        item for item in teacher_client.get("/api/teacher/concepts").json()
        if item["code"] == "GM-LE"
    )
    generated = teacher_client.post(
        f"/api/teacher/documents/{document['id']}/generate",
        json={
            "subject": "Mathematics",
            "grade_level": "Grade 12",
            "topic": "Linear Equations",
            "concept_id": concept["id"],
            "learning_competency": "Solve and verify linear equations.",
            "number_of_questions": 2,
            "question_type": "Problem solving",
            "difficulty": "Moderate",
            "cognitive_level": "Apply",
            "include_solutions": True,
            "source_grounding": True,
        },
    )
    assert generated.status_code == 503
    assert "AI question generation is not configured" in generated.json()["detail"]


def test_prediction_grouped_metrics_settings_and_pathway_rank(teacher_client):
    trained = teacher_client.post("/api/teacher/models/train?mode=demo")
    assert trained.status_code == 200, trained.text
    models = teacher_client.get("/api/teacher/models").json()
    active_model = next(row for row in models if row["active"] and row["is_demo"])
    assert active_model["metadata"]["algorithm"] == "Soft-voting ensemble"
    assert active_model["metadata"]["ensemble_members"]
    metrics = active_model["metrics"]
    assert metrics["group_leakage"] is False
    assert metrics["folds"] >= 2
    assert set(metrics["class_distribution"]) == {"Low", "Moderate", "High"}
    learner = teacher_client.get(
        "/api/teacher/students", params={"search": "STEM001"}
    ).json()[0]
    prediction = teacher_client.get(
        "/api/teacher/models/predict", params={"student_id": learner["id"]}
    )
    assert prediction.status_code == 200, prediction.text
    result = prediction.json()
    assert result["available"] is True
    assert sum(result["probabilities"].values()) == pytest.approx(1)
    assert result["category"] == max(result["probabilities"], key=result["probabilities"].get)
    assert result["expected_index"] == pytest.approx(
        0.5 * result["probabilities"]["Moderate"] + result["probabilities"]["High"]
    )
    assert result["evidence"]["mental_effort_rating"] is not None
    assert result["formula"]["probability_substitution"]
    assert result["prediction_id"]
    assert result["recommended_action"]
    history = teacher_client.get(
        "/api/teacher/models/predictions", params={"student_id": learner["id"]}
    )
    assert history.status_code == 200 and history.json()[0]["id"] == result["prediction_id"]
    with SessionLocal() as db:
        assert db.get(CognitiveLoadPrediction, result["prediction_id"]) is not None

    settings = teacher_client.get("/api/teacher/settings").json()
    settings.update({"alpha": 0.45, "beta": 0.35, "gamma": 0.20})
    saved = teacher_client.put("/api/teacher/settings", json=settings)
    assert saved.status_code == 200, saved.text
    with SessionLocal() as db:
        target = db.scalar(select(Concept).where(Concept.active.is_(True)))
        student = User(
            participant_code="RANK401",
            password_hash=hash_password("Secure!Pass7"),
            role="student",
            display_name="Ranking Test",
            must_change_password=False,
            is_active=True,
            is_demo=True,
            account_status="Active",
        )
        db.add(student)
        db.flush()
        db.add(StudentProfile(user_id=student.id, target_concept_id=target.id))
        low = PathwayRecommendation(
            student_id=student.id,
            target_concept_id=target.id,
            label="Incorrectly selected lower APS",
            selected=True,
            gap_coverage=0.8,
            predicted_cognitive_load=0.4,
            normalized_learning_time=0.5,
            adaptive_pathway_score=0.637,
            total_minutes=30,
            cognitive_load_category="Moderate",
            cognitive_load_probabilities={"Low": 0.2, "Moderate": 0.6, "High": 0.2},
            explanation="Lower candidate",
            feature_explanation={},
            decision_explanation={},
            active=True,
            is_demo=True,
        )
        high = PathwayRecommendation(
            student_id=student.id,
            target_concept_id=target.id,
            label="Highest APS candidate",
            selected=False,
            gap_coverage=1,
            predicted_cognitive_load=0.3,
            normalized_learning_time=0.2,
            adaptive_pathway_score=0.797,
            total_minutes=25,
            cognitive_load_category="Moderate",
            cognitive_load_probabilities={"Low": 0.3, "Moderate": 0.6, "High": 0.1},
            explanation="Highest candidate",
            feature_explanation={},
            decision_explanation={},
            active=True,
            is_demo=True,
        )
        db.add_all([low, high])
        db.commit()
        student_id, low_id, high_id = student.id, low.id, high.id
    compared = teacher_client.get(
        "/api/teacher/pathways", params={"student_id": student_id}
    )
    assert compared.status_code == 200
    rows = compared.json()
    assert rows[0]["id"] == high_id and rows[0]["selected"] is True and rows[0]["rank"] == 1
    assert next(row for row in rows if row["id"] == low_id)["selected"] is False
    assert sum(rows[0]["weighted_contributions"].values()) == pytest.approx(
        rows[0]["adaptive_pathway_score"]
    )
    assert teacher_client.delete(f"/api/teacher/pathways/{low_id}").status_code == 200
    with SessionLocal() as db:
        assert db.get(PathwayRecommendation, low_id) is None
