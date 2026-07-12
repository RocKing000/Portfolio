"""
services/validation_engine.py

DIRE-X Scenario Validation Engine — V1

Runs a battery of plausibility, consistency, and business-rule checks on a
raw scenario dict before it is scored and stored.

Design:
    - Validation score starts at 1.0.
    - Each fired check deducts a fixed amount based on severity:
          error   -> -0.30
          warning -> -0.15
          info    -> -0.05
    - Final score is clamped to [0, 1].
    - Status derived from final score:
          >= 0.75  -> "valid"
          >= 0.50  -> "warning"
          <  0.50  -> "invalid"   (pipeline blocks scoring)

Check categories:
    1. Impact balance         — direct / indirect plausibility
    2. Dependency consistency — dep_level vs hidden_pct coherence
    3. Temporal logic         — tti / recovery sanity
    4. Confidence integrity   — conf_score vs manipulation_risk
    5. Extreme values         — sanity on maxed-out fields

Public API:
    validate(scenario_dict) -> ValidationResult
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ValidationFlag:
    code:     str
    severity: str   # "info" | "warning" | "error"
    message:  str
    field:    str = ""


@dataclass
class ValidationResult:
    validation_score:  float
    validation_status: str          # "valid" | "warning" | "invalid"
    flags:             List[ValidationFlag] = field(default_factory=list)
    passed:            bool = True

    def to_dict(self) -> dict:
        return {
            "validation_score":  self.validation_score,
            "validation_status": self.validation_status,
            "flags": [
                {
                    "code":     f.code,
                    "severity": f.severity,
                    "message":  f.message,
                    "field":    f.field,
                }
                for f in self.flags
            ],
            "passed": self.passed,
        }


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class ValidationEngine:
    """
    Stateless validation engine.
    Call validate(scenario_dict) to get a ValidationResult.
    """

    DEDUCTIONS: Dict[str, float] = {
        "error":   0.30,
        "warning": 0.15,
        "info":    0.05,
    }

    def validate(self, scenario: Dict[str, Any]) -> ValidationResult:
        flags: List[ValidationFlag] = []

        self._check_impact_balance(scenario, flags)
        self._check_dependency_consistency(scenario, flags)
        self._check_temporal_logic(scenario, flags)
        self._check_confidence_integrity(scenario, flags)
        self._check_extreme_values(scenario, flags)

        deduction        = sum(self.DEDUCTIONS.get(f.severity, 0.0) for f in flags)
        validation_score = round(max(0.0, min(1.0, 1.0 - deduction)), 4)

        if validation_score >= 0.75:
            status = "valid"
        elif validation_score >= 0.50:
            status = "warning"
        else:
            status = "invalid"

        return ValidationResult(
            validation_score=validation_score,
            validation_status=status,
            flags=flags,
            passed=(status != "invalid"),
        )

    # -----------------------------------------------------------------------
    # Check 1 — Impact balance
    # -----------------------------------------------------------------------

    def _check_impact_balance(self, s: dict, flags: list) -> None:
        direct   = float(s.get("direct_impact_score", 0))
        indirect = float(s.get("indirect_impact_score", 0))

        # Direct extremely high, indirect negligible — unusual for systemic events
        if direct > 85 and indirect < 15:
            flags.append(ValidationFlag(
                code="IMPACT_CHANNEL_IMBALANCE",
                severity="warning",
                message=(
                    f"Direct impact ({direct:.0f}) is extremely high while indirect ({indirect:.0f}) "
                    "is very low. Most high-severity supply chain events have correlated indirect effects."
                ),
                field="direct_impact_score / indirect_impact_score",
            ))

        # Indirect substantially exceeds direct — valid but unusual
        if indirect > direct + 40:
            flags.append(ValidationFlag(
                code="INDIRECT_DOMINANCE",
                severity="info",
                message=(
                    f"Indirect impact ({indirect:.0f}) significantly exceeds direct ({direct:.0f}) "
                    "by more than 40 points. Confirm this reflects genuine second-order amplification."
                ),
                field="indirect_impact_score",
            ))

    # -----------------------------------------------------------------------
    # Check 2 — Dependency consistency
    # -----------------------------------------------------------------------

    def _check_dependency_consistency(self, s: dict, flags: list) -> None:
        dep_level = str(s.get("dependency_level", "")).lower()
        hidden    = float(s.get("hidden_dependency_percentage", 0))

        # Low dependency + high hidden pct — structurally inconsistent
        if dep_level == "low" and hidden > 65:
            flags.append(ValidationFlag(
                code="DEPENDENCY_HIDDEN_INCONSISTENCY",
                severity="warning",
                message=(
                    f"'low' dependency level with {hidden:.0f}% hidden exposure is inconsistent. "
                    "Low dependency implies limited multi-tier entanglement."
                ),
                field="hidden_dependency_percentage",
            ))

        # High dependency + very low hidden pct — likely underreported
        if dep_level == "high" and hidden < 10:
            flags.append(ValidationFlag(
                code="HIDDEN_DEPENDENCY_UNDERREPORTED",
                severity="warning",
                message=(
                    f"'high' dependency level with only {hidden:.0f}% hidden exposure may underreport "
                    "risk. Deep supply chains typically have substantial non-transparent tiers."
                ),
                field="hidden_dependency_percentage",
            ))

    # -----------------------------------------------------------------------
    # Check 3 — Temporal logic
    # -----------------------------------------------------------------------

    def _check_temporal_logic(self, s: dict, flags: list) -> None:
        tti = int(s.get("time_to_impact", 0))
        rt  = int(s.get("recovery_time", 0))

        # Recovery cannot complete before the event has fully materialized
        # (only flagged as error when tti is meaningfully large)
        if tti > 30 and rt < tti:
            flags.append(ValidationFlag(
                code="RECOVERY_BEFORE_IMPACT",
                severity="error",
                message=(
                    f"Recovery time ({rt}d) is shorter than time to impact ({tti}d). "
                    "A scenario cannot fully recover before the disruption has materialized."
                ),
                field="recovery_time",
            ))

        # Very long recovery for a low-severity event
        direct = float(s.get("direct_impact_score", 0))
        if rt > 730 and direct < 40:
            flags.append(ValidationFlag(
                code="DISPROPORTIONATE_RECOVERY",
                severity="warning",
                message=(
                    f"Recovery time of {rt} days is disproportionately long for a scenario "
                    f"with only {direct:.0f} direct impact. Extended recoveries are typical of "
                    "high-impact events."
                ),
                field="recovery_time",
            ))

        # Immediate onset with very long recovery — flag for verification
        if tti == 0 and rt > 365:
            flags.append(ValidationFlag(
                code="IMMEDIATE_ONSET_EXTENDED_RECOVERY",
                severity="info",
                message=(
                    f"Immediate onset (tti=0) with {rt}-day recovery. "
                    "Confirm this reflects a genuine sudden-onset, sustained disruption."
                ),
                field="time_to_impact",
            ))

    # -----------------------------------------------------------------------
    # Check 4 — Confidence integrity
    # -----------------------------------------------------------------------

    def _check_confidence_integrity(self, s: dict, flags: list) -> None:
        conf  = float(s.get("confidence_score", 0))
        manip = str(s.get("manipulation_risk", "")).lower()

        # High confidence + high manipulation — self-contradictory
        if conf > 0.85 and manip == "high":
            flags.append(ValidationFlag(
                code="CONFIDENCE_MANIPULATION_CONFLICT",
                severity="warning",
                message=(
                    f"Confidence score ({conf:.2f}) is high but manipulation risk is 'high'. "
                    "High data reliability is not credible alongside significant manipulation risk."
                ),
                field="confidence_score",
            ))

        # Very low confidence + no manipulation concern — unusual combination
        if conf < 0.20 and manip == "low":
            flags.append(ValidationFlag(
                code="LOW_CONFIDENCE_CLEAN_DATA",
                severity="info",
                message=(
                    f"Very low confidence ({conf:.2f}) with low manipulation risk. "
                    "Verify whether data scarcity or model uncertainty is the primary driver."
                ),
                field="confidence_score",
            ))

    # -----------------------------------------------------------------------
    # Check 5 — Extreme values
    # -----------------------------------------------------------------------

    def _check_extreme_values(self, s: dict, flags: list) -> None:
        direct   = float(s.get("direct_impact_score", 0))
        indirect = float(s.get("indirect_impact_score", 0))
        hidden   = float(s.get("hidden_dependency_percentage", 0))

        # Both impact channels maxed out
        if direct >= 99 and indirect >= 99:
            flags.append(ValidationFlag(
                code="MAXIMUM_IMPACT_VALUES",
                severity="warning",
                message=(
                    "Both impact scores are at or near maximum (>=99). "
                    "Verify this is not a data entry error or placeholder."
                ),
                field="direct_impact_score / indirect_impact_score",
            ))

        # Complete opacity in supply chain
        if hidden >= 100:
            flags.append(ValidationFlag(
                code="COMPLETE_HIDDEN_DEPENDENCY",
                severity="info",
                message=(
                    "100% hidden dependency implies total supply chain opacity. "
                    "Confirm this is intentional and not a default/unset value."
                ),
                field="hidden_dependency_percentage",
            ))


# ---------------------------------------------------------------------------
# Module-level singleton and convenience function
# ---------------------------------------------------------------------------

_engine = ValidationEngine()


def validate(scenario: dict) -> ValidationResult:
    """Validate a raw scenario dict. Returns a ValidationResult."""
    return _engine.validate(scenario)
