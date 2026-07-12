from __future__ import annotations

from typing import Any, TypedDict, Annotated
import operator


class Component1State(TypedDict, total=False):
    """Shared state flowing through the Component 1 LangGraph graph."""

    # Session context
    session_id: str
    project_id: str
    iteration: int

    # Client inputs
    raw_data_source: dict[str, Any]       # Excel path or DB connection params
    expected_outcome: str                  # Free-text from client

    # Research layer outputs
    schema_map: dict[str, Any]
    data_quality_report: dict[str, Any]
    raw_data_inventory: dict[str, Any]
    entity_map: dict[str, Any]
    business_term_glossary: list[dict]
    semantic_uncertainty_report: dict[str, Any]
    goal_hierarchy: dict[str, Any]
    success_criteria: list[dict]
    constraint_inference: list[dict]
    coverage_map: dict[str, Any]
    conflict_report: list[dict]
    assumption_log: list[dict]
    research_summary: dict[str, Any]

    # Gate 1 result
    gate1_approved: bool
    gate1_corrections: list[dict]

    # Implementation layer outputs
    raw_requirements: list[dict]
    structured_requirements: list[dict]
    priority_ranking: list[dict]
    traceability_matrix: list[dict]
    auto_resolved_conflicts: list[dict]
    unresolved_conflicts: list[dict]
    translated_output: dict[str, Any]

    # Gate results
    gate2_approved: bool
    gate3_approved: bool
    gate4_approved: bool

    # Final output
    requirements_package: dict[str, Any]
    requirements_package_minio_key: str

    # Error / SafeMode
    errors: Annotated[list[str], operator.add]
    safe_mode: bool
    current_agent: str
