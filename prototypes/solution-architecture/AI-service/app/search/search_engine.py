"""
HybridSearchEngine — dynamic, self-adapting hybrid search.
Phases: classify → clean → correct → expand → strategy → execute → merge → gate → diagnose
"""
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from rapidfuzz import fuzz, process as rfprocess

from app.search.input_classifier import InputClassifier, InputType, InputClassification
from app.search.query_processor import QueryProcessor, TypoResult, ExpansionResult
from app.search.strategy_selector import StrategySelector, SearchStrategy

logger = logging.getLogger(__name__)


class HybridSearchEngine:
    def __init__(self, config):
        self._config = config
        self._classifier = InputClassifier()
        self._processor = QueryProcessor(typo_threshold=config.typo_correction_threshold)
        self._selector = StrategySelector()

        # Set at index time
        self._errors_data: List[Dict[str, Any]] = []
        self._error_ids: List[str] = []
        self._corpus: List[str] = []          # for BM25
        self._embeddings: Optional[np.ndarray] = None
        self._bm25 = None

        # Lookup dicts built at index time
        self._code_to_error: Dict[str, dict] = {}   # upper-code → error dict
        self._synonyms: Dict[str, List[str]] = {}   # term → [synonym, ...]
        self._kb_corpus_flat: List[str] = []        # for typo correction

        # Per-request state (set before each search call)
        self._query_embedding: Optional[np.ndarray] = None

    # ──────────────────────────────────────────────────────────────────────────
    # Indexing
    # ──────────────────────────────────────────────────────────────────────────

    def index(
        self,
        errors: List[Dict[str, Any]],
        embeddings: Optional[np.ndarray],
        bm25_index,
        synonyms: Dict[str, List[str]],
    ) -> None:
        self._errors_data = errors
        self._error_ids = [e['error_id'] for e in errors]
        self._embeddings = embeddings
        self._bm25 = bm25_index
        self._synonyms = synonyms

        # Build BM25 corpus: title + description + tags + error_code
        self._corpus = [
            ' '.join(filter(None, [
                e.get('error_title', ''),
                e.get('error_description', ''),
                e.get('solution', ''),
                e.get('category', ''),
                e.get('error_code', ''),
            ]))
            for e in errors
        ]

        # Build code→error lookup
        self._code_to_error = {
            e['error_code'].upper(): e
            for e in errors if e.get('error_code')
        }

        # Flat KB corpus for typo correction
        titles = [e.get('error_title', '') for e in errors]
        codes = [e.get('error_code', '') for e in errors]
        tags_raw = [e.get('auto_keywords') for e in errors]
        tags_flat: List[str] = []
        for t in tags_raw:
            if isinstance(t, list):
                tags_flat.extend(t)
            elif isinstance(t, str) and t:
                tags_flat.extend(t.split(','))

        self._kb_corpus_flat = list(set(filter(None, titles + codes + tags_flat)))
        self._processor.set_kb_corpus(self._kb_corpus_flat)
        self._classifier.build_patterns_from_kb(codes)

        logger.info(
            f"HybridSearchEngine indexed {len(errors)} errors; "
            f"embeddings={'yes' if embeddings is not None else 'no'}; "
            f"bm25={'yes' if bm25_index is not None else 'no'}"
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Public search entry point
    # ──────────────────────────────────────────────────────────────────────────

    def search(self, raw_query: str, top_n: int = 5) -> Dict[str, Any]:
        t0 = time.time()
        raw_query = raw_query or ""

        # PHASE 1 — classify
        classification: InputClassification = self._classifier.classify(raw_query)

        # PHASE 2 — clean
        processed_query = self._processor.clean(raw_query)

        # PHASE 3 — typo correct (on processed_query, not expanded)
        typo_result: TypoResult = self._processor.correct_typos(processed_query)
        corrected_query = typo_result.corrected_query

        # PHASE 4 — expand (for BM25 only; semantic uses corrected_query)
        expansion_result: ExpansionResult = self._processor.expand(
            corrected_query,
            self._synonyms,
            extracted_codes=classification.extracted_codes,
            error_lookup=self._code_to_error,
        )
        expanded_query = expansion_result.expanded_query

        # PHASE 5 — strategy
        strategy: SearchStrategy = self._selector.select(classification.input_type, self._config)

        arms_executed: List[str] = []
        arms_failed: List[str] = []
        bm25_results: List[Tuple[str, float]] = []
        semantic_results: List[Tuple[str, float]] = []

        if strategy.skip_search:
            results: List[Tuple[str, float]] = []
        else:
            # PHASE 6 — execute arms
            # BM25 arm
            bm25_weight = strategy.bm25_weight
            if self._bm25 is not None and bm25_weight > 0:
                try:
                    bm25_results = self._run_bm25(expanded_query, top_n * 2)
                    arms_executed.append("BM25")
                except Exception as e:
                    arms_failed.append(f"BM25: {e}")
                    bm25_weight = 0.0
            else:
                reason = "index_empty" if self._bm25 is None else "weight_zero"
                arms_failed.append(f"BM25: {reason}")
                bm25_weight = 0.0

            # Semantic arm
            sem_weight = strategy.semantic_weight
            if self._embeddings is not None and sem_weight > 0:
                try:
                    semantic_results = self._run_semantic(corrected_query, top_n * 2)
                    arms_executed.append("SEMANTIC")
                except Exception as e:
                    arms_failed.append(f"SEMANTIC: {e}")
                    sem_weight = 0.0
            else:
                reason = "model_not_loaded" if self._embeddings is None else "weight_zero"
                arms_failed.append(f"SEMANTIC: {reason}")
                sem_weight = 0.0

            # If one arm failed, give full weight to the surviving arm
            total_weight = bm25_weight + sem_weight
            if total_weight > 0 and (bm25_weight == 0 or sem_weight == 0):
                if bm25_weight > 0:
                    bm25_weight = 1.0
                    sem_weight = 0.0
                else:
                    bm25_weight = 0.0
                    sem_weight = 1.0

            # PHASE 7 — RRF merge
            results = self._rrf_merge(
                bm25_results, bm25_weight,
                semantic_results, sem_weight,
                strategy.rrf_k, top_n,
            )

        # PHASE 8 — confidence gate
        no_match = False
        no_match_reason: Optional[str] = None
        low_confidence = False

        if strategy.skip_search:
            no_match = True
            no_match_reason = "input_garbage"
        elif not self._errors_data:
            no_match = True
            no_match_reason = "index_empty"
        elif not results:
            no_match = True
            no_match_reason = "no_results"
        elif results[0][1] < self._config.min_confidence_threshold:
            no_match = True
            no_match_reason = "below_threshold"
            low_confidence = True
        elif all(score < self._config.min_confidence_threshold * 3 for _, score in results):
            low_confidence = True

        # PHASE 9 — build diagnostic
        elapsed_ms = (time.time() - t0) * 1000
        diagnostic = {
            "raw_query": raw_query,
            "processed_query": processed_query,
            "corrected_query": corrected_query,
            "expanded_query": expanded_query,
            "input_type": classification.input_type.value,
            "corrections": [
                {"original": c.original, "corrected": c.corrected, "confidence": c.confidence}
                for c in typo_result.corrections
            ],
            "expansions": [
                {"term": e.term, "expanded_to": e.expanded_to}
                for e in expansion_result.expansions
            ],
            "arms_executed": arms_executed,
            "arms_failed": arms_failed,
            "bm25_weight": strategy.bm25_weight,
            "semantic_weight": strategy.semantic_weight,
            "rrf_k": strategy.rrf_k,
            "total_candidates": len(self._errors_data),
            "results_returned": 0 if no_match else len(results),
            "low_confidence": low_confidence,
            "no_match": no_match,
            "no_match_reason": no_match_reason,
            "processing_ms": round(elapsed_ms, 2),
        }

        # PHASE 10 — suggestions on no_match
        suggestions = None
        if no_match:
            suggestions = self._build_suggestions(raw_query, processed_query)

        return {
            "results": [] if no_match else results,
            "diagnostic": diagnostic,
            "suggestions": suggestions,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Search arms
    # ──────────────────────────────────────────────────────────────────────────

    def _run_bm25(self, query: str, top_k: int) -> List[Tuple[str, float]]:
        tokenized = query.lower().split()
        scores = self._bm25.get_scores(tokenized)
        top_indices = np.argsort(scores)[::-1][:top_k]
        max_score = float(scores[top_indices[0]]) if len(top_indices) > 0 else 1.0
        if max_score == 0:
            return []
        return [
            (self._error_ids[i], float(scores[i] / max_score))
            for i in top_indices
            if scores[i] > 0
        ]

    def _run_semantic(self, query: str, top_k: int) -> List[Tuple[str, float]]:
        # embeddings matrix already loaded; model is passed separately for encoding
        # We use the pre-computed matrix — query encoding must be injected externally
        # via encode_query() before calling search() when using async wrapper
        if self._query_embedding is None:
            raise RuntimeError("query_embedding not set — call set_query_embedding() first")
        sims = np.dot(self._embeddings, self._query_embedding)
        top_indices = np.argsort(sims)[::-1][:top_k]
        return [
            (self._error_ids[i], float(sims[i]))
            for i in top_indices
            if sims[i] >= self._config.similarity_threshold
        ]

    # ──────────────────────────────────────────────────────────────────────────
    # RRF merge
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _rrf_merge(
        bm25_results: List[Tuple[str, float]],
        bm25_weight: float,
        semantic_results: List[Tuple[str, float]],
        semantic_weight: float,
        k: int,
        top_n: int,
    ) -> List[Tuple[str, float]]:
        scores: Dict[str, float] = {}
        for rank, (eid, _) in enumerate(bm25_results):
            scores[eid] = scores.get(eid, 0.0) + bm25_weight / (k + rank + 1)
        for rank, (eid, _) in enumerate(semantic_results):
            scores[eid] = scores.get(eid, 0.0) + semantic_weight / (k + rank + 1)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

    # ──────────────────────────────────────────────────────────────────────────
    # Suggestions for no_match
    # ──────────────────────────────────────────────────────────────────────────

    def _build_suggestions(self, raw_query: str, processed_query: str) -> Dict[str, Any]:
        limit = self._config.did_you_mean_limit
        kw_limit = self._config.try_keywords_limit

        # did_you_mean: fuzzy match raw_query against all error titles
        titles = [e.get('error_title', '') for e in self._errors_data if e.get('error_title')]
        did_you_mean: List[str] = []
        if titles:
            matches = rfprocess.extract(
                raw_query, titles,
                scorer=fuzz.token_sort_ratio,
                limit=limit,
                score_cutoff=30,
            )
            did_you_mean = [m[0] for m in matches]

        # try_keywords: tokenise + filter stopwords
        try_keywords = self._extract_keywords(processed_query, kw_limit)

        return {
            "did_you_mean": did_you_mean,
            "try_keywords": try_keywords,
            "input_received": processed_query,
        }

    def _extract_keywords(self, query: str, limit: int) -> List[str]:
        _STOPWORDS = {
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
            'and', 'or', 'but', 'not', 'my', 'i', 'me', 'it', 'its',
            'this', 'that', 'get', 'got', 'what', 'when', 'how', 'why',
        }
        tokens = query.lower().split()
        keywords = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]
        return keywords[:limit]

    def set_query_embedding(self, emb: Optional[np.ndarray]) -> None:
        self._query_embedding = emb

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    def get_error_by_id(self, error_id: str) -> Optional[Dict[str, Any]]:
        for e in self._errors_data:
            if e.get('error_id') == error_id:
                return e
        return None

    @property
    def errors_data(self) -> List[Dict[str, Any]]:
        return self._errors_data
