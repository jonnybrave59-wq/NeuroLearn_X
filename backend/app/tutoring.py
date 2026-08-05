from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    Activity,
    ActivityConcept,
    AnswerChoice,
    AssessmentAttempt,
    Concept,
    InteractionLog,
    ItemResponse,
    LearningSummary,
    MasteryRecord,
    MentalEffortRating,
    Misconception,
    MisconceptionHistory,
    PathwayRecommendation,
    Question,
    TutoringResponse,
    TutoringSession,
    User,
)
from .services import (
    generate_pathways,
    get_setting,
    latest_mastery_map,
    recalculate_mastery,
    record_pathway_evidence,
    serialize_pathway,
)


DIFFICULTY_ORDER = {"Easy": 1, "Moderate": 2, "Difficult": 3}


def _clean(value: str | None, maximum: int = 5000) -> str | None:
    if value is None:
        return None
    value = value.replace("\x00", " ")
    return re.sub(r"[ \t]+", " ", value).strip()[:maximum]


def structured_solution(question: Question, correct_answer: str | None) -> dict[str, Any]:
    stored = question.solution_structure or {}
    if stored:
        return stored
    raw_steps = [
        line.strip(" -\t")
        for line in re.split(r"[\r\n]+|(?<=\.)\s+(?=[A-Z0-9])", question.solution_steps or "")
        if line.strip(" -\t")
    ]
    if not raw_steps and (question.explanation or question.feedback):
        raw_steps = [question.explanation or question.feedback]
    return {
        "given_information": "Use the quantities and relationships stated in the question.",
        "objective": question.prompt,
        "rule_or_formula": question.hint or "Identify the governing concept before substituting values.",
        "steps": raw_steps,
        "substitution": "Substitute only after the relationship and units are identified.",
        "final_answer": correct_answer or question.correct_answer,
        "unit_check": "Confirm that the final unit and direction match the requested quantity.",
        "reasonableness_check": "Compare the result with the scale and signs of the given information.",
    }


def _choice_payload(choice: AnswerChoice) -> dict[str, Any]:
    return {"id": choice.id, "text": choice.text, "position": choice.position}


def learner_question_payload(
    db: Session, question: Question, session: TutoringSession
) -> dict[str, Any]:
    choices = list(
        db.scalars(
            select(AnswerChoice)
            .where(AnswerChoice.question_id == question.id)
            .order_by(AnswerChoice.position)
        )
    )
    return {
        "id": question.id,
        "concept_id": question.concept_id,
        "prompt": question.prompt,
        "question_type": question.question_type,
        "hint": question.hint if session.scaffolding_level >= 1 else "",
        "difficulty": question.difficulty_label,
        "cognitive_demand": question.estimated_cognitive_demand,
        "scaffolding_level": session.scaffolding_level,
        "choices": [_choice_payload(choice) for choice in choices],
    }


def _latest_mastery_score(db: Session, student_id: int, concept_id: int) -> float | None:
    record = db.scalar(
        select(MasteryRecord)
        .where(
            MasteryRecord.student_id == student_id,
            MasteryRecord.concept_id == concept_id,
        )
        .order_by(MasteryRecord.created_at.desc())
    )
    return record.mastery_score if record else None


def _question_pool(db: Session, session: TutoringSession) -> list[Question]:
    rows = list(
        db.scalars(
            select(Question)
            .join(Activity, Activity.id == Question.activity_id)
            .where(
                Question.concept_id == session.concept_id,
                Question.active.is_(True),
                Activity.active.is_(True),
            )
            .order_by(Activity.difficulty, Question.position, Question.id)
        )
    )
    seen = list(
        db.scalars(
            select(Question)
            .join(TutoringResponse, TutoringResponse.question_id == Question.id)
            .where(TutoringResponse.session_id == session.id)
        )
    )
    seen_ids = {question.id for question in seen}
    seen_prompts = {question.prompt.strip().casefold() for question in seen}
    recent_prompts = {
        value.strip().casefold()
        for value in db.scalars(
            select(Question.prompt)
            .join(ItemResponse, ItemResponse.question_id == Question.id)
            .join(AssessmentAttempt, AssessmentAttempt.id == ItemResponse.attempt_id)
            .where(
                AssessmentAttempt.student_id == session.student_id,
                Question.concept_id == session.concept_id,
            )
            .order_by(AssessmentAttempt.submitted_at.desc())
            .limit(20)
        )
    }
    available = [
        question
        for question in rows
        if question.id not in seen_ids
        and question.prompt.strip().casefold() not in seen_prompts
    ]
    fresh = [
        question
        for question in available
        if question.prompt.strip().casefold() not in recent_prompts
    ]
    return fresh or available


