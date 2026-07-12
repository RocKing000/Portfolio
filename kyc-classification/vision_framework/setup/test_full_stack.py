"""
test_full_stack.py — End-to-end test of the Ollama-powered stack.

Run from vision_framework/:
    py setup/test_full_stack.py

All tests run against Ollama — no API keys, no internet required.
"""

import os
import sys

# Ensure vision_framework package is importable.
# VF_ROOT = the vision_framework/ dir itself.
# PROJECT_ROOT = parent of that (D:\Documentation Recognition\).
VF_ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(VF_ROOT)
for _p in (PROJECT_ROOT, VF_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import cv2

from vision_framework.core.llm.ollama_client import OllamaClient

print("=" * 52)
print("   FULL STACK TEST — OLLAMA LOCAL")
print("=" * 52)

tests_passed = 0
tests_failed = 0


def test(name: str, fn) -> None:
    global tests_passed, tests_failed
    try:
        result = fn()
        print(f"  PASS  {name}")
        if result is not None:
            short = str(result)[:120].replace("\n", " ")
            print(f"        {short}")
        tests_passed += 1
    except Exception as exc:
        print(f"  FAIL  {name}")
        print(f"        {exc}")
        tests_failed += 1


TEST_IMAGE = os.path.join(VF_ROOT, "tests", "test_images", "sharp_document.jpg")

# ── Test 1: Ollama connection ─────────────────────────────────────────────────
print("\n[1/6] Connectivity")
test(
    "Ollama connection + list models",
    lambda: OllamaClient().list_models(),
)

# ── Test 2: Text generation ───────────────────────────────────────────────────
print("\n[2/6] Text generation")
test(
    "qwen3:7b text generation",
    lambda: OllamaClient().generate("Say hello in one word", task="general"),
)

# ── Test 3: JSON generation ───────────────────────────────────────────────────
print("\n[3/6] JSON generation")
test(
    "JSON generation (structured output)",
    lambda: OllamaClient().generate_json('Return {"status": "ok", "ready": true}'),
)

# ── Test 4: Intent detection ──────────────────────────────────────────────────
print("\n[4/6] NLU / intent detection")
test(
    "Intent detection — English",
    lambda: OllamaClient().detect_intent(
        "I already paid last week",
        intent_list=["CLAIM_PAID", "CONFIRM_AVAILABLE", "BUSY", "DISPUTE"],
    ),
)
test(
    "Intent detection — Hinglish",
    lambda: OllamaClient().detect_intent(
        "Maine paise bhar diye kal",
        intent_list=["CLAIM_PAID", "CONFIRM_AVAILABLE", "BUSY", "DISPUTE"],
    ),
)

# ── Test 5 & 6: Vision (multimodal) ──────────────────────────────────────────
# These require a vision-capable model (e.g. llava, moondream, qwen2.5-vl).
# qwen3:8b and phi4 are text-only — vision tests are skipped when unavailable.
VISION_MODELS = ["llava", "llava:13b", "moondream", "bakllava", "qwen2.5-vl",
                 "qwen2-vl", "minicpm-v", "llava-phi3"]
_client = OllamaClient()
_available = _client.list_models()
_vision_model = next((m for m in _available if any(v in m for v in VISION_MODELS)), None)

print(f"\n[5/6] Vision — document classification")
if not os.path.exists(TEST_IMAGE):
    print(f"  SKIP  No test image at {TEST_IMAGE}")
elif _vision_model is None:
    print(f"  SKIP  No vision model installed.")
    print(f"        To enable: ollama pull llava")
    print(f"        Available text models: {_available}")
else:
    _img = cv2.imread(TEST_IMAGE)
    test(
        f"Document classification ({_vision_model})",
        lambda: OllamaClient(_vision_model).classify_document(_img),
    )

print(f"\n[6/6] Vision — OCR field extraction")
if not os.path.exists(TEST_IMAGE):
    print(f"  SKIP  No test image at {TEST_IMAGE}")
elif _vision_model is None:
    print(f"  SKIP  No vision model installed (pull llava to enable)")
else:
    _img = cv2.imread(TEST_IMAGE)
    test(
        f"OCR field extraction — aadhaar ({_vision_model})",
        lambda: OllamaClient(_vision_model).extract_document_fields(_img, "aadhaar"),
    )

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 52)
total = tests_passed + tests_failed
print(f"Results: {tests_passed}/{total} passed, {tests_failed} failed")
print("=" * 52)

if tests_failed == 0:
    print("\nAll tests passed — system ready.")
    print()
    print("To start everything:")
    print('  Double-click  START_KYC_SYSTEM.bat')
    print('  OR run        py run.py   (from project root)')
else:
    print("\nFix the failures above before running the full system.")
    sys.exit(1)
