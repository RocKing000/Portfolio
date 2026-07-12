from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# =============================================================================
# REQUEST MODELS
# =============================================================================

class SearchRequest(BaseModel):
    """Enhanced search request with validation"""
    query: str = Field(..., min_length=3, max_length=500, description="Search query")
    tenant_code: str = Field(..., min_length=1, max_length=50, description="Tenant code")
    max_results: int = Field(default=5, ge=1, le=50, description="Maximum results to return")
    search_method: Optional[str] = Field(default="HYBRID", max_length=50, description="Search algorithm to use")

    @validator('query')
    def sanitize_query(cls, v):
        """Sanitize query string"""
        # Remove leading/trailing whitespace
        v = v.strip()

        # Normalize multiple spaces to single space
        import re
        v = re.sub(r'\s+', ' ', v)

        # Remove potential SQL injection patterns (basic sanitization)
        dangerous_patterns = [';', '--', '/*', '*/', 'xp_', 'sp_', 'exec', 'execute']
        v_lower = v.lower()
        for pattern in dangerous_patterns:
            if pattern in v_lower:
                raise ValueError(f"Invalid characters in query: {pattern}")

        return v

# =============================================================================
# RESPONSE MODELS
# =============================================================================

class ErrorResult(BaseModel):
    """Enhanced error result with ML metrics"""
    error_id: str
    error_code: str
    error_title: str
    error_description: str
    solution: str
    root_cause: Optional[str] = None
    severity: str  # DB validates: LOW, MEDIUM, HIGH, CRITICAL
    category: str
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Semantic similarity score")
    module_name: Optional[str] = None
    product_name: Optional[str] = None

    # ML/Analytics fields
    auto_keywords: Optional[List[str]] = Field(default=None, description="Auto-extracted keywords (JSON from DB)")
    search_impressions: int = Field(default=0, description="Times appeared in search results")
    search_clicks: int = Field(default=0, description="Times clicked by users")
    click_through_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="CTR = clicks/impressions")
    avg_result_position: Optional[float] = Field(default=None, description="Average ranking position")

class SearchResponse(BaseModel):
    """Enhanced search response with metadata"""
    success: bool
    results: List[ErrorResult]
    query: str
    total_results: int
    processing_time_ms: float
    cached: bool = False
    search_method: str = "HYBRID"

    # Additional metadata
    query_expansion_used: bool = Field(default=False, description="Whether query was expanded")
    expanded_terms: Optional[List[str]] = Field(default=None, description="Terms added to query")
    reranked: bool = Field(default=False, description="Whether results were reranked")

    # Dynamic search diagnostics (always present)
    search_diagnostic: Optional["SearchDiagnostic"] = None
    suggestions: Optional["SearchSuggestions"] = None

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    database: str
    redis: str
    version: str
    embedding_model_version: Optional[str] = None
    total_errors_indexed: Optional[int] = None

# =============================================================================
# KEYWORD EXTRACTION MODELS
# =============================================================================

class KeywordExtractionResult(BaseModel):
    """Result from keyword extraction"""
    keyword: str = Field(..., min_length=1, max_length=200)
    confidence: float = Field(..., ge=0.0, le=1.0)
    method: str = Field(..., max_length=50, description="Extraction method (DB will validate)")

class AutoKeywordResponse(BaseModel):
    """Response from auto-keyword extraction"""
    error_id: str
    keywords_extracted: int
    keywords: List[KeywordExtractionResult]
    processing_time_ms: float

# =============================================================================
# SEARCH LOGGING MODELS
# =============================================================================

class SearchLog(BaseModel):
    """Search log entry"""
    query_text: str = Field(..., max_length=500)
    tenant_code: str = Field(..., max_length=50)
    selected_error_id: Optional[str] = None
    result_position: Optional[int] = Field(default=None, ge=1)
    search_method: str = Field(default="HYBRID", max_length=50)
    total_results: int = Field(default=0, ge=0)
    processing_time_ms: Optional[float] = Field(default=None, ge=0.0)
    user_id: Optional[str] = None
    session_id: Optional[str] = Field(default=None, max_length=100)

class SearchLogResponse(BaseModel):
    """Response after logging search"""
    logged: bool
    log_id: Optional[int] = None
    message: str

# =============================================================================
# TRAINING DATA MODELS
# =============================================================================

class TrainingDataPoint(BaseModel):
    """Single training data point for ML"""
    query_text: str = Field(..., max_length=500)
    correct_error_id: str
    incorrect_error_ids: Optional[List[str]] = Field(default=None, description="Hard negatives (JSON)")
    relevance_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    data_source: str = Field(default="SEARCH_LOG", max_length=50, description="DB validates valid sources")

