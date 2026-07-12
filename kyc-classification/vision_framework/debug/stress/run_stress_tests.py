"""
Master Stress Test Runner
Runs all 6 agents in parallel threads, collects results, prints report.

Run from vision_framework/ directory:
    py -3 debug/stress/run_stress_tests.py
"""
import os, sys, time, json, threading, subprocess
from datetime import datetime

# ── Path setup ────────────────────────────────────────────────────────────────
_THIS    = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(os.path.dirname(_THIS))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

LOG_BASE = "D:/vision_logs/stress_test"
try:
    os.makedirs(LOG_BASE, exist_ok=True)
    os.makedirs(os.path.join(LOG_BASE, "images"), exist_ok=True)
    open(os.path.join(LOG_BASE, ".test"), "w").close()
    os.remove(os.path.join(LOG_BASE, ".test"))
except OSError:
    LOG_BASE = os.path.join(_VF_ROOT, "vision_logs", "stress_test")
    os.makedirs(os.path.join(LOG_BASE, "images"), exist_ok=True)

TS     = datetime.now().strftime("%Y%m%d_%H%M%S")
PYTHON = sys.executable

AGENTS = [
    ("Agent1-ImageQuality",  os.path.join(_THIS, "agent1_image_quality.py"),  120),
    ("Agent2-Geometry",      os.path.join(_THIS, "agent2_geometry.py"),        100),
    ("Agent3-Backgrounds",   os.path.join(_THIS, "agent3_backgrounds.py"),      80),
    ("Agent4-Documents",     os.path.join(_THIS, "agent4_documents.py"),        80),
    ("Agent5-Performance",   os.path.join(_THIS, "agent5_performance.py"),      60),
    ("Agent6-FrontendSim",   os.path.join(_THIS, "agent6_frontend_sim.py"),     60),
]

TOTAL_TESTS = sum(a[2] for a in AGENTS)

# ── Print header ──────────────────────────────────────────────────────────────
BORDER = "═" * 55
print(BORDER)
print("  VISION FRAMEWORK — STRESS TEST SYSTEM")
print(f"  Started:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  Agents:   {len(AGENTS)}")
print(f"  Tests:    {TOTAL_TESTS}")
print(f"  Logs:     {LOG_BASE}")
print(BORDER)

# ── Thread worker ─────────────────────────────────────────────────────────────
agent_results = {}
lock          = threading.Lock()

