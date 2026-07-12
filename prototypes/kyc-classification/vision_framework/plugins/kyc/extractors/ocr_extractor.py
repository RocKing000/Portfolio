"""
OCRExtractor — extract text fields from a KYC document image using OCR.

Single Responsibility: run OCR on the image and route structured field
extraction to the correct document-type-specific parser.

Extraction waterfall:
  1. EasyOCR + regex parsers  — fast, deterministic field matching
  2. Ollama vision model  — used when EasyOCR is unavailable or confidence low
"""

import logging
import re
from typing import Any, Dict, List, Optional

import numpy as np

from vision_framework.core.interfaces.base_extractor import BaseExtractor
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

# Soft-import OllamaClient — OCR still works without Ollama installed.
try:
    from vision_framework.core.llm.ollama_client import OllamaClient as _OllamaClient
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

logger = logging.getLogger(__name__)

# Try to import EasyOCR; soft-fail so the rest of the framework still loads
try:
    import easyocr
    _EASYOCR_AVAILABLE = True
except ImportError:
    _EASYOCR_AVAILABLE = False
    logger.warning("OCRExtractor: easyocr not installed. OCR will return empty results.")

# Module-level singleton — initialised once when first needed, then reused
# across all requests.  Avoids ~3-5s re-init cost on every call.
_reader: Optional[Any] = None


def _get_reader(languages: List[str]) -> Optional[Any]:
    """Return the cached EasyOCR reader, initialising it on first call."""
    global _reader
    if _reader is None and _EASYOCR_AVAILABLE:
        logger.info("[OCR] EasyOCR reader initialising (first call)…")
        _reader = easyocr.Reader(languages, gpu=False)
        logger.info("[OCR] EasyOCR reader initialised")
    return _reader