class TrainingDataBatch(BaseModel):
    """Batch of training data points"""
    data_points: List[TrainingDataPoint]
    total_count: int
    source_filter: Optional[str] = None
    date_range: Optional[Dict[str, str]] = None

# =============================================================================
# SYNONYM MODELS
# =============================================================================

class SynonymMapping(BaseModel):
    """Synonym mapping entry"""
    primary_term: str = Field(..., max_length=200)
    synonym_term: str = Field(..., max_length=200)
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    auto_discovered: bool = False
    discovery_method: Optional[str] = Field(default=None, max_length=50)

class SynonymResponse(BaseModel):
    """Response for synonym operations"""
    primary_term: str
    synonyms: List[str]
    count: int

# =============================================================================
# MODEL VERSION MODELS
# =============================================================================

class ModelVersion(BaseModel):
    """ML model version entry"""
    version_id: str
    version_name: str = Field(..., max_length=100)
    model_type: str = Field(..., max_length=50, description="DB validates: EMBEDDING, RERANKER, etc.")
    model_identifier: str = Field(..., max_length=200, description="e.g., 'all-MiniLM-L6-v2'")
    is_active: bool
    deployment_date: datetime
    deprecated_date: Optional[datetime] = None
    performance_metrics: Optional[Dict[str, Any]] = None  # JSON from DB
    config_params: Optional[Dict[str, Any]] = None  # JSON from DB

class ModelVersionResponse(BaseModel):
    """Response for model version queries"""
    active_models: List[ModelVersion]
    total_versions: int

# =============================================================================
# ANALYTICS MODELS
# =============================================================================

class SearchAnalytics(BaseModel):
    """Search analytics for an error"""
    error_id: str
    error_code: str
    error_title: str
    severity: str
    category: str
    search_impressions: int
    search_clicks: int
    click_through_rate: float
    avg_result_position: Optional[float]
    performance_category: str  # From DB view: NO_TRAFFIC, LOW_CTR, MEDIUM_CTR, HIGH_CTR

class TopQuery(BaseModel):
    """Top searched query"""
    query_text: str
    tenant_code: str
    query_count: int
    unique_sessions: int
    avg_processing_time: float
    avg_results: float
    click_count: int
    click_rate: float
    last_searched: datetime

class AnalyticsSummary(BaseModel):
    """Overall analytics summary"""
    total_searches: int
    unique_queries: int
    avg_results_per_query: float
    avg_processing_time_ms: float
    overall_click_rate: float
    top_queries: List[TopQuery]
    date_range: Dict[str, str]

# =============================================================================
# EMBEDDING MODELS
# =============================================================================

class EmbeddingRequest(BaseModel):
    """Request to generate embeddings"""
    texts: List[str] = Field(..., min_items=1, max_items=100)
    model_version: Optional[str] = None

class EmbeddingResponse(BaseModel):
    """Response with embeddings"""
    embeddings: List[List[float]]
    model_version: str
    dimensions: int
    processing_time_ms: float

class EmbeddingBatchUpdate(BaseModel):
    """Batch update of embeddings"""
    error_ids: List[str]
    success_count: int
    failed_count: int
    processing_time_ms: float
    errors: Optional[List[str]] = None

# =============================================================================
# QUERY EXPANSION MODELS
# =============================================================================

class QueryExpansion(BaseModel):
    """Query expansion entry"""
    original_query: str = Field(..., max_length=500)
    expanded_terms: List[str]  # JSON from DB
    expansion_method: str = Field(default="SYNONYM", max_length=50)
    improvement_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class QueryExpansionResponse(BaseModel):
    """Response from query expansion"""
    original_query: str
    expanded_query: str
    added_terms: List[str]
    method: str
    cached: bool = False


# =============================================================================
# DYNAMIC SEARCH DIAGNOSTIC MODELS
# =============================================================================

class CorrectionEntry(BaseModel):
    original: str
    corrected: str
    confidence: float

class ExpansionEntry(BaseModel):
    term: str
    expanded_to: List[str]

class SearchDiagnostic(BaseModel):
    raw_query: str
    processed_query: str
    corrected_query: str
    expanded_query: str
    input_type: str                        # InputType enum value
    corrections: List[CorrectionEntry] = Field(default_factory=list)
    expansions: List[ExpansionEntry] = Field(default_factory=list)
    arms_executed: List[str] = Field(default_factory=list)
    arms_failed: List[str] = Field(default_factory=list)
    bm25_weight: float
    semantic_weight: float
    rrf_k: int
    total_candidates: int
    results_returned: int
    low_confidence: bool = False
    no_match: bool = False
    no_match_reason: Optional[str] = None
    processing_ms: float

class SearchSuggestions(BaseModel):
    did_you_mean: List[str] = Field(default_factory=list)
    try_keywords: List[str] = Field(default_factory=list)
    input_received: str
