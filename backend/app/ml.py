from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import io
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .algorithms import expected_cognitive_load, prerequisite_ancestors
from .models import (
    Activity,
    ActivityConcept,
    AssessmentAttempt,
    Concept,
    CognitiveLoadPrediction,
    InteractionLog,
    MasteryRecord,
    MentalEffortRating,
    ModelVersion,
    PrerequisiteEdge,
    Question,
    User,
)


FEATURE_NAMES = [
    "recent_score",
    "average_accuracy",
    "average_response_seconds",
    "average_completion_minutes",
    "number_of_attempts",
    "skipped_item_rate",
    "hint_usage_rate",
    "previous_mental_effort",
    "current_mastery",
    "recent_improvement",
    "activity_difficulty",
    "estimated_minutes",
    "question_count",
    "concept_difficulty",
    "prerequisite_depth",
    "activity_type_code",
]
CLASS_ORDER = ["Low", "Moderate", "High"]
ACTIVITY_TYPE_CODES = {
    "lesson": 0.1,
    "guided-practice": 0.3,
    "practice": 0.5,
    "quiz": 0.7,
    "diagnostic": 0.8,
    "simulation": 0.6,
}
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


def _soft_probabilities(models, features: np.ndarray) -> tuple[np.ndarray, list[str]]:
    classes = sorted({str(label) for model in models for label in model.classes_})
    combined = np.zeros((len(features), len(classes)))
    for model in models:
        probability = model.predict_proba(features)
        lookup = {str(label): index for index, label in enumerate(model.classes_)}
        for position, label in enumerate(classes):
            if label in lookup:
                combined[:, position] += probability[:, lookup[label]]
    return combined / len(models), classes


def _new_models():
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression

    return [
        LogisticRegression(max_iter=2_000, class_weight="balanced", random_state=42),
        RandomForestClassifier(
            n_estimators=180, max_depth=8, class_weight="balanced", random_state=42
        ),
        GradientBoostingClassifier(n_estimators=120, random_state=42),
    ]


def _prerequisite_depth(db: Session, concept_id: int) -> int:
    edges = db.execute(
        select(
            PrerequisiteEdge.prerequisite_concept_id,
            PrerequisiteEdge.succeeding_concept_id,
        ).where(PrerequisiteEdge.active.is_(True))
    ).all()
    return len(prerequisite_ancestors(edges, concept_id))


def _latest_mastery(db: Session, student_id: int, concept_id: int) -> float:
    record = db.scalar(
        select(MasteryRecord)
        .where(
            MasteryRecord.student_id == student_id,
            MasteryRecord.concept_id == concept_id,
        )
        .order_by(MasteryRecord.created_at.desc())
    )
    return record.mastery_score if record else 0.5


def future_feature_dict(
    db: Session, student_id: int, activity: Activity, concept_id: int, concept_difficulty: int
) -> dict[str, float]:
    history = list(
        db.scalars(
            select(InteractionLog)
            .where(InteractionLog.student_id == student_id)
            .order_by(InteractionLog.submission_time.desc())
            .limit(5)
        )
    )
    ratings = list(
        db.scalars(
            select(MentalEffortRating)
            .where(MentalEffortRating.student_id == student_id)
            .order_by(MentalEffortRating.created_at.desc())
            .limit(5)
        )
    )
    question_count = db.scalar(
        select(func.count(Question.id)).where(
            Question.activity_id == activity.id, Question.active.is_(True)
        )
    ) or 0
    scores = [row.response_accuracy for row in reversed(history)]
    improvement = (scores[-1] - scores[0]) if len(scores) > 1 else 0
    return {
        "recent_score": history[0].response_accuracy if history else 0.5,
        "average_accuracy": float(np.mean([row.response_accuracy for row in history]))
        if history
        else 0.5,
        "average_response_seconds": float(
            np.mean([row.average_response_seconds for row in history])
        )
        if history
        else 45,
        "average_completion_minutes": float(
            np.mean([row.total_completion_seconds / 60 for row in history])
        )
        if history
        else activity.estimated_minutes,
        "number_of_attempts": float(
            np.mean([row.number_of_attempts for row in history])
        )
        if history
        else 1,
        "skipped_item_rate": float(
            np.mean([row.skipped_items / max(1, question_count) for row in history])
        )
        if history
        else 0,
        "hint_usage_rate": float(
            np.mean([row.hint_usage_count / max(1, question_count) for row in history])
        )
        if history
        else 0,
        "previous_mental_effort": float(np.mean([row.rating for row in ratings])) if ratings else 5,
        "current_mastery": _latest_mastery(db, student_id, concept_id),
        "recent_improvement": improvement,
        "activity_difficulty": activity.difficulty,
        "estimated_minutes": activity.estimated_minutes,
        "question_count": question_count,
        "concept_difficulty": concept_difficulty,
        "prerequisite_depth": _prerequisite_depth(db, concept_id),
        "activity_type_code": ACTIVITY_TYPE_CODES.get(activity.activity_type, 0.5),
    }


