FROM node:24-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The browser build is deliberately same-origin. The Android workflow sets an
# explicit HTTPS API origin when it creates the native bundle.
ENV VITE_API_BASE_URL="" \
    VITE_PUBLIC_APP_URL="" \
    VITE_SOURCE_AVAILABLE="true" \
    VITE_APK_AVAILABLE="false" \
    VITE_WINDOWS_PACKAGE_AVAILABLE="false"
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend-build /build/frontend/dist/ /app/frontend/dist/
COPY release/NeuroLearn-X-Source-Code.zip /app/release/NeuroLearn-X-Source-Code.zip
COPY release/NeuroLearn-X-Source-Code.zip.sha256 /app/release/NeuroLearn-X-Source-Code.zip.sha256
COPY scripts/validate_deployment.py /app/scripts/validate_deployment.py
COPY full-system/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

WORKDIR /app/backend
EXPOSE 10000
CMD ["/app/docker-entrypoint.sh"]
