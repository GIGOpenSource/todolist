#!/usr/bin/env bash
# Stop local Upgrade services started by scripts/dev-all.sh (or any listeners on these ports).
set -euo pipefail

PID_DIR="${UPGRADE_PID_DIR:-/tmp/upgrade-pids}"
PORTS=(8000 5180 5173 5181 4173)

if [[ -d "$PID_DIR" ]]; then
  for f in "$PID_DIR"/*.pid; do
    [[ -e "$f" ]] || continue
    pid=$(cat "$f" 2>/dev/null || true)
    name=$(basename "$f" .pid)
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "[stop] $name pid=$pid"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  done
fi

sleep 1

for port in "${PORTS[@]}"; do
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids:-}" ]]; then
    echo "[kill] port $port -> $pids"
    kill $pids 2>/dev/null || true
    sleep 0.3
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "${pids:-}" ]]; then
      kill -9 $pids 2>/dev/null || true
    fi
  else
    echo "[idle] port $port"
  fi
done

echo "Done."
