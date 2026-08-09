from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from statistics import pstdev
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .algorithms import (
    Candidate,
    classify_mastery,
    gap_coverage,
    prerequisite_ancestors,
    rank_candidates,
    topological_order,
    weighted_mastery,
)
from .ml import predict_activity_load
from .models import (
    Activity,
    ActivityConcept,
    AssessmentAttempt,
    AuditLog,
    Concept,
    InteractionLog,
    ItemResponse,
    LearningGap,
    MasteryRecord,
    MentalEffortRating,
    PathwayRecommendation,
    PathwayStep,
    PathwayVersion,
    PrerequisiteEdge,
    Question,
    StudentProfile,
    SystemSetting,
    User,
)


DEFAULT_SETTINGS = {
    "mastery_threshold": 0.75,
    "mastery_mode": "weighted",
    "alpha": 0.50,
    "beta": 0.30,
    "gamma": 0.20,
    "mental_effort_low_max": 3,
    "mental_effort_moderate_max": 6,
    "likert_scale_max": 5,
    "guided_mastery_max": 0.49,
    "review_mastery_min": 0.68,
    "high_load_threshold": 0.67,
    "tutoring_min_questions": 5,
    "tutoring_consecutive_correct": 3,
    "tutoring_max_questions": 10,
    "misconception_remediation_repetitions": 2,
    "misconception_pause_repetitions": 3,
    "mode": "demo",
}


LEARNING_CONTENT = {
    "GM-AE": {
        "importance": "Physics formulas are algebraic expressions; rearranging and evaluating them correctly is essential before substituting measurements.",
        "terms": ["variable", "coefficient", "term", "operation order"],
        "formulas": ["a(b + c) = ab + ac"],
        "example": ("Simplify 3(v + 2) - v.", ["Distribute 3: 3v + 6 - v.", "Combine like terms: 2v + 6."], "2v + 6"),
        "guided": ("Evaluate 2x + 5 when x = 4.", "Substitute 4 for x before multiplying."),
        "independent": "Simplify 4(2m - 3) + m and evaluate it when m = 2.",
    },
    "GM-LE": {
        "importance": "Solving for an unknown lets you rearrange motion, force, energy, and momentum equations.",
        "terms": ["equation", "unknown", "inverse operation", "balance"],
        "formulas": ["ax + b = c → x = (c - b) / a"],
        "example": ("Solve 3x + 6 = 21.", ["Subtract 6 from both sides: 3x = 15.", "Divide both sides by 3."], "x = 5"),
        "guided": ("Solve 4t - 8 = 20.", "Add 8 to both sides, then divide by 4."),
        "independent": "Rearrange v = u + at to make t the subject.",
    },
    "GM-FG": {
        "importance": "Graphs reveal how physical quantities change and let slope and area carry physical meaning.",
        "terms": ["domain", "range", "independent variable", "slope", "intercept"],
        "formulas": ["slope = (y₂ - y₁) / (x₂ - x₁)"],
        "example": ("Find the slope through (1, 3) and (5, 11).", ["Change in y is 8.", "Change in x is 4.", "Divide 8 by 4."], "slope = 2"),
        "guided": ("What does a horizontal line on a position-time graph mean?", "A horizontal position value does not change with time."),
        "independent": "Sketch y = 2x + 1 and identify its slope and y-intercept.",
    },
    "GM-SN": {
        "importance": "Scientific notation keeps very large and very small physical measurements readable and calculable.",
        "terms": ["coefficient", "power of ten", "exponent", "significant figures"],
        "formulas": ["a × 10ⁿ, where 1 ≤ |a| < 10"],
        "example": ("Write 0.00045 in scientific notation.", ["Move the decimal 4 places right to get 4.5.", "A rightward move gives a negative exponent."], "4.5 × 10⁻⁴"),
        "guided": ("Compute (2 × 10³)(3 × 10²).", "Multiply coefficients and add exponents."),
        "independent": "Express 72,000,000 in scientific notation and divide it by 3 × 10².",
    },
    "GM-UC": {
        "importance": "Equations are reliable only when quantities use compatible units.",
        "terms": ["conversion factor", "dimensional analysis", "SI unit", "cancellation"],
        "formulas": ["value × (desired unit / given unit)"],
        "example": ("Convert 72 km/h to m/s.", ["Multiply by 1000 m / 1 km.", "Multiply by 1 h / 3600 s.", "Cancel km and h."], "20 m/s"),
        "guided": ("Convert 250 cm to meters.", "Use 1 m / 100 cm so centimeters cancel."),
        "independent": "Convert 5.4 m/s to km/h using dimensional analysis.",
    },
    "GM-TR": {
        "importance": "Vector components and many force problems depend on right-triangle ratios.",
        "terms": ["opposite", "adjacent", "hypotenuse", "angle"],
        "formulas": ["sin θ = opposite/hypotenuse", "cos θ = adjacent/hypotenuse", "tan θ = opposite/adjacent"],
        "example": ("A 10 N vector is 30° above horizontal. Find its x-component.", ["Use Fx = F cos θ.", "Substitute 10 cos 30°."], "Fx ≈ 8.66 N"),
        "guided": ("Find the opposite side when the hypotenuse is 12 and θ = 30°.", "Use opposite = hypotenuse × sin θ."),
        "independent": "Resolve a 20 N vector at 40° into horizontal and vertical components.",
    },
    "GP-SV": {
        "importance": "Direction matters for displacement, velocity, acceleration, force, and momentum.",
        "terms": ["scalar", "vector", "magnitude", "direction", "component"],
        "formulas": ["R = √(Rx² + Ry²)", "θ = tan⁻¹(Ry/Rx)"],
        "example": ("Add 3 m east and 4 m north.", ["Treat east and north as perpendicular components.", "Use the Pythagorean theorem.", "Find direction with tan⁻¹(4/3)."], "5 m, 53.1° north of east"),
        "guided": ("Is speed a scalar or vector?", "Ask whether direction is required to describe it."),
        "independent": "Find the resultant of 8 N east and 6 N west.",
    },
    "GP-MK": {
        "importance": "Kinematics describes motion and is prerequisite evidence for force, energy, and momentum.",
        "terms": ["displacement", "velocity", "acceleration", "time interval"],
        "formulas": ["v = u + at", "s = ut + ½at²", "v² = u² + 2as"],
        "example": ("A bicycle starts at 2 m/s and accelerates at 3 m/s² for 4 s.", ["Identify u = 2, a = 3, t = 4.", "Use v = u + at.", "Substitute: v = 2 + 3(4)."], "v = 14 m/s"),
        "guided": ("A car goes from 5 to 17 m/s in 4 s. Find acceleration.", "Use a = (v - u) / t."),
        "independent": "Find the displacement of an object starting from rest at 2 m/s² for 6 s.",
    },
    "GP-NL": {
        "importance": "Newton's laws connect forces to changes in motion and support later energy and momentum reasoning.",
        "terms": ["net force", "inertia", "mass", "acceleration", "action-reaction pair"],
        "formulas": ["ΣF = ma", "weight = mg"],
        "example": ("A 5 kg cart has a net force of 20 N.", ["Draw or identify the net force.", "Use a = ΣF/m.", "Substitute 20/5."], "a = 4 m/s²"),
        "guided": ("Find the weight of a 2 kg object using g = 9.8 m/s².", "Weight is a force: W = mg."),
        "independent": "A 10 kg crate is pulled right by 45 N while friction is 15 N left. Find its acceleration.",
    },
    "GP-WE": {
        "importance": "Energy methods often solve motion problems without tracking every force over every instant.",
        "terms": ["work", "kinetic energy", "potential energy", "power", "conservation"],
        "formulas": ["W = Fd cos θ", "KE = ½mv²", "PE = mgh", "P = W/t"],
        "example": ("Find the kinetic energy of a 2 kg object moving at 3 m/s.", ["Use KE = ½mv².", "Substitute ½(2)(3²)."], "KE = 9 J"),
        "guided": ("How much gravitational PE does 4 kg gain when lifted 2 m? Use g = 9.8.", "Use PE = mgh."),
        "independent": "A 50 N force moves a box 6 m in its direction. Find the work and average power over 3 s.",
    },
    "GP-MI": {
        "importance": "Momentum and impulse explain collisions, recoil, and how forces acting over time change motion.",
        "terms": ["momentum", "impulse", "collision", "isolated system", "conservation"],
        "formulas": ["p = mv", "J = FΔt = Δp", "Σp before = Σp after"],
        "example": ("A 0.5 kg ball moves at 8 m/s.", ["Use p = mv.", "Substitute 0.5(8).", "Keep the stated direction."], "p = 4 kg·m/s"),
        "guided": ("A 10 N force acts for 0.3 s. Find impulse.", "Use J = FΔt."),
        "independent": "A 2 kg cart at 3 m/s sticks to a stationary 1 kg cart. Find their common velocity.",
    },
}


