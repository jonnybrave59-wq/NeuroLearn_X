from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_public_health_alias_and_security_headers(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "NeuroLearn-X API"
    assert response.json()["name"] == "NeuroLearn-X"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_expired_session_response_clears_the_invalid_cookie(client):
    client.cookies.set("neurolearnx_session", "expired-token")
    response = client.get("/api/student/dashboard")
    assert response.status_code == 401
    cookie = response.headers.get("set-cookie", "")
    assert "neurolearnx_session=" in cookie
    assert "Max-Age=0" in cookie


def test_state_change_rejects_unapproved_origin(client):
    response = client.post(
        "/api/auth/logout",
        headers={"Origin": "https://attacker.example"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Request origin is not approved"


def test_approved_development_origin_receives_credentialed_cors(client):
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def run_validator(overrides: dict[str, str]) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update(overrides)
    return subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_deployment.py")],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_production_validator_rejects_placeholder_and_wildcard():
    result = run_validator(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://user:pass@db.example/neurolearnx",
            "SECRET_KEY": "x" * 64,
            "COOKIE_SECURE": "1",
            "COOKIE_SAMESITE": "none",
            "PUBLIC_APP_URL": "https://your-neurolearnx-app.replit.app",
            "ALLOWED_ORIGINS": "*",
            "CREATE_TABLES_ON_STARTUP": "0",
        }
    )
    assert result.returncode == 1
    assert "final clean HTTPS deployment origin" in result.stderr
    assert "cannot contain a wildcard" in result.stderr


def test_production_validator_accepts_exact_https_origins():
    public_url = "https://neurolearnx-test.replit.app"
    result = run_validator(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://user:pass@db.example/neurolearnx",
            "SECRET_KEY": "x" * 64,
            "COOKIE_SECURE": "1",
            "COOKIE_SAMESITE": "none",
            "PUBLIC_APP_URL": public_url,
            "ALLOWED_ORIGINS": public_url,
            "CAPACITOR_ORIGINS": "https://native-client.example",
            "CREATE_TABLES_ON_STARTUP": "0",
        }
    )
    assert result.returncode == 0, result.stderr
    assert "validation passed" in result.stdout


def test_same_origin_production_accepts_lax_cookie_policy():
    public_url = "https://neurolearnx-test.replit.app"
    result = run_validator(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://user:pass@db.example/neurolearnx",
            "SECRET_KEY": "x" * 64,
            "COOKIE_SECURE": "1",
            "COOKIE_SAMESITE": "lax",
            "PUBLIC_APP_URL": public_url,
            "ALLOWED_ORIGINS": public_url,
            "CAPACITOR_ORIGINS": "",
            "CREATE_TABLES_ON_STARTUP": "0",
        }
    )
    assert result.returncode == 0, result.stderr


def test_render_hostname_supplies_the_canonical_same_origin():
    result = run_validator(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql://user:pass@db.example/neurolearnx",
            "SECRET_KEY": "x" * 64,
            "COOKIE_SECURE": "1",
            "COOKIE_SAMESITE": "none",
            "PUBLIC_APP_URL": "",
            "RENDER_EXTERNAL_HOSTNAME": "neurolearn-x.onrender.com",
            "ALLOWED_ORIGINS": "",
            "CAPACITOR_ORIGINS": "https://localhost",
            "CREATE_TABLES_ON_STARTUP": "0",
        }
    )
    assert result.returncode == 0, result.stderr