def select_next_question(db: Session, session: TutoringSession) -> Question | None:
    pool = _question_pool(db, session)
    if not pool:
        return None
    target = DIFFICULTY_ORDER.get(session.current_difficulty, 2)
    if session.scaffolding_level >= 2:
        target = max(1, target - 1)
    return min(
        pool,
        key=lambda question: (
            abs(DIFFICULTY_ORDER.get(question.difficulty_label, 2) - target),
            abs((question.estimated_cognitive_demand or 0.5) - target / 3),
            question.id,
        ),
    )


def start_tutoring_session(
    db: Session, student: User, activity: Activity, mode: str
) -> dict[str, Any]:
    concept_id = db.scalar(
        select(ActivityConcept.concept_id)
        .where(ActivityConcept.activity_id == activity.id)
        .order_by(ActivityConcept.id)
    )
    if not concept_id:
        raise HTTPException(status_code=400, detail="This activity has no linked competency")
    active = db.scalar(
        select(TutoringSession)
        .where(
            TutoringSession.student_id == student.id,
            TutoringSession.activity_id == activity.id,
            TutoringSession.mode == mode,
            TutoringSession.status == "Active",
        )
        .order_by(TutoringSession.created_at.desc())
    )
    if active:
        next_question = select_next_question(db, active)
        if next_question:
            return session_payload(db, active, next_question)
        active.status = "Abandoned"
        active.stop_reason = "Question pool changed"
    mastery = _latest_mastery_score(db, student.id, concept_id)
    session = TutoringSession(
        student_id=student.id,
        activity_id=activity.id,
        concept_id=concept_id,
        mode=mode,
        current_difficulty=(
            "Easy" if mastery is None or mastery < 0.5 else "Difficult" if mastery >= 0.8 else "Moderate"
        ),
        scaffolding_level=2 if mastery is None or mastery < 0.5 else 1,
        mastery_before=mastery,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    question = select_next_question(db, session)
    if not question:
        session.status = "Paused"
        session.stop_reason = "No eligible non-recent questions are available"
        db.commit()
        raise HTTPException(status_code=409, detail=session.stop_reason)
    return session_payload(db, session, question)


def session_payload(
    db: Session, session: TutoringSession, question: Question | None = None
) -> dict[str, Any]:
    concept = db.get(Concept, session.concept_id)
    return {
        "id": session.id,
        "activity_id": session.activity_id,
        "concept_id": session.concept_id,
        "concept": concept.name if concept else "Unknown competency",
        "mode": session.mode,
        "status": session.status,
        "current_difficulty": session.current_difficulty,
        "scaffolding_level": session.scaffolding_level,
        "responses_count": session.responses_count,
        "consecutive_correct": session.consecutive_correct,
        "mastery_before": session.mastery_before,
        "mastery_after": session.mastery_after,
        "stop_reason": session.stop_reason,
        "question": learner_question_payload(db, question, session) if question else None,
        "rules": {
            "minimum_questions": int(get_setting(db, "tutoring_min_questions")),
            "consecutive_correct": int(get_setting(db, "tutoring_consecutive_correct")),
            "maximum_questions": int(get_setting(db, "tutoring_max_questions")),
            "mastery_threshold": float(get_setting(db, "mastery_threshold")),
        },
    }


def _text_answer_correct(question: Question, response_text: str | None) -> bool:
    if not response_text or not question.correct_answer:
        return False
    supplied = re.sub(r"\W+", " ", response_text.casefold()).strip()
    expected = re.sub(r"\W+", " ", question.correct_answer.casefold()).strip()
    if question.question_type == "Identification":
        return supplied == expected
    expected_tokens = {
        token for token in expected.split() if len(token) > 2 and token not in {"the", "and", "that", "with", "from"}
    }
    return supplied == expected if not expected_tokens else len(set(supplied.split()) & expected_tokens) / len(expected_tokens) >= 0.6


def _misconception_evidence(
    db: Session,
    student: User,
    session: TutoringSession,
    question: Question,
    choice: AnswerChoice | None,
) -> tuple[Misconception | None, int, str]:
    if (
        not choice
        or choice.is_correct
        or not choice.misconception_id
        or choice.mapping_status not in {"Teacher reviewed", "Validated"}
    ):
        return None, 0, "Not diagnosed"
    misconception = db.get(Misconception, choice.misconception_id)
    if not misconception or not misconception.active:
        return None, 0, "Not diagnosed"
    previous_count = db.scalar(
        select(func.count(MisconceptionHistory.id)).where(
            MisconceptionHistory.student_id == student.id,
            MisconceptionHistory.misconception_id == misconception.id,
            MisconceptionHistory.resolved_at.is_(None),
        )
    ) or 0
    count = previous_count + 1
    confidence = "High" if count >= 3 else "Moderate" if count == 2 else "Low"
    db.add(
        MisconceptionHistory(
            student_id=student.id,
            misconception_id=misconception.id,
            question_id=question.id,
            selected_choice_id=choice.id,
            tutoring_session_id=session.id,
            evidence_count=count,
            confidence_level=confidence,
        )
    )
    return misconception, count, confidence


def _pathway_snapshot(db: Session, student_id: int) -> dict[str, Any] | None:
    pathway = db.scalar(
        select(PathwayRecommendation)
        .where(
            PathwayRecommendation.student_id == student_id,
            PathwayRecommendation.active.is_(True),
            PathwayRecommendation.selected.is_(True),
        )
        .order_by(PathwayRecommendation.created_at.desc())
    )
    return serialize_pathway(db, pathway) if pathway else None


def _finalize_session(db: Session, student: User, session: TutoringSession) -> dict[str, Any]:
    responses = list(
        db.scalars(
            select(TutoringResponse)
            .where(TutoringResponse.session_id == session.id)
            .order_by(TutoringResponse.sequence)
        )
    )
    if not responses:
        raise HTTPException(status_code=409, detail="No tutoring evidence is available")
    submitted_at = datetime.now(timezone.utc)
    score = sum(1 for response in responses if response.is_correct)
    accuracy = score / len(responses)
    previous_attempts = db.scalar(
        select(func.count(AssessmentAttempt.id)).where(
            AssessmentAttempt.student_id == student.id,
            AssessmentAttempt.activity_id == session.activity_id,
        )
    ) or 0
    attempt = AssessmentAttempt(
        student_id=student.id,
        activity_id=session.activity_id,
        score=float(score),
        max_score=float(len(responses)),
        accuracy=accuracy,
        started_at=session.started_at,
        submitted_at=submitted_at,
        total_seconds=sum(response.response_seconds for response in responses),
        skipped_items=sum(1 for response in responses if not response.selected_choice_id and not response.response_text),
        hint_usage_count=sum(1 for response in responses if response.hint_opened),
        answer_change_count=sum(response.answer_changes for response in responses),
        attempt_number=previous_attempts + 1,
        is_demo=student.is_demo,
    )
    db.add(attempt)
    db.flush()
    for response in responses:
        question = db.get(Question, response.question_id)
        db.add(
            ItemResponse(
                attempt_id=attempt.id,
                question_id=response.question_id,
                selected_choice_id=response.selected_choice_id,
                response_text=response.response_text,
                is_correct=response.is_correct,
                earned_points=question.points if response.is_correct else 0,
                max_points=question.points,
                response_seconds=response.response_seconds,
                hint_opened=response.hint_opened,
                skipped=not response.selected_choice_id and not response.response_text,
                answer_changes=response.answer_changes,
            )
        )
    db.add(
        InteractionLog(
            student_id=student.id,
            activity_id=session.activity_id,
            concept_id=session.concept_id,
            attempt_id=attempt.id,
            score=float(score),
            max_score=float(len(responses)),
            response_accuracy=accuracy,
            average_response_seconds=sum(response.response_seconds for response in responses) / len(responses),
            total_completion_seconds=sum(response.response_seconds for response in responses),
            number_of_attempts=previous_attempts + 1,
            skipped_items=attempt.skipped_items,
            hint_usage_count=attempt.hint_usage_count,
            start_time=session.started_at,
            submission_time=submitted_at,
            is_demo=student.is_demo,
        )
    )
    session.status = "Completed" if session.stop_reason != "Repeated misconception requires remediation" else "Paused"
    session.completed_at = submitted_at
    session.attempt_id = attempt.id
    db.commit()
    recalculate_mastery(db, student, {session.concept_id}, attempt.id)
    session.mastery_after = _latest_mastery_score(db, student.id, session.concept_id)
    if session.mastery_after is not None and session.mastery_after >= float(get_setting(db, "mastery_threshold")):
        for history in db.scalars(
            select(MisconceptionHistory).where(
                MisconceptionHistory.student_id == student.id,
                MisconceptionHistory.resolved_at.is_(None),
            )
        ):
            misconception = db.get(Misconception, history.misconception_id)
            if misconception and misconception.concept_id == session.concept_id:
                history.resolved_at = submitted_at
                history.resolved_by_attempt_id = attempt.id
    record_pathway_evidence(db, student.id, session.activity_id, attempt)
    previous_pathway = _pathway_snapshot(db, student.id)
    db.commit()
    generate_pathways(db, student, trigger_type="Tutoring session", trigger_id=session.id)
    updated_pathway = _pathway_snapshot(db, student.id)
    misconception_rows = db.execute(
        select(Misconception.code, Misconception.name, func.count(MisconceptionHistory.id))
        .join(MisconceptionHistory, MisconceptionHistory.misconception_id == Misconception.id)
        .where(MisconceptionHistory.tutoring_session_id == session.id)
        .group_by(Misconception.id)
    ).all()
    summary_data = {
        "initial_mastery": session.mastery_before,
        "final_mastery": session.mastery_after,
        "accuracy": accuracy,
        "questions_completed": len(responses),
        "concepts_strengthened": [db.get(Concept, session.concept_id).name] if accuracy >= 0.6 else [],
        "errors_observed": len(responses) - score,
        "misconceptions": [
            {"code": code, "name": name, "evidence_count": count}
            for code, name, count in misconception_rows
        ],
        "mental_effort": "Pending learner rating",
        "pathway_changed": bool(
            (previous_pathway or {}).get("id") != (updated_pathway or {}).get("id")
        ),
        "pathway_before": (previous_pathway or {}).get("label"),
        "pathway_after": (updated_pathway or {}).get("label"),
        "next_action": (
            "Complete the assigned remediation before continuing."
            if session.status == "Paused"
            else "Review the updated pathway and continue with its next required step."
        ),
    }
    summary = LearningSummary(
        student_id=student.id,
        activity_id=session.activity_id,
        attempt_id=attempt.id,
        tutoring_session_id=session.id,
        summary=summary_data,
    )
    db.add(summary)
    db.commit()
    return {
        "attempt_id": attempt.id,
        "score": score,
        "max_score": len(responses),
        "accuracy": accuracy,
        "mastery_before": session.mastery_before,
        "mastery_after": session.mastery_after,
        "summary": summary_data,
        "mental_effort_required": True,
        "mental_effort_boundaries": {
            "low_max": int(get_setting(db, "mental_effort_low_max")),
            "moderate_max": int(get_setting(db, "mental_effort_moderate_max")),
        },
    }


def submit_tutoring_response(
    db: Session,
    student: User,
    session: TutoringSession,
    question_id: int,
    selected_choice_id: int | None,
    response_text: str | None,
    response_seconds: float,
    hint_opened: bool,
    answer_changes: int,
) -> dict[str, Any]:
    if session.student_id != student.id or session.status != "Active":
        raise HTTPException(status_code=404, detail="Active tutoring session not found")
    expected = select_next_question(db, session)
    if not expected or expected.id != question_id:
        raise HTTPException(status_code=409, detail="This is not the current adaptive question")
    choice = db.get(AnswerChoice, selected_choice_id) if selected_choice_id else None
    if choice and choice.question_id != question_id:
        raise HTTPException(status_code=400, detail="Answer choice does not match question")
    is_correct = bool((choice and choice.is_correct) or _text_answer_correct(expected, response_text))
    misconception, repetition_count, confidence = _misconception_evidence(
        db, student, session, expected, choice
    )
    session.responses_count += 1
    session.consecutive_correct = session.consecutive_correct + 1 if is_correct else 0
    db.add(
        TutoringResponse(
            session_id=session.id,
            question_id=expected.id,
            selected_choice_id=choice.id if choice else None,
            response_text=_clean(response_text),
            is_correct=is_correct,
            response_seconds=response_seconds,
            hint_opened=hint_opened,
            answer_changes=answer_changes,
            difficulty_at_response=session.current_difficulty,
            scaffolding_level=session.scaffolding_level,
            misconception_id=misconception.id if misconception else None,
            sequence=session.responses_count,
        )
    )
    remediation_count = int(get_setting(db, "misconception_remediation_repetitions"))
    pause_count = int(get_setting(db, "misconception_pause_repetitions"))
    if repetition_count >= remediation_count:
        session.scaffolding_level = min(3, max(2, session.scaffolding_level + 1))
        session.current_difficulty = "Easy"
    if repetition_count >= pause_count:
        session.stop_reason = "Repeated misconception requires remediation"
    elif is_correct and session.consecutive_correct >= 2:
        session.scaffolding_level = max(0, session.scaffolding_level - 1)
        session.current_difficulty = "Difficult" if session.responses_count >= 4 else "Moderate"
    db.commit()
    correct_choice = db.scalar(
        select(AnswerChoice).where(
            AnswerChoice.question_id == expected.id,
            AnswerChoice.is_correct.is_(True),
        )
    )
    feedback = {
        "correct": is_correct,
        "learner_answer": choice.text if choice else response_text,
        "correct_answer": correct_choice.text if correct_choice else expected.correct_answer,
        "why": expected.explanation or expected.feedback,
        "solution": structured_solution(
            expected, correct_choice.text if correct_choice else expected.correct_answer
        ),
        "misconception": (
            {
                "code": misconception.code,
                "name": misconception.name,
                "concept": db.get(Concept, misconception.concept_id).name,
                "explanation": misconception.explanation,
                "remediation_instruction": misconception.remediation_instruction,
                "suggested_activity_id": misconception.suggested_activity_id,
                "pattern_confidence": confidence,
                "evidence_count": repetition_count,
            }
            if misconception
            else None
        ),
        "diagnostic_note": (
            None
            if is_correct or misconception
            else "This response is incorrect, but no teacher-reviewed distractor mapping supports a specific misconception diagnosis."
        ),
    }
    minimum = int(get_setting(db, "tutoring_min_questions"))
    maximum = int(get_setting(db, "tutoring_max_questions"))
    required_streak = int(get_setting(db, "tutoring_consecutive_correct"))
    # SQLite and PostgreSQL do not agree on AVG(boolean); the persisted rows are small.
    persisted = list(
        db.scalars(select(TutoringResponse).where(TutoringResponse.session_id == session.id))
    )
    current_accuracy = sum(1 for item in persisted if item.is_correct) / len(persisted)
    should_finish = False
    if session.stop_reason == "Repeated misconception requires remediation":
        should_finish = True
    elif session.responses_count >= maximum:
        session.stop_reason = "Maximum question limit reached"
        should_finish = True
    elif (
        session.responses_count >= minimum
        and session.consecutive_correct >= required_streak
        and current_accuracy >= float(get_setting(db, "mastery_threshold"))
    ):
        session.stop_reason = "Mastery stopping rule met"
        should_finish = True
    next_question = None if should_finish else select_next_question(db, session)
    if not next_question:
        if not session.stop_reason:
            session.stop_reason = "Eligible question pool completed"
        should_finish = True
    db.commit()
    if should_finish:
        return {"feedback": feedback, "completed": True, "result": _finalize_session(db, student, session)}
    return {
        "feedback": feedback,
        "completed": False,
        "session": session_payload(db, session, next_question),
    }


def update_summary_effort(db: Session, attempt_id: int, rating: MentalEffortRating) -> None:
    row = db.scalar(select(LearningSummary).where(LearningSummary.attempt_id == attempt_id))
    if not row:
        return
    summary = dict(row.summary or {})
    summary["mental_effort"] = {"rating": rating.rating, "category": rating.category}
    row.summary = summary