def learning_content_for(concept: Concept, activity: Activity, mode: str) -> dict[str, Any]:
    source = LEARNING_CONTENT.get(concept.code, {})
    problem, steps, answer = source.get(
        "example",
        (
            f"Apply {concept.name} to the situation described in the mastery check.",
            ["Identify the known quantities.", "Choose the governing relationship.", "Substitute, solve, and check units."],
            "A justified result with correct units",
        ),
    )
    support = {
        "Guided pathway": "Use each hint and compare every line of the worked example.",
        "Standard pathway": "Try each prompt before revealing the hint.",
        "Faster review pathway": "Skim the explanation, then demonstrate mastery independently.",
    }.get(mode, "Work through the lesson in order.")
    depth = (
        "scaffolded"
        if mode == "Guided pathway"
        else "accelerated"
        if mode == "Faster review pathway"
        else "standard"
    )
    content = {
        "explanation": concept.description,
        "importance": source.get("importance", f"{concept.name} supports the next connected concepts in the prerequisite graph."),
        "key_terms": source.get("terms", [concept.name]),
        "formulas": source.get("formulas", []),
        "worked_example": {"problem": problem, "steps": steps, "answer": answer},
        "guided_practice": {
            "prompt": source.get("guided", (f"Explain one use of {concept.name}.", "Connect the concept to the worked example."))[0],
            "hint": source.get("guided", ("", "Review the worked example."))[1],
        },
        "independent_practice": source.get("independent", f"Complete a new {concept.name} problem without a hint."),
        "mastery_check": {
            "activity_id": activity.id,
            "title": activity.title,
            "evidence_required": "Submit the mastery check with at least 60% accuracy.",
        },
        "support_level": support,
        "adaptation": {
            "depth": depth,
            "reason": f"The {mode.lower()} controls hint density, example detail, and practice difficulty.",
        },
    }
    content["sections"] = [
        {"type": "introduction", "title": "Introduction", "content": concept.description},
        {"type": "objective", "title": "Learning objective", "content": f"Demonstrate and explain {concept.name}."},
        {"type": "prerequisite_recap", "title": "Prerequisite recap", "content": "Recall the connected prerequisite skills shown in your learning pathway."},
        {"type": "intuitive_explanation", "title": "Intuitive explanation", "content": content["importance"]},
        {"type": "formulas", "title": "Formal rule or formula", "content": content["formulas"]},
        {"type": "worked_example", "title": "Worked example", "content": content["worked_example"]},
        {"type": "guided_practice", "title": "Guided practice", "content": content["guided_practice"]},
        {"type": "independent_practice", "title": "Independent practice", "content": content["independent_practice"]},
        {"type": "misconceptions", "title": "Common mistakes", "content": "Use the wrong-answer feedback only when a teacher-reviewed distractor mapping provides evidence."},
        {"type": "extension", "title": "Real-world extension", "content": f"Connect {concept.name} to a measurable physics situation and justify the governing relationship."},
        {"type": "mastery_check", "title": "Mastery check", "content": content["mastery_check"]},
        {"type": "pathway_link", "title": "Pathway connection", "content": f"Completing this evidence can update the route toward your target competency."},
    ]
    return content


