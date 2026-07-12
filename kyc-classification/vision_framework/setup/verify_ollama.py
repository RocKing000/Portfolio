"""
verify_ollama.py — Confirm Ollama is running and all required models respond.

Run from vision_framework/:
    py setup/verify_ollama.py
"""

import requests
import json
import sys


def check_ollama():
    print("Checking Ollama...")

    # ── 1. Is Ollama running? ─────────────────────────────────────────────
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        response.raise_for_status()
        models = response.json()["models"]
        print(f"Ollama running: YES")
        print(f"Available models:")
        for m in models:
            print(f"  {m['name']} — {m['size'] / 1e9:.1f} GB")
    except Exception as exc:
        print(f"Ollama not running: {exc}")
        print("Start the Ollama desktop app first, then re-run this script.")
        sys.exit(1)

    # ── 2. Verify qwen3:8b ────────────────────────────────────────────────
    # think=False disables qwen3's extended reasoning so tokens go to the answer
    print("\nTesting qwen3:8b...")
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen3:8b",
                "prompt": "Reply with just the word: WORKING",
                "stream": False,
                "think": False,
                "options": {"temperature": 0.0, "num_predict": 50},
            },
            timeout=120,
        )
        response.raise_for_status()
        reply = response.json()["response"].strip()
        print(f"qwen3:8b: {reply}")
    except Exception as exc:
        print(f"qwen3:8b ERROR: {exc}")
        sys.exit(1)

    # ── 3. Verify phi4 ────────────────────────────────────────────────────
    print("Testing phi4...")
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "phi4",
                "prompt": "Reply with just the word: WORKING",
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 50},
            },
            timeout=120,
        )
        response.raise_for_status()
        reply = response.json()["response"].strip()
        print(f"phi4: {reply}")
    except Exception as exc:
        print(f"phi4 ERROR: {exc}")
        sys.exit(1)

    print("\nAll models ready.")
    print("Next step: py setup/test_full_stack.py")


if __name__ == "__main__":
    check_ollama()
