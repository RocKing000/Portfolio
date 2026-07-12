"""
Master Runner — Vision Framework Multi-Agent Debug System

Runs all three debug agents in sequence (or individually) and
produces a consolidated master report.

Run from vision_framework/ directory:
    py -3 debug/run_all_agents.py

Individual agents can also be run directly:
    py -3 debug/agent1_image_pipeline.py
    py -3 debug/agent2_api_comms.py
    py -3 debug/agent3_thresholds.py
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime

# ── Path setup ────────────────────────────────────────────────────────────────
_THIS    = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Output dirs ───────────────────────────────────────────────────────────────
LOG_DIR = "D:/vision_logs"
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    _test = os.path.join(LOG_DIR, ".write_test")
    open(_test, "w").close(); os.remove(_test)
except OSError:
    LOG_DIR = os.path.join(_VF_ROOT, "vision_logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"[WARN] Falling back to local log dir: {LOG_DIR}")

_TS = datetime.now().strftime("%Y%m%d_%H%M%S")

# ══════════════════════════════════════════════════════════════════════════════
# Banner
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("VISION FRAMEWORK — MULTI AGENT DEBUG SYSTEM")
print(f"Started:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Log dir:  {LOG_DIR}")
print("=" * 60)

agents = [
    ("Agent 1 — Image Pipeline",     os.path.join(_THIS, "agent1_image_pipeline.py")),
    ("Agent 2 — API Communication",  os.path.join(_THIS, "agent2_api_comms.py")),
    ("Agent 3 — Threshold Calibration", os.path.join(_THIS, "agent3_thresholds.py")),
]

# Use the same Python interpreter that launched this script
PYTHON = sys.executable

# ══════════════════════════════════════════════════════════════════════════════
# Run agents sequentially
# ══════════════════════════════════════════════════════════════════════════════
results = {}

for name, script in agents:
    print(f"\n{'─' * 60}")
    print(f"Running {name}...")
    print(f"Script:  {script}")
    if not os.path.isfile(script):
        print(f"  SKIP — script not found: {script}")
        results[name] = {"status": "SKIP", "time": 0, "stdout": "", "stderr": "script not found"}
        continue

    t_start = time.perf_counter()
    try:
        proc = subprocess.run(
            [PYTHON, script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=_VF_ROOT,          # run from vision_framework/ so imports work
            timeout=300,           # 5 min max per agent
        )
        elapsed = time.perf_counter() - t_start
        status  = "PASS" if proc.returncode == 0 else "FAIL"

        results[name] = {
            "status":   status,
            "time":     round(elapsed, 1),
            "returncode": proc.returncode,
            "stdout":   proc.stdout,
            "stderr":   proc.stderr,
        }

        print(f"Status:  {status}  ({elapsed:.1f}s)")

        # Print last 30 lines of stdout for immediate feedback
        stdout_lines = proc.stdout.strip().splitlines()
        if stdout_lines:
            preview = stdout_lines[-30:]
            print("  Last output lines:")
            for line in preview:
                print(f"    {line}")

        if proc.returncode != 0 and proc.stderr:
            print(f"  STDERR (last 20 lines):")
            for line in proc.stderr.strip().splitlines()[-20:]:
                print(f"    {line}")

    except subprocess.TimeoutExpired:
        elapsed = time.perf_counter() - t_start
        results[name] = {
            "status": "TIMEOUT",
            "time":   round(elapsed, 1),
            "stdout": "",
            "stderr": "Agent timed out after 300s",
        }
        print(f"Status:  TIMEOUT  ({elapsed:.1f}s)")
    except Exception as e:
        elapsed = time.perf_counter() - t_start
        results[name] = {
            "status": "ERROR",
            "time":   round(elapsed, 1),
            "stdout": "",
            "stderr": str(e),
        }
        print(f"Status:  ERROR — {e}")


# ══════════════════════════════════════════════════════════════════════════════
# Final report
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("MULTI AGENT DEBUG REPORT")
print("=" * 60)
for name, result in results.items():
    status = result["status"]
    t      = result["time"]
    print(f"  {name}: {status} ({t:.1f}s)")

print(f"\nAll logs saved to: {LOG_DIR}")
print(f"\nNext steps based on agent findings:")
print("  1. Review D:/vision_logs/agent1_*.log for pipeline breaks")
print("  2. Review D:/vision_logs/agent2_*.log for API issues")
print("  3. Review D:/vision_logs/recommended_config.py for thresholds")
print("  4. Apply recommended_config.py to plugins/kyc/config/kyc_config.py")
print("     (Agent 3 does this automatically if it ran successfully)")
print("  5. Restart server: py -m uvicorn vision_framework.api.fastapi_app:app --port 8000")

# Save JSON report
master_report = {
    "timestamp":  _TS,
    "log_dir":    LOG_DIR,
    "agents":     results,
    "summary": {
        "total":   len(results),
        "passed":  sum(1 for r in results.values() if r["status"] == "PASS"),
        "failed":  sum(1 for r in results.values() if r["status"] == "FAIL"),
        "skipped": sum(1 for r in results.values() if r["status"] in ("SKIP", "TIMEOUT", "ERROR")),
    },
}

report_path = os.path.join(LOG_DIR, f"master_report_{_TS}.json")
try:
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(master_report, f, indent=2, ensure_ascii=False)
    print(f"\nMaster report: {report_path}")
except Exception as e:
    print(f"\n[WARN] Could not save master report: {e}")

print("=" * 60)
