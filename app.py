"""
app.py — Python project manager/orchestrator for Northstar University.
(NOT Flask — Python here only manages/runs the project, it is not the
web framework. Uses the standard library only.)

What it does:
  1. Loads environment variables from .env (admin credentials, ports,
     and — once created — the Supabase connection details).
  2. Starts the Node.js backend (backend/server.js) as a subprocess.
  3. Serves the frontend/ folder as static files (student + admin pages).
  4. Shuts both down cleanly on Ctrl+C.
"""

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
BACKEND_DIR = BASE_DIR / "backend"
ENV_FILE = BASE_DIR / ".env"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

FRONTEND_PORT = int(os.environ.get("FRONTEND_PORT", "5500"))


def load_env(path: Path) -> None:
    """Minimal .env loader — no external dependency, no Flask."""
    if not path.exists():
        print(f"[app.py] Warning: {path.name} not found, skipping.")
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def find_free_port(port: int) -> int:
    """Return the requested port if free, otherwise find an available one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("", port))
            return port
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("", 0))
        return int(sock.getsockname()[1])


def serve_frontend() -> None:
    """Serve frontend/ (and frontend/admin/) as static files."""
    port = find_free_port(FRONTEND_PORT)
    handler = partial(SimpleHTTPRequestHandler, directory=str(FRONTEND_DIR))
    with ThreadingHTTPServer(("0.0.0.0", port), handler) as httpd:
        print(f"[app.py] Frontend running at http://localhost:{port}")
        httpd.serve_forever()


def backend_is_running(port: int) -> bool:
    """Check whether the backend already answers on the health endpoint."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
            return response.status == 200
    except Exception:
        return False


def start_backend():
    """Start the Node.js backend as a subprocess."""
    server_file = BACKEND_DIR / "src" / "server.js"
    if not server_file.exists():
        print("[app.py] backend/src/server.js not found — skipping backend start.")
        return None

    node_modules = BACKEND_DIR / "node_modules"
    if not node_modules.exists():
        print("[app.py] backend/node_modules not found. Run `npm install` inside backend/ first — skipping backend start.")
        return None

    port = int(os.environ.get("PORT", "3000"))
    if backend_is_running(port):
        print("[app.py] Backend is already running — skipping startup.")
        return None

    # shutil.which resolves platform-specific executables correctly —
    # on Windows the real file is npm.cmd, not npm, so a bare "npm" in
    # subprocess.Popen(..., shell=False) fails with FileNotFoundError
    # even when npm works fine from an interactive shell.
    npm_path = shutil.which("npm")
    if not npm_path:
        print("[app.py] Node.js/npm is not installed or not on PATH — skipping backend start.")
        return None

    print("[app.py] Starting Node.js backend...")
    process = subprocess.Popen([npm_path, "start"], cwd=str(BACKEND_DIR), env=os.environ.copy())

    # Give it a moment, then check it didn't crash immediately (e.g. bad
    # DATABASE_URL, missing JWT_SECRET) so the failure isn't silent.
    time.sleep(2)
    if process.poll() is not None:
        print(f"[app.py] Backend exited immediately (code {process.returncode}). "
              f"Run `npm start` inside backend/ directly to see the full error.")
        return None

    return process


def main() -> None:
    load_env(ENV_FILE)
    load_env(BACKEND_ENV_FILE)

    backend_process = start_backend()

    frontend_thread = threading.Thread(target=serve_frontend, daemon=True)
    frontend_thread.start()

    print("[app.py] Northstar University is running. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[app.py] Shutting down...")
        if backend_process:
            backend_process.terminate()
        sys.exit(0)


if __name__ == "__main__":
    main()