"""
run_all_tests.py — orchestrate all Vision Framework tests and emit a report.

Run from vision_framework/ directory:
    py -3 tests/run_all_tests.py

Produces:
  - Console summary table
  - tests/test_report.json
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime

# We run inside the same process by importing and capturing output
# so that we get results without spawning child processes.

_THIS = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)
_PARENT  = os.path.dirname(_VF_ROOT)
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── Colour codes ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def run_script(script_path: str) -> tuple:
    """
    Run *script_path* as a subprocess and return (success, stdout, elapsed).
    We capture stdout/stderr and re-print it indented.
    """
    import os as _os
    env = dict(_os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    t0 = time.perf_counter()
    proc = subprocess.run(
        [sys.executable, script_path],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        cwd=os.path.dirname(TESTS_DIR),   # run from vision_framework/
    )
    elapsed = time.perf_counter() - t0
    return proc.returncode == 0, proc.stdout + proc.stderr, elapsed


def parse_results_from_output(output: str) -> dict:
    """
    Parse per-module PASS/FAIL/SKIP lines from the script output.
    Looks for patterns like:  ✓ PASS: ModuleName  or  ✗ FAIL: ModuleName
    """
    modules: dict = {}
    for line in output.splitlines():
        line = line.strip()
        for status in ("PASS", "FAIL", "SKIP"):
            if status + ":" in line:
                # Extract name (token after "PASS:" / "FAIL:" / "SKIP:")
                after = line.split(status + ":")[1].strip()
                name = after.split("(")[0].strip()
                if name:
                    modules[name] = status
    return modules


# ─────────────────────────────────────────────────────────────────────────────
# Run all test scripts
# ─────────────────────────────────────────────────────────────────────────────

report = {
    "timestamp": datetime.now().isoformat(),
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "modules": {},
    "failed_tests": [],
    "total_time_seconds": 0.0,
    "scripts": {},
}

scripts = [
    ("Image Generator",   os.path.join(TESTS_DIR, "generate_test_images.py")),
    ("Module Tests",      os.path.join(TESTS_DIR, "test_modules.py")),
    ("API Startup Tests", os.path.join(TESTS_DIR, "test_api_startup.py")),
]

banner = f"\n{BOLD}{CYAN}{'═'*58}{RESET}"
print(banner)
print(f"{BOLD}{CYAN}  VISION FRAMEWORK — FULL TEST SUITE{RESET}")
print(f"{CYAN}{'═'*58}{RESET}")

total_start = time.perf_counter()

for script_label, script_path in scripts:
    print(f"\n{BOLD}▶ {script_label}{RESET}  [{os.path.basename(script_path)}]")
    print(f"  {'─'*54}")

    if not os.path.exists(script_path):
        print(f"  {YELLOW}⊘ SKIP: script not found{RESET}")
        report["scripts"][script_label] = {"status": "SKIP", "elapsed": 0}
        continue

    success, output, elapsed = run_script(script_path)

    # Re-print output indented
    for line in output.splitlines():
        print(f"  {line}")

    # Parse module-level results
    modules = parse_results_from_output(output)
    report["modules"].update(modules)
    report["scripts"][script_label] = {
        "status": "PASS" if success else "FAIL",
        "elapsed": round(elapsed, 2),
    }

    status_color = GREEN if success else RED
    status_text  = "PASSED" if success else "FAILED"
    print(f"\n  {status_color}{BOLD}{script_label}: {status_text}  ({elapsed:.1f}s){RESET}")

report["total_time_seconds"] = round(time.perf_counter() - total_start, 2)

# ─── Tally ────────────────────────────────────────────────────────────────────
for name, status in report["modules"].items():
    report["total_tests"] += 1
    if status == "PASS":
        report["passed"] += 1
    elif status == "FAIL":
        report["failed"] += 1
        report["failed_tests"].append(name)
    elif status == "SKIP":
        report["skipped"] += 1

# ─── Summary table ────────────────────────────────────────────────────────────
print(f"\n{BOLD}{CYAN}{'═'*58}{RESET}")
print(f"{BOLD}{CYAN}  FINAL REPORT{RESET}")
print(f"{CYAN}{'═'*58}{RESET}")
print(f"  {'Module':<35} {'Status':>6}")
print(f"  {'─'*51}")

for name, status in report["modules"].items():
    color = GREEN if status == "PASS" else (RED if status == "FAIL" else YELLOW)
    print(f"  {name:<35} {color}{status}{RESET}")

print(f"\n  {'─'*51}")
total   = report["total_tests"]
passed  = report["passed"]
failed  = report["failed"]
skipped = report["skipped"]

color = GREEN if failed == 0 else RED
print(f"  {color}{BOLD}TOTAL: {passed}/{total} passed, {failed} failed, {skipped} skipped{RESET}")
print(f"  Wall time: {report['total_time_seconds']:.1f} s")

if report["failed_tests"]:
    print(f"\n  {RED}Failed tests:{RESET}")
    for t in report["failed_tests"]:
        print(f"    • {t}")

print(f"{CYAN}{'═'*58}{RESET}\n")

# ─── Save JSON report ─────────────────────────────────────────────────────────
report_path = os.path.join(TESTS_DIR, "test_report.json")
with open(report_path, "w") as f:
    json.dump(report, f, indent=2)
print(f"Report saved → {report_path}")
