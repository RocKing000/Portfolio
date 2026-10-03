"""
ollama_client.py — Unified Ollama client for all LLM interactions.

Replaces every OpenAI API call in the project.  Works with any model
installed locally in Ollama.  No API keys, no internet required.

Usage:
    from vision_framework.core.llm.ollama_client import OllamaClient

    client = OllamaClient()
    text   = client.generate("Summarise this in one sentence: …")
    data   = client.generate_json('Return {"status": "ok"}')
    result = client.classify_document(image_ndarray)
"""

import base64
import json
import logging
import re
from typing import Dict, List, Optional, Union

import cv2
import numpy as np
import requests

logger = logging.getLogger(__name__)

_BASE_URL = "http://localhost:11434"

# ── Task → model routing ──────────────────────────────────────────────────────
# qwen3:8b is the installed model (pull name: qwen3:8b → stored as qwen3:8b)
MODEL_ROUTING: Dict[str, str] = {
    "classification": "qwen3:8b",   # document-type detection
    "ocr":            "qwen3:8b",   # text extraction from images
    "nlp":            "qwen3:8b",   # intent detection, NLU
    "reasoning":      "phi4",       # multi-step reasoning
    "code":           "phi4",       # code generation
    "general":        "qwen3:8b",   # default catch-all
}


