from __future__ import annotations

import pytest


def test_overview_explanations_use_current_learner_records(student_client):
    response = student_client.get("/api/student/dashboard")
    assert response.status_code == 200, response.text
    dashboard = response.json()
    explanations = dashboard["explainability"]

    mastery = explanations["average_mastery"]
    assert mastery["available"] is True
    assert mastery["concept_count"] == len(dashboard["mastery"])
    assert mastery["value"] == pytest.approx(
        sum(row["score"] for row in dashboard["mastery"]) / len(dashboard["mastery"])
    )
    assert mastery["sum_mastery"] == pytest.approx(
        sum(row["score"] for row in dashboard["mastery"])
    )
    assert mastery["score_breakdown_count"] == sum(
        bool(row["attempts"]) for row in mastery["concepts"]
    )
    assert "item-score breakdowns" in mastery["data_quality"].lower()
    assert {
        row["concept_id"] for row in mastery["concepts_below_threshold"]
    } == {
        row["concept_id"]
        for row in dashboard["mastery"]
        if row["score"] < mastery["threshold"]
    }

    target = explanations["current_target"]
    assert target["available"] is True
    assert target["concept"]["id"] == dashboard["target"]["id"]
    target_mastery = next(
        row for row in dashboard["mastery"] if row["concept_id"] == dashboard["target"]["id"]
    )
    assert target["mastery"] == pytest.approx(target_mastery["score"])
    assert target["reason"]
    assert target["latest_evidence_at"]

    progress = explanations["pathway_progress"]
    required_steps = [row for row in dashboard["pathway"]["steps"] if row["required"]]
    assert progress["total"] == len(required_steps)
    assert progress["completed"] == sum(bool(row["completed_at"]) for row in required_steps)
    assert dashboard["progress"] == {
        "completed": progress["completed"],
        "total": progress["total"],
    }
    assert progress["percentage"] == pytest.approx(
        progress["completed"] / progress["total"]
    )

    next_step = explanations["next_recommended_step"]
    expected_step = next(row for row in required_steps if not row["completed_at"])
    assert next_step["available"] is True
    assert next_step["activity"] == expected_step["activity"]
    assert next_step["concept"] == expected_step["concept"]
    assert next_step["selection_reason"] == expected_step["selection_reason"]
    assert next_step["estimated_minutes"] == expected_step["estimated_minutes"]
    assert next_step["predicted_load_index"] == pytest.approx(
        expected_step["predicted_load_index"]
    )
    assert next_step["aps"]["available"] is True
    aps = next_step["aps"]
    expected_aps = (
        aps["weights"]["alpha"] * aps["gap_coverage"]
        + aps["weights"]["beta"] * (1 - aps["predicted_cognitive_load"])
        + aps["weights"]["gamma"] * (1 - aps["normalized_learning_time"])
    )
    assert aps["score"] == pytest.approx(expected_aps)

    predicted = explanations["model_predicted_cognitive_load"]
    assert predicted["available"] is False
    assert predicted["category"] is None
    assert predicted["index"] is None
    assert predicted["reported_mental_effort"] is not None
    assert "not a medical" in predicted["disclaimer"].lower()


def test_overview_does_not_invent_metrics_without_evidence(client):
    registration = {
        "student_id": "EXPLAIN901",
        "first_name": "Explainable",
        "last_name": "Dashboard",
        "email": "explainable.dashboard@example.edu",
        "username": "explainable.dashboard",
        "password": "Secure!Pass7",
        "confirm_password": "Secure!Pass7",
        "grade_level": "Grade 12",
        "section": "STEM E",
        "accept_terms": True,
    }
    assert client.post("/api/auth/register/student", json=registration).status_code == 201
    login = client.post(
        "/api/auth/login",
        json={
            "participant_code": registration["student_id"],
            "password": registration["password"],
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    dashboard = client.get("/api/student/dashboard").json()
    explanations = dashboard["explainability"]
    for key in (
        "average_mastery",
        "model_predicted_cognitive_load",
        "current_target",
        "pathway_progress",
        "next_recommended_step",
    ):
        assert explanations[key]["available"] is False
        assert explanations[key]["data_quality"]
    assert explanations["average_mastery"]["value"] is None
    assert explanations["model_predicted_cognitive_load"]["category"] is None
    assert explanations["model_predicted_cognitive_load"]["index"] is None
    assert explanations["pathway_progress"]["percentage"] is None
    assert explanations["next_recommended_step"]["activity"] is None


def test_teacher_assigned_next_step_never_claims_automatic_aps(teacher_client):
    student = teacher_client.get(
        "/api/teacher/students", params={"search": "STEM006"}
    ).json()[0]
    student_id = student["id"]
    concepts = teacher_client.get("/api/teacher/concepts").json()
    concept = next(row for row in concepts if row["subject"] == "General Physics")
    preview_response = teacher_client.post(
        f"/api/teacher/students/{student_id}/topics/{concept['id']}/pathway-preview",
        json={"difficulty": "Guided pathway"},
    )
    assert preview_response.status_code == 200, preview_response.text
    preview = preview_response.json()
    assert preview["steps"]
    assigned = teacher_client.post(
        f"/api/teacher/students/{student_id}/pathways/assign",
        json={
            "target_concept_id": concept["id"],
            "label": "Explainability verification pathway",
            "difficulty": "Guided pathway",
            "teacher_note": "Assigned for dashboard explanation verification.",
            "due_at": None,
            "steps": [
                {
                    "concept_id": step["concept_id"],
                    "activity_id": step["activity_id"],
                    "position": index + 1,
                }
                for index, step in enumerate(preview["steps"][:1])
            ],
        },
    )
    assert assigned.status_code == 201, assigned.text
    teacher_client.post("/api/auth/logout")
    login = teacher_client.post(
        "/api/auth/login",
        json={
            "participant_code": student["participant_code"],
            "password": "LearnX!2026",
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    next_step = teacher_client.get("/api/student/dashboard").json()["explainability"][
        "next_recommended_step"
    ]
    assert next_step["aps"]["available"] is False
    assert "teacher-assigned" in next_step["aps"]["reason"].lower()
