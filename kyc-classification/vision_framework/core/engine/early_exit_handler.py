"""
EarlyExitHandler — utility for constructing early-exit pipeline responses.

Single Responsibility: provide a canonical factory for early-exit result dicts
so that every pipeline returns exactly the same envelope shape on failure.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class EarlyExitHandler:
    """
    Factory for standardised early-exit pipeline responses.

    Rather than scattering dict literals across pipeline steps, callers use
    this class to ensure consistent key names, types, and log output.
    """

    @staticmethod
    def make_failure(
        step_name: str,
        reason: str,
        partial_results: Optional[dict] = None,
        step_times: Optional[dict] = None,
    ) -> dict:
        """
        Create a structured failure response for an early-exit event.

        Parameters
        ----------
        step_name:
            Name of the pipeline step that triggered the exit.
        reason:
            Human-readable explanation of why the step failed.
        partial_results:
            Results accumulated before the failure (may be empty).
        step_times:
            Timing data accumulated before the failure.

        Returns
        -------
        dict matching the BasePipeline.execute() output contract.
        """
        logger.warning("EarlyExit at step '%s': %s", step_name, reason)
        return {
            "success": False,
            "failed_at_step": step_name,
            "reason": reason,
            "result": partial_results or {},
            "step_times": step_times or {},
            "total_time_ms": round(sum((step_times or {}).values()), 3),
        }

    @staticmethod
    def make_success(
        result: dict,
        step_times: dict,
    ) -> dict:
        """
        Create a standardised success response.

        Parameters
        ----------
        result:
            Accumulated step results keyed by step_name.
        step_times:
            Timing dict keyed by step_name.

        Returns
        -------
        dict matching the BasePipeline.execute() output contract.
        """
        total_ms = round(sum(step_times.values()), 3)
        logger.info("Pipeline completed successfully in %.1f ms.", total_ms)
        return {
            "success": True,
            "failed_at_step": None,
            "reason": None,
            "result": result,
            "step_times": step_times,
            "total_time_ms": total_ms,
        }

    @staticmethod
    def step_failed(step_result: dict, is_required: bool) -> bool:
        """
        Return True if *step_result* represents a failure that should exit.

        Parameters
        ----------
        step_result:
            The dict returned by a pipeline step.
        is_required:
            Whether the step is required (non-required failures are ignored).
        """
        return is_required and not step_result.get("success", False)
