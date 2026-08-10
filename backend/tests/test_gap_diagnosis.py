from sqlalchemy import select

from app.database import SessionLocal
from app.models import GapDiagnosis, User


def test_student_graph_uses_evidence_states_and_saves_gap_diagnosis(student_client):
    graph_response = student_client.get("/api/student/graph")
    assert graph_response.status_code == 200
    graph = graph_response.json()
    assert graph["nodes"]
    assert all(node["state"] in {"mastered", "gap", "target", "unassessed"} for node in graph["nodes"])
    assert all(node["state"] == "gap" for node in graph["nodes"] if node["is_gap"])

    gap = next(node for node in graph["nodes"] if node["state"] == "gap")
    response = student_client.post(f"/api/student/graph/gaps/{gap['id']}/diagnosis", json={})
    assert response.status_code == 200, response.text
    diagnosis = response.json()
    assert diagnosis["selected_learning_gap"]["concept_id"] == gap["id"]
    assert diagnosis["evidence"]["mastery_score"] == gap["mastery_score"]
    assert diagnosis["evidence"]["latest_evidence_date"]
    assert diagnosis["status"] in {"reliable", "insufficient"}
    if diagnosis["status"] == "insufficient":
        assert diagnosis["message"] == "Not enough learner evidence for a reliable diagnosis."

    with SessionLocal() as db:
        student = db.scalar(select(User).where(User.participant_code == "STEM001"))
        stored = db.scalar(
            select(GapDiagnosis)
            .where(
                GapDiagnosis.student_id == student.id,
                GapDiagnosis.concept_id == gap["id"],
            )
            .order_by(GapDiagnosis.created_at.desc())
        )
        assert stored is not None
        assert stored.diagnosis["selected_learning_gap"]["concept_id"] == gap["id"]


def test_real_data_model_status_excludes_demo_records(teacher_client):
    response = teacher_client.get("/api/teacher/models/evaluation-status")
    assert response.status_code == 200
    status = response.json()
    assert status["real_learners"] == 0
    assert status["labeled_records"] == 0
    assert status["evaluation_available"] is False
    assert "real labeled interaction records" in status["message"]
