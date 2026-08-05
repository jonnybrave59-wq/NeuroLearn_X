from __future__ import annotations

from datetime import datetime

import re

from pydantic import BaseModel, Field, field_validator, model_validator


class LoginInput(BaseModel):
    participant_code: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=6, max_length=128)
    expected_role: str | None = None


def validate_secure_password(value: str) -> str:
    if (
        len(value) < 10
        or not re.search(r"[A-Z]", value)
        or not re.search(r"[a-z]", value)
        or not re.search(r"\d", value)
        or not re.search(r"[^A-Za-z0-9]", value)
    ):
        raise ValueError(
            "Password must contain uppercase, lowercase, number, and symbol"
        )
    return value


class StudentRegistrationInput(BaseModel):
    student_id: str = Field(min_length=3, max_length=40)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=180)
    username: str | None = Field(default=None, min_length=3, max_length=80)
    password: str = Field(min_length=10, max_length=128)
    confirm_password: str = Field(min_length=10, max_length=128)
    grade_level: str = Field(min_length=2, max_length=30)
    section: str | None = Field(default=None, max_length=80)
    accept_terms: bool

    @field_validator("student_id")
    @classmethod
    def valid_student_id(cls, value: str):
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{2,39}", value):
            raise ValueError("Student ID may use letters, numbers, hyphens, and underscores")
        return value

    @field_validator("username")
    @classmethod
    def valid_username(cls, value: str | None):
        if value is None or not value.strip():
            return None
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,79}", value):
            raise ValueError("Username contains unsupported characters")
        return value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str | None):
        if value is None or not value.strip():
            return None
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def secure_password(cls, value: str):
        return validate_secure_password(value)

    @model_validator(mode="after")
    def valid_registration(self):
        if not self.email and not self.username:
            raise ValueError("Provide an email address or username")
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not self.accept_terms:
            raise ValueError("Terms and privacy notice must be accepted")
        return self


class ForgotPasswordInput(BaseModel):
    identifier: str = Field(min_length=3, max_length=180)


class PasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def secure_password(cls, value: str):
        return validate_secure_password(value)


class StudentActionInput(BaseModel):
    action: str
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("action")
    @classmethod
    def valid_action(cls, value: str):
        if value not in {
            "reset_password",
            "deactivate",
            "reactivate",
            "archive",
            "remove",
        }:
            raise ValueError("Unsupported student action")
        return value


