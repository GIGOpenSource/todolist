#!/usr/bin/env bash
# Start all local Upgrade services (run in your own Terminal / IDE terminal — not via Agent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${UPGRADE_LOG_DIR:-/tmp/upgrade-logs}"
PID_DIR="${UPGRADE_PID_DIR:-/tmp/upgrade-pids}"
mkdir -p "$LOG_DIR" "$PID_DIR"

start_one() {
  local name="$1"
  local port="$2"
  shift 2
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[skip] $name already listening on :$port"
    return 0
  fi

  nohup bash -c 'cd "$1" && shift && exec "$@"' _ "$ROOT" "$@" >"$log_file" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "$pid" >"$pid_file"
  echo "[start] $name pid=$pid port=$port log=$log_file"
}

start_one backend 8000 bash -lc "
  cd '$ROOT/backend' &&
  source .venv/bin/activate &&
  # Use backend/.env only — never force local sqlite / empty redis overrides.
  unset DATABASE_URL REDIS_URL OSS_ENDPOINT APP_ENV || true
  exec uvicorn main:app --host 0.0.0.0 --port 8000
"

start_one frontend 5180 bash -lc "
  cd '$ROOT/frontend' &&
  exec npm run dev -- --host 127.0.0.1 --port 5180
"

start_one app 5173 bash -lc "
  cd '$ROOT/app' &&
  exec npm run dev:h5 -- --host 127.0.0.1 --port 5173
"

start_one admin 5181 bash -lc "
  cd '$ROOT/web-admin' &&
  exec npm run dev -- --host 127.0.0.1 --port 5181
"

start_one website 4173 bash -lc "
  cd '$ROOT' &&
  exec npx --yes serve website -p 4173
"

echo
echo "Waiting for readiness..."
sleep 6
for u in \
  "http://127.0.0.1:8000/api/health" \
  "http://127.0.0.1:5180/h5/" \
  "http://127.0.0.1:5173/app/" \
  "http://127.0.0.1:5181/admin/" \
  "http://127.0.0.1:4173/"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$u" || echo 000)
  printf "  %-42s %s\n" "$u" "$code"
done

echo
echo "URLs:"
echo "  API      http://127.0.0.1:8000/docs"
echo "  Web      http://127.0.0.1:5180/h5/"
echo "  Mobile   http://127.0.0.1:5173/app/"
echo "  Admin    http://127.0.0.1:5181/admin/"
echo "  Website  http://127.0.0.1:4173/"
echo
echo "Stop with:  $ROOT/scripts/dev-stop.sh"
echo "Logs:       $LOG_DIR/"
