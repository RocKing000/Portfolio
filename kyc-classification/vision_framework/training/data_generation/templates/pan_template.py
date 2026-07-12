"""
pan_template.py — Synthetic PAN card image generator.

Layout:
┌──────────────────────────────────────────────────────────────┐
│  [IT LOGO]  INCOME TAX DEPARTMENT   GOVT. OF INDIA           │ ← white header, blue text
│             PERMANENT ACCOUNT NUMBER CARD                    │
├──────────────────────────────────────────────────────────────┤
│[PHOTO│  Name / नाम                                           │
│ 3×4] │  SHUBHAM AGARWAL                                      │ ← cream body
│      │  Father's Name / पिता का नाम                         │
│      │  RAMESH AGARWAL                                       │
│      │  Date of Birth / जन्म तिथि                           │
│      │  19/04/2001                                           │
│      │  Permanent Account Number                             │
│      │  ABCDE1234F                    [SIGNATURE BOX]        │
└──────┴──────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw

from .base_template import BaseDocumentTemplate
from ..config.pan_config import PAN_CONFIG


class PANTemplate(BaseDocumentTemplate):
    """Generates synthetic PAN card images."""

    HEADER_TEXT  = (0, 0, 128)    # Dark blue
    BODY_BG      = (255, 248, 220) # Cream
    PAN_COLOR    = (0, 0, 128)
    TEXT_COLOR   = (0, 0, 0)
    LABEL_COLOR  = (80, 80, 80)
    BORDER_COLOR = (0, 0, 128)
    LINE_COLOR   = (0, 0, 128)

    def generate(self, fake_data: dict) -> "np.ndarray":  # noqa: F821
        """
        fake_data keys:
          name, father_name, dob, pan_number, face_image (optional)
        """
        canvas = self._create_canvas((255, 255, 255))
        draw = ImageDraw.Draw(canvas)

        self._draw_header(draw, canvas)

        # Body background (cream)
        header_h = int(self.CARD_HEIGHT * 0.20)
        draw.rectangle(
            [(0, header_h), (self.CARD_WIDTH, self.CARD_HEIGHT)],
            fill=self.BODY_BG,
        )

        # Photo
        self._add_photo_placeholder(
            canvas,
            position=(
                int(self.CARD_WIDTH * 0.025),
                int(self.CARD_HEIGHT * 0.23),
            ),
            size=(
                int(self.CARD_WIDTH  * 0.22),
                int(self.CARD_HEIGHT * 0.60),
            ),
            face_image=fake_data.get("face_image"),
        )

        self._draw_fields(draw, fake_data)
        self._draw_signature_box(draw)

        # Border
        draw.rectangle(
            [(0, 0), (self.CARD_WIDTH - 1, self.CARD_HEIGHT - 1)],
            outline=self.BORDER_COLOR, width=3,
        )
        return self.to_numpy(canvas)

    def _draw_header(self, draw: ImageDraw.ImageDraw, canvas: Image.Image) -> None:
        header_h = int(self.CARD_HEIGHT * 0.20)
        # White background (already set by canvas)
        # Divider line
        draw.line(
            [(0, header_h), (self.CARD_WIDTH, header_h)],
            fill=self.LINE_COLOR, width=2,
        )
        # IT logo placeholder
        self._draw_logo_placeholder(
            canvas,
            x=int(self.CARD_WIDTH * 0.025),
            y=int(self.CARD_HEIGHT * 0.015),
            size=int(self.CARD_HEIGHT * 0.16),
            color=self.HEADER_TEXT,
        )
        # Title text
        self._add_text(
            draw, "INCOME TAX DEPARTMENT",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.03)),
            font_size=20, color=self.HEADER_TEXT, font_style="bold",
        )
        self._add_text(
            draw, "GOVT. OF INDIA",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.09)),
            font_size=14, color=self.HEADER_TEXT,
        )
        self._add_text(
            draw, "PERMANENT ACCOUNT NUMBER CARD",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.13)),
            font_size=14, color=self.HEADER_TEXT, font_style="bold",
        )

    def _draw_fields(self, draw: ImageDraw.ImageDraw, data: dict) -> None:
        x = int(self.CARD_WIDTH * 0.30)

        # Name
        self._add_label_value(
            draw,
            label="Name / नाम",
            value=data.get("name", "").upper(),
            x=x, y=int(self.CARD_HEIGHT * 0.25),
            label_font_size=12, value_font_size=20,
            label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
            value_style="bold",
        )
        # Father's name
        self._add_label_value(
            draw,
            label="Father's Name / पिता का नाम",
            value=data.get("father_name", "").upper(),
            x=x, y=int(self.CARD_HEIGHT * 0.41),
            label_font_size=12, value_font_size=18,
            label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
        )
        # DOB
        self._add_label_value(
            draw,
            label="Date of Birth / जन्म तिथि",
            value=data.get("dob", ""),
            x=x, y=int(self.CARD_HEIGHT * 0.55),
            label_font_size=12, value_font_size=18,
            label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
        )
        # PAN number
        self._add_label_value(
            draw,
            label="Permanent Account Number",
            value=data.get("pan_number", ""),
            x=x, y=int(self.CARD_HEIGHT * 0.70),
            label_font_size=12, value_font_size=26,
            label_color=self.LABEL_COLOR, value_color=self.PAN_COLOR,
            value_style="bold",
        )

    def _draw_signature_box(self, draw: ImageDraw.ImageDraw) -> None:
        x = int(self.CARD_WIDTH  * 0.68)
        y = int(self.CARD_HEIGHT * 0.74)
        w = int(self.CARD_WIDTH  * 0.26)
        h = int(self.CARD_HEIGHT * 0.12)
        draw.rectangle([(x, y), (x + w, y + h)],
                        outline=self.TEXT_COLOR, width=1)
        self._add_text(
            draw, "Signature",
            (x + w // 2 - 25, y + h - 16),
            font_size=11, color=(100, 100, 100),
        )

    def get_field_bounding_boxes(self) -> dict:
        W, H = self.CARD_WIDTH, self.CARD_HEIGHT
        return {
            "pan_number": {
                "x": int(W * 0.30), "y": int(H * 0.72),
                "w": int(W * 0.36), "h": int(H * 0.09),
            },
            "name": {
                "x": int(W * 0.30), "y": int(H * 0.28),
                "w": int(W * 0.65), "h": int(H * 0.09),
            },
            "dob": {
                "x": int(W * 0.30), "y": int(H * 0.57),
                "w": int(W * 0.35), "h": int(H * 0.08),
            },
            "father_name": {
                "x": int(W * 0.30), "y": int(H * 0.44),
                "w": int(W * 0.65), "h": int(H * 0.08),
            },
        }
