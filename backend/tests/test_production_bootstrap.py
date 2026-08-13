from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Activity, Question, User
from app.seed import ensure_reference_curriculum


def test_reference_curriculum_is_idempotent_and_creates_no_learner_data():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            first = ensure_reference_curriculum(db)
            assert first is not None
            assert first.is_onboarding_diagnostic is True
            assert first.is_demo is False
            assert db.scalar(select(func.count(User.id))) == 0
            assert db.scalar(
                select(func.count(Question.id)).where(
                    Question.activity_id == first.id,
                    Question.active.is_(True),
                )
            ) == 30
            activity_count = db.scalar(select(func.count(Activity.id)))
            question_count = db.scalar(select(func.count(Question.id)))

            second = ensure_reference_curriculum(db)
            assert second is not None
            assert second.id == first.id
            assert db.scalar(select(func.count(Activity.id))) == activity_count
            assert db.scalar(select(func.count(Question.id))) == question_count
            assert db.scalar(select(func.count(User.id))) == 0
    finally:
        engine.dispose()
