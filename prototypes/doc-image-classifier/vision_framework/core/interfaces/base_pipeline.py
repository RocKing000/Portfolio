"""
BasePipeline — abstract contract for all processing pipelines.

Single Responsibility: declare the ordered sequence of steps that together
accomplish one end-to-end use-case workflow.
The PipelineEngine (core) drives execution; the pipeline only defines steps.

Implements the early-exit pattern: required steps that fail halt the pipeline.
"""

from abc import ABC, abstractmethod
from typing import Any, List, Tuple, Callable


class BasePipeline(ABC):
    """
    Abstract base for all pipelines.

    A pipeline is a pure declaration of steps — it does NOT execute them.
    Execution, timing, error handling, and logging are handled by PipelineEngine.

    Each step is a 3-tuple: (step_name, callable, is_required).
      step_name   — unique label used in logging and result keys.
      callable    — fn(input_data, previous_results) -> dict with 'success' key.
      is_required — if True and step returns success=False, pipeline halts.
    """

    @abstractmethod
    def get_steps(self) -> List[Tuple[str, Callable, bool]]:
        """
        Return the ordered list of pipeline steps.

        Returns
        -------
        List of (step_name: str, step_fn: Callable, is_required: bool).
        """

    @abstractmethod
    def execute(self, input_data: Any) -> dict:
        """
        Execute the pipeline against *input_data*.

        Implementations typically delegate to PipelineEngine.run().

        Parameters
        ----------
        input_data:
            Raw input (e.g. numpy image array, file path, bytes).

        Returns
        -------
        dict with keys:
            success         : bool   — True if all required steps passed.
            failed_at_step  : str    — Name of the step that caused failure, or None.
            result          : dict   — Accumulated step results keyed by step_name.
            step_times      : dict   — Execution time (ms) per step.
            total_time_ms   : float  — Total wall-clock time in milliseconds.
        """
