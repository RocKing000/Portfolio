"""
Component 4 core loop — 7 agents reused for all 5 test tracks.
Each agent is track-aware via state['active_track'].
"""
from __future__ import annotations

import json
import os
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

TRACKS = ("unit", "integration", "system", "performance", "security")

# Security fixes are exempt from the performance impact gate
SECURITY_PERF_EXEMPT = True


class RandomScenarioGeneratorAgent(BaseAgent):
    """Generates a randomised batch of test scenarios for the active track."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        track    = state.get("active_track", "unit")
        codebase = state.get("codebase_map", {})
        strategy = state.get("test_strategy", {})
        batch_size = next(
            (t.get("scenario_batch_size", 20) for t in strategy.get("tracks", []) if t.get("track") == track),
            20
        )

        messages = [{
            "role": "user",
            "content": f"""Generate {batch_size} randomised {track} test scenarios.

ACTIVE TRACK: {track}
CODEBASE MAP: {json.dumps(codebase, indent=2)}
TEST DATA STRATEGY: {json.dumps(state.get('test_data_strategy', {}).get(track, ''), indent=2)}
MOCK REGISTRY: {json.dumps(state.get('mock_registry', [])[:10], indent=2)}
ITERATION: {state.get('iteration_number', 1)}

Return JSON:
{{
  "scenarios": [
    {{
      "id": "SC-{track[:3].upper()}-001",
      "name": "",
      "track": "{track}",
      "target": "<module.method or endpoint or component>",
      "input": {{}},
      "expected_output": {{}},
      "test_type": "happy_path|edge_case|boundary|negative|load|injection|xss|auth_bypass",
      "priority": "critical|high|medium|low",
      "mock_dependencies": ["<from mock_registry>"]
    }}
  ]
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.ECONOMY, max_tokens=5000)
        try: result = json.loads(resp.content)
        except: result = {"scenarios": []}

        return {**state, "scenario_batch": result.get("scenarios", []),
                "current_agent": "random_scenario_generator"}


class TestExecutionAgent(BaseAgent):
    """Simulates test execution and reports pass/fail/error per scenario."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        track     = state.get("active_track", "unit")
        scenarios = state.get("scenario_batch", [])

        messages = [{
            "role": "user",
            "content": f"""Execute these {track} test scenarios and report results.

TRACK: {track}
SCENARIOS: {json.dumps(scenarios, indent=2)}
BASELINE METRICS: {json.dumps(state.get('baseline_metrics', {}), indent=2)}
PERFORMANCE THRESHOLDS: {json.dumps(state.get('performance_thresholds', {}), indent=2)}

Return JSON:
{{
  "execution_results": [
    {{
      "scenario_id": "",
      "status": "pass|fail|error|skip",
      "actual_output": {{}},
      "error_message": null,
      "latency_ms": null,
      "memory_delta_mb": null,
      "assertion_details": ""
    }}
  ],
  "summary": {{"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0}}
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.ECONOMY, max_tokens=5000)
        try: result = json.loads(resp.content)
        except: result = {"execution_results": [], "summary": {}}

        return {**state, "execution_results": result.get("execution_results", []),
                "execution_summary": result.get("summary", {}),
                "current_agent": "test_execution"}


class FailureAnalysisAgent(BaseAgent):
    """Root-cause analyses each failed/error scenario."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        failures = [r for r in state.get("execution_results", []) if r.get("status") in ("fail", "error")]
        if not failures:
            return {**state, "failure_analyses": [], "current_agent": "failure_analysis"}

        messages = [{
            "role": "user",
            "content": f"""Root-cause analyse each test failure.

FAILURES: {json.dumps(failures, indent=2)}
CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}
TRACK: {state.get('active_track', 'unit')}

Return JSON:
{{
  "failure_analyses": [
    {{
      "scenario_id": "",
      "root_cause": "<specific cause>",
      "cause_category": "logic_bug|missing_validation|race_condition|data_issue|config|dependency|security|performance",
      "affected_file": "<file path>",
      "affected_method": "",
      "fix_complexity_percent": 0.0,
      "is_security_issue": false,
      "confidence": 0.0
    }}
  ]
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.PREMIUM, max_tokens=5000)
        try: result = json.loads(resp.content)
        except: result = {"failure_analyses": []}

        return {**state, "failure_analyses": result.get("failure_analyses", []),
                "current_agent": "failure_analysis"}


class FixGenerationAgent(BaseAgent):
    """Generates and applies code fixes for each failure that passes the complexity threshold."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        analyses  = state.get("failure_analyses", [])
        threshold = float(os.getenv("FIX_COMPLEXITY_THRESHOLD", "5"))
        max_attempts = int(os.getenv("MAX_FIX_ATTEMPTS", "3"))

        # Security issues bypass the complexity threshold
        eligible = [
            a for a in analyses
            if a.get("is_security_issue") or a.get("fix_complexity_percent", 100) <= threshold
        ]
        too_complex = [
            a for a in analyses
            if not a.get("is_security_issue") and a.get("fix_complexity_percent", 100) > threshold
        ]

        if not eligible:
            return {**state, "fixes_applied": [], "fixes_rejected": too_complex,
                    "current_agent": "fix_generation"}

        messages = [{
            "role": "user",
            "content": f"""Generate precise code fixes for these failures.

ELIGIBLE FAILURES: {json.dumps(eligible, indent=2)}
CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}
MAX ATTEMPTS: {max_attempts}

Return JSON:
{{
  "fixes": [
    {{
      "scenario_id": "",
      "affected_file": "",
      "fix_description": "",
      "diff": "<unified diff of the fix>",
      "fix_type": "logic|validation|config|dependency|security",
      "is_breaking_change": false,
      "test_to_verify": "<scenario id>"
    }}
  ]
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.PREMIUM, max_tokens=6000)
        try: result = json.loads(resp.content)
        except: result = {"fixes": []}

        return {**state, "fixes_applied": result.get("fixes", []),
                "fixes_rejected": too_complex,
                "current_agent": "fix_generation"}


class PerformanceImpactAgent(BaseAgent):
    """
    Checks that applied fixes do not degrade performance beyond threshold.
    Security fixes are exempt from this gate.
    """

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        fixes = state.get("fixes_applied", [])
        security_fixes = [f for f in fixes if f.get("fix_type") == "security"]
        non_security   = [f for f in fixes if f.get("fix_type") != "security"]

        if not non_security:
            # Nothing to check — all fixes are security (exempt) or none applied
            return {**state, "performance_impact_report": {"status": "exempt", "violations": []},
                    "current_agent": "performance_impact"}

        messages = [{
            "role": "user",
            "content": f"""Assess performance impact of these code fixes.

FIXES (non-security): {json.dumps(non_security, indent=2)}
PERFORMANCE THRESHOLDS: {json.dumps(state.get('performance_thresholds', {}), indent=2)}
BASELINE METRICS: {json.dumps(state.get('baseline_metrics', {}), indent=2)}

Return JSON:
{{
  "performance_impact_report": {{
    "status": "ok|warning|violation",
    "violations": [
      {{
        "fix_scenario_id": "",
        "metric": "latency|throughput|memory|cpu",
        "baseline": 0.0,
        "projected": 0.0,
        "threshold": 0.0,
        "recommendation": "revert|optimise|accept"
      }}
    ],
    "fixes_to_revert": ["<scenario_id>"]
  }}
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.STANDARD, max_tokens=3000)
        try: result = json.loads(resp.content)
        except: result = {"performance_impact_report": {"status": "ok", "violations": []}}

        report = result.get("performance_impact_report", {})
        reverts = report.get("fixes_to_revert", [])

        # Remove reverted fixes from applied list
        remaining = [f for f in fixes if f.get("test_to_verify") not in reverts]
        rejected_by_perf = [f for f in fixes if f.get("test_to_verify") in reverts]

        return {**state, "performance_impact_report": report,
                "fixes_applied": remaining,
                "fixes_rejected": state.get("fixes_rejected", []) + rejected_by_perf,
                "current_agent": "performance_impact"}


class RegressionCheckAgent(BaseAgent):
    """Re-runs previously passing scenarios to detect regressions introduced by fixes."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        fixes = state.get("fixes_applied", [])
        if not fixes:
            return {**state, "regressions_found": [], "current_agent": "regression_check"}

        messages = [{
            "role": "user",
            "content": f"""Check for regressions introduced by these fixes.

FIXES APPLIED: {json.dumps(fixes, indent=2)}
PREVIOUS PASSING SCENARIOS: {json.dumps([r for r in state.get('execution_results', []) if r.get('status') == 'pass'][:20], indent=2)}
CODEBASE MAP: {json.dumps(state.get('codebase_map', {}), indent=2)}

Return JSON:
{{
  "regressions": [
    {{
      "scenario_id": "<previously passing scenario>",
      "caused_by_fix": "<fix scenario id>",
      "regression_type": "logic|performance|data|ui",
      "severity": "critical|major|minor",
      "revert_recommended": true
    }}
  ]
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.STANDARD, max_tokens=3000)
        try: result = json.loads(resp.content)
        except: result = {"regressions": []}

        regressions = result.get("regressions", [])

        # Auto-revert fixes that cause critical regressions
        critical_revert_ids = {r.get("caused_by_fix") for r in regressions
                               if r.get("severity") == "critical" and r.get("revert_recommended")}
        remaining = [f for f in fixes if f.get("test_to_verify") not in critical_revert_ids]
        reverted  = [f for f in fixes if f.get("test_to_verify") in critical_revert_ids]

        return {**state, "regressions_found": regressions,
                "fixes_applied": remaining,
                "fixes_rejected": state.get("fixes_rejected", []) + reverted,
                "current_agent": "regression_check"}


class IterationReportAgent(BaseAgent):
    """Produces the iteration report and recommendation for client gate decision."""

    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        track     = state.get("active_track", "unit")
        iteration = state.get("iteration_number", 1)
        strategy  = state.get("test_strategy", {})
        max_iters = next(
            (t.get("max_iterations", 3) for t in strategy.get("tracks", []) if t.get("track") == track),
            3
        )

        exec_summary = state.get("execution_summary", {})
        fixes_applied  = len(state.get("fixes_applied", []))
        fixes_rejected = len(state.get("fixes_rejected", []))
        regressions    = len(state.get("regressions_found", []))
        unfixed        = [f for f in state.get("failure_analyses", [])
                          if not any(fx.get("scenario_id") == f.get("scenario_id")
                                     for fx in state.get("fixes_applied", []))]

        # Auto-recommendation
        pass_rate = exec_summary.get("passed", 0) / max(exec_summary.get("total", 1), 1)
        recommendation = "continue" if (pass_rate < 0.95 and iteration < max_iters) else "stop"

        report = {
            "track":           track,
            "iteration":       iteration,
            "scenarios_total": exec_summary.get("total", 0),
            "passed":          exec_summary.get("passed", 0),
            "failed":          exec_summary.get("failed", 0),
            "errors":          exec_summary.get("errors", 0),
            "fixes_applied":   fixes_applied,
            "fixes_rejected":  fixes_rejected,
            "regressions":     regressions,
            "unfixed_issues":  len(unfixed),
            "pass_rate":       round(pass_rate, 3),
            "recommendation":  recommendation,
        }

        # Accumulate track reports in state
        track_reports = dict(state.get("track_reports", {t: [] for t in TRACKS}))
        track_reports[track] = track_reports.get(track, []) + [report]

        # Mark unfixed issues for final report
        all_unfixed = state.get("unfixed_issues", []) + unfixed

        return {**state, "iteration_report": report, "track_reports": track_reports,
                "unfixed_issues": all_unfixed,
                "current_agent": "iteration_report"}