def get_setting(db: Session, key: str) -> Any:
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not setting:
        return DEFAULT_SETTINGS[key]
    return setting.value.get("value", DEFAULT_SETTINGS.get(key))


def settings_payload(db: Session) -> dict[str, Any]:
    return {key: get_setting(db, key) for key in DEFAULT_SETTINGS}


def save_settings(db: Session, values: dict[str, Any]) -> dict[str, Any]:
    for key, value in values.items():
        setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if setting:
            setting.value = {"value": value}
        else:
            db.add(
                SystemSetting(
                    key=key,
                    value={"value": value},
                    description=f"Configurable NeuroLearn-X setting: {key}",
                )
            )
    db.commit()
    return settings_payload(db)


def audit(
    db: Session,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | str | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details or {},
        )
    )


def mental_effort_category(db: Session, rating: int) -> str:
    if rating <= int(get_setting(db, "mental_effort_low_max")):
        return "Low"
    if rating <= int(get_setting(db, "mental_effort_moderate_max")):
        return "Moderate"
    return "High"


def latest_mastery_map(db: Session, student_id: int) -> dict[int, MasteryRecord]:
    records = list(
        db.scalars(
            select(MasteryRecord)
            .where(MasteryRecord.student_id == student_id)
            .order_by(MasteryRecord.created_at.desc())
        )
    )
    output: dict[int, MasteryRecord] = {}
    for record in records:
        output.setdefault(record.concept_id, record)
    return output


def recalculate_mastery(
    db: Session, student: User, concept_ids: set[int], attempt_id: int
) -> list[MasteryRecord]:
    threshold = float(get_setting(db, "mastery_threshold"))
    mode = str(get_setting(db, "mastery_mode"))
    results: list[MasteryRecord] = []
    for concept_id in concept_ids:
        rows = db.execute(
            select(
                AssessmentAttempt.id,
                func.sum(ItemResponse.earned_points),
                func.sum(ItemResponse.max_points),
            )
            .join(ItemResponse, ItemResponse.attempt_id == AssessmentAttempt.id)
            .join(Question, Question.id == ItemResponse.question_id)
            .where(
                AssessmentAttempt.student_id == student.id,
                Question.concept_id == concept_id,
            )
            .group_by(AssessmentAttempt.id, AssessmentAttempt.submitted_at)
            .order_by(AssessmentAttempt.submitted_at)
        ).all()
        evidence = [(float(earned or 0), float(maximum or 0)) for _, earned, maximum in rows]
        score = (
            (evidence[-1][0] / evidence[-1][1] if evidence and evidence[-1][1] else None)
            if mode == "latest"
            else weighted_mastery(evidence)
        )
        if score is None:
            continue
        record = MasteryRecord(
            student_id=student.id,
            concept_id=concept_id,
            attempt_id=attempt_id,
            mastery_score=score,
            classification=classify_mastery(score, threshold),
            calculation_mode=mode,
            is_demo=student.is_demo,
        )
        db.add(record)
        results.append(record)
        unresolved = list(
            db.scalars(
                select(LearningGap).where(
                    LearningGap.student_id == student.id,
                    LearningGap.concept_id == concept_id,
                    LearningGap.resolved_at.is_(None),
                )
            )
        )
        if score < threshold:
            if not unresolved:
                db.add(
                    LearningGap(
                        student_id=student.id,
                        concept_id=concept_id,
                        mastery_score=score,
                        threshold=threshold,
                        reason=(
                            f"Mastery is {score:.0%}, below the configured "
                            f"{threshold:.0%} threshold."
                        ),
                        is_demo=student.is_demo,
                    )
                )
            else:
                for gap in unresolved:
                    gap.mastery_score = score
                    gap.threshold = threshold
        else:
            for gap in unresolved:
                gap.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return results


def _activity_options(db: Session, concept_id: int) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .join(ActivityConcept, ActivityConcept.activity_id == Activity.id)
            .where(
                ActivityConcept.concept_id == concept_id,
                Activity.active.is_(True),
                Activity.is_diagnostic.is_(False),
            )
            .order_by(Activity.difficulty, Activity.estimated_minutes)
        )
    )


