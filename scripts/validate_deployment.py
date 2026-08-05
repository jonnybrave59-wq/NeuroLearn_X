"""Fail fast when production is configured with unsafe or ephemeral settings."""

from __future__ import annotations

import os
import sys
from urllib.parse import urlsplit


def origin(value: str) -> str | None:
    value = value.strip().rstrip("/")
    parts = urlsplit(value)
    if (
        parts.scheme != "https"
        or not parts.netloc
        or "*" in parts.netloc
        or parts.username
        or parts.password
        or parts.path not in {"", "/"}
        or parts.query
        or parts.fragment
    ):
        return None
    return f"https://{parts.netloc}"


def main() -> int:
    production = (
        os.getenv("REPLIT_DEPLOYMENT") == "1"
        or os.getenv("APP_ENV", "").lower() == "production"
    )
    if not production:
        print("Development configuration accepted.")
        return 0

    errors: list[str] = []
    database_url = os.getenv("DATABASE_URL", "")
    secret_key = os.getenv("SECRET_KEY", "")
    public_app_url = os.getenv("PUBLIC_APP_URL", "").strip()
    render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if not public_app_url and render_hostname:
        public_app_url = f"https://{render_hostname}"
    public_origin = origin(public_app_url)
    configured_allowed_values = [
        item.strip().rstrip("/")
        for item in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    ]
    # The canonical same-origin app is always approved by app.main. Additional
    # entries are required only for deliberately separate clients.
    allowed_values = list(configured_allowed_values)
    if public_origin and public_origin not in allowed_values:
        allowed_values.append(public_origin)
    capacitor_values = [
        item.strip().rstrip("/")
        for item in os.getenv("CAPACITOR_ORIGINS", "").split(",")
        if item.strip()
    ]
    if not database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        errors.append("DATABASE_URL must point to persistent PostgreSQL.")
    if len(secret_key) < 32 or secret_key.startswith("replace-"):
        errors.append("SECRET_KEY must be a random value of at least 32 characters.")
    if os.getenv("COOKIE_SECURE") != "1":
        errors.append("COOKIE_SECURE must be 1 for HTTPS deployment.")
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax").lower()
    if cookie_samesite not in {"lax", "strict", "none"}:
        errors.append("COOKIE_SAMESITE must be lax, strict, or none.")
    if not public_origin or "your-neurolearnx" in public_app_url.lower():
        errors.append("PUBLIC_APP_URL must be the final clean HTTPS deployment origin.")
    if "*" in configured_allowed_values:
        errors.append("ALLOWED_ORIGINS cannot contain a wildcard when cookies are enabled.")
    cross_origin_clients = [
        value for value in [*allowed_values, *capacitor_values]
        if value != public_origin
    ]
    if cross_origin_clients and cookie_samesite != "none":
        errors.append("Cross-origin clients require COOKIE_SAMESITE=none.")
    invalid_origins = [
        value for value in [*allowed_values, *capacitor_values] if not origin(value)
    ]
    if invalid_origins:
        errors.append("ALLOWED_ORIGINS entries must be clean HTTPS origins without paths.")
    if os.getenv("CREATE_TABLES_ON_STARTUP", "0") != "0":
        errors.append("CREATE_TABLES_ON_STARTUP must be 0; Alembic manages production schema.")
    if errors:
        print("Unsafe deployment configuration:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Production environment validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
