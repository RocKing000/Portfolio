"""
passport_template.py — Synthetic Indian passport data-page generator.

Layout:
┌──────────────────────────────────────────────────────────────┐
│  [EMBLEM]   PASSPORT   REPUBLIC OF INDIA                     │ ← navy header
├──────┬───────────────────────────────────────────────────────┤
│[PHOTO│  Surname:          AGARWAL                            │
│35×45]│  Given Name(s):    SHUBHAM                            │
│      │  Nationality:      INDIAN                             │
│      │  Date of Birth:    19 APR 2001   Sex: M              │
│      │  Place of Birth:   DELHI                              │
│      │  Date of Issue:    01 JAN 2020                        │
│      │  Date of Expiry:   31 DEC 2030   Passport No: A1234567│
├──────┴───────────────────────────────────────────────────────┤
│ P<INDAGARWAL<<SHUBHAM<<<<<<<<<<<<<<<<<<<<<<<<<<<            │ ← MRZ line 1
│ A1234567<3IND0104196M3012315<<<<<<<<<<<<<<<4                │ ← MRZ line 2
└──────────────────────────────────────────────────────────────┘
"""

import random

from PIL import Image, ImageDraw

from .base_template import BaseDocumentTemplate
from ..config.passport_config import PASSPORT_CONFIG


