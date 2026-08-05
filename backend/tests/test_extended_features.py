from __future__ import annotations

from datetime import datetime, timezone


def register_payload(student_id: str, username: str):
    return {
        "student_id": student_id,
        "first_name": "Alex",
        "last_name": "Rivera",
        "email": f"{username}@example.edu",
        "username": username,
        "password": "Secure!Pass7",
        "confirm_password": "Secure!Pass7",
        "grade_level": "Grade 12",
        "section": "STEM A",
        "accept_terms": True,
    }


def test_student_self_registration_login_and_duplicate_protection(client):
    weak = register_payload("REG100", "alex.weak")
    weak["password"] = weak["confirm_password"] = "notsecure"
    assert client.post("/api/auth/register/student", json=weak).status_code == 422

    payload = register_payload("REG101", "alex.reg101")
    created = client.post("/api/auth/register/student", json=payload)
    assert created.status_code == 201
    student = created.json()["student"]
    assert student["account_status"] == "Active"
    assert student["created_at"]
    assert client.post("/api/auth/register/student", json=payload).status_code == 409

    login = client.post(
        "/api/auth/login",
        json={
            "participant_code": payload["username"],
            "password": payload["password"],
            "expected_role": "student",
        },
    )
    assert login.status_code == 200
    assert login.json()["last_sign_in_at"]
    dashboard = client.get("/api/student/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["student"]["participant_code"] == "REG101"
    assert client.get("/api/teacher/question-bank").status_code == 403


def test_teacher_student_lifecycle_actions_are_audited_and_soft(client):
    payload = register_payload("LIFE101", "lifecycle.student")
    assert client.post("/api/auth/register/student", json=payload).status_code == 201
    client.post("/api/auth/logout")
    assert (
        client.post(
            "/api/auth/login",
            json={
                "participant_code": "TEACHER01",
                "password": "NeuroTeach!2026",
                "expected_role": "teacher",
            },
        ).status_code
        == 200
    )
    students = client.get(
        "/api/teacher/students",
        params={"search": "LIFE101", "paginated": True},
    ).json()
    student_id = students["items"][0]["id"]
    reset = client.post(
        f"/api/teacher/students/{student_id}/actions",
        json={"action": "reset_password", "reason": "Student requested help"},
    )
    assert reset.status_code == 200
    assert reset.json()["temporary_password"]

    deactivated = client.post(
        f"/api/teacher/students/{student_id}/actions",
        json={"action": "deactivate", "reason": "Temporary hold"},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["student"]["account_status"] == "Deactivated"
    client.post("/api/auth/logout")
    blocked = client.post(
        "/api/auth/login",
        json={
            "participant_code": "LIFE101",
            "password": reset.json()["temporary_password"],
            "expected_role": "student",
        },
    )
    assert blocked.status_code == 403

    client.post(
        "/api/auth/login",
        json={
            "participant_code": "TEACHER01",
            "password": "NeuroTeach!2026",
            "expected_role": "teacher",
        },
    )
    assert (
        client.post(
            f"/api/teacher/students/{student_id}/actions",
            json={"action": "reactivate"},
        ).status_code
        == 200
    )
    archived = client.post(
        f"/api/teacher/students/{student_id}/actions",
        json={"action": "remove", "reason": "Left the participating section"},
    )
    assert archived.status_code == 200
    assert archived.json()["student"]["account_status"] == "Archived"
    logs = client.get("/api/teacher/audit-logs").json()
    assert any(
        row["action"] == "student.remove" and row["entity_id"] == str(student_id)
        for row in logs
    )


def test_document_generation_question_bank_and_publication_workflow(client):
    assert (
        client.post(
            "/api/auth/login",
            json={
                "participant_code": "TEACHER01",
                "password": "NeuroTeach!2026",
                "expected_role": "teacher",
            },
        ).status_code
        == 200
    )
    concepts = client.get("/api/teacher/concepts").json()
    concept = concepts[0]
    material = (
        "Force changes the motion of an object according to its mass and acceleration. "
        "Newton's first law explains why an object maintains its state of motion. "
        "Newton's second law relates net force, mass, and acceleration. "
        "Newton's third law describes equal and opposite interaction forces. "
        "Free-body diagrams represent the forces acting on an object."
    )
    uploaded = client.post(
        "/api/teacher/documents",
        files={"file": ("newton-laws.txt", material, "text/plain")},
    )
    assert uploaded.status_code == 201
    document = uploaded.json()
    assert document["processing_status"] == "Ready"
    assert "Force changes" in document["text_preview"]

    generated = client.post(
        f"/api/teacher/documents/{document['id']}/generate",
        json={
            "subject": "General Physics",
            "grade_level": "Grade 12",
            "topic": "Newton's Laws",
            "concept_id": concept["id"],
            "learning_competency": "Apply Newton's laws to physical situations.",
            "number_of_questions": 3,
            "question_type": "Multiple choice",
            "difficulty": "Moderate",
            "cognitive_level": "Apply",
            "include_explanations": True,
            "include_hints": True,
            "include_prerequisites": False,
        },
    )
    assert generated.status_code == 201
    questions = generated.json()
    assert len(questions) == 3
    assert all(question["status"] == "Draft" for question in questions)
    assert all(len(question["choices"]) == 4 for question in questions)
    assert all(
        sum(choice["is_correct"] for choice in question["choices"]) == 1
        for question in questions
    )

    saved = client.post(
        "/api/teacher/question-bank/batch",
        json={
            "question_ids": [question["id"] for question in questions],
            "action": "save",
        },
    )
    assert saved.status_code == 200
    bank = client.get(
        "/api/teacher/question-bank",
        params={"source_document_id": document["id"]},
    )
    assert bank.status_code == 200
    assert bank.json()["total"] == 3

    draft = client.post(
        "/api/teacher/assessments",
        json={
            "title": "Draft publication control check",
            "description": "Saved for a later explicit publication decision.",
            "subject": "General Physics",
            "topic": "Newton's Laws",
            "question_ids": [question["id"] for question in questions],
            "status": "Draft",
            "mastery_threshold": 0.75,
            "maximum_attempts": 5,
            "student_ids": [],
            "sections": [],
            "allow_retake": False,
        },
    )
    assert draft.status_code == 201
    assert draft.json()["activity_id"] is None
    published_draft = client.post(
        f"/api/teacher/assessments/{draft.json()['id']}/status",
        json={"status": "Published"},
    )
    assert published_draft.status_code == 200
    assert published_draft.json()["activity_id"]
    assert client.post(
        f"/api/teacher/assessments/{draft.json()['id']}/status",
        json={"status": "Archived"},
    ).status_code == 200

    student = client.get(
        "/api/teacher/students",
        params={"search": "STEM001"},
    ).json()[0]
    assessment = client.post(
        "/api/teacher/assessments",
        json={
            "title": "Newton's Laws Check",
            "description": "Teacher-reviewed generated questions.",
            "subject": "General Physics",
            "topic": "Newton's Laws",
            "question_ids": [question["id"] for question in questions],
            "status": "Published",
            "mastery_threshold": 0.75,
            "time_limit": 20,
            "maximum_attempts": 2,
            "student_ids": [student["id"]],
            "sections": [],
            "shuffle_questions": True,
            "shuffle_choices": True,
            "show_score_immediately": False,
            "show_explanations": False,
            "allow_retake": True,
        },
    )
    assert assessment.status_code == 201
    assert assessment.json()["status"] == "Published"
    assert assessment.json()["activity_id"]

    client.post("/api/auth/logout")
    assert (
        client.post(
            "/api/auth/login",
            json={
                "participant_code": "STEM001",
                "password": "LearnX!2026",
                "expected_role": "student",
            },
        ).status_code
        == 200
    )
    assigned = client.get("/api/student/assessments")
    assert assigned.status_code == 200
    row = next(
        item
        for item in assigned.json()
        if item["title"] == "Newton's Laws Check"
    )
    assert row["can_attempt"] is True
    activity = client.get(f"/api/student/activities/{row['activity_id']}")
    assert activity.status_code == 200
    activity_payload = activity.json()
    assert len(activity_payload["questions"]) == 3
    repeated = client.get(f"/api/student/activities/{row['activity_id']}").json()
    assert [item["id"] for item in repeated["questions"]] == [
        item["id"] for item in activity_payload["questions"]
    ]
    assert [
        [choice["id"] for choice in item["choices"]]
        for item in repeated["questions"]
    ] == [
        [choice["id"] for choice in item["choices"]]
        for item in activity_payload["questions"]
    ]

    submission = client.post(
        "/api/student/attempts",
        json={
            "activity_id": row["activity_id"],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "responses": [
                {
                    "question_id": question["id"],
                    "selected_choice_id": question["choices"][0]["id"],
                    "response_seconds": 1,
                    "hint_opened": False,
                    "skipped": False,
                    "answer_changes": 0,
                }
                for question in activity_payload["questions"]
            ],
        },
    )
    assert submission.status_code == 201
    assert submission.json()["score"] is None
    assert submission.json()["score_visible"] is False
    assert submission.json()["items"] == []
    assert submission.json()["explanations_visible"] is False
