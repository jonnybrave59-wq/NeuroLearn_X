"""Synchronize protected demo credentials after production migrations."""

from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import AuditLog, User
from .schemas import validate_secure_password
from .security import hash_password, verify_password


KNOWN_TEACHER_PASSWORD = "NeuroTeach!2026"
KNOWN_STUDENT_PASSWORD = "LearnX!2026"


def required_password(name: str) -> str:
    value = os.getenv(name, "")
    try:
        validate_secure_password(value)
    except ValueError as error:
        raise RuntimeError(
            f"{name} must contain uppercase, lowercase, number, and symbol"
        ) from error
    if value in {KNOWN_TEACHER_PASSWORD, KNOWN_STUDENT_PASSWORD}:
        raise RuntimeError(f"{name} cannot reuse a published development password")
    return value


def synchronize_demo_credentials(
    db: Session,
    teacher_password: str,
    student_password: str,
) -> int:
    """Make deployment secrets authoritative for reserved demo accounts."""
    rotated = 0
    teacher = db.scalar(
        select(User).where(
            User.participant_code == "TEACHER01",
        )
    )
    if teacher is None:
        teacher = User(
            participant_code="TEACHER01",
            password_hash=hash_password(teacher_password),
            role="teacher",
            display_name="Research Teacher",
            must_change_password=False,
            is_active=True,
            is_demo=True,
            account_status="Active",
        )
        db.add(teacher)
        db.flush()
        db.add(
            AuditLog(
                actor_id=None,
                action="account.production_reserved_created",
                entity_type="user",
                entity_id=str(teacher.id),
                details={"account": "teacher-demo"},
            )
        )
        rotated += 1
    elif teacher.role != "teacher":
        raise RuntimeError("Reserved participant code TEACHER01 has the wrong role")
    elif not verify_password(teacher_password, teacher.password_hash):
        teacher.password_hash = hash_password(teacher_password)
        db.add(
            AuditLog(
                actor_id=None,
                action="account.production_credential_synchronized",
                entity_type="user",
                entity_id=str(teacher.id),
                details={"account": "teacher-demo"},
            )
        )
        rotated += 1

    students = list(
        db.scalars(
            select(User).where(
                User.role == "student",
                User.is_demo.is_(True),
            )
        )
    )
    for student in students:
        if verify_password(student_password, student.password_hash):
            continue
        student.password_hash = hash_password(student_password)
        db.add(
            AuditLog(
                actor_id=None,
                action="account.production_credential_synchronized",
                entity_type="user",
                entity_id=str(student.id),
                details={"account": "student-demo"},
            )
        )
        rotated += 1
    return rotated


def main() -> None:
    if os.getenv("APP_ENV", "").strip().lower() != "production":
        print("Production account synchronization skipped outside production.")
        return

    teacher_password = required_password("PRODUCTION_TEACHER_PASSWORD")
    student_password = required_password("PRODUCTION_DEMO_STUDENT_PASSWORD")
    with SessionLocal.begin() as db:
        rotated = synchronize_demo_credentials(
            db,
            teacher_password,
            student_password,
        )

    print(f"Production credential check completed; synchronized accounts: {rotated}.")


if __name__ == "__main__":
    main()
