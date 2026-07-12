"""Component 4 — FinalReport agent: aggregates all 5 tracks into the testing report."""
from __future__ import annotations

import json
import logging
from typing import Any

from shared.base_agent import BaseAgent, AgentContext
from shared.llm_gateway.base import ModelTier

logger = logging.getLogger(__name__)
TRACKS = ("unit", "integration", "system", "performance", "security")


class FinalReportAgent(BaseAgent):
    def __init__(self, ctx: AgentContext): super().__init__(ctx)
    def build_graph(self): raise NotImplementedError

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        track_reports = state.get("track_reports", {})
        unfixed       = state.get("unfixed_issues", [])
        session_id    = state.get("session_id", "")

        messages = [{
            "role": "user",
            "content": f"""Produce the final testing report aggregating all 5 tracks.

TRACK REPORTS:
{json.dumps(track_reports, indent=2)}

UNFIXED ISSUES ({len(unfixed)}):
{json.dumps(unfixed[:20], indent=2)}

BASELINE METRICS: {json.dumps(state.get('baseline_metrics', {}), indent=2)}
PERFORMANCE THRESHOLDS: {json.dumps(state.get('performance_thresholds', {}), indent=2)}

Return JSON:
{{
  "final_report": {{
    "session_id": "{session_id}",
    "overall_quality_score": 0.0,
    "overall_pass_rate": 0.0,
    "tracks": [
      {{"track": "", "iterations_run": 0, "final_pass_rate": 0.0,
        "fixes_applied": 0, "unfixed_count": 0, "status": "passed|warning|failed"}}
    ],
    "critical_unfixed": [{{"issue": "", "severity": "critical", "track": ""}}],
    "security_findings": [{{"id": "", "cwe": "", "severity": "", "status": "fixed|unfixed"}}],
    "performance_summary": {{"all_thresholds_met": true, "violations": []}},
    "recommendations": ["<recommendation for client>"],
    "executive_summary": "<3-paragraph non-technical summary>",
    "technical_summary": "<technical summary for developers>",
    "ready_for_gate2": true
  }}
}}"""
        }]

        resp = await self.llm_call(messages=messages, model_tier=ModelTier.PREMIUM, max_tokens=6000)
        try: result = json.loads(resp.content)
        except: result = {"final_report": {"raw": resp.content}}

        report = result.get("final_report", result)

        # Safe mode if critical security issues remain unfixed
        critical_security_unfixed = [
            i for i in unfixed if i.get("is_security_issue") and i.get("severity") == "critical"
        ]
        if critical_security_unfixed:
            await self.enter_safe_mode(
                reason=f"{len(critical_security_unfixed)} critical security issues remain unfixed"
            )
            report["ready_for_gate2"] = False

        minio_key = f"sessions/{session_id}/final_test_report.json"
        logger.info("FinalReport assembled: overall_score=%.2f, session=%s",
                    report.get("overall_quality_score", 0.0), session_id)

        return {**state, "final_report": report,
                "final_report_key": minio_key,
                "safe_mode": bool(critical_security_unfixed),
                "current_agent": "final_report"}
