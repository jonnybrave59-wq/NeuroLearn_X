from __future__ import annotations

from sqlalchemy import inspect

from app.database import engine


def test_concurrency_guards_and_frequent_query_indexes_exist():
    inspector = inspect(engine)

    attempt_unique = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints("assessment_attempts")
    }
    assert ("student_id", "activity_id", "started_at") in attempt_unique

    expected_indexes = {
        "assessment_attempts": {
            "ix_assessment_attempts_student_activity_submitted",
        },
        "uploaded_documents": {"ix_uploaded_documents_owner_status"},
        "mastery_records": {"ix_mastery_records_student_concept_created"},
        "learning_gaps": {"ix_learning_gaps_student_resolved_concept"},
        "pathway_recommendations": {
            "uq_pathways_one_active_selected_per_student",
            "ix_pathways_student_active_selected_created",
        },
        "cognitive_load_predictions": {
            "ix_cognitive_load_predictions_student_evidence",
        },
    }
    for table, names in expected_indexes.items():
        actual = {item["name"] for item in inspector.get_indexes(table)}
        assert names <= actual