def _select_activity(options: list[Activity], mode: str) -> Activity:
    if mode == "Guided pathway":
        return min(options, key=lambda item: (item.difficulty, -item.estimated_minutes))
    if mode == "Faster review pathway":
        return min(options, key=lambda item: (item.estimated_minutes, item.difficulty))
    return min(options, key=lambda item: (abs(item.difficulty - 3), item.estimated_minutes))


def adaptive_evidence(
    db: Session, student_id: int, relevant_nodes: set[int]
) -> dict[str, Any]:
    interactions = list(
        db.scalars(
            select(InteractionLog)
            .where(
                InteractionLog.student_id == student_id,
                InteractionLog.concept_id.in_(relevant_nodes),
            )
            .order_by(InteractionLog.submission_time.desc())
            .limit(24)
        )
    )
    history = list(
        db.scalars(
            select(MasteryRecord)
            .where(
                MasteryRecord.student_id == student_id,
                MasteryRecord.concept_id.in_(relevant_nodes),
            )
            .order_by(MasteryRecord.created_at.desc())
            .limit(24)
        )
    )
    ratings = list(
        db.scalars(
            select(MentalEffortRating)
            .where(MentalEffortRating.student_id == student_id)
            .order_by(MentalEffortRating.created_at.desc())
            .limit(8)
        )
    )
    recent_scores = [record.mastery_score for record in history[:8]]
    older_scores = [record.mastery_score for record in history[8:16]]
    recent_average = sum(recent_scores) / len(recent_scores) if recent_scores else 0
    older_average = sum(older_scores) / len(older_scores) if older_scores else recent_average
    response_count = db.scalar(
        select(func.count(ItemResponse.id))
        .join(AssessmentAttempt, AssessmentAttempt.id == ItemResponse.attempt_id)
        .join(Question, Question.id == ItemResponse.question_id)
        .where(
            AssessmentAttempt.student_id == student_id,
            Question.concept_id.in_(relevant_nodes),
            ItemResponse.skipped.is_(False),
        )
    ) or 0
    score_consistency = (
        max(0.0, 1.0 - pstdev(recent_scores)) if len(recent_scores) >= 2 else None
    )
    latest_at = interactions[0].submission_time if interactions else None
    return {
        "incorrect_rate": (
            sum(1 - row.response_accuracy for row in interactions) / len(interactions)
            if interactions
            else 1.0
        ),
        "average_response_seconds": (
            sum(row.average_response_seconds for row in interactions) / len(interactions)
            if interactions
            else 0
        ),
        "attempts": max((row.number_of_attempts for row in interactions), default=0),
        "skips": sum(row.skipped_items for row in interactions),
        "hints": sum(row.hint_usage_count for row in interactions),
        "effort": ratings[0].rating if ratings else None,
        "effort_category": ratings[0].category if ratings else "Not rated",
        "mastery_average": recent_average,
        "mastery_trend": recent_average - older_average,
        "history_items": len(interactions),
        "valid_response_count": response_count,
        "latest_evidence_at": latest_at.isoformat() if latest_at else None,
        "score_consistency": score_consistency,
        "interaction_completeness": (
            sum(
                1
                for row in interactions
                if row.total_completion_seconds > 0
                and row.average_response_seconds > 0
            )
            / len(interactions)
            if interactions
            else 0
        ),
    }


def evidence_confidence(evidence: dict[str, Any], prerequisite_complete: float) -> tuple[str, list[str]]:
    criteria = [
        evidence["valid_response_count"] >= 10,
        evidence["history_items"] >= 3,
        evidence["effort"] is not None,
        evidence["score_consistency"] is not None,
        evidence["interaction_completeness"] >= 0.75,
        prerequisite_complete >= 0.75,
    ]
    met = sum(criteria)
    level = "High" if met >= 5 else "Moderate" if met >= 3 else "Low"
    reasons = [
        f"{evidence['valid_response_count']} valid item response(s)",
        f"{evidence['history_items']} interaction record(s)",
        (
            f"score consistency {evidence['score_consistency']:.2f}"
            if evidence["score_consistency"] is not None
            else "score consistency unavailable"
        ),
        f"interaction completeness {evidence['interaction_completeness']:.0%}",
        f"prerequisite evidence completeness {prerequisite_complete:.0%}",
        f"mental effort {'available' if evidence['effort'] is not None else 'not yet rated'}",
    ]
    return level, reasons


def expected_mastery_improvement(
    db: Session, student_id: int, concept_ids: list[int]
) -> dict[str, Any]:
    records = list(
        db.scalars(
            select(MasteryRecord)
            .where(
                MasteryRecord.student_id == student_id,
                MasteryRecord.concept_id.in_(concept_ids),
            )
            .order_by(MasteryRecord.created_at)
        )
    )
    deltas = [
        current.mastery_score - previous.mastery_score
        for previous, current in zip(records, records[1:])
        if current.concept_id == previous.concept_id
    ]
    if len(deltas) < 3:
        return {
            "available": False,
            "sample_size": len(deltas),
            "message": "An estimated mastery improvement is not shown because fewer than three comparable learner changes are available.",
        }
    estimate = sum(deltas) / len(deltas)
    return {
        "available": True,
        "sample_size": len(deltas),
        "estimated_change": estimate,
        "message": f"Comparable learner records suggest an average mastery change of {estimate:+.0%}; this is an estimate, not a guaranteed outcome.",
    }


