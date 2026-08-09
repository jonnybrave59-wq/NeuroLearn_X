"""Vercel Services adapter for the existing NeuroLearn-X FastAPI API.

Vercel removes a service's route prefix before invoking it. NeuroLearn-X keeps
its established `/api/*` routes internally, so this small ASGI adapter restores
that prefix without changing any application endpoint or calculation.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from app.main import app as neurolearnx_app


class ApiPrefixAdapter:
    def __init__(self, application: Callable[..., Awaitable[Any]]) -> None:
        self.application = application

    async def __call__(self, scope: dict[str, Any], receive, send) -> None:
        if scope.get("type") not in {"http", "websocket"}:
            await self.application(scope, receive, send)
            return

        path = str(scope.get("path") or "/")
        if path == "/api" or path.startswith("/api/"):
            await self.application(scope, receive, send)
            return

        rewritten = dict(scope)
        rewritten_path = f"/api{'' if path == '/' else path}"
        rewritten["path"] = rewritten_path
        rewritten["raw_path"] = rewritten_path.encode("utf-8")
        await self.application(rewritten, receive, send)


app = ApiPrefixAdapter(neurolearnx_app)
