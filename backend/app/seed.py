from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .ml import train_ensemble
from .models import (
    Activity,
    ActivityConcept,
    AnswerChoice,
    AssessmentAttempt,
    AuditLog,
    Concept,
    ConsentRecord,
    ExpertEvaluation,
    InteractionLog,
    ItemResponse,
    LearningGap,
    LearningSummary,
    MasteryRecord,
    MentalEffortRating,
    Misconception,
    MisconceptionHistory,
    ModelVersion,
    PathwayRecommendation,
    PathwayStep,
    PathwayVersion,
    PrerequisiteEdge,
    Question,
    StudentProfile,
    SystemSetting,
    TeacherIntervention,
    TutoringResponse,
    TutoringSession,
    User,
)
from .security import hash_password
from .onboarding import ensure_onboarding_diagnostic
from .services import DEFAULT_SETTINGS, generate_pathways, save_settings


CONCEPTS = [
    ("GM-AE", "Algebraic Expressions", "General Mathematics", 1, "Translate, simplify, and evaluate algebraic expressions."),
    ("GM-LE", "Linear Equations", "General Mathematics", 2, "Solve and interpret equations with one unknown."),
    ("GM-FG", "Functions and Graphs", "General Mathematics", 2, "Relate functions, tables, equations, and graphs."),
    ("GM-SN", "Scientific Notation", "General Mathematics", 2, "Represent and calculate very large and small quantities."),
    ("GM-UC", "Unit Conversion", "General Mathematics", 2, "Use conversion factors while preserving physical quantity."),
    ("GM-TR", "Trigonometric Ratios", "General Mathematics", 3, "Use sine, cosine, and tangent in right triangles."),
    ("GP-SV", "Scalars and Vectors", "General Physics", 2, "Distinguish scalar and vector quantities and resolve components."),
    ("GP-MK", "Motion and Kinematics", "General Physics", 3, "Describe motion using displacement, velocity, acceleration, and graphs."),
    ("GP-NL", "Newton's Laws of Motion", "General Physics", 4, "Analyze forces and motion using Newton's three laws."),
    ("GP-WE", "Work and Energy", "General Physics", 4, "Relate work, kinetic energy, potential energy, and power."),
    ("GP-MI", "Momentum and Impulse", "General Physics", 4, "Apply momentum, impulse, and conservation principles."),
]

EDGES = [
    ("GM-AE", "GM-LE"),
    ("GM-AE", "GM-FG"),
    ("GM-SN", "GM-UC"),
    ("GM-TR", "GP-SV"),
    ("GM-LE", "GP-MK"),
    ("GM-FG", "GP-MK"),
    ("GM-UC", "GP-MK"),
    ("GP-SV", "GP-NL"),
    ("GP-MK", "GP-NL"),
    ("GP-NL", "GP-WE"),
    ("GP-NL", "GP-MI"),
]


