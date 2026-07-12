"""
KYCConfig — all KYC-specific thresholds and constants in one place.

Single Responsibility: own every tunable parameter for the KYC plugin.
Nothing in the KYC plugin hardcodes a numeric value — it reads from here.
"""


class KYCConfig:
    """KYC plugin configuration constants."""

    # ------------------------------------------------------------------
    # Image quality
    # ------------------------------------------------------------------
    BLUR_THRESHOLD: float = 40.0        # Laplacian variance below this → blurry

    # ------------------------------------------------------------------
    # Document detection
    # ------------------------------------------------------------------
    MIN_DOC_AREA_RATIO: float = 0.015   # minimum fraction of image area
    DOC_ASPECT_RATIO_MIN: float = 0.8   # width / height lower bound
    DOC_ASPECT_RATIO_MAX: float = 3.5   # width / height upper bound
    CENTER_BIAS_RATIO: float = 0.60     # document centroid must be within
                                        # this fraction of image centre region
    CANNY_LOW: int = 8
    CANNY_HIGH: int = 40
    CONTOUR_APPROX_EPSILON: float = 0.04

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------
    CLASSIFIER_THRESHOLD: float = 0.70  # minimum confidence to trust model
    CLASSIFIER_MODEL_NAME: str = "mobilenetv2_document"
    CLASSIFIER_INPUT_SIZE: tuple = (224, 224)
    SUPPORTED_CLASSES: tuple = ("aadhaar", "pan", "passport", "driving_license", "unknown")

    # ------------------------------------------------------------------
    # OCR
    # ------------------------------------------------------------------
    OCR_LANGUAGES: list = ["en", "hi"]
    OCR_CONFIDENCE_MIN: float = 0.50

    # ------------------------------------------------------------------
    # Aadhaar masking
    # ------------------------------------------------------------------
    AADHAAR_MASK_FROM_DIGIT: int = 8    # mask from the 8th digit (leaves last 4 visible)
    DIGIT_MASK_BLUR_KERNEL: int = 23
    DIGIT_MASK_BLUR_SIGMA: int = 30

    # ------------------------------------------------------------------
    # Face detection
    # ------------------------------------------------------------------
    FACE_CONFIDENCE_MIN: float = 0.95
    FACE_AREA_MIN: float = 0.02         # face bbox area / image area
    FACE_AREA_MAX: float = 0.80

    # ------------------------------------------------------------------
    # Liveness
    # ------------------------------------------------------------------
    LIVENESS_FRAMES_MIN: int = 10
    LIVENESS_MOTION_THRESHOLD: float = 0.5
    BLINK_EAR_THRESHOLD: float = 0.25   # Eye Aspect Ratio threshold
    BLINK_CONSECUTIVE_FRAMES: int = 2
    TURN_NOSE_X_SHIFT_PX: int = 20
    NOD_NOSE_Y_SHIFT_PX: int = 15
    SMILE_MOUTH_INCREASE_PCT: float = 0.15
    ACTIVE_CHALLENGES: list = ["blink", "smile", "turn_left", "turn_right", "nod"]

    # ------------------------------------------------------------------
    # Face matching
    # ------------------------------------------------------------------
    FACE_MATCH_THRESHOLD: float = 0.60
    FACE_MATCH_HIGH_CONFIDENCE: float = 0.80
    FACE_EMBEDDING_DIM: int = 512
    FACE_MODEL_NAME: str = "buffalo_l"
