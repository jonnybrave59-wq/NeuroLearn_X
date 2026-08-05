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
    InteractionLog,
    MasteryRecord,
    MentalEffortRating,
    ModelVersion,
    PrerequisiteEdge,
    Question,
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
    if version.artifact:
        bundle = joblib.load(io.BytesIO(version.artifact))
    elif version.file_path and Path(version.file_path).exists():
        bundle = joblib.load(version.file_path)
    else:
        return rule_based_prediction(features)
    values = np.array([[features[name] for name in FEATURE_NAMES]], dtype=float)
    scaled = bundle["scaler"].transform(values)
    probabilities_array, classes = _soft_probabilities(bundle["models"], scaled)
    probabilities = {label: 0.0 for label in CLASS_ORDER}
    probabilities.update(
        {str(label): float(value) for label, value in zip(classes, probabilities_array[0])}
    )
    category = max(probabilities, key=probabilities.get)
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
    }


def _training_rows(db: Session, is_demo: bool):
    logs = list(
        db.scalars(
            select(InteractionLog)
            .where(InteractionLog.is_demo == is_demo)
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
    predictions = np.empty(len(labels), dtype=object)
    probability_matrix = np.zeros((len(labels), len(CLASS_ORDER)))
    for train_index, test_index in splitter.split(features, labels, groups):
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
