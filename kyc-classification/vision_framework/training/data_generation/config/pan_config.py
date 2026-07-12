"""PAN card template configuration."""

PAN_CONFIG = {
    "card_width": 1012,
    "card_height": 638,

    "header": {
        "height_ratio": 0.20,
        "bg_color": (255, 255, 255),
        "text_color": (0, 0, 128),
        "title": "INCOME TAX DEPARTMENT",
        "subtitle": "GOVT. OF INDIA",
        "pan_label": "PERMANENT ACCOUNT NUMBER CARD",
        "title_font_size": 20,
        "subtitle_font_size": 14,
        "pan_label_font_size": 16,
    },

    "body_bg": (255, 248, 220),  # Cornsilk / cream

    "photo": {
        "x_ratio": 0.025,
        "y_ratio": 0.22,
        "width_ratio": 0.22,
        "height_ratio": 0.60,
        "border_color": (0, 0, 128),
        "border_width": 2,
        "placeholder_color": (210, 210, 220),
    },

    "fields": {
        "name": {
            "x_ratio": 0.30,
            "y_ratio": 0.28,
            "font_size": 20,
            "color": (0, 0, 0),
            "style": "bold",
            "label": "Name / नाम",
            "label_font_size": 13,
            "label_color": (80, 80, 80),
        },
        "father_name": {
            "x_ratio": 0.30,
            "y_ratio": 0.42,
            "font_size": 18,
            "color": (0, 0, 0),
            "style": "regular",
            "label": "Father's Name / पिता का नाम",
            "label_font_size": 13,
            "label_color": (80, 80, 80),
        },
        "dob": {
            "x_ratio": 0.30,
            "y_ratio": 0.56,
            "font_size": 18,
            "color": (0, 0, 0),
            "style": "regular",
            "label": "Date of Birth / जन्म तिथि",
            "label_font_size": 13,
            "label_color": (80, 80, 80),
        },
        "pan_number": {
            "x_ratio": 0.30,
            "y_ratio": 0.72,
            "font_size": 26,
            "color": (0, 0, 128),
            "style": "bold",
            "label": "Permanent Account Number",
            "label_font_size": 12,
            "label_color": (80, 80, 80),
        },
    },

    "signature": {
        "x_ratio": 0.68,
        "y_ratio": 0.74,
        "width_ratio": 0.26,
        "height_ratio": 0.12,
        "border_color": (0, 0, 0),
        "label": "Signature",
    },

    "border": {
        "color": (0, 0, 128),
        "width": 3,
    },

    "divider_line": {
        "y_ratio": 0.21,
        "color": (0, 0, 128),
        "width": 2,
    },
}