def rule_based_prediction(features: dict[str, float]) -> dict[str, Any]:
    effort = features["previous_mental_effort"] / 9
    difficulty = features["activity_difficulty"] / 5
    concept = features["concept_difficulty"] / 5
    time_pressure = min(1, features["estimated_minutes"] / 45)
    low_mastery = 1 - features["current_mastery"]
    struggle = 1 - features["average_accuracy"]
    raw = (
        0.24 * effort
        + 0.19 * difficulty
        + 0.12 * concept
        + 0.10 * time_pressure
        + 0.20 * low_mastery
        + 0.15 * struggle
    )
    high = max(0.05, min(0.85, (raw - 0.45) * 1.4))
    low = max(0.05, min(0.85, (0.62 - raw) * 1.4))
    moderate = max(0.1, 1 - high - low)
    total = low + moderate + high
    probabilities = {
        "Low": low / total,
        "Moderate": moderate / total,
        "High": high / total,
    }
    category = max(probabilities, key=probabilities.get)
    influences = sorted(
        {
            "Current mastery": low_mastery,
            "Previous mental effort": effort,
            "Activity difficulty": difficulty,
            "Recent accuracy": struggle,
            "Estimated time": time_pressure,
        }.items(),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:4]
    return {
        "category": category,
        "probabilities": probabilities,
        "index": expected_cognitive_load(probabilities),
        "explanation": dict(influences),
        "source": "Temporary rule-based estimate",
        "warning": "Insufficient validated data for model training",
    }


