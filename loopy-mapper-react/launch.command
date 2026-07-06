#!/usr/bin/env bash
# ================================================================
#  Loopy Mapper — macOS Launch (double-clickable .command file)
#  Double-click this file in Finder, or run from Terminal:
#      ./launch.command
#      ./launch.command frontend
#      ./launch.command backend
# ================================================================

set -eo pipefail

# `clear` below needs TERM; Finder double-clicks always set it via Terminal.app,
# but default it defensively so `set -e` can't hard-fail the whole launch on it.
: "${TERM:=xterm-256color}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_PORT=5173
BACKEND_PORT=8766
VENV_DIR="backend/.venv"

# ── Colors ──────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET='\033[0m'
  C_RED='\033[91m'
  C_GREEN='\033[92m'
  C_YELLOW='\033[93m'
  C_CYAN='\033[96m'
  C_BOLD='\033[1m'
else
  C_RESET='' C_RED='' C_GREEN='' C_YELLOW='' C_CYAN='' C_BOLD=''
fi

# ── PID tracking for cleanup ────────────────────────────────────
declare -a PIDS=()

cleanup() {
  echo ""
  echo -e "${C_YELLOW}Shutting down...${C_RESET}"
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo -e "${C_GREEN}All processes stopped.${C_RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ── Helpers ─────────────────────────────────────────────────────

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${C_RED}[ERROR] '$1' not found. Please install ${2:-$1} first.${C_RESET}"
    return 1
  fi
}

check_port_available() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null; then
    return 1
  fi
}

wait_for_url() {
  local url="$1"
  local max_seconds="${2:-30}"
  local count=0
  while [[ $count -lt $max_seconds ]]; do
    if curl -s --max-time 1 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -qE '^[23][0-9][0-9]$'; then
      return 0
    fi
    sleep 1
    ((count++))
  done
  return 1
}

# ── Header ──────────────────────────────────────────────────────
clear || true
echo -e "${C_CYAN}${C_BOLD}================================================${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}  Loopy Mapper — Launch Script${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}================================================${C_RESET}"
echo ""

# ── Help ────────────────────────────────────────────────────────
if [[ "${1:-}" == "help" ]]; then
  echo -e "${C_CYAN}Usage:${C_RESET}"
  echo "  ./launch.command            Launch both frontend + backend"
  echo "  ./launch.command frontend   Launch frontend only (port $FRONTEND_PORT)"
  echo "  ./launch.command backend    Launch backend only (port $BACKEND_PORT)"
  echo "  ./launch.command help       Show this help"
  echo ""
  exit 0
fi

# ── Determine what to launch ────────────────────────────────────
LAUNCH_FRONTEND=1
LAUNCH_BACKEND=1
case "${1:-}" in
  frontend) LAUNCH_BACKEND=0 ;;
  backend)  LAUNCH_FRONTEND=0 ;;
esac

# ── Pre-flight checks ───────────────────────────────────────────
check_cmd node "Node.js" || exit 1
check_cmd npm "npm" || exit 1

# ════════════════════════════════════════════════════════════════
#  BACKEND
# ════════════════════════════════════════════════════════════════
if [[ $LAUNCH_BACKEND -eq 1 ]]; then
  check_cmd python3 "Python 3" || LAUNCH_BACKEND=0
fi