QUESTION_BANK = {
    "GM-AE": [
        ("Simplify 3x + 2x.", ["5x", "6x", "5x²", "x"], 0, "Combine like terms.", "The coefficients 3 and 2 add to 5."),
        ("Evaluate 2a + 3 when a = 4.", ["8", "10", "11", "14"], 2, "Substitute 4 for a first.", "2(4) + 3 = 11."),
        ("Expand 4(x + 2).", ["4x + 2", "4x + 6", "4x + 8", "x + 8"], 2, "Distribute 4 to both terms.", "4·x + 4·2 = 4x + 8."),
        ("Which terms are like terms?", ["3x and 3y", "2x and 5x", "x and x²", "4 and 4x"], 1, "Like terms have identical variables and exponents.", "2x and 5x share the same variable part."),
        ("Simplify 7m − 2m + 4.", ["5m + 4", "9m + 4", "5m", "9m"], 0, "Combine only the m terms.", "7m − 2m = 5m, while 4 remains."),
    ],
    "GM-LE": [
        ("Solve x + 7 = 12.", ["3", "5", "7", "19"], 1, "Subtract 7 from both sides.", "x = 12 − 7 = 5."),
        ("Solve 3x = 18.", ["5", "6", "15", "54"], 1, "Divide both sides by 3.", "x = 18 ÷ 3 = 6."),
        ("Solve 2x + 4 = 14.", ["4", "5", "7", "9"], 1, "Subtract 4, then divide by 2.", "2x = 10, so x = 5."),
        ("Which equation represents 'five more than x is 11'?", ["5x = 11", "x − 5 = 11", "x + 5 = 11", "5 + 11 = x"], 2, "'More than' signals addition.", "x + 5 = 11 matches the statement."),
        ("If v = d/t, which equation solves for d?", ["d = v/t", "d = vt", "d = t/v", "d = v + t"], 1, "Multiply both sides by t.", "vt = d."),
    ],
    "GM-FG": [
        ("For f(x)=2x+1, find f(3).", ["5", "6", "7", "8"], 2, "Replace x with 3.", "2(3)+1 = 7."),
        ("What is the slope of y=4x−2?", ["−2", "2", "4", "6"], 2, "Use y=mx+b.", "The coefficient m is 4."),
        ("A horizontal line has what slope?", ["−1", "0", "1", "Undefined"], 1, "Its rise is zero.", "Zero rise divided by run is 0."),
        ("Which ordered pair lies on y=x+2?", ["(0,0)", "(1,2)", "(2,4)", "(4,1)"], 2, "Substitute each x value.", "For (2,4), 4=2+2."),
        ("On a position-time graph, slope represents:", ["Acceleration", "Velocity", "Force", "Mass"], 1, "Slope is change in position over time.", "Change in position per time is velocity."),
    ],
    "GM-SN": [
        ("Write 4,500 in scientific notation.", ["4.5×10²", "4.5×10³", "45×10³", "0.45×10⁴"], 1, "Move the decimal three places left.", "4,500 = 4.5×10³."),
        ("Write 3.2×10⁻³ in decimal form.", ["0.0032", "0.032", "320", "3200"], 0, "Move the decimal three places left.", "3.2×10⁻³ = 0.0032."),
        ("Compute (2×10³)(3×10²).", ["5×10⁵", "6×10⁵", "6×10⁶", "6×10¹"], 1, "Multiply coefficients and add exponents.", "2·3=6 and 3+2=5."),
        ("Which is normalized scientific notation?", ["12×10²", "0.8×10⁴", "8×10³", "80×10²"], 2, "The coefficient must be at least 1 and less than 10.", "8×10³ is normalized."),
        ("What is the order of magnitude of 6.1×10⁷?", ["10⁶", "10⁷", "10⁸", "7"], 1, "Use its power of ten.", "The stated power is 10⁷."),
    ],
    "GM-UC": [
        ("Convert 2.5 m to cm.", ["0.025 cm", "25 cm", "250 cm", "2500 cm"], 2, "One meter is 100 centimeters.", "2.5×100 = 250 cm."),
        ("Convert 72 km/h to m/s.", ["10 m/s", "20 m/s", "36 m/s", "72 m/s"], 1, "Divide km/h by 3.6.", "72÷3.6 = 20 m/s."),
        ("Convert 500 g to kg.", ["0.5 kg", "5 kg", "50 kg", "500,000 kg"], 0, "One kilogram is 1000 grams.", "500÷1000 = 0.5 kg."),
        ("Which factor converts seconds to minutes?", ["60 min/1 s", "1 min/60 s", "1 s/60 min", "60 s/1 min when multiplying seconds"], 1, "Choose a factor that cancels seconds.", "Multiplying by 1 min/60 s cancels seconds."),
        ("3.0 km equals:", ["30 m", "300 m", "3000 m", "30,000 m"], 2, "One kilometer is 1000 meters.", "3.0×1000 = 3000 m."),
    ],
    "GM-TR": [
        ("In a right triangle, sin θ equals:", ["adjacent/hypotenuse", "opposite/hypotenuse", "opposite/adjacent", "hypotenuse/opposite"], 1, "Recall SOH.", "Sine is opposite over hypotenuse."),
        ("In a right triangle, cos θ equals:", ["adjacent/hypotenuse", "opposite/hypotenuse", "opposite/adjacent", "hypotenuse/adjacent"], 0, "Recall CAH.", "Cosine is adjacent over hypotenuse."),
        ("If opposite=3 and adjacent=4, tan θ is:", ["3/5", "4/5", "3/4", "4/3"], 2, "Tangent is opposite over adjacent.", "tan θ = 3/4."),
        ("A vector of 10 N at 0° has x-component:", ["0 N", "5 N", "10 N", "20 N"], 2, "Use Fx=F cos θ.", "10 cos 0° = 10 N."),
        ("Which theorem finds the hypotenuse?", ["Slope formula", "Pythagorean theorem", "Quadratic formula", "Product rule"], 1, "Use a²+b²=c².", "The Pythagorean theorem relates right-triangle sides."),
    ],
    "GP-SV": [
        ("Which quantity is a vector?", ["Mass", "Time", "Temperature", "Velocity"], 3, "A vector has magnitude and direction.", "Velocity includes direction."),
        ("Which quantity is a scalar?", ["Displacement", "Force", "Speed", "Acceleration"], 2, "A scalar has magnitude only.", "Speed has no direction."),
        ("Two 5 N forces act east. Their resultant is:", ["0 N", "5 N east", "10 N east", "25 N east"], 2, "Parallel vectors in the same direction add.", "5+5 = 10 N east."),
        ("A 3 N east and 3 N west pair has resultant:", ["0 N", "3 N east", "6 N east", "9 N"], 0, "Opposite equal vectors cancel.", "The net vector is zero."),
        ("Vector components are commonly resolved along:", ["Color and shape", "x and y axes", "Mass and time", "Heat and light"], 1, "Use perpendicular coordinate axes.", "Cartesian x and y components reconstruct a vector."),
    ],
    "GP-MK": [
        ("Velocity is displacement divided by:", ["Mass", "Force", "Time", "Acceleration"], 2, "Use v=Δx/Δt.", "Velocity measures displacement per time."),
        ("An object at constant velocity has acceleration:", ["Zero", "Positive", "Negative", "Infinite"], 0, "Acceleration is change in velocity.", "No velocity change means zero acceleration."),
        ("Starting from rest at 2 m/s² for 3 s gives velocity:", ["2 m/s", "3 m/s", "5 m/s", "6 m/s"], 3, "Use v=u+at.", "v=0+(2)(3)=6 m/s."),
        ("The area under a velocity-time graph gives:", ["Acceleration", "Displacement", "Force", "Power"], 1, "Integrating velocity over time gives position change.", "The signed area is displacement."),
        ("A negative velocity indicates:", ["The object is slowing", "Motion opposite the chosen positive direction", "Zero acceleration", "No motion"], 1, "Velocity sign expresses direction.", "Negative means opposite the defined positive axis."),
    ],
    "GP-NL": [
        ("Newton's first law describes:", ["Inertia", "F=ma only", "Action-reaction only", "Energy conservation"], 0, "Think of resistance to motion change.", "The first law is the law of inertia."),
        ("A 2 kg mass accelerates at 3 m/s². Net force is:", ["1.5 N", "5 N", "6 N", "9 N"], 2, "Use F=ma.", "F=(2)(3)=6 N."),
        ("Action-reaction forces act on:", ["The same object", "Different objects", "No objects", "Only moving objects"], 1, "The force pair belongs to two interacting bodies.", "Third-law forces act on different objects."),
        ("If net force is zero, acceleration is:", ["Zero", "1 m/s²", "Equal to mass", "Infinite"], 0, "Use a=Fnet/m.", "Zero net force yields zero acceleration."),
        ("Weight near Earth is calculated using:", ["W=m/g", "W=mg", "W=g/m", "W=m+g"], 1, "Multiply mass by gravitational field strength.", "Weight is W=mg."),
    ],
    "GP-WE": [
        ("Work by a parallel force is:", ["W=F/d", "W=Fd", "W=F+d", "W=d/F"], 1, "Multiply force by displacement.", "For parallel force and motion, W=Fd."),
        ("Kinetic energy is:", ["mv", "½mv²", "mgh", "Fd/t"], 1, "It depends on speed squared.", "KE=½mv²."),
        ("Gravitational potential energy is:", ["½mv²", "mgh", "F/a", "Pt²"], 1, "Use mass, gravity, and height.", "GPE=mgh."),
        ("Power is work divided by:", ["Distance", "Mass", "Time", "Velocity"], 2, "Power is the rate of doing work.", "P=W/t."),
        ("If only conservative forces act, total mechanical energy:", ["Always increases", "Always decreases", "Is conserved", "Becomes zero"], 2, "Track KE+PE.", "Their sum remains constant."),
    ],
    "GP-MI": [
        ("Momentum is calculated by:", ["p=mv", "p=ma", "p=m/v", "p=F/t"], 0, "Multiply mass and velocity.", "Linear momentum is p=mv."),
        ("Impulse equals change in:", ["Energy", "Momentum", "Mass", "Position"], 1, "Use J=Δp.", "Impulse changes momentum."),
        ("A 2 kg object moving at 4 m/s has momentum:", ["2 kg·m/s", "6 kg·m/s", "8 kg·m/s", "16 kg·m/s"], 2, "Use p=mv.", "p=(2)(4)=8 kg·m/s."),
        ("In an isolated collision, total momentum is:", ["Conserved", "Always zero", "Doubled", "Converted entirely to heat"], 0, "No external impulse acts.", "Total momentum before equals total after."),
        ("Increasing collision time for the same impulse makes average force:", ["Larger", "Smaller", "Unchanged", "Infinite"], 1, "Use J=FΔt.", "For fixed J, increasing Δt reduces F."),
    ],
}


