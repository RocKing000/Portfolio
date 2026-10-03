"""Driving License template configuration (Maharashtra style)."""

DL_CONFIG = {
    "card_width": 1012,
    "card_height": 638,

    "header": {
        "height_ratio": 0.18,
        "bg_color": (139, 0, 0),       # Dark red / maroon
        "text_color": (255, 255, 255),
        "title": "DRIVING LICENCE",
        "state": "GOVERNMENT OF MAHARASHTRA",
        "title_font_size": 26,
        "state_font_size": 16,
        "ministry": "MINISTRY OF ROAD TRANSPORT & HIGHWAYS",
        "ministry_font_size": 11,
    },

    "body_bg": (245, 245, 255),   # Very light lavender / off-white

    "photo": {
        "x_ratio": 0.025,
        "y_ratio": 0.21,
        "width_ratio": 0.22,
        "height_ratio": 0.55,
        "border_color": (80, 80, 80),
        "border_width": 2,
        "placeholder_color": (200, 205, 210),
    },

    "fields": {
        "dl_number":  {"x_ratio": 0.30, "y_ratio": 0.22, "font_size": 20, "color": (139,0,0), "style": "bold",    "label": "DL No.",          "label_font_size": 12, "label_color": (80,80,80)},
        "name":       {"x_ratio": 0.30, "y_ratio": 0.33, "font_size": 18, "color": (0,0,0),   "style": "bold",    "label": "Name",            "label_font_size": 12, "label_color": (80,80,80)},
        "rel_name":   {"x_ratio": 0.30, "y_ratio": 0.43, "font_size": 16, "color": (0,0,0),   "style": "regular", "label": "S/D/W of",        "label_font_size": 12, "label_color": (80,80,80)},
        "dob":        {"x_ratio": 0.30, "y_ratio": 0.52, "font_size": 16, "color": (0,0,0),   "style": "regular", "label": "DOB",             "label_font_size": 12, "label_color": (80,80,80)},
        "address":    {"x_ratio": 0.30, "y_ratio": 0.60, "font_size": 12, "color": (40,40,40),"style": "regular", "label": "Address",         "label_font_size": 12, "label_color": (80,80,80), "max_width_ratio": 0.65},
        "valid_till": {"x_ratio": 0.30, "y_ratio": 0.73, "font_size": 16, "color": (0,100,0), "style": "bold",    "label": "Valid Till (NT)", "label_font_size": 12, "label_color": (80,80,80)},
        "cov":        {"x_ratio": 0.68, "y_ratio": 0.73, "font_size": 14, "color": (0,0,0),   "style": "regular", "label": "COV",             "label_font_size": 12, "label_color": (80,80,80)},
    },

    "border": {
        "color": (139, 0, 0),
        "width": 3,
    },

    "badge": {
        "x_ratio": 0.72,
        "y_ratio": 0.21,
        "width_ratio": 0.24,
        "height_ratio": 0.45,
        "text": "MAHARASHTRA",
        "bg_color": (240, 240, 240),
        "text_color": (139, 0, 0),
        "font_size": 11,
    },
}
