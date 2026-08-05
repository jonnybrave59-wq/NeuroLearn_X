"""Seed demo accounts once, without resetting an existing deployment."""

from sqlalchemy import func, select

from .database import SessionLocal
from .models import User
from .seed import seed_database


def main() -> None:
    with SessionLocal() as db:
        user_count = db.scalar(select(func.count(User.id))) or 0
        if user_count:
            print(f"Database already contains {user_count} users; demo seed skipped.")
            return
        seed_database(db)
        print("Empty database initialized with NeuroLearn-X demo records.")


if __name__ == "__main__":
    main()
