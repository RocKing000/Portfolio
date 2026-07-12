"""
utils.py

Shared utility functions used across calculators.
"""


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp value to [lo, hi]."""
    return max(lo, min(hi, value))


def dependency_to_weight(level: str) -> float:
    """
    Convert categorical dependency level to numeric weight.

    low    → 0.3  (limited supply chain exposure)
    medium → 0.6  (moderate multi-tier exposure)
    high   → 0.9  (deep, cross-sector dependency)
    """
    mapping = {
        "low":    0.3,
        "medium": 0.6,
        "high":   0.9,
    }
    if level not in mapping:
        raise ValueError(f"Unknown dependency level '{level}'. Must be: low, medium, high.")
    return mapping[level]


def policy_multiplier(policy: str) -> float:
    """
    Policy response moderates final risk.

    none     → no mitigation, score unchanged
    moderate → partial buffer applied
    high     → strong institutional response, score reduced
    """
    mapping = {
        "none":     1.00,
        "moderate": 0.90,
        "high":     0.75,
    }
    return mapping.get(policy, 1.00)


def format_score_label(score: float) -> str:
    """Return human-readable tier label for a 0–100 score."""
    if score >= 75:
        return "CRITICAL"
    elif score >= 50:
        return "HIGH"
    elif score >= 25:
        return "MODERATE"
    else:
        return "LOW"
