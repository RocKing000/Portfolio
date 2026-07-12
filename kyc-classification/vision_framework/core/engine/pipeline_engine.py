"""
PipelineEngine — the core orchestrator for any BasePipeline.

Single Responsibility: execute an ordered sequence of pipeline steps with
timing, structured error handling, and early-exit on required-step failure.
This class has ZERO knowledge of any use case or plugin.
"""

import logging
import time
from typing import Any

from vision_framework.core.interfaces.base_pipeline import BasePipeline

logger = logging.getLogger(__name__)


class PipelineEngine:
    """
    Drives execution of any pipeline that implements BasePipeline.

    Responsibilities:
      - Iterate over steps returned by pipeline.get_steps().
      - Time each step individually.
      - On required-step failure: capture partial results and return early.
      - On exception: capture the traceback and return a structured error.
      - Never raise; always return a dict.
    """

    def run(self, pipeline: BasePipeline, input_data: Any) -> dict:
        """
        Execute *pipeline* against *input_data*.

        Parameters
        ----------
        pipeline:
            Any concrete BasePipeline implementation.
        input_data:
            Raw input forwarded to the first step.

        Returns
        -------
        dict with keys:
            success         : bool
            failed_at_step  : str | None
            reason          : str | None
            result          : dict          — Accumulated step results.
            step_times      : dict          — ms per step.
            total_time_ms   : float
        """
        accumulated: dict = {}
        step_times: dict = {}

        logger.info("PipelineEngine starting pipeline: %s", type(pipeline).__name__)

        for step_name, step_fn, is_required in pipeline.get_steps():
            start = time.perf_counter()
            try:
                step_result = step_fn(input_data, accumulated)
            except Exception as exc:
                elapsed_ms = (time.perf_counter() - start) * 1000
                step_times[step_name] = round(elapsed_ms, 3)
                logger.exception("Step '%s' raised an unhandled exception.", step_name)
                return {
                    "success": False,
                    "failed_at_step": step_name,
                    "reason": f"Unhandled exception: {exc}",
                    "error": str(exc),
                    "result": accumulated,
                    "step_times": step_times,
                    "total_time_ms": round(sum(step_times.values()), 3),
                }

            elapsed_ms = (time.perf_counter() - start) * 1000
            step_times[step_name] = round(elapsed_ms, 3)

            step_success = step_result.get("success", False)
            step_message = step_result.get("message", "")

            logger.info(
                "Step '%s': success=%s, time=%.1f ms — %s",
                step_name,
                step_success,
                elapsed_ms,
                step_message,
            )

            accumulated[step_name] = step_result

            if not step_success and is_required:
                logger.warning(
                    "Required step '%s' failed. Triggering early exit.", step_name
                )
                return {
                    "success": False,
                    "failed_at_step": step_name,
                    "reason": step_message,
                    "result": accumulated,
                    "step_times": step_times,
                    "total_time_ms": round(sum(step_times.values()), 3),
                }

        total_ms = round(sum(step_times.values()), 3)
        logger.info(
            "Pipeline completed successfully in %.1f ms.", total_ms
        )
        return {
            "success": True,
            "failed_at_step": None,
            "reason": None,
            "result": accumulated,
            "step_times": step_times,
            "total_time_ms": total_ms,
        }
