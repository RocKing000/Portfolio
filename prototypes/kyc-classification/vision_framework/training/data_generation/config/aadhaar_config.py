"""
Aadhaar card template configuration.

All ratio values are fractions of CARD_WIDTH (1012px) or CARD_HEIGHT (638px).
Colors are BGR tuples for OpenCV / RGB tuples for PIL.
"""

AADHAAR_CONFIG = {
    # ── card dimensions ───────────────────────────────────────────────────────
    "card_width": 1012,
    "card_height": 638,

    # ── header bar (saffron strip at top) ────────────────────────────────────
    "header": {
        "height_ratio": 0.15,          # 15% of card height
        "bg_color": (255, 153, 51),    # Saffron / Government orange
        "text_color": (255, 255, 255), # White
        "logo_width_ratio": 0.06,
        "logo_height_ratio": 0.12,
        "hindi_text": "आधार",
        "english_text": "AADHAAR",
        "subtitle": "भारत सरकार / Govt. of India",
        "hindi_font_size": 32,
        "english_font_size": 24,
        "subtitle_font_size": 14,
    },

    # ── photo region ──────────────────────────────────────────────────────────
    "photo": {
        "x_ratio": 0.025,
        "y_ratio": 0.20,
        "width_ratio": 0.22,
        "height_ratio": 0.56,
        "border_color": (160, 160, 160),
        "border_width": 2,
        "placeholder_color": (200, 200, 200),
    },

    # ── personal information fields ───────────────────────────────────────────
    "fields": {
        "name_hindi": {
            "x_ratio": 0.30,
            "y_ratio": 0.22,
            "font_size": 22,
            "color": (33, 33, 33),
            "style": "hindi",
            "label": None,
        },
        "name_english": {
            "x_ratio": 0.30,
            "y_ratio": 0.33,
            "font_size": 20,
            "color": (33, 33, 33),
            "style": "bold",
            "label": None,
        },
        "dob": {
            "x_ratio": 0.30,
            "y_ratio": 0.46,
            "font_size": 18,
            "color": (33, 33, 33),
            "style": "regular",
            "label": "DOB / जन्म तिथि: ",
        },
        "gender": {
            "x_ratio": 0.30,
            "y_ratio": 0.56,
            "font_size": 18,
            "color": (33, 33, 33),
            "style": "regular",
            "label": None,
        },
        "address": {
            "x_ratio": 0.30,
            "y_ratio": 0.65,
            "font_size": 13,
            "color": (60, 60, 60),
            "style": "regular",
            "label": "Address: ",
            "max_width_ratio": 0.66,
        },
    },

    # ── footer bar ────────────────────────────────────────────────────────────
    "footer": {
        "start_ratio": 0.82,
        "bg_color": None,             # No separate background — same as body
        "number_color": (0, 0, 128),  # Dark blue
        "number_font_size": 28,
        "tagline": "मेरा आधार, मेरी पहचान",
        "tagline_font_size": 14,
        "tagline_color": (100, 100, 100),
        "number_x_ratio": 0.45,
        "number_y_ratio": 0.84,
        "tagline_y_ratio": 0.91,
    },

    # ── QR code placeholder ───────────────────────────────────────────────────
    "qr_code": {
        "x_ratio": 0.025,
        "y_ratio": 0.83,
        "size_ratio": 0.14,          # Square: 14% of card width
        "color": (40, 40, 40),
        "bg_color": (255, 255, 255),
    },

    # ── card border ───────────────────────────────────────────────────────────
    "border": {
        "color": (200, 200, 200),
        "width": 3,
        "radius": 8,
    },

    # ── body background ───────────────────────────────────────────────────────
    "body_bg": (255, 255, 255),

    # ── bottom accent line (thin green strip) ─────────────────────────────────
    "accent_line": {
        "color": (19, 136, 8),
        "height": 6,
    },
}
