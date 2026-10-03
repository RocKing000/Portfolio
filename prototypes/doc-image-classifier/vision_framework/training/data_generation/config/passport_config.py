"""Passport template configuration (data page)."""

PASSPORT_CONFIG = {
    "card_width": 1012,
    "card_height": 638,

    "header": {
        "height_ratio": 0.18,
        "bg_color": (0, 0, 102),       # Deep navy blue
        "text_color": (255, 255, 255),
        "title": "PASSPORT",
        "country": "REPUBLIC OF INDIA",
        "title_font_size": 28,
        "country_font_size": 18,
    },

    "body_bg": (250, 248, 240),  # Off-white / cream

    "photo": {
        "x_ratio": 0.025,
        "y_ratio": 0.20,
        "width_ratio": 0.24,
        "height_ratio": 0.58,
        "border_color": (0, 0, 128),
        "border_width": 2,
        "placeholder_color": (210, 215, 220),
    },

    "fields": {
        "surname":       {"x_ratio": 0.30, "y_ratio": 0.22, "font_size": 18, "color": (0,0,0), "style": "bold",    "label": "Surname",          "label_font_size": 12, "label_color": (80,80,80)},
        "given_name":    {"x_ratio": 0.30, "y_ratio": 0.32, "font_size": 18, "color": (0,0,0), "style": "bold",    "label": "Given Name(s)",    "label_font_size": 12, "label_color": (80,80,80)},
        "nationality":   {"x_ratio": 0.30, "y_ratio": 0.42, "font_size": 16, "color": (0,0,0), "style": "regular", "label": "Nationality",      "label_font_size": 12, "label_color": (80,80,80)},
        "dob":           {"x_ratio": 0.30, "y_ratio": 0.50, "font_size": 16, "color": (0,0,0), "style": "regular", "label": "Date of Birth",    "label_font_size": 12, "label_color": (80,80,80)},
        "sex":           {"x_ratio": 0.62, "y_ratio": 0.50, "font_size": 16, "color": (0,0,0), "style": "regular", "label": "Sex",              "label_font_size": 12, "label_color": (80,80,80)},
        "place_of_birth":{"x_ratio": 0.30, "y_ratio": 0.58, "font_size": 14, "color": (0,0,0), "style": "regular", "label": "Place of Birth",   "label_font_size": 12, "label_color": (80,80,80)},
        "issue_date":    {"x_ratio": 0.30, "y_ratio": 0.66, "font_size": 14, "color": (0,0,0), "style": "regular", "label": "Date of Issue",    "label_font_size": 12, "label_color": (80,80,80)},
        "expiry_date":   {"x_ratio": 0.62, "y_ratio": 0.66, "font_size": 14, "color": (0,0,0), "style": "regular", "label": "Date of Expiry",   "label_font_size": 12, "label_color": (80,80,80)},
        "passport_no":   {"x_ratio": 0.30, "y_ratio": 0.74, "font_size": 18, "color": (0,0,128), "style": "bold",  "label": "Passport No.",     "label_font_size": 12, "label_color": (80,80,80)},
    },

    # MRZ: 2 lines of 44 chars at the very bottom
    "mrz": {
        "y_ratio": 0.87,
        "line_height_ratio": 0.07,
        "bg_color": (240, 240, 230),
        "text_color": (0, 0, 0),
        "font_size": 16,
        "font_style": "mono",
        "chars_per_line": 44,
    },

    "border": {
        "color": (0, 0, 128),
        "width": 3,
    },
}
