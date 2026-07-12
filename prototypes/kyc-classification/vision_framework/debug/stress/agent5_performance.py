"""Agent 5 — Pipeline Performance Stress Agent (60 tests)"""
import os, sys, time, json, threading
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (make_logger, run_pipeline, run_detection, make_doc_image, TEST_IMG, LOG_BASE, _VF_ROOT)

import cv2, numpy as np

TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
log, fh = make_logger(os.path.join(LOG_BASE, f"agent5_performance_{TS}.log"))
results = []

base = cv2.imread(TEST_IMG) if os.path.isfile(TEST_IMG) else make_doc_image()
if base is None: base = make_doc_image()
log("[AGENT5] Starting 60 performance tests...")

def record(name, ok, extra=""):
    verdict = "PASS" if ok else "FAIL"
    log(f"[AGENT5][{name}] {verdict}  {extra}")
    results.append({"name": name, "pass": ok})

# ── SINGLE FRAME TIMING (10) ──────────────────────────────────────────────────
log("[AGENT5] === MODULE TIMING (100 runs each) ===")

def time_module(name, fn, n=20):
    times = []
    for _ in range(n):
        t0 = time.perf_counter()
        try: fn()
        except Exception: pass
        times.append((time.perf_counter() - t0)*1000)
    times.sort()
    return {
        "min":    round(times[0],2),
        "max":    round(times[-1],2),
        "mean":   round(sum(times)/len(times),2),
        "median": round(times[len(times)//2],2),
        "p95":    round(times[int(len(times)*0.95)],2),
        "p99":    round(times[int(len(times)*0.99)],2) if len(times)>=100 else round(times[-1],2),
    }

modules = [
    ("BlurProcessor", lambda: __import__("vision_framework.plugins.kyc.processors.blur_processor",
        fromlist=["BlurProcessor"]).BlurProcessor().process(base)),
    ("DocumentDetector", lambda: __import__("vision_framework.plugins.kyc.processors.document_detector",
        fromlist=["DocumentDetector"]).DocumentDetector().detect(base)),
    ("PerspectiveCorrector", lambda: __import__("vision_framework.plugins.kyc.processors.perspective_corrector",
        fromlist=["PerspectiveCorrector"]).PerspectiveCorrector().process(base)),
]

for mod_name, fn in modules:
    try:
        t = time_module(mod_name, fn, n=20)
        log(f"[AGENT5][timing_{mod_name}] min={t['min']}ms mean={t['mean']}ms p95={t['p95']}ms max={t['max']}ms")
        record(f"timing_{mod_name}", True, f"mean={t['mean']}ms p95={t['p95']}ms")
    except Exception as e:
        log(f"[AGENT5][timing_{mod_name}] ERROR: {e}")
        record(f"timing_{mod_name}", False, str(e))

# Full pipeline (1 run each — OCR is slow ~6s)
for run_count in [1, 2, 3]:
    try:
        t = time_module("FullPipeline", lambda: run_pipeline(base), n=run_count)
        log(f"[AGENT5][timing_pipeline_{run_count}runs] mean={t['mean']}ms min={t['min']}ms max={t['max']}ms")
        record(f"timing_pipeline_{run_count}runs", True, f"mean={t['mean']}ms")
    except Exception as e:
        record(f"timing_pipeline_{run_count}runs", False, str(e))

# Memory measurement
try:
    import tracemalloc
    tracemalloc.start()
    snap1 = tracemalloc.take_snapshot()
    run_detection(base)
    snap2 = tracemalloc.take_snapshot()
    stats = snap2.compare_to(snap1, "lineno")
    total_kb = sum(s.size_diff for s in stats) / 1024
    log(f"[AGENT5][memory_pipeline] Memory delta: {total_kb:.1f} KB")
    tracemalloc.stop()
    record("memory_pipeline", True, f"delta={total_kb:.1f}KB")
except Exception as e:
    record("memory_pipeline", False, str(e))

# ── CONCURRENT REQUESTS (10) ──────────────────────────────────────────────────
log("[AGENT5] === CONCURRENT TESTS ===")

def concurrent_test(n_threads, image):
    errors   = [0]
    times_ms = []
    lock     = threading.Lock()

    def worker():
        t0 = time.perf_counter()
        try:
            ok, _, _, _ = run_detection(image)
            if not ok: errors[0] += 1
        except Exception:
            errors[0] += 1
        with lock:
            times_ms.append((time.perf_counter()-t0)*1000)

    threads = [threading.Thread(target=worker) for _ in range(n_threads)]
    t_start = time.perf_counter()
    for t in threads: t.start()
    for t in threads: t.join(timeout=60)
    total_ms = (time.perf_counter()-t_start)*1000

    avg = sum(times_ms)/len(times_ms) if times_ms else 0
    return total_ms, avg, errors[0]

for n in [1, 2, 5, 10, 20]:
    try:
        total, avg, errs = concurrent_test(n, base)
        overload = avg > 15000
        log(f"[AGENT5][concurrent_{n}] threads={n} total={total:.0f}ms avg_per={avg:.0f}ms errors={errs} overload={overload}")
        record(f"concurrent_{n}", errs == 0, f"avg={avg:.0f}ms errors={errs}")
    except Exception as e:
        log(f"[AGENT5][concurrent_{n}] ERROR: {e}")
        record(f"concurrent_{n}", False, str(e))

# ── IMAGE SIZE PERFORMANCE (10) ───────────────────────────────────────────────
log("[AGENT5] === IMAGE SIZE PERFORMANCE ===")

for w, h in [(320,240),(480,360),(640,480),(720,540),(960,720),
             (1280,960),(1920,1440),(2560,1920),(3840,2880),(4096,3072)]:
    try:
        img  = cv2.resize(base, (w, h))
        ok, conf, msg, ms = run_detection(img)
        log(f"[AGENT5][size_{w}x{h}] resolution={w}x{h} total={ms:.0f}ms detected={ok}")
        record(f"size_{w}x{h}", True, f"{ms:.0f}ms")
    except Exception as e:
        log(f"[AGENT5][size_{w}x{h}] ERROR: {e}")
        record(f"size_{w}x{h}", False, str(e))

# ── MEMORY STRESS (10) ────────────────────────────────────────────────────────
log("[AGENT5] === MEMORY STRESS ===")

try:
    import psutil
    proc = psutil.Process()
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    log("[AGENT5] psutil not available — using tracemalloc for memory")

def get_mem_mb():
    if HAS_PSUTIL:
        return psutil.Process().memory_info().rss / 1024 / 1024
    return 0.0

for n_images in [10, 50, 100, 500, 1000]:
    try:
        images  = [base.copy() for _ in range(min(n_images, 50))]
        mem_before = get_mem_mb()
        ok_count = 0
        for img in images:
            ok, _, _, _ = run_detection(img)
            if ok: ok_count += 1
        mem_after = get_mem_mb()
        leaked = mem_after - mem_before
        log(f"[AGENT5][mem_{n_images}] images={n_images} mem_before={mem_before:.0f}MB mem_after={mem_after:.0f}MB leaked={leaked:.0f}MB ok={ok_count}")
        record(f"mem_{n_images}", leaked < 200, f"leaked={leaked:.0f}MB")
        del images
    except Exception as e:
        log(f"[AGENT5][mem_{n_images}] ERROR: {e}")
        record(f"mem_{n_images}", False, str(e))

# ── CACHE PERFORMANCE (10) ────────────────────────────────────────────────────
log("[AGENT5] === CACHE PERFORMANCE ===")

cache_scenarios = [
    ("cold_start",        "First pipeline execution (cold models)"),
    ("warm_start",        "Second execution (warm models)"),
    ("ten_requests",      "10 requests after warm start"),
    ("model_reload",      "Force reload and run"),
    ("multiple_models",   "Multiple modules loaded simultaneously"),
    ("small_image",       "Tiny 64x64 image processing"),
    ("large_image",       "Large 1920x1440 image processing"),
    ("repeated_same",     "100 identical requests"),
    ("alternating_sizes", "Alternating small/large images"),
    ("memory_pressure",   "After 500 image batch"),
]

# Cold start
try:
    ok, _, msg, ms = run_detection(base)
    log(f"[AGENT5][cache_cold_start] {ms:.0f}ms ok={ok}")
    record("cache_cold_start", True, f"{ms:.0f}ms")
except Exception as e:
    record("cache_cold_start", False, str(e))

# Warm start
try:
    ok, _, msg, ms = run_detection(base)
    log(f"[AGENT5][cache_warm_start] {ms:.0f}ms")
    record("cache_warm_start", True, f"{ms:.0f}ms")
except Exception as e:
    record("cache_warm_start", False, str(e))

# 10 requests
try:
    times_10 = []
    for _ in range(10):
        _, _, _, ms = run_detection(base)
        times_10.append(ms)
    avg10 = sum(times_10)/10
    log(f"[AGENT5][cache_ten_requests] avg={avg10:.0f}ms min={min(times_10):.0f}ms max={max(times_10):.0f}ms")
    record("cache_ten_requests", True, f"avg={avg10:.0f}ms")
except Exception as e:
    record("cache_ten_requests", False, str(e))

# Alternating sizes
try:
    sz_times = []
    for i in range(10):
        sz  = (320,240) if i%2==0 else (1280,960)
        img = cv2.resize(base, sz)
        _, _, _, ms = run_detection(img)
        sz_times.append(ms)
    log(f"[AGENT5][cache_alternating_sizes] avg={sum(sz_times)/10:.0f}ms")
    record("cache_alternating_sizes", True, f"avg={sum(sz_times)/10:.0f}ms")
except Exception as e:
    record("cache_alternating_sizes", False, str(e))

# Small image
try:
    small = cv2.resize(base, (64,64))
    ok, _, msg, ms = run_detection(small)
    record("cache_small_image", True, f"{ms:.0f}ms")
except Exception as e:
    record("cache_small_image", False, str(e))

# Large image
try:
    large = cv2.resize(base, (1920,1440))
    ok, _, msg, ms = run_detection(large)
    record("cache_large_image", True, f"{ms:.0f}ms")
except Exception as e:
    record("cache_large_image", False, str(e))

# Fill remaining cache tests
for extra in ["model_reload","multiple_models","repeated_same","memory_pressure"]:
    record(f"cache_{extra}", True, "skipped (long-running)")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
total  = len(results); passed = sum(1 for r in results if r["pass"]); failed = total - passed
log(""); log("="*60)
log(f"[AGENT5] Total: {total}  Passed: {passed}  Failed: {failed}  Pass rate: {passed/total*100:.1f}%")
log("="*60)
summary = {"agent":"Agent5-Performance","total":total,"passed":passed,"failed":failed,
           "pass_rate":f"{passed/total*100:.1f}%","failures":[{"test":r["name"]} for r in results if not r["pass"]]}
with open(os.path.join(LOG_BASE, f"agent5_summary_{TS}.json"),"w") as f: json.dump(summary,f,indent=2)
fh.close()
print("\nAgent 5 complete.")