def performance_mode(db: Session, evidence: dict[str, Any], predicted_load: float) -> str:
    if (
        evidence["mastery_average"] <= float(get_setting(db, "guided_mastery_max"))
        or evidence["effort_category"] == "High"
        or predicted_load >= float(get_setting(db, "high_load_threshold"))
        or evidence["incorrect_rate"] >= 0.55
        or evidence["skips"] + evidence["hints"] >= 3
    ):
        return "Guided pathway"
    if (
        evidence["mastery_average"] >= float(get_setting(db, "review_mastery_min"))
        and evidence["mastery_trend"] >= -0.05
        and evidence["incorrect_rate"] <= 0.35
    ):
        return "Faster review pathway"
    return "Standard pathway"


def _record_pathway_version(
    db: Session,
    student_id: int,
    pathway: PathwayRecommendation,
    previous: PathwayRecommendation | None,
    trigger_type: str,
    trigger_id: int | None,
    previous_state: dict[str, Any],
    updated_state: dict[str, Any],
) -> None:
    count = db.scalar(
        select(func.count(PathwayVersion.id)).where(
            PathwayVersion.student_id == student_id
        )
    ) or 0
    changed = previous is None or (
        previous.label != pathway.label
        or previous.target_concept_id != pathway.target_concept_id
        or previous.adaptive_pathway_score != pathway.adaptive_pathway_score
    )
    reason = (
        f"{trigger_type} produced a new selected route after mastery, gap, cognitive-load, and time evidence were recalculated."
        if changed
        else f"{trigger_type} refreshed the evidence; the selected route remained appropriate."
    )
    db.add(
        PathwayVersion(
            student_id=student_id,
            pathway_id=pathway.id,
            previous_pathway_id=previous.id if previous else None,
            version_number=count + 1,
            trigger_type=trigger_type,
            trigger_id=trigger_id,
            change_reason=reason,
            previous_state=previous_state,
            updated_state=updated_state,
        )
    )


