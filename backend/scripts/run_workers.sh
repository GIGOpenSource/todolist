#!/usr/bin/env bash
# Multi-worker entry for concurrent traffic (Phase A).
# Dev single-worker with reload: uvicorn main:app --reload --host 0.0.0.0 --port 8000
set -euo pipefail
cd "$(dirname "$0")/.."
WORKERS="${WEB_CONCURRENCY:-4}"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "$WORKERS"