def run_agent(name, script, expected_tests):
    print(f"\n[START] {name} ({expected_tests} tests)...")
    if not os.path.isfile(script):
        with lock:
            agent_results[name] = {
                "status": "SKIP", "time": 0, "total": expected_tests,
                "passed": 0, "failed": expected_tests,
                "pass_rate": "0%", "stdout": "", "stderr": f"script not found: {script}",
                "failures": [], "avg_ms": 0
            }
        print(f"[SKIP]  {name} — script not found")
        return

    t_start = time.perf_counter()
    try:
        proc = subprocess.run(
            [PYTHON, script],
            capture_output=True, text=True,
            encoding="utf-8", errors="replace",
            cwd=_VF_ROOT, timeout=600
        )
        elapsed = time.perf_counter() - t_start
        status  = "PASS" if proc.returncode == 0 else "FAIL"

        # Try to load summary JSON
        summary_files = [f for f in os.listdir(LOG_BASE)
                         if f.startswith(f"agent{name[5]}_summary") and f.endswith(".json")]
        parsed = {}
        if summary_files:
            try:
                with open(os.path.join(LOG_BASE, sorted(summary_files)[-1])) as f:
                    parsed = json.load(f)
            except Exception:
                pass

        total   = parsed.get("total",   expected_tests)
        passed  = parsed.get("passed",  0)
        failed  = parsed.get("failed",  total)
        failures = parsed.get("failures", [])
        avg_ms   = parsed.get("avg_ms",  0)

        with lock:
            agent_results[name] = {
                "status":     status,
                "time":       round(elapsed, 1),
                "total":      total,
                "passed":     passed,
                "failed":     failed,
                "pass_rate":  parsed.get("pass_rate", f"{passed/max(1,total)*100:.1f}%"),
                "stdout":     proc.stdout[-3000:],
                "stderr":     proc.stderr[-1000:],
                "failures":   failures[:20],
                "avg_ms":     avg_ms,
            }

        print(f"[DONE]  {name}: {status} — {passed}/{total} passed ({passed/max(1,total)*100:.1f}%) in {elapsed:.1f}s")
        if proc.returncode != 0:
            for line in proc.stderr.strip().splitlines()[-5:]:
                print(f"        ERR: {line}")

    except subprocess.TimeoutExpired:
        elapsed = time.perf_counter() - t_start
        with lock:
            agent_results[name] = {
                "status":"TIMEOUT","time":round(elapsed,1),
                "total":expected_tests,"passed":0,"failed":expected_tests,
                "pass_rate":"0%","stdout":"","stderr":"timed out after 600s",
                "failures":[],"avg_ms":0
            }
        print(f"[TIMEOUT] {name} — exceeded 600s")
    except Exception as e:
        elapsed = time.perf_counter() - t_start
        with lock:
            agent_results[name] = {
                "status":"ERROR","time":round(elapsed,1),
                "total":expected_tests,"passed":0,"failed":expected_tests,
                "pass_rate":"0%","stdout":"","stderr":str(e),
                "failures":[],"avg_ms":0
            }
        print(f"[ERROR] {name}: {e}")

# ── Launch all agents in parallel ─────────────────────────────────────────────
print(f"\nLaunching {len(AGENTS)} agents in parallel...\n")
t_master_start = time.perf_counter()

threads = []
for name, script, n in AGENTS:
    t = threading.Thread(target=run_agent, args=(name, script, n), daemon=True)
    threads.append(t)
    t.start()
    time.sleep(0.5)  # stagger slightly so log lines don't interleave as badly

# Live progress
while any(t.is_alive() for t in threads):
    time.sleep(15)
    done  = sum(1 for t in threads if not t.is_alive())
    total_done = sum(r.get("passed",0)+r.get("failed",0) for r in agent_results.values())
    if done < len(threads):
        print(f"[LIVE] {done}/{len(threads)} agents complete  ~{total_done}/{TOTAL_TESTS} tests done")

for t in threads:
    t.join(timeout=5)

master_elapsed = time.perf_counter() - t_master_start

# ── Aggregate results ─────────────────────────────────────────────────────────
all_passed = sum(r.get("passed",0) for r in agent_results.values())
all_failed = sum(r.get("failed",0) for r in agent_results.values())
all_total  = sum(r.get("total",0)  for r in agent_results.values())
pass_rate  = all_passed / max(1, all_total) * 100

# Collect all failures
all_failures = []
for aname, ar in agent_results.items():
    for f in ar.get("failures", []):
        all_failures.append({"agent": aname, "test": f.get("test","?"), "reason": f.get("reason","")})

# Critical findings heuristics
findings = []
for aname, ar in agent_results.items():
    if ar.get("pass_rate","100%").replace("%","").replace(".","").isdigit():
        pr = float(ar["pass_rate"].replace("%",""))
    else:
        pr = ar["passed"]/max(1,ar["total"])*100
    if pr < 50:
        findings.append(f"{aname}: only {pr:.0f}% pass rate — major issues")
    elif pr < 80:
        findings.append(f"{aname}: {pr:.0f}% pass rate — needs tuning")

for f in all_failures[:5]:
    if "blur" in f["test"].lower():
        findings.append(f"Blur failures: {f['test']} — check BLUR_THRESHOLD")
    elif "noise" in f["test"].lower():
        findings.append(f"Noise sensitivity: {f['test']}")
    elif "small" in f["test"].lower() or "5pct" in f["test"].lower():
        findings.append(f"Small card detection issue: {f['test']}")