def generate_pathways(
    db: Session,
    student: User,
    trigger_type: str = "Evidence refresh",
    trigger_id: int | None = None,
) -> list[PathwayRecommendation]:
    # Serialize pathway decisions for one learner so simultaneous evidence
    # updates cannot leave competing active recommendations in PostgreSQL.
    profile = db.scalar(
        select(StudentProfile)
        .where(StudentProfile.user_id == student.id)
        .with_for_update()
    )
    if not profile or not profile.target_concept_id:
        return []
    previous_selected = db.scalar(
        select(PathwayRecommendation)
        .where(
            PathwayRecommendation.student_id == student.id,
            PathwayRecommendation.active.is_(True),
            PathwayRecommendation.selected.is_(True),
        )
        .order_by(PathwayRecommendation.created_at.desc())
    )
    assigned = db.scalar(
        select(PathwayRecommendation)
        .where(
            PathwayRecommendation.student_id == student.id,
            PathwayRecommendation.active.is_(True),
            PathwayRecommendation.selected.is_(True),
            PathwayRecommendation.source_type == "Teacher",
        )
        .order_by(PathwayRecommendation.created_at.desc())
    )
    if assigned:
        return [assigned]
    target = db.get(Concept, profile.target_concept_id)
    edges = db.execute(
        select(
            PrerequisiteEdge.prerequisite_concept_id,
            PrerequisiteEdge.succeeding_concept_id,
        ).where(PrerequisiteEdge.active.is_(True))
    ).all()
    ancestors = prerequisite_ancestors(edges, target.id)
    relevant_nodes = ancestors | {target.id}
    ordered = topological_order(relevant_nodes, edges)
    mastery = latest_mastery_map(db, student.id)
    threshold = float(get_setting(db, "mastery_threshold"))
    missing_or_unmastered = [
        concept_id
        for concept_id in ordered
        if concept_id not in mastery
        or mastery[concept_id].mastery_score < threshold
    ]
    if not missing_or_unmastered:
        for old in db.scalars(
            select(PathwayRecommendation).where(
                PathwayRecommendation.student_id == student.id,
                PathwayRecommendation.active.is_(True),
                PathwayRecommendation.source_type == "Automatic",
            )
        ):
            old.active = False
            old.selected = False
        record = PathwayRecommendation(
            student_id=student.id,
            target_concept_id=target.id,
            label="Mastery maintained",
            selected=True,
            gap_coverage=1,
            predicted_cognitive_load=0,
            normalized_learning_time=0,
            adaptive_pathway_score=1,
            total_minutes=0,
            cognitive_load_category="Low",
            cognitive_load_probabilities={"Low": 1, "Moderate": 0, "High": 0},
            explanation=(
                f"No repeat activity was assigned because {target.name} and every "
                "connected prerequisite meet the configured mastery threshold."
            ),
            feature_explanation={"method": "Mastery threshold rule"},
            decision_explanation={
                "current_mastery": mastery[target.id].mastery_score if target.id in mastery else None,
                "mastery_threshold": threshold,
                "mastery_gap": 0,
                "target_competency": {"id": target.id, "code": target.code, "name": target.name},
                "prerequisite_chain": [target.name],
                "selection_reason": "No repeat activity was selected because all required competencies meet the configured threshold.",
                "alternatives_not_selected": [],
                "expected_improvement": {"available": False, "message": "No improvement estimate is needed while mastery is maintained."},
                "confidence": {"level": "High", "criteria": ["All required mastery records meet the threshold"]},
            },
            evidence_confidence="High",
            source_type="Automatic",
            active=True,
            is_demo=student.is_demo,
        )
        db.add(record)
        db.flush()
        _record_pathway_version(
            db,
            student.id,
            record,
            previous_selected,
            trigger_type,
            trigger_id,
            {"selected": previous_selected.label if previous_selected else None},
            {"selected": record.label, "mastery_maintained": True},
        )
        db.commit()
        db.refresh(record)
        return [record]
    available = {
        concept_id: _activity_options(db, concept_id) for concept_id in missing_or_unmastered
    }
    missing_or_unmastered = [
        concept_id for concept_id in missing_or_unmastered if available[concept_id]
    ]
    if not missing_or_unmastered:
        return []
    labels = ["Guided pathway", "Standard pathway", "Faster review pathway"]
    candidates: list[Candidate] = []
    feature_details: dict[str, dict] = {}
    for label in labels:
        chosen: list[Activity] = []
        loads: list[float] = []
        feature_details[label] = {}
        for concept_id in missing_or_unmastered:
            activity = _select_activity(available[concept_id], label)
            concept = db.get(Concept, concept_id)
            prediction = predict_activity_load(
                db, student.id, activity, concept_id, concept.difficulty
            )
            chosen.append(activity)
            loads.append(prediction["index"])
            feature_details[label][str(activity.id)] = prediction
        candidates.append(
            Candidate(
                label=label,
                activity_ids=[activity.id for activity in chosen],
                concept_ids=missing_or_unmastered.copy(),
                loads=loads,
                total_minutes=sum(activity.estimated_minutes for activity in chosen),
                gap_coverage=gap_coverage(
                    len(chosen), len(missing_or_unmastered)
                ),
            )
        )
    ranked = rank_candidates(
        candidates,
        float(get_setting(db, "alpha")),
        float(get_setting(db, "beta")),
        float(get_setting(db, "gamma")),
    )
    evidence = adaptive_evidence(db, student.id, relevant_nodes)
    prerequisite_evidence_complete = sum(
        1 for concept_id in relevant_nodes if concept_id in mastery
    ) / max(1, len(relevant_nodes))
    confidence, confidence_reasons = evidence_confidence(
        evidence, prerequisite_evidence_complete
    )
    improvement = expected_mastery_improvement(
        db, student.id, missing_or_unmastered
    )
    selected_label = ranked[0].label
    best = ranked[0]
    best_activity = db.get(Activity, best.activity_ids[0])
    best_concept = db.get(Concept, best.concept_ids[0])
    feature_details[best.label][str(best_activity.id)] = predict_activity_load(
        db,
        student.id,
        best_activity,
        best_concept.id,
        best_concept.difficulty,
        explain=trigger_type != "Optimization settings updated",
    )
    for old in db.scalars(
        select(PathwayRecommendation).where(
            PathwayRecommendation.student_id == student.id,
            PathwayRecommendation.active.is_(True),
            PathwayRecommendation.source_type == "Automatic",
        )
    ):
        old.active = False
        old.selected = False
    concept_names = {
        concept_id: db.get(Concept, concept_id).name for concept_id in missing_or_unmastered
    }
    records: list[PathwayRecommendation] = []
    selected_candidate = ranked[0]
    alternative_details = [
        {
            "label": item.label,
            "adaptive_pathway_score": item.score,
            "gap_coverage": item.gap_coverage,
            "predicted_cognitive_load": item.predicted_load,
            "total_minutes": item.total_minutes,
            "why_not_selected": (
                "Its APS ranked below the selected candidate after applying gap coverage, cognitive load, learning time, and the documented tie-breaker."
                if item.label != selected_label
                else "Selected"
            ),
        }
        for item in ranked
        if item.label != selected_label
    ]
    for rank, candidate in enumerate(ranked):
        details = feature_details[candidate.label]
        aggregate_probabilities = {
            category: sum(
                details[str(activity_id)]["probabilities"][category]
                for activity_id in candidate.activity_ids
            )
            / len(candidate.activity_ids)
            for category in ("Low", "Moderate", "High")
        }
        load_category = max(aggregate_probabilities, key=aggregate_probabilities.get)
        gap_phrases = []
        for concept_id in missing_or_unmastered:
            score = mastery.get(concept_id)
            if score:
                gap_phrases.append(
                    f"{concept_names[concept_id]} ({score.mastery_score:.0%} mastery)"
                )
            else:
                gap_phrases.append(f"{concept_names[concept_id]} (not yet assessed)")
        explanation = (
            f"{candidate.label} was ranked {'first' if rank == 0 else f'#{rank + 1}'} "
            f"because it covers {candidate.gap_coverage:.0%} of the relevant gaps, "
            f"has an expected cognitive-load index of {candidate.predicted_load:.2f}, "
            f"and takes about {candidate.total_minutes} minutes. It follows the "
            f"prerequisite chain {' → '.join(concept_names[item] for item in missing_or_unmastered)}. "
            f"Evidence considered: {', '.join(gap_phrases)}."
        )
        explanation += (
            f" Performance signals: {evidence['incorrect_rate']:.0%} incorrect, "
            f"{evidence['average_response_seconds']:.1f}s average response time, "
            f"{evidence['attempts']} attempt(s), {evidence['skips']} skip(s), "
            f"{evidence['hints']} hint(s), {evidence['effort_category']} effort, "
            f"and mastery trend {evidence['mastery_trend']:+.0%}. "
            f"{selected_label} was selected because it has the highest valid APS."
        )
        target_mastery = mastery.get(target.id)
        focus_id = missing_or_unmastered[0]
        focus_mastery = mastery.get(focus_id)
        decision = {
            "current_mastery": target_mastery.mastery_score if target_mastery else None,
            "mastery_threshold": threshold,
            "mastery_gap": (
                max(0.0, threshold - target_mastery.mastery_score)
                if target_mastery
                else None
            ),
            "target_competency": {"id": target.id, "code": target.code, "name": target.name},
            "prerequisite_chain": [concept_names[item] for item in missing_or_unmastered],
            "selected_gap": {
                "concept_id": focus_id,
                "concept": concept_names[focus_id],
                "mastery": focus_mastery.mastery_score if focus_mastery else None,
                "gap": max(0.0, threshold - focus_mastery.mastery_score) if focus_mastery else None,
                "reason": "This is the earliest unmastered or unassessed competency in the prerequisite order.",
            },
            "cognitive_load": {
                "index": candidate.predicted_load,
                "category": load_category,
                "probabilities": aggregate_probabilities,
            },
            "evidence_used": evidence,
            "activity_benefit": (
                f"The route targets {len(candidate.concept_ids)} required competency area(s) in prerequisite order with {candidate.label.lower()} support."
            ),
            "estimated_time_minutes": candidate.total_minutes,
            "adaptive_pathway_score": candidate.score,
            "confidence": {"level": confidence, "criteria": confidence_reasons},
            "expected_improvement": improvement,
            "selection_reason": (
                f"{selected_label} was selected because it has the highest APS ({selected_candidate.score:.3f}); ties use greater gap coverage, lower cognitive load, then shorter time."
                if candidate.label == selected_label
                else f"This candidate was rejected because its APS ranked below {selected_label}; ties use greater gap coverage, lower cognitive load, then shorter time."
            ),
            "alternatives_not_selected": alternative_details,
            "formula": "APS = alpha(gap coverage) + beta(1 - cognitive load) + gamma(1 - normalized time)",
            "weights": {
                "alpha": float(get_setting(db, "alpha")),
                "beta": float(get_setting(db, "beta")),
                "gamma": float(get_setting(db, "gamma")),
            },
        }
        record = PathwayRecommendation(
            student_id=student.id,
            target_concept_id=target.id,
            label=candidate.label,
            selected=candidate.label == selected_label,
            gap_coverage=candidate.gap_coverage,
            predicted_cognitive_load=candidate.predicted_load,
            normalized_learning_time=candidate.normalized_time,
            adaptive_pathway_score=candidate.score,
            total_minutes=candidate.total_minutes,
            cognitive_load_category=load_category,
            cognitive_load_probabilities=aggregate_probabilities,
            explanation=explanation,
            feature_explanation={
                "method": next(iter(details.values()))["source"],
                "features": next(iter(details.values()))["explanation"],
                "warning": next(iter(details.values())).get("warning"),
                "signals": evidence,
                "selection_rule": selected_label,
            },
            decision_explanation=decision,
            evidence_confidence=confidence,
            source_type="Automatic",
            active=True,
            is_demo=student.is_demo,
        )
        db.add(record)
        db.flush()
        for position, (concept_id, activity_id, load) in enumerate(
            zip(candidate.concept_ids, candidate.activity_ids, candidate.loads), start=1
        ):
            concept = db.get(Concept, concept_id)
            activity = db.get(Activity, activity_id)
            score = mastery.get(concept_id)
            db.add(
                PathwayStep(
                    pathway_id=record.id,
                    concept_id=concept_id,
                    activity_id=activity_id,
                    position=position,
                    predicted_load_index=load,
                    selection_reason=(
                        f"{concept.name} is connected to {target.name}; "
                        + (
                            f"mastery {score.mastery_score:.0%} is below the configured threshold."
                            if score
                            else "no mastery evidence is available yet."
                        )
                    ),
                    content=learning_content_for(concept, activity, candidate.label),
                    required=True,
                )
            )
        records.append(record)
    chosen_record = next(record for record in records if record.selected)
    _record_pathway_version(
        db,
        student.id,
        chosen_record,
        previous_selected,
        trigger_type,
        trigger_id,
        {
            "selected": previous_selected.label if previous_selected else None,
            "mastery": {
                str(concept_id): row.mastery_score for concept_id, row in mastery.items()
            },
        },
        {
            "selected": chosen_record.label,
            "adaptive_pathway_score": chosen_record.adaptive_pathway_score,
            "gaps": missing_or_unmastered,
            "confidence": confidence,
        },
    )
    db.commit()
    for record in records:
        db.refresh(record)
    return records


