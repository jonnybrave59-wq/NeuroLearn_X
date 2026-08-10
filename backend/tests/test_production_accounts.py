from unittest.mock import MagicMock

from app.models import User
from app.production_accounts import synchronize_demo_credentials
from app.security import hash_password, verify_password


def account(role: str, code: str, password: str, *, is_demo: bool) -> User:
    return User(
        id=1 if role == "teacher" else 2,
        participant_code=code,
        password_hash=hash_password(password),
        role=role,
        display_name=code,
        is_demo=is_demo,
        is_active=True,
        account_status="Active",
    )


def test_configured_secrets_are_authoritative_for_demo_accounts():
    teacher = account("teacher", "TEACHER01", "Older!Teacher1", is_demo=True)
    student = account("student", "STEM001", "Older!Student1", is_demo=True)
    db = MagicMock()
    db.scalar.return_value = teacher
    db.scalars.return_value = [student]

    changed = synchronize_demo_credentials(
        db,
        "Current!Teacher1",
        "Current!Student1",
    )

    assert changed == 2
    assert verify_password("Current!Teacher1", teacher.password_hash)
    assert verify_password("Current!Student1", student.password_hash)


def test_no_teacher_record_is_created_or_changed_when_reserved_account_is_absent():
    db = MagicMock()
    db.scalar.return_value = None
    db.scalars.return_value = []

    changed = synchronize_demo_credentials(
        db,
        "Configured!Teacher1",
        "Configured!Student1",
    )

    assert changed == 0
    db.add.assert_not_called()