MISCONCEPTION_SPECS = {
    "GM-AE": (
        "AE-PARTIAL-DISTRIBUTION",
        "Distributes a factor to only one term",
        "The selected distractor preserves one term inside the grouping instead of multiplying every term by the outside factor.",
        "Return to a two-arrow distribution scaffold, then solve a lower-demand item before trying a parallel item.",
        {"4x + 2", "x + 8", "3y + 4", "y + 12", "10p - 3", "5p - 6"},
    ),
    "GM-LE": (
        "LE-INVERSE-OPERATION",
        "Uses an operation without preserving equation balance",
        "The distractor is produced by applying the wrong inverse operation or changing only one side of the equation.",
        "Use a balance-model prompt and write the same inverse operation on both sides before simplifying.",
        {"19", "54", "9", "d = v/t"},
    ),
    "GM-FG": (
        "FG-SLOPE-MEANING",
        "Confuses slope with another graph feature",
        "The selected distractor treats slope as a coordinate, intercept, or unrelated physical quantity.",
        "Recalculate rise over run and connect the graph axes to the physical rate represented by slope.",
        {"âˆ’2", "Acceleration", "Undefined"},
    ),
    "GM-SN": (
        "SN-EXPONENT-DIRECTION",
        "Moves the decimal in the wrong exponent direction",
        "The distractor is consistent with reversing the sign or movement associated with the power of ten.",
        "Mark the original and normalized decimal positions, count moves, and verify the reconstructed magnitude.",
        {"0.032", "3200", "4.5Ã—10Â²"},
    ),
    "GM-UC": (
        "UC-CONVERSION-FACTOR",
        "Uses a conversion factor in the wrong orientation",
        "The selected distractor results when the given unit does not cancel or the scale factor is applied in reverse.",
        "Write units on every factor and accept only an orientation that cancels the starting unit.",
        {"0.025 cm", "5 kg", "30 m"},
    ),
    "GM-TR": (
        "TR-RATIO-ORDER",
        "Reverses sides in a trigonometric ratio",
        "The distractor swaps opposite, adjacent, or hypotenuse in the selected trigonometric ratio.",
        "Label O, A, and H relative to the angle before selecting SOH, CAH, or TOA.",
        {"adjacent/hypotenuse", "opposite/hypotenuse", "4/3"},
    ),
    "GP-SV": (
        "SV-DIRECTION-OMISSION",
        "Treats a directional quantity as magnitude only",
        "The selected distractor does not consistently use direction when classifying or combining vectors.",
        "Draw signed arrows on one axis, combine components, then report both magnitude and direction.",
        {"Speed", "5 N east", "6 N east"},
    ),
    "GP-MK": (
        "MK-RATE-CONFUSION",
        "Confuses velocity, acceleration, and graph evidence",
        "The distractor uses a related motion quantity but not the rate or graph relationship asked for.",
        "Name the graph axes and write the requested rate or area relationship before calculating.",
        {"Acceleration", "Positive", "Force"},
    ),
    "GP-NL": (
        "NL-FORCE-PAIR-OBJECT",
        "Places action-reaction forces on one object",
        "The selected distractor treats a third-law pair as forces acting on the same body.",
        "Name the two interacting objects and write one force on each before drawing free-body diagrams.",
        {"The same object", "F=ma only", "Equal to mass"},
    ),
    "GP-WE": (
        "WE-FORMULA-MIX",
        "Substitutes a related energy formula for the requested quantity",
        "The selected distractor uses variables from the situation in a formula for a different work-energy quantity.",
        "First classify the target as work, kinetic energy, potential energy, or power, then choose the matching dimensions.",
        {"mv", "mgh", "Distance"},
    ),
    "GP-MI": (
        "MI-IMPULSE-MOMENTUM",
        "Confuses impulse with another changing quantity",
        "The distractor does not use impulse as the change in momentum or applies the momentum relation incorrectly.",
        "Write J = Î”p and p = mv, mark before and after states, then track direction signs.",
        {"Energy", "6 kgÂ·m/s", "Larger"},
    ),
}


