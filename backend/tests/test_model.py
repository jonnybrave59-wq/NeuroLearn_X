from __future__ import annotations

from app.database import SessionLocal
from app.ml import train_ensemble


def test_grouped_ensemble_training_uses_student_groups():
    with SessionLocal() as db:
        version = train_ensemble(db, is_demo=True)
        assert version.sample_size >= 12
        assert version.student_count >= 3
        assert "student-grouped" in version.metrics["evaluation"]
        assert len(version.metrics["confusion_matrix"]) == 3
        assert 0 <= version.metrics["accuracy"] <= 1
        assert version.warning == "Demonstration Data – Not a Research Result."