class OCRExtractor(BaseExtractor):
    """
    Extracts structured text fields from KYC document images.

    EasyOCR reads raw text from the image.  The *context* dict (expected to
    carry a 'class_label' key from the document classifier) determines which
    field parser runs.  For Aadhaar, a fast bottom-strip scan is tried first
    to find the 12-digit number without running OCR on the full card.

    When EasyOCR is unavailable (not installed) *or* returns low confidence,
    Ollama vision is used as a drop-in replacement that requires no setup.
    """

    # Minimum EasyOCR average confidence before we prefer Ollama
    _OLLAMA_PREFER_THRESHOLD = 0.50

    def __init__(
        self,
        languages: Optional[List[str]] = None,
        use_ollama_fallback: bool = True,
    ) -> None:
        self._languages = languages or KYCConfig.OCR_LANGUAGES
        self._ollama: Optional[_OllamaClient] = None

        if use_ollama_fallback and _OLLAMA_AVAILABLE:
            try:
                self._ollama = _OllamaClient()
                logger.info("[OCR] Ollama fallback enabled")
            except ConnectionError:
                logger.info("[OCR] Ollama not running — Ollama fallback disabled")

    @property
    def extractor_name(self) -> str:
        return "ocr_extractor"

    def extract(self, image: np.ndarray, context: Optional[Dict] = None) -> dict:
        """
        Run OCR on *image* and return structured extracted data.

        Parameters
        ----------
        image:
            BGR uint8 document image (ideally perspective-corrected).
        context:
            Must contain 'class_label' from DocumentClassifier for routing.
        """
        if image is None or image.size == 0:
            return self._failure("Invalid image.")

        context = context or {}
        doc_type = context.get("class_label", "unknown")

        reader = _get_reader(self._languages)

        # EasyOCR unavailable — delegate entirely to Ollama
        if reader is None:
            if self._ollama is not None:
                return self._ollama_extract(image, doc_type)
            return self._failure("EasyOCR not available and Ollama not running.")

        # Fast path for Aadhaar: scan bottom 35% first
        if doc_type == "aadhaar":
            fast_number = self._extract_aadhaar_number_fast(image, reader)
            if fast_number:
                logger.debug("[OCR] Aadhaar number found via fast bottom-strip scan")
                return {
                    "success": True,
                    "extracted_data": {"aadhaar_number": fast_number, "name": None,
                                       "dob": None, "gender": None, "all_bboxes": []},
                    "raw_output": [],
                    "confidence": 0.85,
                    "message": "Aadhaar number extracted via fast scan.",
                }

        # Full card OCR
        try:
            raw_results = reader.readtext(image)
        except Exception as exc:
            logger.exception("OCRExtractor: easyocr.readtext raised: %s", exc)
            return self._failure(str(exc))

        raw_texts = [
            {"bbox": r[0], "text": r[1].strip(), "confidence": float(r[2])}
            for r in raw_results
            if float(r[2]) >= KYCConfig.OCR_CONFIDENCE_MIN
        ]

        all_text = " ".join(t["text"] for t in raw_texts)
        extracted_fields = self._parse_fields(doc_type, raw_texts, all_text)

        avg_confidence = (
            sum(t["confidence"] for t in raw_texts) / len(raw_texts)
            if raw_texts else 0.0
        )

        logger.debug(
            "OCRExtractor: doc_type=%s, %d text blocks, avg_conf=%.2f",
            doc_type, len(raw_texts), avg_confidence,
        )

        # Low-confidence EasyOCR result — try Ollama for better accuracy
        if (
            avg_confidence < self._OLLAMA_PREFER_THRESHOLD
            and self._ollama is not None
        ):
            logger.debug(
                "[OCR] EasyOCR confidence %.2f below threshold — trying Ollama",
                avg_confidence,
            )
            return self._ollama_extract(image, doc_type)

        return {
            "success": bool(raw_texts),
            "extracted_data": extracted_fields,
            "raw_output": raw_texts,
            "confidence": round(avg_confidence, 4),
            "message": f"Extracted {len(raw_texts)} text blocks for '{doc_type}'.",
        }

    # ------------------------------------------------------------------
    # Ollama-based extraction path
    # ------------------------------------------------------------------

    def _ollama_extract(self, image: np.ndarray, doc_type: str) -> dict:
        """Delegate field extraction to the Ollama vision model."""
        logger.debug("[OCR] Using Ollama vision for %s extraction", doc_type)
        try:
            result = self._ollama.extract_document_fields(image, doc_type)
            doc_number = (
                result.get("aadhaar_number")
                or result.get("pan_number")
                or result.get("passport_number")
                or result.get("dl_number")
            )
            return {
                "success": True,
                "extracted_data": result,
                "raw_output": [],
                "confidence": 0.80,
                "message": f"Ollama extraction complete for '{doc_type}'.",
                "document_number": doc_number,
            }
        except Exception as exc:
            logger.exception("[OCR] Ollama extraction failed: %s", exc)
            return self._failure(f"Ollama extraction failed: {exc}")

    # ------------------------------------------------------------------
    # Fast Aadhaar number extraction (bottom strip only)
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_aadhaar_number_fast(
        image: np.ndarray, reader: Any
    ) -> Optional[str]:
        """
        Scan the bottom 35% of the card for a 12-digit Aadhaar number.

        Returns the number string (digits only) if found, else None.
        Skips full-card OCR when successful — ~3× faster for the common case.
        """
        h = image.shape[0]
        bottom_strip = image[int(h * 0.65):, :]
        uid_re = re.compile(r'\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b')

        try:
            results = reader.readtext(bottom_strip, detail=1)
        except Exception:
            return None

        for (_bbox, text, conf) in results:
            if conf < KYCConfig.OCR_CONFIDENCE_MIN:
                continue
            match = uid_re.search(text)
            if match:
                return re.sub(r'\s', '', match.group())
        return None

    # ------------------------------------------------------------------
    # Field parsers (one per document type)
    # ------------------------------------------------------------------

    def _parse_fields(self, doc_type: str, raw_texts: List[Dict], all_text: str) -> Dict:
        parsers = {
            "aadhaar": self._parse_aadhaar,
            "pan": self._parse_pan,
            "passport": self._parse_passport,
            "driving_license": self._parse_driving_license,
        }
        parser = parsers.get(doc_type, self._parse_generic)
        return parser(raw_texts, all_text)

    @staticmethod
    def _parse_aadhaar(raw_texts: List[Dict], all_text: str) -> Dict:
        uid_pattern = re.compile(r'\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b')
        dob_pattern = re.compile(r'\b(\d{2}/\d{2}/\d{4}|\d{4})\b')
        name_pattern = re.compile(r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b')

        uid = next((uid_pattern.search(t["text"]).group() for t in raw_texts
                    if uid_pattern.search(t["text"])), None)
        dob = next((dob_pattern.search(t["text"]).group() for t in raw_texts
                    if "DOB" in t["text"].upper() or "Year of Birth" in t["text"]), None)
        name_match = name_pattern.search(all_text)
        name = name_match.group() if name_match else None
        gender = next(
            (g for t in raw_texts for g in ["MALE", "FEMALE", "TRANSGENDER"]
             if g in t["text"].upper()), None
        )
        return {
            "aadhaar_number": uid.replace(" ", "") if uid else None,
            "name": name,
            "dob": dob,
            "gender": gender,
            "all_bboxes": [t["bbox"] for t in raw_texts
                           if uid and uid.replace(" ", "") in t["text"].replace(" ", "")],
        }

    @staticmethod
    def _parse_pan(raw_texts: List[Dict], all_text: str) -> Dict:
        pan_pattern = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')
        name_pattern = re.compile(r'\b([A-Z][A-Z\s]{3,30})\b')
        pan_number = next(
            (pan_pattern.search(t["text"]).group() for t in raw_texts
             if pan_pattern.search(t["text"])), None
        )
        name_match = name_pattern.search(all_text)
        return {
            "pan_number": pan_number,
            "name": name_match.group().strip() if name_match else None,
        }

    @staticmethod
    def _parse_passport(raw_texts: List[Dict], all_text: str) -> Dict:
        mrz_pattern = re.compile(r'[A-Z0-9<]{44}')
        passport_no = re.compile(r'\b[A-Z]\d{7}\b')
        mrz_lines = [mrz_pattern.search(t["text"]).group() for t in raw_texts
                     if mrz_pattern.search(t["text"])]
        doc_no = next(
            (passport_no.search(t["text"]).group() for t in raw_texts
             if passport_no.search(t["text"])), None
        )
        return {"passport_number": doc_no, "mrz_lines": mrz_lines}

    @staticmethod
    def _parse_driving_license(raw_texts: List[Dict], all_text: str) -> Dict:
        dl_pattern = re.compile(r'\b[A-Z]{2}[0-9]{2}\s?[0-9]{11}\b')
        dl_no = next(
            (dl_pattern.search(t["text"]).group() for t in raw_texts
             if dl_pattern.search(t["text"])), None
        )
        return {"dl_number": dl_no}

    @staticmethod
    def _parse_generic(raw_texts: List[Dict], all_text: str) -> Dict:
        return {"raw_text": all_text, "blocks": [t["text"] for t in raw_texts]}

    @staticmethod
    def _failure(message: str) -> dict:
        return {
            "success": False,
            "extracted_data": {},
            "raw_output": None,
            "confidence": 0.0,
            "message": message,
        }