class PassportTemplate(BaseDocumentTemplate):
    """Generates synthetic Indian passport data pages."""

    HEADER_BG    = (0, 0, 102)     # Deep navy
    HEADER_TEXT  = (255, 255, 255)
    BODY_BG      = (250, 248, 240) # Off-white
    PASSPORT_COLOR = (0, 0, 128)
    TEXT_COLOR   = (0, 0, 0)
    LABEL_COLOR  = (80, 80, 80)
    MRZ_BG       = (240, 240, 230)
    MRZ_TEXT     = (0, 0, 0)
    BORDER_COLOR = (0, 0, 128)

    def generate(self, fake_data: dict) -> "np.ndarray":  # noqa: F821
        """
        fake_data keys:
          name_english (full name), dob, gender,
          passport_number, expiry_date, issue_date (optional),
          place_of_birth (optional), face_image (optional)
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
                int(self.CARD_WIDTH  * 0.24),
                int(self.CARD_HEIGHT * 0.58),
            ),
            face_image=fake_data.get("face_image"),
        )
        self._draw_fields(draw, fake_data)
        self._draw_mrz(draw, fake_data)

        # Border
        draw.rectangle(
            [(0, 0), (self.CARD_WIDTH - 1, self.CARD_HEIGHT - 1)],
            outline=self.BORDER_COLOR, width=3,
        )
        return self.to_numpy(canvas)

    def _draw_header(self, draw: ImageDraw.ImageDraw, canvas: Image.Image) -> None:
        header_h = int(self.CARD_HEIGHT * 0.18)
        draw.rectangle([(0, 0), (self.CARD_WIDTH, header_h)], fill=self.HEADER_BG)

        self._draw_logo_placeholder(
            canvas,
            x=int(self.CARD_WIDTH * 0.025),
            y=int(self.CARD_HEIGHT * 0.01),
            size=int(self.CARD_HEIGHT * 0.15),
            color=self.HEADER_TEXT,
        )
        self._add_text(
            draw, "PASSPORT",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.025)),
            font_size=28, color=self.HEADER_TEXT, font_style="bold",
        )
        self._add_text(
            draw, "REPUBLIC OF INDIA",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.09)),
            font_size=18, color=self.HEADER_TEXT,
        )

    def _draw_fields(self, draw: ImageDraw.ImageDraw, data: dict) -> None:
        x = int(self.CARD_WIDTH * 0.30)
        parts = data.get("name_english", "AGARWAL SHUBHAM").upper().split()
        surname = parts[-1] if len(parts) > 1 else parts[0]
        given = " ".join(parts[:-1]) if len(parts) > 1 else ""

        fields = [
            ("Surname",         surname,                                  0.22, 18, "bold"),
            ("Given Name(s)",   given,                                    0.32, 18, "bold"),
            ("Nationality",     "INDIAN",                                 0.42, 16, "regular"),
            ("Date of Birth",   data.get("dob", ""),                      0.50, 16, "regular"),
            ("Place of Birth",  data.get("place_of_birth", "INDIA"),      0.58, 14, "regular"),
            ("Date of Issue",   data.get("issue_date", "01 JAN 2020"),    0.66, 14, "regular"),
            ("Passport No.",    data.get("passport_number", ""),          0.74, 18, "bold"),
        ]

        for label, value, y_ratio, font_size, style in fields:
            self._add_label_value(
                draw, label=label, value=str(value),
                x=x, y=int(self.CARD_HEIGHT * y_ratio),
                label_font_size=12, value_font_size=font_size,
                label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
                value_style=style,
            )

        # Sex (right column, same row as DOB)
        self._add_label_value(
            draw, label="Sex",
            value="M" if data.get("gender", "Male") == "Male" else "F",
            x=int(self.CARD_WIDTH * 0.62), y=int(self.CARD_HEIGHT * 0.50),
            label_font_size=12, value_font_size=16,
            label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
        )
        # Expiry date (right column, same row as issue)
        self._add_label_value(
            draw, label="Date of Expiry",
            value=data.get("expiry_date", "31 DEC 2030"),
            x=int(self.CARD_WIDTH * 0.62), y=int(self.CARD_HEIGHT * 0.66),
            label_font_size=12, value_font_size=14,
            label_color=self.LABEL_COLOR, value_color=self.TEXT_COLOR,
        )

    def _draw_mrz(self, draw: ImageDraw.ImageDraw, data: dict) -> None:
        mrz_y = int(self.CARD_HEIGHT * 0.86)
        # MRZ background strip
        draw.rectangle(
            [(0, mrz_y - 4), (self.CARD_WIDTH, self.CARD_HEIGHT - 4)],
            fill=self.MRZ_BG,
        )
        # Build MRZ lines (simplified — not cryptographically valid)
        name_parts = data.get("name_english", "AGARWAL SHUBHAM").upper().split()
        surname = name_parts[-1] if len(name_parts) > 1 else name_parts[0]
        given   = "".join(name_parts[:-1]) if len(name_parts) > 1 else "X"
        pno     = data.get("passport_number", "A1234567").replace(" ", "")
        dob_raw = data.get("dob", "01/01/1990").replace("/", "").replace("-", "")
        dob_mrz = dob_raw[4:6] + dob_raw[2:4] + dob_raw[:2] if len(dob_raw) >= 8 else "900101"
        expiry  = data.get("expiry_date", "31 DEC 2030")
        exp_mrz = "301231"   # simplified

        sex = "M" if data.get("gender", "Male") == "Male" else "F"
        name_field = (surname + "<<" + given).replace(" ", "<")
        name_field = (name_field + "<" * 39)[:39]

        line1 = f"P<IND{name_field}<"
        line1 = (line1 + "<" * 44)[:44]
        line2 = f"{pno[:8]:<8}<IND{dob_mrz}{sex}{exp_mrz}<<<<<<<<<<<<<<4"
        line2 = (line2 + "<" * 44)[:44]

        self._add_text(
            draw, line1, (int(self.CARD_WIDTH * 0.02), mrz_y),
            font_size=16, color=self.MRZ_TEXT, font_style="mono",
        )
        self._add_text(
            draw, line2,
            (int(self.CARD_WIDTH * 0.02), mrz_y + int(self.CARD_HEIGHT * 0.07)),
            font_size=16, color=self.MRZ_TEXT, font_style="mono",
        )

    def get_field_bounding_boxes(self) -> dict:
        W, H = self.CARD_WIDTH, self.CARD_HEIGHT
        return {
            "passport_number": {"x": int(W*0.30), "y": int(H*0.76), "w": int(W*0.25), "h": int(H*0.08)},
            "name":            {"x": int(W*0.30), "y": int(H*0.34), "w": int(W*0.65), "h": int(H*0.08)},
            "dob":             {"x": int(W*0.30), "y": int(H*0.52), "w": int(W*0.30), "h": int(H*0.07)},
            "mrz_line1":       {"x": int(W*0.02), "y": int(H*0.86), "w": int(W*0.96), "h": int(H*0.07)},
            "mrz_line2":       {"x": int(W*0.02), "y": int(H*0.93), "w": int(W*0.96), "h": int(H*0.07)},
        }
