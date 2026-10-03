"""
base_template.py — Abstract base class for KYC document templates.

All templates inherit from this class. It handles:
- Font loading (with graceful fallback to PIL default)
- Canvas creation
- Text rendering (regular, bold, hindi)
- Photo placeholder drawing (gray box with a simple face outline)
- PIL ↔ OpenCV conversion
"""

import os
import random
from abc import ABC, abstractmethod
from textwrap import wrap as textwrap_wrap
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


class BaseDocumentTemplate(ABC):
    """Abstract base for all KYC document templates."""

    # Standard ID card at 300 DPI
    CARD_WIDTH = 1012   # 85.6 mm
    CARD_HEIGHT = 638   # 54 mm

    # Font sizes available
    _FONT_SIZES = [10, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36]

    # ── Windows / Linux / macOS font search paths ─────────────────────────────
    _REGULAR_PATHS = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    _BOLD_PATHS = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    _MONO_PATHS = [
        "C:/Windows/Fonts/cour.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ]
    _HINDI_PATHS = [
        "C:/Windows/Fonts/NotoSansDevanagari-Regular.ttf",
        "C:/Windows/Fonts/mangal.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.otf",
    ]

    def __init__(self, config: dict) -> None:
        self.config = config
        self._regular_path: Optional[str] = self._find_font(self._REGULAR_PATHS)
        self._bold_path: Optional[str] = self._find_font(self._BOLD_PATHS)
        self._mono_path: Optional[str] = self._find_font(self._MONO_PATHS)
        self._hindi_path: Optional[str] = self._find_font(self._HINDI_PATHS)
        self._font_cache: dict = {}
        self.fonts = self._load_fonts()

    # ── abstract interface ────────────────────────────────────────────────────

    @abstractmethod
    def generate(self, fake_data: dict) -> np.ndarray:
        """Generate one document image with the supplied fake data."""

    @abstractmethod
    def get_field_bounding_boxes(self) -> dict:
        """Return pixel bounding boxes for each field (used for OCR labels)."""

    # ── font helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _find_font(paths) -> Optional[str]:
        for p in paths:
            if os.path.exists(p):
                return p
        return None

    def _load_fonts(self) -> dict:
        """Download Noto fonts if missing and return a size-keyed dict."""
        import urllib.request

        fonts_dir = os.path.join(os.path.dirname(__file__), "..", "fonts")
        fonts_dir = os.path.normpath(fonts_dir)
        os.makedirs(fonts_dir, exist_ok=True)

        _DOWNLOADS = {
            "NotoSansDevanagari-Regular.ttf": (
                "https://github.com/googlefonts/noto-fonts/"
                "raw/main/hinted/ttf/NotoSansDevanagari/"
                "NotoSansDevanagari-Regular.ttf"
            ),
            "NotoSans-Regular.ttf": (
                "https://github.com/googlefonts/noto-fonts/"
                "raw/main/hinted/ttf/NotoSans/"
                "NotoSans-Regular.ttf"
            ),
            "NotoSans-Bold.ttf": (
                "https://github.com/googlefonts/noto-fonts/"
                "raw/main/hinted/ttf/NotoSans/"
                "NotoSans-Bold.ttf"
            ),
        }

        paths: dict = {}
        for fname, url in _DOWNLOADS.items():
            dest = os.path.join(fonts_dir, fname)
            if not os.path.exists(dest):
                print(f"[FONT] Downloading {fname}…")
                try:
                    urllib.request.urlretrieve(url, dest)
                    print(f"[FONT] Saved to {dest}")
                except Exception as exc:
                    print(f"[FONT] Download failed ({exc}) — falling back to system font")
                    dest = None
            paths[fname] = dest if (dest and os.path.exists(dest)) else None

        # Fall back to system paths if Noto download failed
        dev_path   = paths["NotoSansDevanagari-Regular.ttf"] or self._hindi_path
        latin_path = paths["NotoSans-Regular.ttf"]           or self._regular_path
        bold_path  = paths["NotoSans-Bold.ttf"]              or self._bold_path

        def _load(path, size):
            if path:
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    pass
            return ImageFont.load_default()

        return {
            "hindi_small":       _load(dev_path,   16),
            "hindi_medium":      _load(dev_path,   22),
            "hindi_large":       _load(dev_path,   28),
            "latin_small":       _load(latin_path, 16),
            "latin_medium":      _load(latin_path, 20),
            "latin_large":       _load(latin_path, 24),
            "latin_bold_small":  _load(bold_path,  18),
            "latin_bold_medium": _load(bold_path,  22),
            "latin_bold_large":  _load(bold_path,  28),
        }

    def _get_font(self, size: int, style: str = "regular") -> ImageFont.FreeTypeFont:
        # Clamp to nearest available size
        nearest = min(self._FONT_SIZES, key=lambda s: abs(s - size))
        key = f"{style}_{nearest}"
        if key in self._font_cache:
            return self._font_cache[key]

        path_map = {
            "regular": self._regular_path,
            "bold": self._bold_path,
            "mono": self._mono_path,
            "hindi": self._hindi_path or self._regular_path,
        }
        path = path_map.get(style, self._regular_path)
        try:
            font = ImageFont.truetype(path, nearest) if path else ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()
        self._font_cache[key] = font
        return font

    # ── canvas ────────────────────────────────────────────────────────────────

    def _create_canvas(self, bg_color: tuple = (255, 255, 255)) -> Image.Image:
        return Image.new("RGB", (self.CARD_WIDTH, self.CARD_HEIGHT), bg_color)

    # ── text rendering ────────────────────────────────────────────────────────

    def _add_text(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        position: tuple,
        font_size: int = 20,
        color: tuple = (0, 0, 0),
        font_style: str = "regular",
        anchor: str = "la",
    ) -> None:
        """Render text at (x, y), auto-selecting Devanagari or Latin font."""
        text = str(text)

        def _is_devanagari(s: str) -> bool:
            return any("\u0900" <= c <= "\u097F" for c in s)

        if _is_devanagari(text):
            if font_size <= 18:
                font = self.fonts["hindi_small"]
            elif font_size <= 24:
                font = self.fonts["hindi_medium"]
            else:
                font = self.fonts["hindi_large"]
        elif "bold" in font_style:
            if font_size <= 18:
                font = self.fonts["latin_bold_small"]
            elif font_size <= 24:
                font = self.fonts["latin_bold_medium"]
            else:
                font = self.fonts["latin_bold_large"]
        else:
            if font_size <= 18:
                font = self.fonts["latin_small"]
            elif font_size <= 24:
                font = self.fonts["latin_medium"]
            else:
                font = self.fonts["latin_large"]

        x, y = int(position[0]), int(position[1])
        try:
            draw.text((x, y), text, fill=color, font=font, anchor=anchor)
        except Exception:
            # anchor param not supported on very old Pillow — fall back
            try:
                draw.text((x, y), text, fill=color, font=font)
            except Exception:
                draw.text((x, y), text, fill=color)

    def _add_label_value(
        self,
        draw: ImageDraw.ImageDraw,
        label: Optional[str],
        value: str,
        x: int,
        y: int,
        label_font_size: int = 12,
        value_font_size: int = 18,
        label_color: tuple = (80, 80, 80),
        value_color: tuple = (0, 0, 0),
        value_style: str = "regular",
    ) -> None:
        """Render a small label above a value — common pattern on ID cards."""
        if label:
            self._add_text(draw, label, (x, y), label_font_size, label_color, "regular")
            y += label_font_size + 4
        self._add_text(draw, value, (x, y), value_font_size, value_color, value_style)

    def _add_wrapped_text(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        x: int,
        y: int,
        max_width: int,
        font_size: int = 13,
        color: tuple = (40, 40, 40),
        line_height: int = 16,
    ) -> None:
        """Word-wrap text within max_width pixels."""
        # Rough estimate: avg char width ≈ font_size * 0.55
        chars_per_line = max(10, int(max_width / (font_size * 0.55)))
        lines = textwrap_wrap(text, width=chars_per_line)
        for i, line in enumerate(lines[:3]):   # max 3 lines
            self._add_text(draw, line, (x, y + i * line_height), font_size, color)

    # ── photo placeholder ─────────────────────────────────────────────────────

    def _add_photo_placeholder(
        self,
        image: Image.Image,
        position: tuple,
        size: tuple,
        face_image: Optional[np.ndarray] = None,
    ) -> None:
        """Draw photo area — paste real face or draw a schematic placeholder."""
        x, y = int(position[0]), int(position[1])
        w, h = int(size[0]), int(size[1])
        draw = ImageDraw.Draw(image)

        if face_image is not None:
            try:
                face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                face_pil = Image.fromarray(face_rgb).resize((w, h), Image.LANCZOS)
                image.paste(face_pil, (x, y))
                return
            except Exception:
                pass  # fall through to placeholder

        # Gray background
        draw.rectangle([(x, y), (x + w, y + h)],
                        fill=(200, 200, 200), outline=(140, 140, 140), width=2)

        # Schematic head+shoulders
        cx = x + w // 2
        head_r = int(min(w, h) * 0.22)
        head_cy = y + int(h * 0.36)
        # Head
        draw.ellipse(
            [(cx - head_r, head_cy - head_r), (cx + head_r, head_cy + head_r)],
            fill=(175, 155, 135), outline=(140, 120, 105),
        )
        # Shoulders (half-ellipse)
        sw = int(w * 0.55)
        sh = int(h * 0.25)
        sy = head_cy + head_r + 2
        draw.ellipse(
            [(cx - sw, sy), (cx + sw, sy + sh * 2)],
            fill=(165, 145, 125), outline=(130, 110, 95),
        )

    # ── QR code placeholder ───────────────────────────────────────────────────

    def _draw_qr_placeholder(
        self,
        image: Image.Image,
        x: int,
        y: int,
        size: int,
    ) -> None:
        """Draw a schematic QR-code square (grid pattern)."""
        draw = ImageDraw.Draw(image)
        draw.rectangle([(x, y), (x + size, y + size)],
                        fill=(255, 255, 255), outline=(30, 30, 30), width=1)
        # Finder patterns (3 corner squares)
        fp_size = size // 5
        for fx, fy in [(x + 2, y + 2), (x + size - fp_size - 2, y + 2),
                        (x + 2, y + size - fp_size - 2)]:
            draw.rectangle([(fx, fy), (fx + fp_size, fy + fp_size)],
                            fill=(30, 30, 30))
            inner = fp_size // 3
            draw.rectangle(
                [(fx + inner, fy + inner),
                 (fx + fp_size - inner, fy + fp_size - inner)],
                fill=(255, 255, 255),
            )
        # Random data dots
        rng = random.Random(42)
        dot_size = max(2, size // 20)
        for _ in range(60):
            dx = rng.randint(x + fp_size + 4, x + size - dot_size - 2)
            dy = rng.randint(y + fp_size + 4, y + size - dot_size - 2)
            draw.rectangle([(dx, dy), (dx + dot_size, dy + dot_size)],
                            fill=(20, 20, 20))

    # ── government logo placeholder ───────────────────────────────────────────

    def _draw_logo_placeholder(
        self,
        image: Image.Image,
        x: int,
        y: int,
        size: int,
        color: tuple = (255, 153, 51),
    ) -> None:
        """Draw Ashoka emblem placeholder (simple circle with spokes)."""
        draw = ImageDraw.Draw(image)
        r = size // 2
        cx, cy = x + r, y + r
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)],
                      outline=color, width=2)
        # Spokes
        for angle_deg in range(0, 360, 30):
            import math
            rad = math.radians(angle_deg)
            ex = int(cx + r * 0.85 * math.cos(rad))
            ey = int(cy + r * 0.85 * math.sin(rad))
            draw.line([(cx, cy), (ex, ey)], fill=color, width=1)
        draw.ellipse([(cx - 3, cy - 3), (cx + 3, cy + 3)], fill=color)

    # ── conversion ────────────────────────────────────────────────────────────

    def to_numpy(self, pil_image: Image.Image) -> np.ndarray:
        """Convert PIL RGB image to OpenCV BGR numpy array."""
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
