"""
calculators/temporal.py

Computes the Temporal Factor — how timing affects risk severity.

Formula:
    temporal_factor = (1 / (1 + time_to_impact)) * (recovery_time / 30)

Components:
    onset_urgency  = 1 / (1 + time_to_impact)
        — approaches 1 when time_to_impact → 0 (immediate)
        — approaches 0 for far-future events
        — NOTE: time_to_impact is in days

    recovery_weight = recovery_time / 30
        — normalized to a 30-day baseline
        — longer recovery = sustained higher risk
        — e.g. 30 days → 1.0, 90 days → 3.0, 180 days → 6.0

Result: unbounded above 1.0 for long recoveries — this is intentional.
        The final score formula absorbs this via the risk_score calculation.
"""

from scoring_engine.utils import clamp


RECOVERY_BASELINE_DAYS = 30   # reference point for normalization


def compute_temporal(
    time_to_impact: int,
    recovery_time: int,
) -> tuple[float, dict]:
    """
    Compute the temporal factor.

    Args:
        time_to_impact:  days until the event hits (0 = immediate)
        recovery_time:   days until full recovery

    Returns:
        temporal_factor  — float (>0, can exceed 1.0 for long recoveries)
        detail           — intermediate values for explainability
    """
    # Onset urgency: higher when event is imminent
    onset_urgency = 1.0 / (1.0 + time_to_impact)

    # Recovery weight: normalized to 30-day baseline
    recovery_weight = recovery_time / RECOVERY_BASELINE_DAYS

    temporal_factor = onset_urgency * recovery_weight

    detail = {
        "time_to_impact_days":    time_to_impact,
        "recovery_time_days":     recovery_time,
        "onset_urgency":          round(onset_urgency, 4),
        "recovery_weight":        round(recovery_weight, 4),
        "temporal_factor":        round(temporal_factor, 4),
        "urgency_interpretation": (
            "Immediate — no preparation window."
            if time_to_impact == 0
            else "Near-term — minimal preparation buffer."
            if time_to_impact < 30
            else "Medium-term — some preparation time available."
            if time_to_impact < 90
            else "Long-term — significant lead time available."
        ),
        "recovery_interpretation": (
            "Short recovery — disruption contained."
            if recovery_time < 30
            else "Moderate recovery — extended disruption."
            if recovery_time < 90
            else "Long recovery — sustained systemic impact."
        ),
    }

    return temporal_factor, detail
