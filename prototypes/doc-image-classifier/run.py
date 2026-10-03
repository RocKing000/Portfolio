"""
run.py — Single launcher for the entire KYC Vision Framework stack.

Start everything without VS Code.  Run from the project root:
    py run.py

Or double-click START_KYC_SYSTEM.bat.
"""

import os
import subprocess
import sys
import time
import webbrowser

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
VISION_FW    = os.path.join(PROJECT_ROOT, "vision_framework")
KYC_FRONTEND = os.path.join(PROJECT_ROOT, "kyc-frontend")


# ── Helpers ───────────────────────────────────────────────────────────────────

def check_ollama() -> bool:
    try:
        import requests
        requests.get("http://localhost:11434/api/tags", timeout=3)
        return True
    except Exception:
        return False


def start_backend() -> subprocess.Popen:
    print("[+] Starting vision framework backend (FastAPI)...")
    return subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "vision_framework.api.fastapi_app:app",
            "--reload", "--port", "8000",
        ],
        cwd=PROJECT_ROOT,
    )


def start_frontend() -> subprocess.Popen:
    print("[+] Starting Angular frontend...")
    return subprocess.Popen(
        ["ng", "serve"],
        cwd=KYC_FRONTEND,
        shell=True,
    )


def start_jupyter() -> subprocess.Popen:
    print("[+] Starting Jupyter notebook server...")
    nb_dir = os.path.join(VISION_FW, "training", "notebooks")
    return subprocess.Popen(
        [
            sys.executable, "-m", "jupyter", "notebook",
            "--notebook-dir", nb_dir,
            "--no-browser",
        ],
        cwd=PROJECT_ROOT,
    )


def generate_dataset() -> None:
    print("[+] Starting dataset generation...")
    script = os.path.join(VISION_FW, "training", "scripts", "generate_dataset.py")
    subprocess.run(
        [
            sys.executable, script,
            "--output", "D:/kyc_dataset",
            "--samples", "1000",
            "--augments", "5",
        ]
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 52)
    print("   KYC VISION FRAMEWORK — LOCAL LAUNCHER")
    print("=" * 52)

    # Ollama check
    if check_ollama():
        print("[OK] Ollama: RUNNING")
    else:
        print("[!!] Ollama: NOT RUNNING")
        print("     Start the Ollama desktop app, then press Enter.")
        input("     Press Enter when Ollama is running...")
        if not check_ollama():
            print("[!!] Still can't reach Ollama.  Continuing anyway.")

    print()
    print("What do you want to start?")
    print("  1. Backend only       (FastAPI on :8000)")
    print("  2. Frontend only      (Angular on :4200)")
    print("  3. Backend + Frontend")
    print("  4. Jupyter notebooks  (:8888)")
    print("  5. Everything")
    print("  6. Generate dataset")
    print()

    choice = input("Enter choice [1-6]: ").strip()

    processes = []

    if choice in ("1", "3", "5"):
        processes.append(start_backend())
        time.sleep(3)
        print("    Backend : http://localhost:8000")
        print("    API docs: http://localhost:8000/docs")

    if choice in ("2", "3", "5"):
        processes.append(start_frontend())
        time.sleep(5)
        print("    Frontend: http://localhost:4200")
        webbrowser.open("http://localhost:4200")

    if choice in ("4", "5"):
        processes.append(start_jupyter())
        time.sleep(3)
        print("    Jupyter : http://localhost:8888")
        webbrowser.open("http://localhost:8888")

    if choice == "6":
        generate_dataset()
        return

    if processes:
        print()
        print("All services running.  Press Ctrl+C to stop everything.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping all services...")
            for p in processes:
                p.terminate()
            print("Done.")
    elif choice not in ("6",):
        print("No service started.  Invalid choice.")


if __name__ == "__main__":
    main()
