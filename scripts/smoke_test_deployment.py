"""Non-destructive live smoke test for a local or public NeuroLearn-X deployment."""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import httpx


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for authenticated smoke testing")
    return value


def checked(response: httpx.Response, expected: int = 200) -> httpx.Response:
    if response.status_code != expected:
        raise RuntimeError(
            f"{response.request.method} {response.request.url.path} returned "
            f"{response.status_code}; expected {expected}"
        )
    if not response.headers.get("x-request-id"):
        raise RuntimeError(f"{response.request.url.path} did not return X-Request-ID")
    return response


def main() -> int:
    base_url = required("NEUROLEARNX_SMOKE_BASE_URL").rstrip("/")
    parts = urlsplit(base_url)
    if parts.scheme not in {"http", "https"} or not parts.netloc or parts.path:
        raise RuntimeError("NEUROLEARNX_SMOKE_BASE_URL must be a clean HTTP(S) origin")
    if parts.scheme != "https" and parts.hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Public smoke tests require HTTPS")

    student_id = required("SMOKE_STUDENT_ID")
    student_password = required("SMOKE_STUDENT_PASSWORD")
    teacher_id = required("SMOKE_TEACHER_ID")
    teacher_password = required("SMOKE_TEACHER_PASSWORD")
    timeout = httpx.Timeout(20.0)
    results: dict[str, object] = {}

    with httpx.Client(base_url=base_url, timeout=timeout, follow_redirects=False) as public:
        health = checked(public.get("/api/health"))
        assert health.json()["service"] == "NeuroLearn-X API"
        checked(public.get("/api/health/live"))
        ready = checked(public.get("/api/health/ready")).json()
        homepage = checked(public.get("/"))
        assert "NeuroLearn-X" in homepage.text
        checked(public.get("/api/student/dashboard"), 401)
        results["database"] = ready["database"]

    with httpx.Client(base_url=base_url, timeout=timeout) as student:
        login = checked(
            student.post(
                "/api/auth/login",
                json={
                    "participant_code": student_id,
                    "password": student_password,
                    "expected_role": "student",
                },
            )
        )
        assert login.json()["role"] == "student"
        checked(student.get("/api/auth/me"))
        dashboard = checked(student.get("/api/student/dashboard")).json()
        checked(student.get("/api/student/assessments"))
        checked(student.get("/api/student/pathways"))
        checked(student.get("/api/student/graph"))
        student_cookie = student.cookies.get("neurolearnx_session")
        checked(student.get("/api/teacher/dashboard"), 403)
        results["student"] = dashboard["student"]["participant_code"]

    with httpx.Client(base_url=base_url, timeout=timeout) as teacher:
        login = checked(
            teacher.post(
                "/api/auth/login",
                json={
                    "participant_code": teacher_id,
                    "password": teacher_password,
                    "expected_role": "teacher",
                },
            )
        )
        assert login.json()["role"] == "teacher"
        checked(teacher.get("/api/auth/me"))
        checked(teacher.get("/api/teacher/dashboard"))
        students = checked(teacher.get("/api/teacher/students")).json()
        checked(teacher.get("/api/teacher/activities"))
        checked(teacher.get("/api/teacher/documents"))
        checked(teacher.get("/api/teacher/question-bank?page=1&page_size=10"))
        teacher_cookie = teacher.cookies.get("neurolearnx_session")
        checked(teacher.get("/api/student/dashboard"), 403)
        results["teacher_student_count"] = len(students)

    if not student_cookie or not teacher_cookie:
        raise RuntimeError("Authentication cookies were not issued")

    checks = [
        ("/api/health", None),
    ] * 10 + [
        ("/api/student/dashboard", student_cookie),
    ] * 5 + [
        ("/api/teacher/dashboard", teacher_cookie),
    ] * 5

    def concurrent_check(item: tuple[str, str | None]) -> int:
        path, cookie = item
        cookies = {"neurolearnx_session": cookie} if cookie else None
        response = httpx.get(
            f"{base_url}{path}",
            cookies=cookies,
            timeout=timeout,
        )
        checked(response)
        return response.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(concurrent_check, checks))
    results["concurrent_requests"] = len(statuses)
    results["concurrent_successes"] = statuses.count(200)

    for identifier, password, role in [
        (student_id, student_password, "student"),
        (teacher_id, teacher_password, "teacher"),
    ]:
        with httpx.Client(base_url=base_url, timeout=timeout) as client:
            checked(
                client.post(
                    "/api/auth/login",
                    json={
                        "participant_code": identifier,
                        "password": password,
                        "expected_role": role,
                    },
                )
            )
            checked(client.post("/api/auth/logout"))
            checked(client.get("/api/auth/me"), 401)

    results["status"] = "passed"
    print(json.dumps(results, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
