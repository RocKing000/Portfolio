"""
dl_template.py — Synthetic Indian Driving License generator (Maharashtra style).

Layout:
┌──────────────────────────────────────────────────────────────┐
│  [EMBLEM]  GOVERNMENT OF MAHARASHTRA                         │ ← maroon header
│            DRIVING LICENCE                                   │
├──────┬───────────────────────────────────────────────────────┤
│[PHOTO│  DL No.    MH02 2011 0012345      [MAHARASHTRA badge]│
│ 3×4] │  Name      SHUBHAM AGARWAL                           │
│      │  S/D/W of  RAMESH AGARWAL                            │
│      │  DOB       19-04-2001                                 │
│      │  Address   123 MG Road, Pune, Maharashtra - 411001   │
│      │  Valid Till (NT)  18-04-2041       COV  LMV, MCWG   │
└──────┴──────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw

from .base_template import BaseDocumentTemplate
from ..config.dl_config import DL_CONFIG


class DrivingLicenseTemplate(BaseDocumentTemplate):
    """Generates synthetic Driving License images (Maharashtra style)."""

    HEADER_BG    = (139, 0, 0)      # Dark red / maroon
    HEADER_TEXT  = (255, 255, 255)
    BODY_BG      = (245, 245, 255)  # Very light lavender
    DL_NO_COLOR  = (139, 0, 0)
    VALID_COLOR  = (0, 100, 0)
    TEXT_COLOR   = (0, 0, 0)
    LABEL_COLOR  = (80, 80, 80)
    BORDER_COLOR = (139, 0, 0)

    def generate(self, fake_data: dict) -> "np.ndarray":  # noqa: F821
        """
        fake_data keys:
          name_english, dob, address, dl_number,
          valid_till, father_name (used as S/D/W of),
          face_image (optional)
        """
        canvas = self._create_canvas(self.BODY_BG)
        draw = ImageDraw.Draw(canvas)

        self._draw_header(draw, canvas)
        self._add_photo_placeholder(
            canvas,
            position=(
                int(self.CARD_WIDTH * 0.025),
                int(self.CARD_HEIGHT * 0.21),
            ),
            size=(
                int(self.CARD_WIDTH  * 0.22),
                int(self.CARD_HEIGHT * 0.55),
            ),
            face_image=fake_data.get("face_image"),
        )
        self._draw_fields(draw, fake_data)
        self._draw_state_badge(draw)

        # Border
        draw.rectangle(
            [(0, 0), (self.CARD_WIDTH - 1, self.CARD_HEIGHT - 1)],
            outline=self.BORDER_COLOR, width=3,
        )
        return self.to_numpy(canvas)

    def _draw_header(self, draw: ImageDraw.ImageDraw, canvas: Image.Image) -> None:
        header_h = int(self.CARD_HEIGHT * 0.19)
        draw.rectangle([(0, 0), (self.CARD_WIDTH, header_h)], fill=self.HEADER_BG)

        self._draw_logo_placeholder(
            canvas,
            x=int(self.CARD_WIDTH * 0.025),
            y=int(self.CARD_HEIGHT * 0.01),
            size=int(self.CARD_HEIGHT * 0.16),
            color=self.HEADER_TEXT,
        )
        self._add_text(
            draw, "GOVERNMENT OF MAHARASHTRA",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.025)),
            font_size=18, color=self.HEADER_TEXT, font_style="bold",
        )
        self._add_text(
            draw, "DRIVING LICENCE",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.09)),
            font_size=24, color=self.HEADER_TEXT, font_style="bold",
        )
        self._add_text(
            draw, "MINISTRY OF ROAD TRANSPORT & HIGHWAYS, GOVT. OF INDIA",
            (int(self.CARD_WIDTH * 0.18), int(self.CARD_HEIGHT * 0.14)),
            font_size=11, color=(220, 200, 200),
        )

    def _draw_fields(self, draw: ImageDraw.ImageDraw, data: dict) -> None:
        x = int(self.CARD_WIDTH * 0.30)

        self._add_label_value(
            draw, "DL No.", data.get("dl_number", "MH02 2011 0012345"),
            x, int(self.CARD_HEIGHT * 0.22),
            12, 20, self.LABEL_COLOR, self.DL_NO_COLOR, "bold",
        )
        self._add_label_value(
            draw, "Name", data.get("name_english", "").upper(),
            x, int(self.CARD_HEIGHT * 0.34),
            12, 18, self.LABEL_COLOR, self.TEXT_COLOR, "bold",
        )
        self._add_label_value(
            draw, "S/D/W of", data.get("father_name", data.get("name_english", "")).upper(),
            x, int(self.CARD_HEIGHT * 0.44),
            12, 16, self.LABEL_COLOR, self.TEXT_COLOR,
        )
        self._add_label_value(
            draw, "DOB", data.get("dob", ""),
            x, int(self.CARD_HEIGHT * 0.53),
            12, 16, self.LABEL_COLOR, self.TEXT_COLOR,
        )
        self._add_wrapped_text(
            draw, "Address: " + data.get("address", ""),
            x, int(self.CARD_HEIGHT * 0.62),
            max_width=int(self.CARD_WIDTH * 0.65),
            font_size=12, color=(40, 40, 40), line_height=15,
        )
        self._add_label_value(
            draw, "Valid Till (NT)", data.get("valid_till", ""),
            x, int(self.CARD_HEIGHT * 0.75),
            12, 16, self.LABEL_COLOR, self.VALID_COLOR, "bold",
        )
        self._add_label_value(
            draw, "COV",
            data.get("cov", "LMV, MCWG"),
            int(self.CARD_WIDTH * 0.68), int(self.CARD_HEIGHT * 0.75),
            12, 14, self.LABEL_COLOR, self.TEXT_COLOR,
        )

    def _draw_state_badge(self, draw: ImageDraw.ImageDraw) -> None:
        x = int(self.CARD_WIDTH  * 0.72)
        y = int(self.CARD_HEIGHT * 0.21)
        w = int(self.CARD_WIDTH  * 0.24)
        h = int(self.CARD_HEIGHT * 0.40)
        draw.rectangle([(x, y), (x + w, y + h)],
                        fill=(240, 240, 240), outline=(200, 180, 180), width=1)
        self._add_text(
            draw, "MAHARASHTRA",
            (x + 8, y + 8),
            font_size=11, color=self.HEADER_BG, font_style="bold",
        )
        # Three horizontal lines as decoration
        for i in range(3):
            ly = y + 30 + i * 12
            draw.line([(x + 6, ly), (x + w - 6, ly)], fill=(200, 180, 180), width=1)

    def get_field_bounding_boxes(self) -> dict:
        W, H = self.CARD_WIDTH, self.CARD_HEIGHT
        return {
            "dl_number":  {"x": int(W*0.30), "y": int(H*0.24), "w": int(W*0.40), "h": int(H*0.08)},
            "name":       {"x": int(W*0.30), "y": int(H*0.36), "w": int(W*0.55), "h": int(H*0.08)},
            "dob":        {"x": int(W*0.30), "y": int(H*0.55), "w": int(W*0.30), "h": int(H*0.07)},
            "valid_till": {"x": int(W*0.30), "y": int(H*0.77), "w": int(W*0.35), "h": int(H*0.08)},
        }
