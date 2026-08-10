from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    participant_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    first_name: Mapped[str | None] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    account_status: Mapped[str] = mapped_column(
        String(20), default="Active", index=True
    )
    last_sign_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student_profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    grade_level: Mapped[str] = mapped_column(String(30), default="Grade 12")
    strand: Mapped[str] = mapped_column(String(30), default="STEM")
    section: Mapped[str | None] = mapped_column(String(80))
    target_concept_id: Mapped[int | None] = mapped_column(ForeignKey("concepts.id"))
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    onboarding_version: Mapped[str] = mapped_column(String(20), default="1.0")
    user: Mapped[User] = relationship(back_populates="student_profile")


class ConsentRecord(Base, TimestampMixin):
    __tablename__ = "consent_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    consented: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_version: Mapped[str] = mapped_column(String(30), default="1.0")
    recorded_by: Mapped[str] = mapped_column(String(80), default="demo-seed")
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginHistory(Base):
    __tablename__ = "login_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), index=True
    )
    participant_code: Mapped[str] = mapped_column(String(80), index=True)
    successful: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class UploadedDocument(Base, TimestampMixin):
    __tablename__ = "uploaded_documents"
    __table_args__ = (
        Index("ix_uploaded_documents_owner_status", "uploaded_by", "processing_status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20), index=True)
    file_size: Mapped[int] = mapped_column(Integer)
    content_sha256: Mapped[str] = mapped_column(String(64), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    processing_status: Mapped[str] = mapped_column(
        String(30), default="Ready", index=True
    )
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(String(300))
    storage_bucket: Mapped[str | None] = mapped_column(String(120))
    storage_object_path: Mapped[str | None] = mapped_column(String(700))


class Concept(Base, TimestampMixin):
    __tablename__ = "concepts"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    subject: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class PrerequisiteEdge(Base, TimestampMixin):
    __tablename__ = "prerequisite_edges"
    __table_args__ = (
        UniqueConstraint("prerequisite_concept_id", "succeeding_concept_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    prerequisite_concept_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id"), index=True
    )
    succeeding_concept_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id"), index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Activity(Base, TimestampMixin):
    __tablename__ = "activities"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    activity_type: Mapped[str] = mapped_column(String(40), index=True)
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=15)
    instructions: Mapped[str] = mapped_column(Text, default="")
    resource_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_diagnostic: Mapped[bool] = mapped_column(Boolean, default=False)
    is_onboarding_diagnostic: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class ActivityConcept(Base):
    __tablename__ = "activity_concepts"
    __table_args__ = (UniqueConstraint("activity_id", "concept_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)


class Question(Base, TimestampMixin):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("activities.id"), index=True
    )
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    feedback: Mapped[str] = mapped_column(Text, default="")
    hint: Mapped[str] = mapped_column(Text, default="")
    question_type: Mapped[str] = mapped_column(
        String(30), default="Multiple choice", index=True
    )
    correct_answer: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    difficulty_label: Mapped[str] = mapped_column(
        String(20), default="Moderate", index=True
    )
    cognitive_level: Mapped[str] = mapped_column(
        String(40), default="Understand", index=True
    )
    subject: Mapped[str] = mapped_column(
        String(100), default="General Physics", index=True
    )
    topic: Mapped[str] = mapped_column(String(160), default="", index=True)
    learning_competency: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[str] = mapped_column(
        String(50), default="Manually created", index=True
    )
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("uploaded_documents.id"), index=True
    )
    source_locator: Mapped[str] = mapped_column(
        String(300), default="Uploaded learning material"
    )
    solution_steps: Mapped[str] = mapped_column(Text, default="")
    solution_structure: Mapped[dict] = mapped_column(JSON, default=dict)
    estimated_cognitive_demand: Mapped[float] = mapped_column(Float, default=0.5)
    prerequisite_concept_id: Mapped[int | None] = mapped_column(
        ForeignKey("concepts.id")
    )
    validation_status: Mapped[str] = mapped_column(
        String(30), default="Needs review", index=True
    )
    validation_flags: Mapped[list] = mapped_column(JSON, default=list)
    generation_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    distractor_rationales: Mapped[dict] = mapped_column(JSON, default=dict)
    is_calculation: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft", index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    points: Mapped[float] = mapped_column(Float, default=1.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class AnswerChoice(Base):
    __tablename__ = "answer_choices"
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    misconception_id: Mapped[int | None] = mapped_column(
        ForeignKey("misconceptions.id"), index=True
    )
    misconception_confidence: Mapped[float | None] = mapped_column(Float)
    mapping_status: Mapped[str] = mapped_column(
        String(30), default="Unreviewed", index=True
    )


class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    subject: Mapped[str] = mapped_column(String(100), default="General Physics")
    topic: Mapped[str] = mapped_column(String(160), default="")
    status: Mapped[str] = mapped_column(String(20), default="Draft", index=True)
    mastery_threshold: Mapped[float] = mapped_column(Float, default=0.75)
    time_limit: Mapped[int | None] = mapped_column(Integer)
    maximum_attempts: Mapped[int] = mapped_column(Integer, default=1)
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_choices: Mapped[bool] = mapped_column(Boolean, default=False)
    show_score_immediately: Mapped[bool] = mapped_column(Boolean, default=True)
    show_explanations: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_retake: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"))


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"
    __table_args__ = (UniqueConstraint("assessment_id", "question_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)


class AssessmentAssignment(Base):
    __tablename__ = "assessment_assignments"
    __table_args__ = (
        UniqueConstraint("assessment_id", "student_id", "section"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    section: Mapped[str | None] = mapped_column(String(80), index=True)


class AssessmentAttempt(Base, TimestampMixin):
    __tablename__ = "assessment_attempts"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "activity_id",
            "started_at",
            name="uq_assessment_attempt_submission",
        ),
        Index(
            "ix_assessment_attempts_student_activity_submitted",
            "student_id",
            "activity_id",
            "submitted_at",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    max_score: Mapped[float] = mapped_column(Float, default=0)
    accuracy: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_seconds: Mapped[float] = mapped_column(Float, default=0)
    skipped_items: Mapped[int] = mapped_column(Integer, default=0)
    hint_usage_count: Mapped[int] = mapped_column(Integer, default=0)
    answer_change_count: Mapped[int] = mapped_column(Integer, default=0)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class ItemResponse(Base, TimestampMixin):
    __tablename__ = "item_responses"
    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    selected_choice_id: Mapped[int | None] = mapped_column(ForeignKey("answer_choices.id"))
    response_text: Mapped[str | None] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    earned_points: Mapped[float] = mapped_column(Float, default=0)
    max_points: Mapped[float] = mapped_column(Float, default=1)
    response_seconds: Mapped[float] = mapped_column(Float, default=0)
    hint_opened: Mapped[bool] = mapped_column(Boolean, default=False)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    answer_changes: Mapped[int] = mapped_column(Integer, default=0)


class InteractionLog(Base, TimestampMixin):
    __tablename__ = "interaction_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("assessment_attempts.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)
    response_accuracy: Mapped[float] = mapped_column(Float)
    average_response_seconds: Mapped[float] = mapped_column(Float)
    total_completion_seconds: Mapped[float] = mapped_column(Float)
    number_of_attempts: Mapped[int] = mapped_column(Integer)
    skipped_items: Mapped[int] = mapped_column(Integer)
    hint_usage_count: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submission_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class MentalEffortRating(Base, TimestampMixin):
    __tablename__ = "mental_effort_ratings"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_attempts.id"), unique=True, index=True
    )
    rating: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(20))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class MasteryRecord(Base, TimestampMixin):
    __tablename__ = "mastery_records"
    __table_args__ = (
        Index("ix_mastery_records_student_concept_created", "student_id", "concept_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    attempt_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_attempts.id"))
    mastery_score: Mapped[float] = mapped_column(Float)
    classification: Mapped[str] = mapped_column(String(30))
    calculation_mode: Mapped[str] = mapped_column(String(30), default="weighted")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class LearningGap(Base, TimestampMixin):
    __tablename__ = "learning_gaps"
    __table_args__ = (
        Index("ix_learning_gaps_student_resolved_concept", "student_id", "resolved_at", "concept_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    mastery_score: Mapped[float | None] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class PathwayRecommendation(Base, TimestampMixin):
    __tablename__ = "pathway_recommendations"
    __table_args__ = (
        Index(
            "uq_pathways_one_active_selected_per_student",
            "student_id",
            unique=True,
            postgresql_where=text("selected IS TRUE AND active IS TRUE"),
            sqlite_where=text("selected = 1 AND active = 1"),
        ),
        Index(
            "ix_pathways_student_active_selected_created",
            "student_id",
            "active",
            "selected",
            "created_at",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    label: Mapped[str] = mapped_column(String(80))
    selected: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    gap_coverage: Mapped[float] = mapped_column(Float)
    predicted_cognitive_load: Mapped[float] = mapped_column(Float)
    normalized_learning_time: Mapped[float] = mapped_column(Float)
    adaptive_pathway_score: Mapped[float] = mapped_column(Float)
    total_minutes: Mapped[int] = mapped_column(Integer)
    cognitive_load_category: Mapped[str] = mapped_column(String(20))
    cognitive_load_probabilities: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[str] = mapped_column(Text)
    feature_explanation: Mapped[dict] = mapped_column(JSON, default=dict)
    decision_explanation: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence_confidence: Mapped[str] = mapped_column(
        String(20), default="Low", index=True
    )
    source_type: Mapped[str] = mapped_column(
        String(30), default="Automatic", index=True
    )
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    teacher_note: Mapped[str] = mapped_column(Text, default="")
    learner_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    supersedes_pathway_id: Mapped[int | None] = mapped_column(
        ForeignKey("pathway_recommendations.id")
    )
    difficulty_override: Mapped[str | None] = mapped_column(String(30))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class PathwayStep(Base, TimestampMixin):
    __tablename__ = "pathway_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    pathway_id: Mapped[int] = mapped_column(
        ForeignKey("pathway_recommendations.id", ondelete="CASCADE"), index=True
    )
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"))
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    position: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    predicted_load_index: Mapped[float] = mapped_column(Float, default=0.5)
    selection_reason: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    completion_attempt_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_attempts.id")
    )


class ExpertEvaluation(Base, TimestampMixin):
    __tablename__ = "expert_evaluations"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    pathway_id: Mapped[int] = mapped_column(ForeignKey("pathway_recommendations.id"))
    recommendation_accuracy: Mapped[int] = mapped_column(Integer)
    adaptability: Mapped[int] = mapped_column(Integer)
    personalization: Mapped[int] = mapped_column(Integer)
    optimization_efficiency: Mapped[int] = mapped_column(Integer)
    pathway_relevance: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class ModelVersion(Base, TimestampMixin):
    __tablename__ = "model_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(80), unique=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sample_size: Mapped[int] = mapped_column(Integer)
    student_count: Mapped[int] = mapped_column(Integer)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    feature_names: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    file_path: Mapped[str | None] = mapped_column(String(500))
    artifact: Mapped[bytes | None] = mapped_column(LargeBinary)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    warning: Mapped[str | None] = mapped_column(Text)


class CognitiveLoadPrediction(Base, TimestampMixin):
    __tablename__ = "cognitive_load_predictions"
    __table_args__ = (
        Index(
            "ix_cognitive_load_predictions_student_evidence",
            "student_id",
            "evidence_date",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    model_version_id: Mapped[int] = mapped_column(
        ForeignKey("model_versions.id"), index=True
    )
    evidence_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    probabilities: Mapped[dict] = mapped_column(JSON, default=dict)
    predicted_category: Mapped[str] = mapped_column(String(20), index=True)
    expected_index: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    missing_features: Mapped[list] = mapped_column(JSON, default=list)
    feature_contributions: Mapped[dict] = mapped_column(JSON, default=dict)
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class GapDiagnosis(Base, TimestampMixin):
    __tablename__ = "gap_diagnoses"
    __table_args__ = (
        Index("ix_gap_diagnoses_student_concept_created", "student_id", "concept_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    diagnosis: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model_version_id: Mapped[int | None] = mapped_column(ForeignKey("model_versions.id"))
    recommended_activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[dict] = mapped_column(JSON)
    description: Mapped[str] = mapped_column(Text, default="")


class Misconception(Base, TimestampMixin):
    __tablename__ = "misconceptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    explanation: Mapped[str] = mapped_column(Text)
    remediation_instruction: Mapped[str] = mapped_column(Text)
    suggested_activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("activities.id")
    )
    validation_status: Mapped[str] = mapped_column(
        String(30), default="Teacher reviewed", index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class TutoringSession(Base, TimestampMixin):
    __tablename__ = "tutoring_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), index=True)
    mode: Mapped[str] = mapped_column(String(30), default="guided", index=True)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True)
    current_difficulty: Mapped[str] = mapped_column(String(20), default="Moderate")
    scaffolding_level: Mapped[int] = mapped_column(Integer, default=1)
    responses_count: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_correct: Mapped[int] = mapped_column(Integer, default=0)
    mastery_before: Mapped[float | None] = mapped_column(Float)
    mastery_after: Mapped[float | None] = mapped_column(Float)
    stop_reason: Mapped[str | None] = mapped_column(String(120))
    attempt_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_attempts.id")
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TutoringResponse(Base, TimestampMixin):
    __tablename__ = "tutoring_responses"
    __table_args__ = (UniqueConstraint("session_id", "question_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("tutoring_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    selected_choice_id: Mapped[int | None] = mapped_column(
        ForeignKey("answer_choices.id")
    )
    response_text: Mapped[str | None] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    response_seconds: Mapped[float] = mapped_column(Float, default=0)
    hint_opened: Mapped[bool] = mapped_column(Boolean, default=False)
    answer_changes: Mapped[int] = mapped_column(Integer, default=0)
    difficulty_at_response: Mapped[str] = mapped_column(String(20), default="Moderate")
    scaffolding_level: Mapped[int] = mapped_column(Integer, default=1)
    misconception_id: Mapped[int | None] = mapped_column(
        ForeignKey("misconceptions.id"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer)


class MisconceptionHistory(Base, TimestampMixin):
    __tablename__ = "misconception_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    misconception_id: Mapped[int] = mapped_column(
        ForeignKey("misconceptions.id"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    selected_choice_id: Mapped[int | None] = mapped_column(
        ForeignKey("answer_choices.id")
    )
    attempt_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_attempts.id"))
    tutoring_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("tutoring_sessions.id")
    )
    evidence_count: Mapped[int] = mapped_column(Integer, default=1)
    confidence_level: Mapped[str] = mapped_column(String(20), default="Low")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_attempt_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_attempts.id")
    )


class PathwayVersion(Base, TimestampMixin):
    __tablename__ = "pathway_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    pathway_id: Mapped[int] = mapped_column(
        ForeignKey("pathway_recommendations.id"), index=True
    )
    previous_pathway_id: Mapped[int | None] = mapped_column(
        ForeignKey("pathway_recommendations.id")
    )
    version_number: Mapped[int] = mapped_column(Integer)
    trigger_type: Mapped[str] = mapped_column(String(40), index=True)
    trigger_id: Mapped[int | None] = mapped_column(Integer)
    change_reason: Mapped[str] = mapped_column(Text)
    previous_state: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_state: Mapped[dict] = mapped_column(JSON, default=dict)


class LearningSummary(Base, TimestampMixin):
    __tablename__ = "learning_summaries"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    attempt_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_attempts.id"), unique=True, index=True
    )
    tutoring_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("tutoring_sessions.id"), unique=True
    )
    summary: Mapped[dict] = mapped_column(JSON, default=dict)


class TeacherIntervention(Base, TimestampMixin):
    __tablename__ = "teacher_interventions"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    concept_id: Mapped[int | None] = mapped_column(ForeignKey("concepts.id"))
    misconception_id: Mapped[int | None] = mapped_column(
        ForeignKey("misconceptions.id")
    )
    pathway_id: Mapped[int | None] = mapped_column(
        ForeignKey("pathway_recommendations.id")
    )
    assigned_activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("activities.id")
    )
    action_type: Mapped[str] = mapped_column(String(50), index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="Open", index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