class ConceptInput(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    subject: str
    description: str
    difficulty: int = Field(ge=1, le=5)


class EdgeInput(BaseModel):
    prerequisite_concept_id: int
    succeeding_concept_id: int


class ActivityInput(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str
    activity_type: str
    difficulty: int = Field(ge=1, le=5)
    estimated_minutes: int = Field(ge=1, le=300)
    instructions: str = ""
    resource_url: str | None = None
    concept_ids: list[int] = Field(min_length=1)
    is_diagnostic: bool = False


class ChoiceInput(BaseModel):
    text: str
    is_correct: bool = False
    misconception_id: int | None = None
    misconception_confidence: float | None = Field(default=None, ge=0, le=1)
    mapping_status: str = "Unreviewed"

    @field_validator("mapping_status")
    @classmethod
    def valid_mapping_status(cls, value: str):
        if value not in {"Unreviewed", "Teacher reviewed", "Validated", "Rejected"}:
            raise ValueError("Unsupported misconception mapping status")
        return value


class QuestionInput(BaseModel):
    activity_id: int
    concept_id: int
    prompt: str = Field(min_length=3)
    feedback: str = ""
    hint: str = ""
    points: float = Field(default=1, gt=0, le=100)
    choices: list[ChoiceInput] = Field(min_length=2)

    @field_validator("choices")
    @classmethod
    def one_correct_choice(cls, choices):
        if sum(1 for choice in choices if choice.is_correct) != 1:
            raise ValueError("Exactly one answer choice must be correct")
        return choices


class QuestionBankInput(BaseModel):
    concept_id: int
    prompt: str = Field(min_length=3, max_length=5000)
    question_type: str
    correct_answer: str = Field(min_length=1, max_length=3000)
    explanation: str = Field(default="", max_length=5000)
    hint: str = Field(default="", max_length=3000)
    difficulty: str
    cognitive_level: str
    subject: str = Field(min_length=2, max_length=100)
    topic: str = Field(min_length=1, max_length=160)
    learning_competency: str = Field(default="", max_length=1000)
    choices: list[ChoiceInput] = Field(default_factory=list, max_length=8)
    points: float = Field(default=1, gt=0, le=100)
    source_locator: str = Field(default="Uploaded learning material", max_length=300)
    solution_steps: str = Field(default="", max_length=5000)
    solution_structure: dict = Field(default_factory=dict)
    estimated_cognitive_demand: float = Field(default=0.5, ge=0, le=1)
    prerequisite_concept_id: int | None = None
    validation_status: str = Field(default="Needs review", max_length=30)
    validation_flags: list[str] = Field(default_factory=list, max_length=20)
    distractor_rationales: dict[str, str] = Field(default_factory=dict)
    is_calculation: bool = False
    status: str = "Draft"

    @model_validator(mode="after")
    def valid_question(self):
        allowed_types = {
            "Multiple choice",
            "True or false",
            "Identification",
            "Short answer",
        }
        if self.question_type not in allowed_types:
            raise ValueError("Unsupported question type")
        if self.status not in {"Draft", "Ready", "Published", "Archived"}:
            raise ValueError("Unsupported question status")
        if self.question_type in {"Multiple choice", "True or false"}:
            if len(self.choices) < 2:
                raise ValueError("This question type requires answer choices")
            if sum(1 for choice in self.choices if choice.is_correct) != 1:
                raise ValueError("Exactly one answer choice must be correct")
            normalized = [choice.text.strip().casefold() for choice in self.choices]
            if len(normalized) != len(set(normalized)):
                raise ValueError("Answer choices must be unique")
        return self


class DocumentGenerationInput(BaseModel):
    subject: str = Field(min_length=2, max_length=100)
    grade_level: str = Field(min_length=2, max_length=30)
    topic: str = Field(min_length=1, max_length=160)
    concept_id: int
    learning_competency: str = Field(min_length=2, max_length=1000)
    number_of_questions: int = Field(ge=1, le=30)
    question_type: str
    difficulty: str
    cognitive_level: str
    include_explanations: bool = True
    include_hints: bool = True
    include_prerequisites: bool = False
    include_calculations: bool = False

    @field_validator("question_type")
    @classmethod
    def valid_question_type(cls, value: str):
        if value not in {
            "Multiple choice",
            "True or false",
            "Identification",
            "Short answer",
        }:
            raise ValueError("Unsupported question type")
        return value


class QuestionBatchInput(BaseModel):
    question_ids: list[int] = Field(min_length=1, max_length=100)
    action: str

    @field_validator("action")
    @classmethod
    def valid_action(cls, value: str):
        if value not in {"regenerate", "archive", "save"}:
            raise ValueError("Unsupported batch action")
        return value


class AssessmentInput(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(default="", max_length=5000)
    subject: str = Field(min_length=2, max_length=100)
    topic: str = Field(min_length=1, max_length=160)
    question_ids: list[int] = Field(min_length=1, max_length=100)
    status: str = "Draft"
    mastery_threshold: float = Field(ge=0.1, le=1)
    time_limit: int | None = Field(default=None, ge=1, le=600)
    maximum_attempts: int = Field(default=1, ge=1, le=20)
    available_from: datetime | None = None
    due_at: datetime | None = None
    student_ids: list[int] = Field(default_factory=list, max_length=1000)
    sections: list[str] = Field(default_factory=list, max_length=100)
    shuffle_questions: bool = False
    shuffle_choices: bool = False
    show_score_immediately: bool = True
    show_explanations: bool = True
    allow_retake: bool = False

    @model_validator(mode="after")
    def valid_assessment(self):
        if self.status not in {"Draft", "Scheduled", "Published", "Closed", "Archived"}:
            raise ValueError("Unsupported assessment status")
        if self.available_from and self.due_at and self.due_at <= self.available_from:
            raise ValueError("Due date must be after the start date")
        if not self.allow_retake:
            self.maximum_attempts = 1
        return self


class AssessmentStatusInput(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str):
        if value not in {"Draft", "Scheduled", "Published", "Closed", "Archived"}:
            raise ValueError("Unsupported assessment status")
        return value


class ResponseInput(BaseModel):
    question_id: int
    selected_choice_id: int | None = None
    response_text: str | None = Field(default=None, max_length=5000)
    response_seconds: float = Field(default=0, ge=0, le=86_400)
    hint_opened: bool = False
    skipped: bool = False
    answer_changes: int = Field(default=0, ge=0, le=100)


class AttemptInput(BaseModel):
    activity_id: int
    started_at: datetime
    responses: list[ResponseInput]


class TutoringSessionInput(BaseModel):
    activity_id: int
    mode: str = "guided"

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, value: str):
        if value not in {"guided", "mastery_check"}:
            raise ValueError("Unsupported tutoring mode")
        return value


class TutoringResponseInput(BaseModel):
    question_id: int
    selected_choice_id: int | None = None
    response_text: str | None = Field(default=None, max_length=5000)
    response_seconds: float = Field(default=0, ge=0, le=86_400)
    hint_opened: bool = False
    answer_changes: int = Field(default=0, ge=0, le=100)


class MentalEffortInput(BaseModel):
    rating: int = Field(ge=1, le=9)


class TargetInput(BaseModel):
    concept_id: int


class PathwayPreviewInput(BaseModel):
    difficulty: str = "Auto"

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, value: str):
        if value not in {"Auto", "Guided pathway", "Standard pathway", "Faster review pathway"}:
            raise ValueError("Unsupported pathway difficulty")
        return value


class PathwayAssignmentStepInput(BaseModel):
    concept_id: int
    activity_id: int
    position: int = Field(ge=1, le=100)


class PathwayAssignmentInput(BaseModel):
    target_concept_id: int
    label: str = Field(min_length=3, max_length=80)
    difficulty: str
    teacher_note: str = Field(default="", max_length=2000)
    due_at: datetime | None = None
    steps: list[PathwayAssignmentStepInput] = Field(min_length=1, max_length=100)

    @field_validator("difficulty")
    @classmethod
    def valid_assignment_difficulty(cls, value: str):
        if value not in {"Guided pathway", "Standard pathway", "Faster review pathway"}:
            raise ValueError("Unsupported pathway difficulty")
        return value


class SettingsInput(BaseModel):
    mastery_threshold: float = Field(ge=0.1, le=1)
    mastery_mode: str
    alpha: float = Field(ge=0, le=1)
    beta: float = Field(ge=0, le=1)
    gamma: float = Field(ge=0, le=1)
    mental_effort_low_max: int = Field(ge=1, le=7)
    mental_effort_moderate_max: int = Field(ge=2, le=8)
    likert_scale_max: int = Field(default=5, ge=3, le=10)
    guided_mastery_max: float = Field(default=0.49, ge=0, le=1)
    review_mastery_min: float = Field(default=0.68, ge=0, le=1)
    high_load_threshold: float = Field(default=0.67, ge=0, le=1)
    tutoring_min_questions: int = Field(default=5, ge=1, le=20)
    tutoring_consecutive_correct: int = Field(default=3, ge=1, le=10)
    tutoring_max_questions: int = Field(default=10, ge=3, le=30)
    misconception_remediation_repetitions: int = Field(default=2, ge=1, le=5)
    misconception_pause_repetitions: int = Field(default=3, ge=2, le=8)

    @field_validator("mastery_mode")
    @classmethod
    def validate_mode(cls, value):
        if value not in {"latest", "weighted"}:
            raise ValueError("Mastery mode must be latest or weighted")
        return value

    def validate_combination(self):
        if abs((self.alpha + self.beta + self.gamma) - 1.0) > 1e-6:
            raise ValueError("Optimization weights must total exactly 1")
        if self.mental_effort_low_max >= self.mental_effort_moderate_max:
            raise ValueError("Mental-effort boundaries must be increasing")
        if self.guided_mastery_max >= self.review_mastery_min:
            raise ValueError("Guided and faster-review mastery boundaries must be increasing")
        if self.review_mastery_min > self.mastery_threshold:
            raise ValueError("Faster-review mastery must not exceed the mastery threshold")
        if self.tutoring_min_questions > self.tutoring_max_questions:
            raise ValueError("Tutoring minimum must not exceed the maximum")
        if self.misconception_remediation_repetitions >= self.misconception_pause_repetitions:
            raise ValueError("Misconception pause count must exceed remediation count")


class InterventionInput(BaseModel):
    student_id: int
    concept_id: int | None = None
    misconception_id: int | None = None
    pathway_id: int | None = None
    assigned_activity_id: int | None = None
    action_type: str
    note: str = Field(default="", max_length=3000)

    @field_validator("action_type")
    @classmethod
    def valid_action_type(cls, value: str):
        if value not in {
            "Assign remediation",
            "Add support note",
            "Override pathway",
            "Resolve misconception",
        }:
            raise ValueError("Unsupported intervention action")
        return value


class MisconceptionInput(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=3, max_length=180)
    concept_id: int
    explanation: str = Field(min_length=10, max_length=5000)
    remediation_instruction: str = Field(min_length=10, max_length=5000)
    suggested_activity_id: int | None = None
    validation_status: str = "Teacher reviewed"
    active: bool = True

    @field_validator("validation_status")
    @classmethod
    def valid_validation_status(cls, value: str):
        if value not in {"Needs review", "Teacher reviewed", "Validated", "Rejected"}:
            raise ValueError("Unsupported misconception validation status")
        return value


class EvaluationInput(BaseModel):
    pathway_id: int
    recommendation_accuracy: int
    adaptability: int
    personalization: int
    optimization_efficiency: int
    pathway_relevance: int
    comment: str = ""


class ResetInput(BaseModel):
    confirmation: str
