"""Persistent object storage for uploaded learning materials.

Supabase Storage is optional in local development. Production deployments that
set one storage variable must set the complete group so raw uploads never fall
back to an ephemeral serverless filesystem.
"""

from __future__ import annotations

import os
from urllib.parse import quote, urlsplit

import httpx


def storage_settings() -> tuple[str, str, str] | None:
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "").strip()
    values = (base_url, service_key, bucket)
    if not any(values):
        return None
    if not all(values):
        raise RuntimeError(
            "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and "
            "SUPABASE_STORAGE_BUCKET must be configured together"
        )
    parts = urlsplit(base_url)
    if parts.scheme != "https" or not parts.netloc or parts.path not in {"", "/"}:
        raise RuntimeError("SUPABASE_URL must be a clean HTTPS origin")
    return base_url, service_key, bucket


def storage_headers(service_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }


async def upload_object(
    object_path: str,
    data: bytes,
    content_type: str,
) -> tuple[str, str] | None:
    settings = storage_settings()
    if settings is None:
        return None
    base_url, service_key, bucket = settings
    target = (
        f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/"
        f"{quote(object_path, safe='/')}"
    )
    headers = {
        **storage_headers(service_key),
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "false",
    }
    timeout = float(os.getenv("SUPABASE_STORAGE_TIMEOUT_SECONDS", "30"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(target, headers=headers, content=data)
    if response.status_code not in {200, 201}:
        raise RuntimeError(
            f"Supabase Storage upload failed with status {response.status_code}"
        )
    return bucket, object_path


async def delete_object(bucket: str | None, object_path: str | None) -> None:
    if not bucket or not object_path:
        return
    settings = storage_settings()
    if settings is None:
        return
    base_url, service_key, _configured_bucket = settings
    target = f"{base_url}/storage/v1/object/{quote(bucket, safe='')}"
    timeout = float(os.getenv("SUPABASE_STORAGE_TIMEOUT_SECONDS", "30"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.request(
            "DELETE",
            target,
            headers={**storage_headers(service_key), "Content-Type": "application/json"},
            json={"prefixes": [object_path]},
        )
    if response.status_code not in {200, 204, 404}:
        raise RuntimeError(
            f"Supabase Storage deletion failed with status {response.status_code}"
        )