def _seed_tutoring_metadata(db: Session, concepts: dict[str, Concept]) -> None:
    rule_by_concept: dict[int, tuple[Misconception, set[str]]] = {}
    for code, (rule_code, name, explanation, remediation, mapped_choices) in MISCONCEPTION_SPECS.items():
        concept = concepts[code]
        guided = db.scalar(
            select(Activity)
            .join(ActivityConcept, ActivityConcept.activity_id == Activity.id)
            .where(
                ActivityConcept.concept_id == concept.id,
                Activity.activity_type == "guided-practice",
            )
        )
        rule = db.scalar(select(Misconception).where(Misconception.code == rule_code))
        if not rule:
            rule = Misconception(
                code=rule_code,
                name=name,
                concept_id=concept.id,
                explanation=explanation,
                remediation_instruction=remediation,
                suggested_activity_id=guided.id if guided else None,
                validation_status="Teacher reviewed",
                active=True,
            )
            db.add(rule)
            db.flush()
        rule_by_concept[concept.id] = (rule, mapped_choices)
    prerequisite_by_concept = {
        target: source
        for source, target in db.execute(
            select(
                PrerequisiteEdge.prerequisite_concept_id,
                PrerequisiteEdge.succeeding_concept_id,
            ).where(PrerequisiteEdge.active.is_(True))
        )
    }
    algebra_guided = db.scalar(
        select(Activity)
        .join(ActivityConcept, ActivityConcept.activity_id == Activity.id)
        .where(
            ActivityConcept.concept_id == concepts["GM-AE"].id,
            Activity.activity_type == "guided-practice",
        )
    )
    remediation_questions = [
        (
            "Expand 3(y + 4).",
            ["3y + 12", "3y + 4", "y + 12", "7y"],
            0,
            "Draw one distribution arrow from 3 to y and another from 3 to 4.",
            "The outside factor multiplies both terms: 3y + 12.",
        ),
        (
            "Expand 2(5p - 3).",
            ["10p - 6", "10p - 3", "5p - 6", "7p - 3"],
            0,
            "Distribute 2 to both 5p and -3, keeping the negative sign.",
            "2(5p) + 2(-3) = 10p - 6.",
        ),
    ]
    if algebra_guided:
        for offset, (prompt, choices, correct, hint, feedback) in enumerate(
            remediation_questions, start=4
        ):
            question = db.scalar(select(Question).where(Question.prompt == prompt))
            if question:
                continue
            question = Question(
                activity_id=algebra_guided.id,
                concept_id=concepts["GM-AE"].id,
                prompt=prompt,
                feedback=feedback,
                hint=hint,
                points=1,
                active=True,
                position=offset,
                source_type="Validated tutoring seed",
                status="Published",
            )
            db.add(question)
            db.flush()
            for position, text in enumerate(choices, start=1):
                db.add(
                    AnswerChoice(
                        question_id=question.id,
                        text=text,
                        is_correct=position - 1 == correct,
                        position=position,
                    )
                )
        db.flush()
    for question in db.scalars(select(Question).where(Question.activity_id.is_not(None))):
        activity = db.get(Activity, question.activity_id)
        choices = list(
            db.scalars(
                select(AnswerChoice)
                .where(AnswerChoice.question_id == question.id)
                .order_by(AnswerChoice.position)
            )
        )
        correct = next((choice for choice in choices if choice.is_correct), None)
        question.correct_answer = correct.text if correct else question.correct_answer
        question.explanation = question.explanation or question.feedback
        question.solution_steps = question.solution_steps or question.feedback
        question.solution_structure = question.solution_structure or {
            "given_information": "Use the information stated in the question.",
            "objective": question.prompt,
            "rule_or_formula": question.hint,
            "steps": [question.feedback] if question.feedback else [],
            "substitution": "Substitute the stated values after choosing the rule.",
            "final_answer": correct.text if correct else question.correct_answer,
            "unit_check": "Check that the unit matches the requested quantity.",
            "reasonableness_check": "Check the sign and magnitude against the given information.",
        }
        question.difficulty_label = (
            "Easy" if activity.difficulty <= 2 else "Moderate" if activity.difficulty == 3 else "Difficult"
        )
        question.estimated_cognitive_demand = min(1.0, max(0.1, activity.difficulty / 5))
        question.cognitive_level = "Apply" if activity.difficulty >= 3 else "Understand"
        question.prerequisite_concept_id = prerequisite_by_concept.get(question.concept_id)
        question.validation_status = "Teacher reviewed"
        rule, mapped_choices = rule_by_concept[question.concept_id]
        rationales = dict(question.distractor_rationales or {})
        for choice in choices:
            if choice.is_correct:
                choice.mapping_status = "Validated"
                continue
            if choice.text in mapped_choices:
                choice.misconception_id = rule.id
                choice.misconception_confidence = 0.85
                choice.mapping_status = "Teacher reviewed"
                rationales[choice.text] = rule.explanation
            else:
                choice.mapping_status = "Unreviewed"
                rationales.setdefault(
                    choice.text,
                    "This option is incorrect, but it is not mapped to a validated misconception pattern.",
                )
        question.distractor_rationales = rationales
    db.commit()


