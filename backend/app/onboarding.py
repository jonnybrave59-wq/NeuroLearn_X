from __future__ import annotations

from collections import defaultdict
from copy import deepcopy

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .models import (
    Activity,
    ActivityConcept,
    AnswerChoice,
    AssessmentAttempt,
    Question,
)


ONBOARDING_DIAGNOSTIC_TITLE = "NeuroLearn-X 30-Item Diagnostic Assessment"
ONBOARDING_DIAGNOSTIC_ITEMS = 30


def _eligible_source_questions(db: Session) -> list[Question]:
    candidates = list(
        db.scalars(
            select(Question)
            .join(Activity, Activity.id == Question.activity_id)
            .where(
                Activity.active.is_(True),
                Activity.is_diagnostic.is_(True),
                Activity.is_onboarding_diagnostic.is_(False),
                Question.active.is_(True),
                func.lower(Question.question_type) == "multiple choice",
            )
            .order_by(Question.concept_id, Question.position, Question.id)
        )
    )
    eligible: list[Question] = []
    for question in candidates:
        choices = list(
            db.scalars(
                select(AnswerChoice)
                .where(AnswerChoice.question_id == question.id)
                .order_by(AnswerChoice.position, AnswerChoice.id)
            )
        )
        if len(choices) >= 2 and sum(1 for choice in choices if choice.is_correct) == 1:
            eligible.append(question)
    return eligible


def _balanced_selection(questions: list[Question]) -> list[Question]:
    by_concept: dict[int, list[Question]] = defaultdict(list)
    for question in questions:
        by_concept[question.concept_id].append(question)
    selected: list[Question] = []
    depth = 0
    concept_ids = sorted(by_concept)
    while len(selected) < ONBOARDING_DIAGNOSTIC_ITEMS:
        added = False
        for concept_id in concept_ids:
            concept_questions = by_concept[concept_id]
            if depth < len(concept_questions):
                selected.append(concept_questions[depth])
                added = True
                if len(selected) == ONBOARDING_DIAGNOSTIC_ITEMS:
                    break
        if not added:
            break
        depth += 1
    return selected


def ensure_onboarding_diagnostic(db: Session) -> Activity | None:
    """Create the stable 30-item diagnostic from existing authored question data.

    Existing learner attempts are immutable. Once the activity has attempts,
    this function never changes its question set.
    """
    activity = db.scalar(
        select(Activity).where(Activity.is_onboarding_diagnostic.is_(True))
    )
    if activity:
        item_count = db.scalar(
            select(func.count(Question.id)).where(
                Question.activity_id == activity.id,
                Question.active.is_(True),
            )
        ) or 0
        attempt_count = db.scalar(
            select(func.count(AssessmentAttempt.id)).where(
                AssessmentAttempt.activity_id == activity.id
            )
        ) or 0
        if item_count == ONBOARDING_DIAGNOSTIC_ITEMS or attempt_count:
            return activity if item_count == ONBOARDING_DIAGNOSTIC_ITEMS else None
        db.execute(delete(AnswerChoice).where(AnswerChoice.question_id.in_(
            select(Question.id).where(Question.activity_id == activity.id)
        )))
        db.execute(delete(Question).where(Question.activity_id == activity.id))
        db.execute(delete(ActivityConcept).where(ActivityConcept.activity_id == activity.id))

    selected = _balanced_selection(_eligible_source_questions(db))
    if len(selected) != ONBOARDING_DIAGNOSTIC_ITEMS:
        return None
    if not activity:
        activity = Activity(
            title=ONBOARDING_DIAGNOSTIC_TITLE,
            description=(
                "A broad baseline assessment that identifies prerequisite strengths, "
                "learning gaps, mastery evidence, and cognitive-load inputs."
            ),
            activity_type="diagnostic",
            difficulty=3,
            estimated_minutes=45,
            instructions=(
                "Answer all 30 multiple-choice questions. You may review earlier items "
                "before submitting; unanswered items are recorded as skipped."
            ),
            active=True,
            is_diagnostic=True,
            is_onboarding_diagnostic=True,
            is_demo=False,
        )
        db.add(activity)
        db.flush()
    else:
        activity.title = ONBOARDING_DIAGNOSTIC_TITLE
        activity.active = True
        activity.is_diagnostic = True

    for concept_id in sorted({question.concept_id for question in selected}):
        db.add(ActivityConcept(activity_id=activity.id, concept_id=concept_id))
    for position, source in enumerate(selected, start=1):
        clone = Question(
            activity_id=activity.id,
            concept_id=source.concept_id,
            prompt=source.prompt,
            feedback=source.feedback,
            hint=source.hint,
            question_type="Multiple choice",
            correct_answer=source.correct_answer,
            explanation=source.explanation,
            difficulty_label=source.difficulty_label,
            cognitive_level=source.cognitive_level,
            subject=source.subject,
            topic=source.topic,
            learning_competency=source.learning_competency,
            source_type=source.source_type,
            source_document_id=source.source_document_id,
            source_locator=source.source_locator,
            solution_steps=source.solution_steps,
            solution_structure=deepcopy(source.solution_structure or {}),
            estimated_cognitive_demand=source.estimated_cognitive_demand,
            prerequisite_concept_id=source.prerequisite_concept_id,
            validation_status=source.validation_status,
            validation_flags=deepcopy(source.validation_flags or []),
            generation_metadata={
                **deepcopy(source.generation_metadata or {}),
                "onboarding_diagnostic_source_question_id": source.id,
            },
            distractor_rationales=deepcopy(source.distractor_rationales or {}),
            is_calculation=source.is_calculation,
            status=source.status,
            created_by=source.created_by,
            points=source.points,
            active=True,
            position=position,
        )
        db.add(clone)
        db.flush()
        for choice in db.scalars(
            select(AnswerChoice)
            .where(AnswerChoice.question_id == source.id)
            .order_by(AnswerChoice.position, AnswerChoice.id)
        ):
            db.add(
                AnswerChoice(
                    question_id=clone.id,
                    text=choice.text,
                    is_correct=choice.is_correct,
                    position=choice.position,
                    misconception_id=choice.misconception_id,
                    misconception_confidence=choice.misconception_confidence,
                    mapping_status=choice.mapping_status,
                )
            )
    db.commit()
    db.refresh(activity)
    return activity
