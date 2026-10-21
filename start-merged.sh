#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGRI_DIR="$ROOT_DIR/agri"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"
HEALTH_URL="$BACKEND_URL/api/v1/health"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# --- Prerequisites ---
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is not installed or not on PATH." >&2; exit 1; }

cd "$AGRI_DIR"
if ! python3 -c "import uvicorn" 2>/dev/null; then
  echo "ERROR: uvicorn is not installed. Run: pip install -r agri/requirements.txt" >&2
  exit 1
fi
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "ERROR: fastapi is not installed. Run: pip install -r agri/requirements.txt" >&2
  exit 1
fi
cd "$ROOT_DIR"

# --- Start backend ---
echo "Starting FastAPI backend on port 8000..."
cd "$AGRI_DIR"
uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$ROOT_DIR/.merged-backend.log" 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# --- Start frontend ---
echo "Starting frontend static server on port 5173..."
cd "$FRONTEND_DIR"
python3 -m http.server 5173 > "$ROOT_DIR/.merged-frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

# --- Wait for readiness ---
echo "Waiting for services to be ready..."

wait_for() {
  local url="$1" label="$2"
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "$label is ready."
      return 0
    fi
    sleep 1
  done
  echo "ERROR: $label did not become ready. Check logs:" >&2
  echo "  $ROOT_DIR/.merged-backend.log" >&2
  echo "  $ROOT_DIR/.merged-frontend.log" >&2
  exit 1
}

wait_for "$HEALTH_URL" "API"
wait_for "$FRONTEND_URL/" "Frontend"

echo ""
echo "=== Merged deployment running ==="
echo "Frontend : $FRONTEND_URL"
echo "API      : $BACKEND_URL"
echo "Docs     : $BACKEND_URL/docs"
echo ""
echo "Press Ctrl+C to stop."
wait