class OllamaClient:
    """
    Single client for all Ollama interactions.

    Replaces OpenAI API completely.  Every public method is intentionally
    named to match what the rest of the codebase previously expected from
    OpenAI so that callers need minimal changes.
    """

    BASE_URL = _BASE_URL

    def __init__(self, default_model: str = "qwen3:8b") -> None:
        self.default_model = default_model
        self._verify_connection()

    # ── Internal helpers ──────────────────────────────────────────────────

    def _verify_connection(self) -> None:
        try:
            requests.get(f"{self.BASE_URL}/api/tags", timeout=5)
        except Exception:
            raise ConnectionError(
                "Ollama not running. "
                "Start the Ollama desktop app before using OllamaClient."
            )

    @staticmethod
    def _clean_json_response(raw: str) -> str:
        """Strip markdown fences from an LLM response that should be JSON."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Drop first line (``` or ```json) and last line (```)
            cleaned = "\n".join(lines[1:-1]).strip()
        return cleaned

    @staticmethod
    def _parse_json(text: str) -> dict:
        """
        Parse JSON from text, tolerating minor LLM formatting quirks.
        Falls back to regex extraction of the first {...} block.
        """
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            return {"error": "Could not parse JSON", "raw": text}

    # ── Core generation ───────────────────────────────────────────────────

    def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        task: str = "general",
        temperature: float = 0.1,
        max_tokens: int = 2000,
        stream: bool = False,
        think: bool = False,
    ) -> str:
        """
        Generate a plain-text response from an Ollama model.

        Parameters
        ----------
        prompt:      The text prompt.
        model:       Override model name.  If None, task routing applies.
        task:        Key into MODEL_ROUTING (used when model is None).
        temperature: Sampling temperature; 0.0 = deterministic.
        max_tokens:  Maximum tokens to generate (num_predict).
        stream:      Whether to stream the response (returns full text anyway).
        """
        if model is None:
            model = MODEL_ROUTING.get(task, self.default_model)

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "think": think,          # False = skip CoT (qwen3); True = enable
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        logger.debug("[Ollama] generate model=%s task=%s", model, task)
        response = requests.post(
            f"{self.BASE_URL}/api/generate",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        raw = response.json()["response"].strip()

        # qwen3 wraps its reasoning in <think>…</think> before the answer.
        # Strip those blocks so callers always receive clean output.
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()
        return raw

    def generate_json(
        self,
        prompt: str,
        model: Optional[str] = None,
        task: str = "general",
    ) -> dict:
        """
        Generate and parse a JSON response.

        Automatically appends a JSON-only instruction to the prompt and
        cleans markdown fences from the response before parsing.
        """
        json_prompt = (
            f"{prompt}\n\n"
            "Respond with valid JSON only. "
            "No explanation, no markdown, just JSON."
        )
        raw = self.generate(json_prompt, model=model, task=task, temperature=0.0)
        cleaned = self._clean_json_response(raw)
        return self._parse_json(cleaned)

    # ── Vision (image input) ──────────────────────────────────────────────

    def analyze_image(
        self,
        image: np.ndarray,
        prompt: str,
        model: str = "moondream:latest",
        as_json: bool = False,
    ) -> Union[str, dict]:
        """
        Analyze an image using a vision-capable Ollama model.

        Converts a BGR numpy array to base64 JPEG before sending.
        Uses /api/chat (required by moondream, llava, and most vision models).
        Returns a dict when as_json=True, otherwise a plain string.
        """
        # BGR → JPEG bytes → base64
        _, buf = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 92])
        img_b64 = base64.b64encode(buf).decode('utf-8')

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [img_b64],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 2000},
        }

        logger.debug("[Ollama] analyze_image model=%s as_json=%s", model, as_json)
        response = requests.post(
            f"{self.BASE_URL}/api/chat",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        result = response.json()["message"]["content"].strip()

        if not as_json:
            return result

        cleaned = self._clean_json_response(result)
        return self._parse_json(cleaned)

    # ── KYC document helpers ──────────────────────────────────────────────

    def classify_document(self, image: np.ndarray) -> dict:
        """
        Classify the type of an Indian identity document from an image.

        Replaces the rule-based fallback in DocumentClassifier.
        Returns a dict with keys: document_type, confidence, reasoning,
        visible_elements.
        """
        prompt = (
            "Look at this image. What type of Indian identity document is it?\n"
            "Reply with exactly one word: aadhaar, pan, passport, driving_license, or unknown.\n"
            "No explanation. Just the single word."
        )
        raw = self.analyze_image(image, prompt, as_json=False)

        # Map plain-text response to document_type
        raw_lower = raw.lower().strip().strip("'\"")
        type_map = {
            "aadhaar": "aadhaar",
            "aadhar": "aadhaar",
            "adhaar": "aadhaar",
            "pan": "pan",
            "passport": "passport",
            "driving_license": "driving_license",
            "driving license": "driving_license",
            "drivinglicense": "driving_license",
            "licence": "driving_license",
            "license": "driving_license",
        }
        doc_type = "unknown"
        for key, val in type_map.items():
            if key in raw_lower:
                doc_type = val
                break

        return {
            "document_type": doc_type,
            "confidence": 0.75 if doc_type != "unknown" else 0.0,
            "reasoning": raw,
            "visible_elements": [],
        }

    def extract_document_fields(
        self,
        image: np.ndarray,
        document_type: str,
    ) -> dict:
        """
        Extract structured text fields from a KYC document image.

        Uses the model as an OCR+parser for the given document_type.
        Returns a dict of field-name → extracted value (or None).
        """
        type_prompts = {
            "aadhaar": (
                "Extract these fields:\n"
                "- aadhaar_number: 12-digit number (format: XXXX XXXX XXXX)\n"
                "- name_english: name in English\n"
                "- name_hindi: name in Hindi/Devanagari\n"
                "- dob: date of birth (DD/MM/YYYY)\n"
                "- gender: Male/Female/Other\n"
                "- address: full address text"
            ),
            "pan": (
                "Extract these fields:\n"
                "- pan_number: 10-character PAN (format: AAAAA9999A)\n"
                "- name: account holder name\n"
                "- father_name: father's name\n"
                "- dob: date of birth"
            ),
            "passport": (
                "Extract these fields:\n"
                "- passport_number: passport number\n"
                "- surname: surname/last name\n"
                "- given_name: given name(s)\n"
                "- dob: date of birth\n"
                "- expiry_date: date of expiry\n"
                "- mrz_line1: first MRZ line\n"
                "- mrz_line2: second MRZ line"
            ),
            "driving_license": (
                "Extract these fields:\n"
                "- dl_number: driving license number\n"
                "- name: holder name\n"
                "- dob: date of birth\n"
                "- valid_till: expiry date\n"
                "- address: address"
            ),
        }

        fields_desc = type_prompts.get(
            document_type,
            "Extract all visible text fields as key-value pairs.",
        )

        prompt = (
            f"You are an OCR system for Indian {document_type} documents.\n\n"
            f"{fields_desc}\n\n"
            "Return JSON with extracted values. Use null for fields not visible.\n"
            "Copy text exactly as shown in the document."
        )

        return self.analyze_image(image, prompt, as_json=True)

    # ── NLU helpers ───────────────────────────────────────────────────────

    def detect_intent(
        self,
        text: str,
        context: str = "",
        intent_list: Optional[List[str]] = None,
    ) -> dict:
        """
        Detect intent from user text.

        Replaces OpenAI NLU in the Aaya telecalling system.
        Returns a dict with keys: intent, confidence, entities,
        language, sentiment.
        """
        intents_str = ""
        if intent_list:
            intents_str = f"Valid intents: {', '.join(intent_list)}\n"

        prompt = (
            "You are an intent classifier for a loan telecalling system.\n\n"
            f"{intents_str}"
            f"Conversation context: {context or 'None'}\n"
            f'User said: "{text}"\n\n'
            "Classify the intent and return JSON:\n"
            "{\n"
            '  "intent": "detected intent name",\n'
            '  "confidence": 0.0 to 1.0,\n'
            '  "entities": {"key": "value"},\n'
            '  "language": "english" or "hindi" or "hinglish",\n'
            '  "sentiment": "positive" or "negative" or "neutral"\n'
            "}"
        )
        return self.generate_json(prompt, task="nlp")

    def generate_tts_text(
        self,
        script: str,
        tone: str = "professional",
        language: str = "english",
    ) -> str:
        """
        Improve a TTS script to sound natural when spoken aloud.

        Used to make Aaya's voice responses more conversational.
        """
        prompt = (
            "You are writing a script for an AI voice assistant named Aaya "
            "who works for a financial company.\n\n"
            "Rewrite this script to sound more natural and conversational.\n"
            f"Tone: {tone}\n"
            f"Language: {language}\n"
            "Keep it concise — under 30 words.\n"
            "No special characters or punctuation that sounds odd when spoken.\n\n"
            f"Original: {script}\n\n"
            "Rewritten (just the text, nothing else):"
        )
        return self.generate(prompt, task="general", temperature=0.3)

    # ── Model management ──────────────────────────────────────────────────

    def list_models(self) -> List[str]:
        """Return names of all locally available Ollama models."""
        response = requests.get(f"{self.BASE_URL}/api/tags", timeout=10)
        response.raise_for_status()
        return [m["name"] for m in response.json()["models"]]

    def pull_model(self, model_name: str) -> bool:
        """
        Pull a model from the Ollama registry into local storage.

        Streams progress lines to stdout.  Returns True on success.
        """
        print(f"Pulling {model_name}...")
        response = requests.post(
            f"{self.BASE_URL}/api/pull",
            json={"name": model_name},
            stream=True,
            timeout=600,
        )
        for line in response.iter_lines():
            if line:
                data = json.loads(line)
                if "status" in data:
                    print(f"  {data['status']}")
        return True