def _seed_content(
    db: Session, *, content_is_demo: bool = True
) -> dict[str, Concept]:
    concepts: dict[str, Concept] = {}
    for code, name, subject, difficulty, description in CONCEPTS:
        concept = db.scalar(select(Concept).where(Concept.code == code))
        if not concept:
            concept = Concept(
                code=code,
                name=name,
                subject=subject,
                difficulty=difficulty,
                description=description,
                active=True,
            )
            db.add(concept)
            db.flush()
        concepts[code] = concept
    for source, target in EDGES:
        exists = db.scalar(
            select(PrerequisiteEdge).where(
                PrerequisiteEdge.prerequisite_concept_id == concepts[source].id,
                PrerequisiteEdge.succeeding_concept_id == concepts[target].id,
            )
        )
        if not exists:
            db.add(
                PrerequisiteEdge(
                    prerequisite_concept_id=concepts[source].id,
                    succeeding_concept_id=concepts[target].id,
                )
            )
    db.flush()
    for code, concept in concepts.items():
        if db.scalar(
            select(Activity)
            .join(ActivityConcept, ActivityConcept.activity_id == Activity.id)
            .where(
                ActivityConcept.concept_id == concept.id,
                Activity.title == f"{concept.name} Diagnostic",
            )
        ):
            continue
        specs = [
            (
                f"{concept.name} Diagnostic",
                "diagnostic",
                concept.difficulty,
                12,
                True,
                "Answer five questions so NeuroLearn-X can establish current evidence.",
                QUESTION_BANK[code],
            ),
            (
                f"{concept.name} Guided Lab",
                "guided-practice",
                max(1, concept.difficulty - 1),
                20 + concept.difficulty * 2,
                False,
                f"Work through a scaffolded explanation and practice for {concept.name}.",
                QUESTION_BANK[code][:3],
            ),
            (
                f"{concept.name} Quick Review",
                "quiz",
                min(5, concept.difficulty + 1),
                8 + concept.difficulty,
                False,
                f"Complete a concise retrieval-practice check for {concept.name}.",
                QUESTION_BANK[code][3:],
            ),
        ]
        for title, activity_type, difficulty, minutes, diagnostic, description, questions in specs:
            activity = Activity(
                title=title,
                description=description,
                activity_type=activity_type,
                difficulty=difficulty,
                estimated_minutes=minutes,
                instructions="Read each item carefully. Hints are available and their use is recorded.",
                active=True,
                is_diagnostic=diagnostic,
                is_demo=content_is_demo,
            )
            db.add(activity)
            db.flush()
            db.add(ActivityConcept(activity_id=activity.id, concept_id=concept.id))
            for position, (prompt, choices, correct, hint, feedback) in enumerate(
                questions, start=1
            ):
                question = Question(
                    activity_id=activity.id,
                    concept_id=concept.id,
                    prompt=prompt,
                    feedback=feedback,
                    hint=hint,
                    points=1,
                    active=True,
                    position=position,
                )
                db.add(question)
                db.flush()
                for choice_position, text in enumerate(choices, start=1):
                    db.add(
                        AnswerChoice(
                            question_id=question.id,
                            text=text,
                            is_correct=choice_position - 1 == correct,
                            position=choice_position,
                        )
                    )
    db.commit()
    return concepts


