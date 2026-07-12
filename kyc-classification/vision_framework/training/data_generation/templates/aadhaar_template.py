"""
aadhaar_template.py — Synthetic Aadhaar card image generator.

Layout:
┌──────────────────────────────────────────────────────────────┐
│  [LOGO]  आधार  AADHAAR   भारत सरकार / Govt. of India        │ ← saffron header
├──────┬───────────────────────────────────────────────────────┤
│      │  [Name in Hindi]                                      │
│[PHOTO│  [Name in English]                                    │
│ 3×4 ]│  DOB / जन्म तिथि: DD/MM/YYYY                        │
│      │  [Male/Female]                                        │
│      │  Address: ...                                         │
├──────┴───────────────────────────────────────────────────────┤
│ [QR] │  XXXX XXXX XXXX   (dark blue)                        │ ← footer
│      │  मेरा आधार, मेरी पहचान                               │
└──────────────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw

from .base_template import BaseDocumentTemplate
from ..config.aadhaar_config import AADHAAR_CONFIG


class AadhaarTemplate(BaseDocumentTemplate):
    """Generates synthetic Aadhaar card images."""

    HEADER_BG    = (255, 153, 51)
    HEADER_TEXT  = (255, 255, 255)
    BODY_BG      = (255, 255, 255)
    NUMBER_COLOR = (0, 0, 128)
    BORDER_COLOR = (200, 200, 200)
    ACCENT_COLOR = (19, 136, 8)
    TEXT_COLOR   = (33, 33, 33)
    MUTED_COLOR  = (100, 100, 100)

    def generate(self, fake_data: dict) -> "np.ndarray":  # noqa: F821
        """
        fake_data keys:
          name_hindi, name_english, dob, gender,
          address, aadhaar_number, face_image (optional np.ndarray)
        """
        canvas = self._create_canvas(self.BODY_BG)
        draw = ImageDraw.Draw(canvas)

        self._draw_header(draw, canvas)
        self._add_photo_placeholder(
            canvas,
            position=(
                int(self.CARD_WIDTH * 0.025),
                int(self.CARD_HEIGHT * 0.20),
            ),
            size=(
                int(self.CARD_WIDTH  * 0.22),
                int(self.CARD_HEIGHT * 0.56),
            ),
            face_image=fake_data.get("face_image"),
        )
        self._draw_personal_info(draw, fake_data)
        self._draw_footer(draw, fake_data.get("aadhaar_number", "0000 0000 0000"))
        self._draw_qr_placeholder(
            canvas,
            x=int(self.CARD_WIDTH  * 0.025),
            y=int(self.CARD_HEIGHT * 0.83),
            size=int(self.CARD_WIDTH * 0.13),
        )
        self._draw_logo_placeholder(
            canvas,
            x=int(self.CARD_WIDTH * 0.88),
            y=int(self.CARD_HEIGHT * 0.02),
            size=int(self.CARD_HEIGHT * 0.10),
            color=self.HEADER_TEXT,
        )
        # Bottom accent line
        accent_y = self.CARD_HEIGHT - 6
        draw.rectangle(
            [(0, accent_y), (self.CARD_WIDTH, self.CARD_HEIGHT)],
            fill=self.ACCENT_COLOR,
        )
        # Outer border
        draw.rectangle(
            [(0, 0), (self.CARD_WIDTH - 1, self.CARD_HEIGHT - 1)],
            outline=self.BORDER_COLOR, width=3,
        )
        return self.to_numpy(canvas)

    # ── private drawing helpers ───────────────────────────────────────────────

    def _draw_header(self, draw: ImageDraw.ImageDraw, canvas: Image.Image) -> None:
        header_h = int(self.CARD_HEIGHT * 0.16)
        draw.rectangle([(0, 0), (self.CARD_WIDTH, header_h)], fill=self.HEADER_BG)

        # Hindi "आधार"
        self._add_text(
            draw, "आधार",
            (int(self.CARD_WIDTH * 0.38), int(header_h * 0.08)),
            font_size=32, color=self.HEADER_TEXT, font_style="hindi",
        )
        # English "AADHAAR"
        self._add_text(
            draw, "AADHAAR",
            (int(self.CARD_WIDTH * 0.38), int(header_h * 0.52)),
            font_size=20, color=self.HEADER_TEXT, font_style="bold",
        )
        # Subtitle
        self._add_text(
            draw, "भारत सरकार / Govt. of India",
            (int(self.CARD_WIDTH * 0.10), int(header_h * 0.72)),
            font_size=13, color=self.HEADER_TEXT,
        )
        # Logo placeholder
        self._draw_logo_placeholder(
            canvas,
            x=int(self.CARD_WIDTH * 0.025),
            y=int(self.CARD_HEIGHT * 0.01),
            size=int(self.CARD_HEIGHT * 0.13),
            color=self.HEADER_TEXT,
        )

    def _draw_personal_info(self, draw: ImageDraw.ImageDraw, data: dict) -> None:
        x = int(self.CARD_WIDTH * 0.30)

        # Name in Hindi
        self._add_text(
            draw, data.get("name_hindi", "नाम"),
            (x, int(self.CARD_HEIGHT * 0.22)),
            font_size=22, color=self.TEXT_COLOR, font_style="hindi",
        )
        # Name in English
        self._add_text(
            draw, data.get("name_english", "Name").upper(),
            (x, int(self.CARD_HEIGHT * 0.33)),
            font_size=20, color=self.TEXT_COLOR, font_style="bold",
        )
        # DOB
        dob_label = "DOB / जन्म तिथि: "
        self._add_text(
            draw, dob_label + data.get("dob", ""),
            (x, int(self.CARD_HEIGHT * 0.46)),
            font_size=17, color=self.TEXT_COLOR,
        )
        # Gender
        gender = data.get("gender", "Male")
        gender_hi = "पुरुष" if gender == "Male" else "महिला"
        self._add_text(
            draw, f"{gender_hi} / {gender}",
            (x, int(self.CARD_HEIGHT * 0.56)),
            font_size=17, color=self.TEXT_COLOR,
        )
        # Address (wrapped)
        addr = data.get("address", "")
        self._add_wrapped_text(
            draw, "Address: " + addr,
            x, int(self.CARD_HEIGHT * 0.65),
            max_width=int(self.CARD_WIDTH * 0.66),
            font_size=12, color=(60, 60, 60), line_height=15,
        )

    def _draw_footer(self, draw: ImageDraw.ImageDraw, aadhaar_number: str) -> None:
        footer_y = int(self.CARD_HEIGHT * 0.84)
        # Horizontal separator
        draw.line(
            [(0, int(self.CARD_HEIGHT * 0.82)), (self.CARD_WIDTH, int(self.CARD_HEIGHT * 0.82))],
            fill=self.BORDER_COLOR, width=1,
        )
        # Format number
        num = aadhaar_number.replace(" ", "")
        if len(num) >= 12:
            formatted = f"{num[:4]} {num[4:8]} {num[8:12]}"
        else:
            formatted = aadhaar_number

        self._add_text(
            draw, formatted,
            (int(self.CARD_WIDTH * 0.38), footer_y),
            font_size=28, color=self.NUMBER_COLOR, font_style="bold",
        )
        # Tagline
        self._add_text(
            draw, "मेरा आधार, मेरी पहचान",
            (int(self.CARD_WIDTH * 0.38), int(self.CARD_HEIGHT * 0.91)),
            font_size=13, color=self.MUTED_COLOR, font_style="hindi",
        )

    # ── OCR bounding boxes ────────────────────────────────────────────────────

    def get_field_bounding_boxes(self) -> dict:
        W, H = self.CARD_WIDTH, self.CARD_HEIGHT
        return {
            "aadhaar_number": {
                "x": int(W * 0.38), "y": int(H * 0.84),
                "w": int(W * 0.55), "h": int(H * 0.09),
            },
            "name_english": {
                "x": int(W * 0.30), "y": int(H * 0.33),
                "w": int(W * 0.65), "h": int(H * 0.09),
            },
            "dob": {
                "x": int(W * 0.30), "y": int(H * 0.46),
                "w": int(W * 0.45), "h": int(H * 0.08),
            },
            "gender": {
                "x": int(W * 0.30), "y": int(H * 0.56),
                "w": int(W * 0.30), "h": int(H * 0.08),
            },
        }