if not findings:
    findings.append("No critical issues — all agents passed above 80%")

# Recommended fixes
fixes = []
blur_fails = [f for f in all_failures if "blur" in f["test"].lower()]
if len(blur_fails) > 5:
    fixes.append({"component":"BlurProcessor","issue":f"{len(blur_fails)} blur failures","recommendation":"Lower BLUR_THRESHOLD"})

size_fails = [f for f in all_failures if "size_5" in f["test"] or "size_10" in f["test"]]
if size_fails:
    fixes.append({"component":"DocumentDetector","issue":"small card detection","recommendation":"Lower MIN_DOC_AREA_RATIO to 0.01"})

if not fixes:
    fixes.append({"component":"All","issue":"none","recommendation":"System performing well"})

# Performance summary
avg_pipeline_times = [ar["avg_ms"] for ar in agent_results.values() if ar.get("avg_ms",0) > 0]
avg_pipeline = sum(avg_pipeline_times)/len(avg_pipeline_times) if avg_pipeline_times else 0

# ── Build master report ───────────────────────────────────────────────────────
report = {
    "timestamp":    TS,
    "total_time_s": round(master_elapsed, 1),
    "log_dir":      LOG_BASE,
    "total_scenarios": all_total,
    "total_passed":    all_passed,
    "total_failed":    all_failed,
    "pass_rate":       f"{pass_rate:.1f}%",
    "agents": {
        name: {
            "total":      r.get("total",0),
            "passed":     r.get("passed",0),
            "failed":     r.get("failed",0),
            "pass_rate":  r.get("pass_rate","0%"),
            "status":     r.get("status","?"),
            "time_s":     r.get("time",0),
            "avg_ms":     r.get("avg_ms",0),
            "failures":   r.get("failures",[])[:10],
        }
        for name, r in agent_results.items()
    },
    "critical_findings":   findings,
    "recommended_fixes":   fixes,
    "performance_summary": {
        "avg_pipeline_time_ms":  round(avg_pipeline, 1),
        "note": "see Agent5 log for detailed timing breakdown",
    },
}

# Save reports
report_path  = os.path.join(LOG_BASE, f"MASTER_REPORT_{TS}.json")
latest_path  = os.path.join(LOG_BASE, "LATEST_REPORT.json")
with open(report_path,  "w", encoding="utf-8") as f: json.dump(report, f, indent=2)
with open(latest_path,  "w", encoding="utf-8") as f: json.dump(report, f, indent=2)

# ── Print final summary ───────────────────────────────────────────────────────
mins = int(master_elapsed // 60); secs = int(master_elapsed % 60)

print(f"\n{BORDER}")
print("  VISION FRAMEWORK STRESS TEST COMPLETE")
print(BORDER)
print(f"  Total scenarios:    {all_total}")
print(f"  Passed:             {all_passed} ({pass_rate:.1f}%)")
print(f"  Failed:             {all_failed}")
print(f"  Total time:         {mins}m {secs}s")
print(f"\n  Agent Results:")
for name, ar in agent_results.items():
    p  = ar.get("passed",0); t = ar.get("total",1)
    pr = p/max(1,t)*100
    st = ar.get("status","?")
    print(f"    {name:<30} {p:>3}/{t:<3} ({pr:5.1f}%)  [{st}]")

print(f"\n  Critical Findings:")
for f in findings[:5]:
    print(f"    → {f}")

print(f"\n  Recommended Fixes:")
for fx in fixes[:3]:
    print(f"    → [{fx['component']}] {fx['recommendation']}")

print(f"\n  Performance Baseline:")
if avg_pipeline > 0:
    print(f"    → Avg pipeline: {avg_pipeline:.0f}ms")
    rec_fps = max(1, min(30, int(1000/avg_pipeline)))
    print(f"    → Recommended client FPS: {rec_fps}")

print(f"\n  Full report: {latest_path}")
print(BORDER)
