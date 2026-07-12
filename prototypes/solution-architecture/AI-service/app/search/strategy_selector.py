import logging
from dataclasses import dataclass

from app.search.input_classifier import InputType

logger = logging.getLogger(__name__)


@dataclass
class SearchStrategy:
    bm25_weight: float
    semantic_weight: float
    rrf_k: int
    skip_search: bool = False


class StrategySelector:
    """
    Selects BM25/semantic weights based on the classified input type.
    All weight values are read from config — none are hardcoded here.
    """

    def select(self, input_type: InputType, config) -> SearchStrategy:
        if input_type == InputType.GARBAGE:
            return SearchStrategy(bm25_weight=0.0, semantic_weight=0.0,
                                  rrf_k=config.rrf_k, skip_search=True)

        if input_type == InputType.EXACT_ERROR_CODE:
            return SearchStrategy(
                bm25_weight=config.bm25_weight_exact_code,
                semantic_weight=config.semantic_weight_exact_code,
                rrf_k=config.rrf_k,
            )

        if input_type == InputType.MIXED:
            return SearchStrategy(
                bm25_weight=config.bm25_weight_mixed,
                semantic_weight=config.semantic_weight_mixed,
                rrf_k=config.rrf_k,
            )

        # NATURAL_LANGUAGE (default)
        return SearchStrategy(
            bm25_weight=config.bm25_weight_natural,
            semantic_weight=config.semantic_weight_natural,
            rrf_k=config.rrf_k,
        )