def ensure_reference_curriculum(db: Session) -> Activity | None:
    """Install only the authored curriculum needed by real learner workflows.

    This does not create demo users, attempts, mastery, model metrics, or
    pathways. Existing records and teacher-authored activities are preserved.
    """
    _seed_content(db, content_is_demo=False)
    return ensure_onboarding_diagnostic(db)


def _seed_users_and_history(db: Session, concepts: dict[str, Concept]) -> None:
    teacher = db.scalar(select(User).where(User.participant_code == "TEACHER01"))
    if not teacher:
        teacher = User(
            participant_code="TEACHER01",
            password_hash=hash_password("NeuroTeach!2026"),
            role="teacher",
            display_name="Research Teacher",
            must_change_password=True,
            is_demo=True,
        )
        db.add(teacher)
    else:
        teacher.password_hash = hash_password("NeuroTeach!2026")
        teacher.role = "teacher"
        teacher.display_name = "Research Teacher"
        teacher.must_change_password = True
        teacher.is_active = True
        teacher.is_demo = True
    student_specs = [
        ("STEM001", "Demo Learner 01", "GP-MK", 0.38),
        ("STEM002", "Demo Learner 02", "GP-NL", 0.52),
        ("STEM003", "Demo Learner 03", "GP-WE", 0.68),
        ("STEM004", "Demo Learner 04", "GP-MI", 0.78),
        ("STEM005", "Demo Learner 05", "GP-NL", 0.88),
        ("STEM006", "Demo Learner 06", "GP-WE", 0.61),
    ]
    students: list[tuple[User, float]] = []
    for code, name, target_code, ability in student_specs:
        student = db.scalar(select(User).where(User.participant_code == code))
        if not student:
            student = User(
                participant_code=code,
                password_hash=hash_password("LearnX!2026"),
                role="student",
                display_name=name,
                must_change_password=True,
                is_demo=True,
            )
            db.add(student)
            db.flush()
        else:
            student.password_hash = hash_password("LearnX!2026")
            student.role = "student"
            student.display_name = name
            student.must_change_password = True
            student.is_demo = True
        profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student.id)
        )
        if not profile:
            db.add(
                StudentProfile(
                    user_id=student.id,
                    target_concept_id=concepts[target_code].id,
                    onboarding_completed_at=datetime.now(timezone.utc),
                    onboarding_version="1.0",
                )
            )
        else:
            profile.target_concept_id = concepts[target_code].id
            profile.onboarding_completed_at = (
                profile.onboarding_completed_at or datetime.now(timezone.utc)
            )
            profile.onboarding_version = "1.0"
        consent = db.scalar(
            select(ConsentRecord).where(
                ConsentRecord.student_id == student.id,
                ConsentRecord.consent_version == "demo-1.0",
            )
        )
        if not consent:
            db.add(
                ConsentRecord(
                    student_id=student.id,
                    consented=True,
                    consent_version="demo-1.0",
                    recorded_by="synthetic-demo-seed",
                )
            )
        students.append((student, ability))
    db.commit()
    if db.scalar(
        select(AssessmentAttempt.id)
        .where(AssessmentAttempt.is_demo.is_(True))
        .limit(1)
    ):
        return
    randomizer = random.Random(20260730)
    activities = list(
        db.scalars(
            select(Activity).where(
                Activity.is_diagnostic.is_(True),
                Activity.is_onboarding_diagnostic.is_(False),
            )
        )
    )
    now = datetime.now(timezone.utc)
    for student_index, (student, ability) in enumerate(students):
        selected = activities[:]
        randomizer.shuffle(selected)
        for attempt_index, activity in enumerate(selected[:9]):
            concept_id = db.scalar(
                select(ActivityConcept.concept_id).where(
                    ActivityConcept.activity_id == activity.id
                )
            )
            concept = db.get(Concept, concept_id)
            difficulty_penalty = 0.06 * (concept.difficulty - 1)
            trend = 0.015 * attempt_index
            accuracy = max(
                0.1,
                min(
                    0.98,
                    ability - difficulty_penalty + trend + randomizer.uniform(-0.10, 0.10),
                ),
            )
            max_score = 5.0
            score = round(accuracy * max_score)
            accuracy = score / max_score
            effort_value = max(
                1,
                min(
                    9,
                    round(
                        3
                        + (1 - accuracy) * 5
                        + concept.difficulty * 0.35
                        + randomizer.uniform(-1, 1)
                    ),
                ),
            )
            category = "Low" if effort_value <= 3 else "Moderate" if effort_value <= 6 else "High"
            started = now - timedelta(days=28 - attempt_index * 2 + student_index)
            minutes = activity.estimated_minutes * (1.35 - ability * 0.4)
            attempt = AssessmentAttempt(
                student_id=student.id,
                activity_id=activity.id,
                score=score,
                max_score=max_score,
                accuracy=accuracy,
                started_at=started,
                submitted_at=started + timedelta(minutes=minutes),
                total_seconds=minutes * 60,
                skipped_items=1 if accuracy < 0.45 else 0,
                hint_usage_count=2 if accuracy < 0.55 else 1 if accuracy < 0.75 else 0,
                answer_change_count=1 if accuracy < 0.7 else 0,
                attempt_number=1,
                is_demo=True,
            )
            db.add(attempt)
            db.flush()
            db.add(
                InteractionLog(
                    student_id=student.id,
                    activity_id=activity.id,
                    concept_id=concept_id,
                    attempt_id=attempt.id,
                    score=score,
                    max_score=max_score,
                    response_accuracy=accuracy,
                    average_response_seconds=minutes * 60 / 5,
                    total_completion_seconds=minutes * 60,
                    number_of_attempts=1,
                    skipped_items=attempt.skipped_items,
                    hint_usage_count=attempt.hint_usage_count,
                    start_time=attempt.started_at,
                    submission_time=attempt.submitted_at,
                    is_demo=True,
                )
            )
            db.add(
                MentalEffortRating(
                    student_id=student.id,
                    attempt_id=attempt.id,
                    rating=effort_value,
                    category=category,
                    is_demo=True,
                )
            )
            classification = (
                "Mastered" if accuracy >= 0.75 else "Developing" if accuracy >= 0.525 else "Needs Review"
            )
            db.add(
                MasteryRecord(
                    student_id=student.id,
                    concept_id=concept_id,
                    attempt_id=attempt.id,
                    mastery_score=accuracy,
                    classification=classification,
                    calculation_mode="weighted",
                    is_demo=True,
                )
            )
            if accuracy < 0.75:
                db.add(
                    LearningGap(
                        student_id=student.id,
                        concept_id=concept_id,
                        mastery_score=accuracy,
                        threshold=0.75,
                        reason=f"Mastery is {accuracy:.0%}, below the configured 75% threshold.",
                        is_demo=True,
                    )
                )
    db.commit()
    for student, _ in students:
        generate_pathways(db, student)


