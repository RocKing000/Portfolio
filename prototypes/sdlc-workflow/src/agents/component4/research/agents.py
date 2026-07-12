"""Component 4 research layer — 4 agents."""
from __future__ import annotations

import json
from typing import Any

from shared.llm_gateway.base import ModelTier
from shared.base_agent import BaseAgent, AgentContext


class CodebaseAnalysisAgent(BaseAgent):
    """Parses the development package and maps the codebase structure."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        dev_pkg = state.get("development_package", {})
        messages = [{
            "role": "user",
            "content": f"""Analyse the development package and map the codebase for testing.

DEVELOPMENT PACKAGE SUMMARY:
{json.dumps(dev_pkg.get('summary', {}), indent=2)}

TECH STACK: {json.dumps(dev_pkg.get('tech_stack', {}), indent=2)}

Return JSON:
{{
  "codebase_map": {{
    "backend_modules": [{{"name": "", "type": "controller|service|repository", "testable_methods": 0}}],
    "frontend_modules": [{{"name": "", "type": "component|service|pipe", "testable_units": 0}}],
    "database_objects": [{{"name": "", "type": "table|proc|view", "data_complexity": "low|medium|high"}}],
    "integration_points": [{{"name": "", "type": "rest|queue|webhook", "mock_needed": true}}],
    "ai_ml_components": [{{"name": "", "type": "model|pipeline|service"}}]
  }},
  "total_testable_units": 0,
  "complexity_score": 0.0,
  "estimated_test_scenarios_per_track": {{"unit": 0, "integration": 0, "system": 0, "performance": 0, "security": 0}}
}}"""
        }]
        resp = await self.llm_call(messages=messages, model_tier=ModelTier.STANDARD, max_tokens=3000)
        try: result = json.loads(resp.content)
        except: result = {"raw": resp.content}
        return {**state, "codebase_map": result.get("codebase_map", result),
                "estimated_scenarios": result.get("estimated_test_scenarios_per_track", {}),
                "current_agent": "codebase_analysis"}


class TestabilityAnalysisAgent(BaseAgent):
    """Identifies hard-to-test areas and prescribes mocking/stubbing strategies."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [{
            "role": "user",
            "content": f"""Assess testability for each codebase component.

CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}
TECH STACK: {json.dumps(state.get('development_package', {}).get('tech_stack', {}), indent=2)}

Return JSON:
{{
  "testability_map": {{
    "high_testability": ["<component>"],
    "medium_testability": [{{"component": "", "issue": "", "mitigation": ""}}],
    "low_testability": [{{"component": "", "issue": "", "mitigation": "", "skip_if_unfixable": false}}]
  }},
  "mock_registry": [
    {{"dependency": "", "mock_strategy": "in_memory|stub|spy|fake", "applies_to_tracks": []}}
  ],
  "test_data_strategy": {{
    "unit": "builders|fixtures|inline",
    "integration": "test_db|docker_compose|in_memory",
    "system": "seeded_db|contract_data",
    "performance": "generated_load_data",
    "security": "malicious_payloads_library"
  }}
}}"""
        }]
        resp = await self.llm_call(messages=messages, model_tier=ModelTier.STANDARD, max_tokens=3000)
        try: result = json.loads(resp.content)
        except: result = {"raw": resp.content}
        return {**state, "testability_map": result.get("testability_map", {}),
                "mock_registry": result.get("mock_registry", []),
                "test_data_strategy": result.get("test_data_strategy", {}),
                "current_agent": "testability_analysis"}


class BaselineMetricsAgent(BaseAgent):
    """Establishes baseline code quality metrics before any testing."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [{
            "role": "user",
            "content": f"""Establish baseline code quality metrics for the codebase.

CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}
DEV PACKAGE SUMMARY: {json.dumps(state.get('development_package', {}).get('summary', {}), indent=2)}

Return JSON:
{{
  "baseline_metrics": {{
    "cyclomatic_complexity": {{"average": 0.0, "max": 0, "threshold_alert": 10}},
    "code_duplication_percent": 0.0,
    "lines_of_code": {{"backend": 0, "frontend": 0, "total": 0}},
    "dependency_count": 0,
    "known_vulnerabilities": [],
    "estimated_coverage_before_testing": 0.0
  }},
  "performance_thresholds": {{
    "api_p99_latency_ms": 500,
    "api_p95_latency_ms": 200,
    "db_query_p99_ms": 100,
    "page_load_p90_ms": 2000,
    "throughput_rps": 100,
    "memory_growth_per_1000_requests_mb": 5,
    "cpu_spike_threshold_percent": 80
  }}
}}"""
        }]
        resp = await self.llm_call(messages=messages, model_tier=ModelTier.ECONOMY, max_tokens=2000)
        try: result = json.loads(resp.content)
        except: result = {"raw": resp.content}
        return {**state, "baseline_metrics": result.get("baseline_metrics", {}),
                "performance_thresholds": result.get("performance_thresholds", {}),
                "current_agent": "baseline_metrics"}


class TestStrategyAgent(BaseAgent):
    """Produces the comprehensive test strategy for Gate 1 review."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        messages = [{
            "role": "user",
            "content": f"""Produce the comprehensive testing strategy.

CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}
TESTABILITY: {json.dumps(state.get('testability_map', {}), indent=2)}
BASELINE METRICS: {json.dumps(state.get('baseline_metrics', {}), indent=2)}
ESTIMATED SCENARIOS: {json.dumps(state.get('estimated_scenarios', {}), indent=2)}

Return JSON:
{{
  "test_strategy": {{
    "tracks": [
      {{"track": "unit|integration|system|performance|security",
        "priority": 1, "tool": "<Jest|pytest|k6|OWASP ZAP>",
        "coverage_target_percent": 80,
        "max_iterations": 3,
        "scenario_batch_size": 20,
        "performance_gate_applies": true,
        "security_exempt_from_perf_gate": true}}
    ],
    "fix_complexity_threshold_percent": 5,
    "max_fix_attempts_per_failure": 3,
    "safe_mode_triggers": ["security_critical_unfixed", "regression_cascade"],
    "reporting_format": "junit|allure|custom"
  }},
  "gate1_summary": "<3-sentence summary for client Gate 1 approval>"
}}"""
        }]
        resp = await self.llm_call(messages=messages, model_tier=ModelTier.STANDARD, max_tokens=3000)
        try: result = json.loads(resp.content)
        except: result = {"raw": resp.content}
        return {**state, "test_strategy": result.get("test_strategy", {}),
                "current_agent": "test_strategy"}