if [[ $LAUNCH_BACKEND -eq 1 ]]; then
  PY_VER=$(python3 --version 2>&1)
  echo -e "${C_GREEN}[python] Found $PY_VER${C_RESET}"

  # ── Virtual environment ──────────────────────────────────────
  if [[ ! -f "$VENV_DIR/bin/python" ]]; then
    echo -e "${C_YELLOW}[venv] Creating virtual environment...${C_RESET}"
    python3 -m venv "$VENV_DIR"
    if [[ $? -ne 0 ]]; then
      echo -e "${C_RED}[venv] Failed to create virtual environment.${C_RESET}"
      LAUNCH_BACKEND=0
    fi
  fi

  if [[ $LAUNCH_BACKEND -eq 1 ]]; then
    echo -e "${C_GREEN}[venv] Using: $VENV_DIR${C_RESET}"
    # shellcheck source=/dev/null
    source "$VENV_DIR/bin/activate"

    # ── Install dependencies ───────────────────────────────────
    echo -e "${C_YELLOW}[pip] Installing backend dependencies...${C_RESET}"
    pip install -q -r backend/requirements.txt
    if [[ $? -ne 0 ]]; then
      echo -e "${C_RED}[pip] Failed to install dependencies. Try manual install:${C_RESET}"
      echo "       source $VENV_DIR/bin/activate && pip install -r backend/requirements.txt"
      LAUNCH_BACKEND=0
    else
      echo -e "${C_GREEN}[pip] Dependencies ready.${C_RESET}"
    fi
  fi

  # ── Port check ───────────────────────────────────────────────
  if [[ $LAUNCH_BACKEND -eq 1 ]]; then
    if ! check_port_available "$BACKEND_PORT"; then
      echo -e "${C_RED}[ERROR] Port $BACKEND_PORT is already in use.${C_RESET}"
      echo "        Close the process using that port or change BACKEND_PORT."
      echo "        To find: lsof -iTCP:$BACKEND_PORT -sTCP:LISTEN"
      LAUNCH_BACKEND=0
    fi
  fi

  # ── Start backend ────────────────────────────────────────────
  if [[ $LAUNCH_BACKEND -eq 1 ]]; then
    echo -e "${C_CYAN}[backend] Starting FastAPI server on port $BACKEND_PORT...${C_RESET}"
    (
      source "$VENV_DIR/bin/activate"
      uvicorn backend.main:app --reload --port "$BACKEND_PORT" 2>&1 | sed 's/^/['"$(printf '\033[96m')"'backend'"$(printf '\033[0m')"'] /'
    ) &
    BACKEND_PID=$!
    PIDS+=("$BACKEND_PID")

    # Wait for backend to be ready
    echo -e "${C_YELLOW}[backend] Waiting for server to be ready...${C_RESET}"
    if wait_for_url "http://127.0.0.1:$BACKEND_PORT/api/health" 30; then
      echo -e "${C_GREEN}[backend] Server is ready!${C_RESET}"
    else
      echo -e "${C_RED}[backend] Server did not start within 30s timeout.${C_RESET}"
    fi
  fi
fi

# ════════════════════════════════════════════════════════════════
#  FRONTEND
# ════════════════════════════════════════════════════════════════
if [[ $LAUNCH_FRONTEND -eq 1 ]]; then
  # ── Install npm dependencies ─────────────────────────────────
  if [[ ! -d "node_modules" ]]; then
    echo -e "${C_YELLOW}[npm] Installing frontend dependencies...${C_RESET}"
    npm install
    if [[ $? -ne 0 ]]; then
      echo -e "${C_RED}[npm] Failed to install dependencies.${C_RESET}"
      LAUNCH_FRONTEND=0
    fi
  else
    echo -e "${C_GREEN}[npm] node_modules exists — skipped install.${C_RESET}"
    echo -e "${C_YELLOW}[npm] Run 'npm install' manually if packages are outdated.${C_RESET}"
  fi

  # ── Port check ───────────────────────────────────────────────
  if [[ $LAUNCH_FRONTEND -eq 1 ]]; then
    if ! check_port_available "$FRONTEND_PORT"; then
      echo -e "${C_RED}[ERROR] Port $FRONTEND_PORT is already in use.${C_RESET}"
      echo "        Close the process using that port or change FRONTEND_PORT."
      echo "        To find: lsof -iTCP:$FRONTEND_PORT -sTCP:LISTEN"
      LAUNCH_FRONTEND=0
    fi
  fi

  # ── Start frontend ───────────────────────────────────────────
  if [[ $LAUNCH_FRONTEND -eq 1 ]]; then
    echo -e "${C_CYAN}[frontend] Starting Vite dev server on port $FRONTEND_PORT...${C_RESET}"
    npm run dev 2>&1 | sed 's/^/['"$(printf '\033[96m')"'frontend'"$(printf '\033[0m')"'] /' &
    FRONTEND_PID=$!
    PIDS+=("$FRONTEND_PID")

    # Wait for frontend to be ready
    echo -e "${C_YELLOW}[frontend] Waiting for dev server to be ready...${C_RESET}"
    if wait_for_url "http://127.0.0.1:$FRONTEND_PORT" 30; then
      echo -e "${C_GREEN}[frontend] Dev server is ready!${C_RESET}"
    else
      echo -e "${C_RED}[frontend] Dev server did not start within 30s timeout.${C_RESET}"
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${C_CYAN}${C_BOLD}================================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}  Loopy Mapper is running!${C_RESET}"
[[ $LAUNCH_FRONTEND -eq 1 ]] && echo -e "${C_GREEN}  Frontend:  http://localhost:$FRONTEND_PORT/${C_RESET}"
[[ $LAUNCH_BACKEND -eq 1 ]] && echo -e "${C_GREEN}  Backend:   http://localhost:$BACKEND_PORT/${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}================================================${C_RESET}"
echo ""
echo -e "${C_YELLOW}Press Ctrl+C to stop all processes.${C_RESET}"

# ── Wait for Ctrl+C ─────────────────────────────────────────────
wait