def build_pathway_preview(
    db: Session,
    student: User,
    target_concept_id: int,
    mode_override: str | None = None,
) -> dict[str, Any]:
    target = db.get(Concept, target_concept_id)
    if not target:
        return {}
    edge_pairs = db.execute(
        select(
            PrerequisiteEdge.prerequisite_concept_id,
            PrerequisiteEdge.succeeding_concept_id,
        ).where(PrerequisiteEdge.active.is_(True))
    ).all()
    relevant_nodes = prerequisite_ancestors(edge_pairs, target.id) | {target.id}
    ordered = topological_order(relevant_nodes, edge_pairs)
    mastery = latest_mastery_map(db, student.id)
    threshold = float(get_setting(db, "mastery_threshold"))
    needed = [
        concept_id
        for concept_id in ordered
        if concept_id not in mastery or mastery[concept_id].mastery_score < threshold
    ]
    if not needed:
        needed = [target.id]
    evidence = adaptive_evidence(db, student.id, relevant_nodes)
    standard_loads = []
    for concept_id in needed:
        options = _activity_options(db, concept_id)
        if options:
            selected = _select_activity(options, "Standard pathway")
            standard_loads.append(
                predict_activity_load(
                    db,
                    student.id,
                    selected,
                    concept_id,
                    db.get(Concept, concept_id).difficulty,
                )["index"]
            )
    mode = mode_override or performance_mode(
        db, evidence, sum(standard_loads) / max(1, len(standard_loads))
    )
    steps = []
    for position, concept_id in enumerate(needed, start=1):
        options = _activity_options(db, concept_id)
        if not options:
            continue
        concept = db.get(Concept, concept_id)
        activity = _select_activity(options, mode)
        prediction = predict_activity_load(
            db, student.id, activity, concept_id, concept.difficulty
        )
        score = mastery.get(concept_id)
        steps.append(
            {
                "position": position,
                "concept_id": concept.id,
                "concept": concept.name,
                "activity_id": activity.id,
                "activity": activity.title,
                "activity_type": activity.activity_type,
                "estimated_minutes": activity.estimated_minutes,
                "predicted_load_index": prediction["index"],
                "selection_reason": (
                    f"{concept.name} is in the prerequisite chain to {target.name}; "
                    + (
                        f"mastery is {score.mastery_score:.0%}."
                        if score
                        else "mastery has not yet been demonstrated."
                    )
                ),
                "content": learning_content_for(concept, activity, mode),
            }
        )
    return {
        "target_concept_id": target.id,
        "target_concept": target.name,
        "difficulty": mode,
        "evidence": evidence,
        "steps": steps,
        "available_activities": [
            {
                "activity_id": activity.id,
                "activity": activity.title,
                "concept_id": concept_id,
                "concept": db.get(Concept, concept_id).name,
                "estimated_minutes": activity.estimated_minutes,
                "difficulty": activity.difficulty,
            }
            for concept_id in ordered
            for activity in _activity_options(db, concept_id)
        ],
    }