def predict_activity_load(
    db: Session,
    student_id: int,
    activity: Activity,
    concept_id: int,
    concept_difficulty: int,
    explain: bool = False,
) -> dict[str, Any]:
    features = future_feature_dict(db, student_id, activity, concept_id, concept_difficulty)
    version = db.scalar(
        select(ModelVersion)
        .where(ModelVersion.active.is_(True), ModelVersion.is_demo == activity.is_demo)
        .order_by(ModelVersion.trained_at.desc())
    )
    if not version:
        return rule_based_prediction(features)
    bundle_cache = db.info.setdefault("neurolearnx_model_bundles", {})
    bundle = bundle_cache.get(version.id)
    if bundle is None:
        if version.artifact:
            bundle = joblib.load(io.BytesIO(version.artifact))
        elif version.file_path and Path(version.file_path).exists():
            bundle = joblib.load(version.file_path)
        else:
            return rule_based_prediction(features)
        bundle_cache[version.id] = bundle
    values = np.array([[features[name] for name in FEATURE_NAMES]], dtype=float)
    scaled = bundle["scaler"].transform(values)
    probabilities_array, classes = _soft_probabilities(bundle["models"], scaled)
    probabilities = {label: 0.0 for label in CLASS_ORDER}
    probabilities.update(
        {str(label): float(value) for label, value in zip(classes, probabilities_array[0])}
    )
    category = max(probabilities, key=probabilities.get)
    model_probabilities = []
    for model in bundle["models"]:
        model_values = model.predict_proba(scaled)[0]
        lookup = {
            str(label): float(value)
            for label, value in zip(model.classes_, model_values)
        }
        model_probabilities.append(
            {label: lookup.get(label, 0.0) for label in CLASS_ORDER}
        )
    important: dict[str, float] = {}
    explanation_method = f"Approximate ensemble importance for {category}"
    if explain:
        try:
            import shap

            random_forest = bundle["models"][1]
            background = bundle.get("background", scaled)
            explainer = shap.TreeExplainer(
                random_forest,
                background,
                feature_perturbation="interventional",
            )
            explanation = explainer(scaled, check_additivity=False)
            values = np.asarray(explanation.values)
            class_index = list(map(str, random_forest.classes_)).index(category)
            if values.ndim == 3:
                local_values = values[0, :, class_index]
            elif values.ndim == 2:
                local_values = values[0]
            else:
                raise ValueError("Unsupported SHAP output shape")
            important = dict(
                sorted(
                    zip(FEATURE_NAMES, map(float, local_values)),
                    key=lambda item: abs(item[1]),
                    reverse=True,
                )[:5]
            )
            explanation_method = f"SHAP values · Random Forest · {category} class"
        except Exception:
            important = {}
    if not important:
        importances: dict[str, float] = defaultdict(float)
        for model in bundle["models"]:
            if hasattr(model, "feature_importances_"):
                values_for_model = model.feature_importances_
            elif hasattr(model, "coef_"):
                values_for_model = np.mean(np.abs(model.coef_), axis=0)
            else:
                continue
            for name, value in zip(FEATURE_NAMES, values_for_model):
                importances[name] += float(value) / len(bundle["models"])
        important = dict(
            sorted(importances.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
        )
    return {
        "category": category,
        "probabilities": probabilities,
        "index": expected_cognitive_load(probabilities),
        "explanation": important,
        "source": f"Ensemble model {version.version} · {explanation_method}",
        "warning": version.warning,
        "model_version": version.version,
        "model_count": len(bundle["models"]),
        "model_probabilities": model_probabilities,
        "features": features,
        "normalized_features": {
            name: float(value)
            for name, value in zip(FEATURE_NAMES, scaled[0])
        },
        "normalization_ranges": {
            name: {
                "minimum": float(minimum),
                "maximum": float(maximum),
            }
            for name, minimum, maximum in zip(
                FEATURE_NAMES,
                bundle["scaler"].data_min_,
                bundle["scaler"].data_max_,
            )
        },
    }


def predict_student_cognitive_load(db: Session, student_id: int) -> dict[str, Any]:
    student = db.get(User, student_id)
    if (
        not student
        or student.role != "student"
        or not student.is_active
        or student.account_status != "Active"
    ):
        raise ValueError("Active learner not found")
    latest = db.scalar(
        select(InteractionLog)
        .where(InteractionLog.student_id == student_id)
        .order_by(InteractionLog.submission_time.desc())
    )
    if not latest:
        return {
            "available": False,
            "message": "Insufficient data for a learner-specific prediction",
            "student_id": student.id,
            "participant_code": student.participant_code,
        }
    activity = db.get(Activity, latest.activity_id)
    concept = db.get(Concept, latest.concept_id)
    attempt = db.get(AssessmentAttempt, latest.attempt_id)
    rating = db.scalar(
        select(MentalEffortRating)
        .where(MentalEffortRating.student_id == student.id)
        .order_by(MentalEffortRating.created_at.desc())
    )
    if not activity or not concept or not attempt:
        return {
            "available": False,
            "message": "Insufficient data for a learner-specific prediction",
            "student_id": student.id,
            "participant_code": student.participant_code,
        }
    result = predict_activity_load(
        db,
        student.id,
        activity,
        concept.id,
        concept.difficulty,
        explain=False,
    )
    if not result.get("model_version"):
        return {
            "available": False,
            "message": "Insufficient data for reliable model prediction",
            "student_id": student.id,
            "participant_code": student.participant_code,
            "evidence": {
                "assessment_score": attempt.score,
                "maximum_score": attempt.max_score,
                "accuracy": attempt.accuracy,
                "average_response_seconds": latest.average_response_seconds,
                "completion_seconds": attempt.total_seconds,
                "attempts": latest.number_of_attempts,
                "skipped_questions": attempt.skipped_items,
                "hint_usage": attempt.hint_usage_count,
                "mental_effort_rating": rating.rating if rating else None,
            },
        }
    probabilities = result["probabilities"]
    confidence_value = max(probabilities.values())
    confidence = "High" if confidence_value >= 0.80 else "Moderate" if confidence_value >= 0.60 else "Low"
    normalization = {}
    for name, raw_value in result["features"].items():
        bounds = result["normalization_ranges"][name]
        normalization[name] = {
            "raw": raw_value,
            "minimum": bounds["minimum"],
            "maximum": bounds["maximum"],
            "normalized": result["normalized_features"][name],
            "formula": (
                f"({raw_value:.4g} - {bounds['minimum']:.4g}) / "
                f"({bounds['maximum']:.4g} - {bounds['minimum']:.4g})"
            ),
        }
    probability_formula = {}
    for label in CLASS_ORDER:
        values = [item[label] for item in result["model_probabilities"]]
        probability_formula[label] = (
            f"({' + '.join(f'{value:.4f}' for value in values)}) / "
            f"{result['model_count']} = {probabilities[label]:.4f}"
        )
    recommended_action = {
        "Low": "Offer an optional challenge or faster review while continuing to monitor mastery.",
        "Moderate": "Continue standard instruction with guided support and timely feedback.",
        "High": "Reduce task complexity, add scaffolds, and break the next activity into shorter steps.",
    }[result["category"]]
    evidence_payload = {
        "activity": activity.title,
        "concept": concept.name,
        "assessment_score": attempt.score,
        "maximum_score": attempt.max_score,
        "accuracy": attempt.accuracy,
        "average_response_seconds": latest.average_response_seconds,
        "completion_seconds": attempt.total_seconds,
        "attempts": latest.number_of_attempts,
        "skipped_questions": attempt.skipped_items,
        "hint_usage": attempt.hint_usage_count,
        "mental_effort_rating": rating.rating if rating else None,
        "recent_mastery": result["features"].get("current_mastery"),
        "evidence_date": latest.submission_time.isoformat() if latest.submission_time else None,
    }
    missing_features = [key for key, value in evidence_payload.items() if value is None]
    version = db.scalar(select(ModelVersion).where(ModelVersion.version == result["model_version"]))
    prediction = CognitiveLoadPrediction(
        student_id=student.id,
        model_version_id=version.id,
        evidence_date=latest.submission_time,
        probabilities=probabilities,
        predicted_category=result["category"],
        expected_index=result["index"],
        confidence=confidence_value,
        evidence=evidence_payload,
        missing_features=missing_features,
        feature_contributions=result["explanation"],
        recommended_action=recommended_action,
        is_demo=student.is_demo,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return {
        "available": True,
        "prediction_id": prediction.id,
        "student_id": student.id,
        "participant_code": student.participant_code,
        "display_name": student.display_name,
        "probabilities": probabilities,
        "category": result["category"],
        "expected_index": result["index"],
        "confidence": confidence,
        "confidence_probability": confidence_value,
        "model_version": result["model_version"],
        "prediction_date": datetime.now(timezone.utc),
        "evidence": evidence_payload,
        "missing_features": missing_features,
        "normalization": normalization,
        "feature_contributions": result["explanation"],
        "explanation_method": result["source"],
        "recommended_action": recommended_action,
        "formula": {
            "normalization": "X' = (X - Xmin) / (Xmax - Xmin)",
            "soft_voting": "pc = (1/K) Î£ pkc",
            "probability_substitution": probability_formula,
            "category": f"argmax pc = {result['category']}",
            "expected_index": (
                f"CL = 0({probabilities['Low']:.4f}) + "
                f"0.5({probabilities['Moderate']:.4f}) + "
                f"1({probabilities['High']:.4f}) = {result['index']:.4f}"
            ),
        },
        "disclaimer": "This is a model prediction for learning support, not a medical or psychological diagnosis.",
        "warning": result.get("warning"),
    }


def _training_rows(db: Session, is_demo: bool):
    logs = list(
        db.scalars(
            select(InteractionLog)
            .join(User, User.id == InteractionLog.student_id)
            .where(
                InteractionLog.is_demo == is_demo,
                User.is_active.is_(True),
                User.account_status == "Active",
            )
            .order_by(InteractionLog.submission_time)
        )
    )
    effort_by_attempt = {
        row.attempt_id: row
        for row in db.scalars(
            select(MentalEffortRating).where(MentalEffortRating.is_demo == is_demo)
        )
    }
    rows, labels, groups = [], [], []
    history_by_student: dict[int, list[InteractionLog]] = defaultdict(list)
    effort_history: dict[int, list[int]] = defaultdict(list)
    for log in logs:
        rating = effort_by_attempt.get(log.attempt_id)
        if not rating:
            continue
        activity = db.get(Activity, log.activity_id)
        concept_link = db.scalar(
            select(ActivityConcept).where(ActivityConcept.activity_id == activity.id)
        )
        if not activity or not concept_link:
            continue
        from .models import Concept

        concept = db.get(Concept, concept_link.concept_id)
        question_count = db.scalar(
            select(func.count(Question.id)).where(Question.activity_id == activity.id)
        ) or 1
        history = history_by_student[log.student_id]
        prior_scores = [item.response_accuracy for item in history[-5:]]
        previous_effort = effort_history[log.student_id][-5:]
        improvement = prior_scores[-1] - prior_scores[0] if len(prior_scores) > 1 else 0
        mastery = _latest_mastery(db, log.student_id, concept.id)
        values = {
            "recent_score": prior_scores[-1] if prior_scores else log.response_accuracy,
            "average_accuracy": float(np.mean(prior_scores))
            if prior_scores
            else log.response_accuracy,
            "average_response_seconds": log.average_response_seconds,
            "average_completion_minutes": log.total_completion_seconds / 60,
            "number_of_attempts": log.number_of_attempts,
            "skipped_item_rate": log.skipped_items / max(1, question_count),
            "hint_usage_rate": log.hint_usage_count / max(1, question_count),
            "previous_mental_effort": float(np.mean(previous_effort))
            if previous_effort
            else rating.rating,
            "current_mastery": mastery,
            "recent_improvement": improvement,
            "activity_difficulty": activity.difficulty,
            "estimated_minutes": activity.estimated_minutes,
            "question_count": question_count,
            "concept_difficulty": concept.difficulty,
            "prerequisite_depth": _prerequisite_depth(db, concept.id),
            "activity_type_code": ACTIVITY_TYPE_CODES.get(activity.activity_type, 0.5),
        }
        rows.append([values[name] for name in FEATURE_NAMES])
        labels.append(rating.category)
        groups.append(log.student_id)
        history.append(log)
        effort_history[log.student_id].append(rating.rating)
    return np.asarray(rows, dtype=float), np.asarray(labels), np.asarray(groups)


def train_ensemble(db: Session, is_demo: bool) -> ModelVersion:
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import GroupKFold, StratifiedGroupKFold
    from sklearn.preprocessing import MinMaxScaler, label_binarize

    features, labels, groups = _training_rows(db, is_demo)
    unique_groups = np.unique(groups)
    class_counts = Counter(labels)
    if len(features) < 12 or len(unique_groups) < 3 or len(class_counts) < 3:
        raise ValueError("Insufficient validated data for model training")
    n_splits = min(3, len(unique_groups), min(class_counts.values()))
    splitter = (
        StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)
        if n_splits >= 2
        else GroupKFold(n_splits=2)
    )
    splits = list(splitter.split(features, labels, groups))
    required_classes = set(CLASS_ORDER)
    if any(
        set(labels[train_index]) != required_classes
        or set(groups[train_index]).intersection(set(groups[test_index]))
        for train_index, test_index in splits
    ):
        raise ValueError("Insufficient data for reliable evaluation")
    predictions = np.empty(len(labels), dtype=object)
    probability_matrix = np.zeros((len(labels), len(CLASS_ORDER)))
    for train_index, test_index in splits:
        scaler = MinMaxScaler().fit(features[train_index])
        train_features = scaler.transform(features[train_index])
        test_features = scaler.transform(features[test_index])
        models = _new_models()
        for model in models:
            model.fit(train_features, labels[train_index])
        probabilities, classes = _soft_probabilities(models, test_features)
        for row_position, source_index in enumerate(test_index):
            mapped = {label: 0.0 for label in CLASS_ORDER}
            mapped.update(
                {str(label): float(value) for label, value in zip(classes, probabilities[row_position])}
            )
            probability_matrix[source_index] = [mapped[label] for label in CLASS_ORDER]
            predictions[source_index] = max(mapped, key=mapped.get)
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision_macro": float(
            precision_score(labels, predictions, average="macro", zero_division=0)
        ),
        "recall_macro": float(
            recall_score(labels, predictions, average="macro", zero_division=0)
        ),
        "f1_macro": float(f1_score(labels, predictions, average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(
            labels, predictions, labels=CLASS_ORDER
        ).tolist(),
        "labels": CLASS_ORDER,
        "evaluation": f"{n_splits}-fold student-grouped cross-validation",
        "training_samples": int(len(features)),
        "student_groups": int(len(unique_groups)),
        "folds": int(n_splits),
        "class_distribution": {
            label: int(class_counts.get(label, 0)) for label in CLASS_ORDER
        },
        "group_leakage": False,
        "reliable": True,
    }
    try:
        binary = label_binarize(labels, classes=CLASS_ORDER)
        metrics["roc_auc_ovr_macro"] = float(
            roc_auc_score(binary, probability_matrix, multi_class="ovr", average="macro")
        )
    except ValueError:
        metrics["roc_auc_ovr_macro"] = None
    scaler = MinMaxScaler().fit(features)
    scaled = scaler.transform(features)
    models = _new_models()
    for model in models:
        model.fit(scaled, labels)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version_name = f"{'demo' if is_demo else 'research'}-{timestamp}"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = MODEL_DIR / f"{version_name}.joblib"
    artifact_buffer = io.BytesIO()
    joblib.dump(
        {
            "scaler": scaler,
            "models": models,
            "feature_names": FEATURE_NAMES,
            "background": scaled[: min(80, len(scaled))],
        },
        artifact_buffer,
    )
    artifact = artifact_buffer.getvalue()
    path.write_bytes(artifact)
    warning = (
        "Demonstration Data – Not a Research Result."
        if is_demo
        else (
            "Small research sample: interpret grouped-validation metrics cautiously."
            if len(unique_groups) < 30
            else None
        )
    )
    for previous in db.scalars(
        select(ModelVersion).where(
            ModelVersion.is_demo == is_demo, ModelVersion.active.is_(True)
        )
    ):
        previous.active = False
    version = ModelVersion(
        version=version_name,
        sample_size=len(features),
        student_count=len(unique_groups),
        metrics=metrics,
        feature_names=FEATURE_NAMES,
        metadata_json={
            "algorithm": "Soft-voting ensemble",
            "ensemble_members": [type(model).__name__ for model in models],
            "training_data_period": {
                "start": min(log.submission_time for log in db.scalars(select(InteractionLog).where(InteractionLog.is_demo == is_demo))).isoformat(),
                "end": max(log.submission_time for log in db.scalars(select(InteractionLog).where(InteractionLog.is_demo == is_demo))).isoformat(),
            },
            "class_labels": CLASS_ORDER,
            "evaluation_method": f"{n_splits}-fold student-grouped cross-validation",
            "deployment_status": "Active",
        },
        file_path=str(path),
        artifact=artifact,
        is_demo=is_demo,
        active=True,
        warning=warning,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version