def seed_database(db: Session, train_model: bool = True) -> None:
    save_settings(db, DEFAULT_SETTINGS)
    concepts = _seed_content(db)
    _seed_tutoring_metadata(db, concepts)
    _seed_users_and_history(db, concepts)
    ensure_onboarding_diagnostic(db)
    if train_model and not db.scalar(select(ModelVersion.id).limit(1)):
        try:
            train_ensemble(db, is_demo=True)
            for student in db.scalars(
                select(User).where(
                    User.role == "student",
                    User.is_demo,
                    User.is_active.is_(True),
                    User.account_status == "Active",
                )
            ):
                generate_pathways(db, student)
        except ValueError:
            pass
    if not db.scalar(select(AuditLog.id).limit(1)):
        db.add(
            AuditLog(
                actor_id=None,
                action="demo.seeded",
                entity_type="system",
                details={"notice": "Demonstration Data – Not a Research Result."},
            )
        )
        db.commit()


def reset_and_seed_demo(db: Session) -> None:
    demo_user_ids = list(
        db.scalars(select(User.id).where(User.is_demo.is_(True)))
    )
    demo_attempt_ids = list(
        db.scalars(
            select(AssessmentAttempt.id).where(
                AssessmentAttempt.is_demo.is_(True)
            )
        )
    )
    demo_pathway_ids = list(
        db.scalars(
            select(PathwayRecommendation.id).where(
                PathwayRecommendation.is_demo.is_(True)
            )
        )
    )
    demo_session_ids = list(
        db.scalars(
            select(TutoringSession.id).where(
                TutoringSession.student_id.in_(demo_user_ids)
            )
        )
    ) if demo_user_ids else []
    for model in list(
        db.scalars(select(ModelVersion).where(ModelVersion.is_demo.is_(True)))
    ):
        if model.file_path:
            try:
                from pathlib import Path

                Path(model.file_path).unlink(missing_ok=True)
            except OSError:
                pass
    db.execute(
        delete(ExpertEvaluation).where(ExpertEvaluation.is_demo.is_(True))
    )
    if demo_user_ids:
        db.execute(
            delete(TeacherIntervention).where(
                (TeacherIntervention.student_id.in_(demo_user_ids))
                | (TeacherIntervention.teacher_id.in_(demo_user_ids))
            )
        )
        db.execute(
            delete(LearningSummary).where(
                LearningSummary.student_id.in_(demo_user_ids)
            )
        )
        db.execute(
            delete(MisconceptionHistory).where(
                MisconceptionHistory.student_id.in_(demo_user_ids)
            )
        )
    if demo_session_ids:
        db.execute(
            delete(TutoringResponse).where(
                TutoringResponse.session_id.in_(demo_session_ids)
            )
        )
        db.execute(
            delete(TutoringSession).where(
                TutoringSession.id.in_(demo_session_ids)
            )
        )
    if demo_pathway_ids:
        db.execute(
            delete(PathwayVersion).where(
                (PathwayVersion.pathway_id.in_(demo_pathway_ids))
                | (PathwayVersion.previous_pathway_id.in_(demo_pathway_ids))
            )
        )
        db.execute(
            delete(PathwayStep).where(
                PathwayStep.pathway_id.in_(demo_pathway_ids)
            )
        )
    db.execute(
        delete(PathwayRecommendation).where(
            PathwayRecommendation.is_demo.is_(True)
        )
    )
    db.execute(delete(LearningGap).where(LearningGap.is_demo.is_(True)))
    db.execute(delete(MasteryRecord).where(MasteryRecord.is_demo.is_(True)))
    db.execute(
        delete(MentalEffortRating).where(
            MentalEffortRating.is_demo.is_(True)
        )
    )
    db.execute(
        delete(InteractionLog).where(InteractionLog.is_demo.is_(True))
    )
    if demo_attempt_ids:
        db.execute(
            delete(ItemResponse).where(
                ItemResponse.attempt_id.in_(demo_attempt_ids)
            )
        )
    db.execute(
        delete(AssessmentAttempt).where(
            AssessmentAttempt.is_demo.is_(True)
        )
    )
    if demo_user_ids:
        db.execute(
            delete(ConsentRecord).where(
                ConsentRecord.student_id.in_(demo_user_ids)
            )
        )
        db.execute(
            delete(StudentProfile).where(
                StudentProfile.user_id.in_(demo_user_ids)
            )
        )
    db.execute(delete(ModelVersion).where(ModelVersion.is_demo.is_(True)))
    db.commit()
    concepts = {concept.code: concept for concept in db.scalars(select(Concept))}
    _seed_users_and_history(db, concepts)
    try:
        train_ensemble(db, is_demo=True)
    except ValueError:
        pass


def main():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
    print("NeuroLearn-X demo data seeded.")
    print("Teacher: TEACHER01 / NeuroTeach!2026")
    print("Student: STEM001 / LearnX!2026")


if __name__ == "__main__":
    main()