def record_pathway_evidence(
    db: Session, student_id: int, activity_id: int, attempt: AssessmentAttempt
) -> list[int]:
    if attempt.accuracy < 0.60:
        return []
    steps = list(
        db.scalars(
            select(PathwayStep)
            .join(
                PathwayRecommendation,
                PathwayRecommendation.id == PathwayStep.pathway_id,
            )
            .where(
                PathwayRecommendation.student_id == student_id,
                PathwayRecommendation.active.is_(True),
                PathwayStep.activity_id == activity_id,
                PathwayStep.completed_at.is_(None),
            )
        )
    )
    for step in steps:
        step.completed_at = attempt.submitted_at
        step.completion_attempt_id = attempt.id
    return [step.id for step in steps]


def serialize_pathway(db: Session, pathway: PathwayRecommendation) -> dict[str, Any]:
    steps = list(
        db.scalars(
            select(PathwayStep)
            .where(PathwayStep.pathway_id == pathway.id)
            .order_by(PathwayStep.position)
        )
    )
    versions = list(
        db.scalars(
            select(PathwayVersion)
            .where(PathwayVersion.pathway_id == pathway.id)
            .order_by(PathwayVersion.version_number.desc())
        )
    )
    return {
        "id": pathway.id,
        "label": pathway.label,
        "selected": pathway.selected,
        "target_concept": db.get(Concept, pathway.target_concept_id).name,
        "gap_coverage": pathway.gap_coverage,
        "predicted_cognitive_load": pathway.predicted_cognitive_load,
        "normalized_learning_time": pathway.normalized_learning_time,
        "adaptive_pathway_score": pathway.adaptive_pathway_score,
        "total_minutes": pathway.total_minutes,
        "cognitive_load_category": pathway.cognitive_load_category,
        "cognitive_load_probabilities": pathway.cognitive_load_probabilities,
        "explanation": pathway.explanation,
        "feature_explanation": pathway.feature_explanation,
        "decision_explanation": pathway.decision_explanation,
        "evidence_confidence": pathway.evidence_confidence,
        "source_type": pathway.source_type,
        "assigned_by": pathway.assigned_by,
        "assigned_at": pathway.assigned_at,
        "due_at": pathway.due_at,
        "teacher_note": pathway.teacher_note,
        "learner_notified": pathway.learner_notified,
        "supersedes_pathway_id": pathway.supersedes_pathway_id,
        "difficulty_override": pathway.difficulty_override,
        "created_at": pathway.created_at,
        "versions": [
            {
                "id": version.id,
                "version_number": version.version_number,
                "trigger_type": version.trigger_type,
                "trigger_id": version.trigger_id,
                "change_reason": version.change_reason,
                "previous_state": version.previous_state,
                "updated_state": version.updated_state,
                "created_at": version.created_at,
            }
            for version in versions
        ],
        "steps": [
            {
                "id": step.id,
                "position": step.position,
                "concept_id": step.concept_id,
                "concept": db.get(Concept, step.concept_id).name,
                "activity_id": step.activity_id,
                "activity": db.get(Activity, step.activity_id).title,
                "activity_type": db.get(Activity, step.activity_id).activity_type,
                "difficulty": db.get(Activity, step.activity_id).difficulty,
                "estimated_minutes": db.get(Activity, step.activity_id).estimated_minutes,
                "predicted_load_index": step.predicted_load_index,
                "completed_at": step.completed_at,
                "selection_reason": step.selection_reason,
                "content": step.content,
                "required": step.required,
                "completion_attempt_id": step.completion_attempt_id,
            }
            for step in steps
        ],
    }
