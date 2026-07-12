"""Component 3 — Frontend layer agents (8 agents)."""
from __future__ import annotations

from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent

_FE_CONTEXT = ["design_package", "backend_package", "implementation_context"]


class FEFrontendAnalysisAgent(LayerSpecAgent):
    AGENT_NAME = "fe_frontend_analysis"
    OUTPUT_KEY = "fe_analysis"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = _FE_CONTEXT
    SYSTEM_PROMPT = """
Analyse the frontend requirements and define the application structure.

Return JSON:
{
  "framework": "<Angular|React|Vue|Next.js>",
  "module_structure": "feature-module|atomic|page-per-route|hybrid",
  "feature_modules": [
    {"name": "", "routes": [""], "screens": ["SCR-xxx"], "api_endpoints": ["EP-xxx"]}
  ],
  "shared_modules": ["AuthModule", "SharedModule", "CoreModule"],
  "state_management": "<NgRx|Zustand|Redux|Pinia|none>",
  "api_layer": "<Axios|HttpClient|Fetch>",
  "build_tool": "<Vite|Webpack|Angular CLI>",
  "ssr_required": false
}
"""


class FERoutingSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_routing_specification"
    OUTPUT_KEY = "fe_routing_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["fe_analysis", "design_package"]
    SYSTEM_PROMPT = """
Specify the complete routing configuration.

Return JSON:
{
  "routes": [
    {"path": "", "component": "", "auth_guard": true, "roles": [],
     "lazy_loaded": true, "title": "", "children": []}
  ],
  "auth_guard": {"redirect_to_login": "/auth/login", "unauthorised_redirect": "/forbidden"},
  "navigation_guards": [{"guard": "", "applies_to": "", "purpose": ""}],
  "wildcard_route": "/not-found"
}
"""


class FEStateManagementSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_state_management_specification"
    OUTPUT_KEY = "fe_state_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["fe_analysis", "design_package", "backend_package"]
    MAX_TOKENS = 6000
    SYSTEM_PROMPT = """
Specify the state management architecture.

Return JSON:
{
  "stores": [
    {"name": "<AuthStore>", "state_shape": {"<key>": "<type>"},
     "actions": [{"name": "", "payload": "", "triggers": ""}],
     "selectors": [{"name": "", "derives": ""}],
     "effects": [{"action": "", "calls_api": "", "on_success": "", "on_error": ""}]}
  ],
  "local_state_guidelines": "<when to use component-local vs store state>",
  "caching_strategy": "<how API responses are cached in state>",
  "optimistic_updates": ["<operations that use optimistic update pattern>"]
}
"""


class FEAPIIntegrationSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_api_integration_specification"
    OUTPUT_KEY = "fe_api_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["fe_analysis", "backend_package"]
    SYSTEM_PROMPT = """
Specify the frontend API integration layer.

Return JSON:
{
  "api_client_config": {
    "base_url": "/api/v1",
    "timeout_ms": 10000,
    "interceptors": ["auth_token", "correlation_id", "error_handler"],
    "retry": {"attempts": 2, "status_codes": [503, 502]}
  },
  "service_classes": [
    {"name": "<UserApiService>",
     "methods": [{"name": "", "http_method": "", "endpoint": "", "request_type": "", "response_type": ""}]}
  ],
  "error_handling": {
    "401": "redirect_to_login",
    "403": "show_forbidden",
    "500": "show_error_toast",
    "network": "show_offline_banner"
  },
  "type_definitions": [{"name": "<UserDto>", "fields": [{"name": "", "type": ""}]}]
}
"""


class FESharedComponentSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_shared_component_specification"
    OUTPUT_KEY = "fe_shared_component_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["fe_analysis", "design_package"]
    SYSTEM_PROMPT = """
Specify all shared/reusable UI components not covered by the design system.

Return JSON:
{
  "shared_components": [
    {"name": "<DataTableComponent>", "purpose": "",
     "inputs": [{"name": "", "type": "", "required": true, "description": ""}],
     "outputs": [{"name": "", "event_type": ""}],
     "accessibility": {"aria_role": "", "keyboard_support": ""},
     "uses_design_system_components": ["DS-001"],
     "test_scenarios": ["<scenario>"]}
  ],
  "layout_components": [{"name": "", "purpose": ""}],
  "pipes": [{"name": "", "transforms": ""}],
  "directives": [{"name": "", "purpose": ""}]
}
"""


class FEFormValidationSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_form_validation_specification"
    OUTPUT_KEY = "fe_form_validation_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["design_package", "fe_api_spec"]
    SYSTEM_PROMPT = """
Specify all form validation logic across the application.

Return JSON:
{
  "forms": [
    {"name": "<LoginForm>", "screen_id": "SCR-001",
     "fields": [
       {"name": "", "type": "text|email|password|select|checkbox|file",
        "validators": [{"type": "required|minLength|pattern|custom", "config": {}, "message": ""}],
        "async_validators": [{"triggers": "blur|submit", "api_endpoint": "", "debounce_ms": 300}]}
     ],
     "submit_action": "<service method>",
     "reset_on_success": true}
  ],
  "custom_validators": [{"name": "", "validates": "", "implementation_hint": ""}],
  "form_submission_pattern": "reactive|template-driven"
}
"""


class FEFeatureModuleSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "fe_feature_module_specification"
    OUTPUT_KEY = "fe_feature_module_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["fe_analysis", "fe_routing_spec", "fe_state_spec",
                  "fe_api_spec", "fe_shared_component_spec", "fe_form_validation_spec"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Specify each feature module in detail.

Return JSON:
{
  "feature_modules": [
    {
      "name": "<DashboardModule>",
      "routes": [],
      "components": [
        {"name": "", "type": "page|container|presentational",
         "state_access": ["<store selector>"],
         "api_calls": ["<service method>"],
         "child_components": [],
         "template_outline": "<brief description of template structure>"}
      ],
      "module_imports": ["SharedModule", "ReactiveFormsModule"],
      "guards": [],
      "resolvers": []
    }
  ]
}
"""


class FECodeGenerationAgent(LayerSpecAgent):
    """Assembles the complete frontend package."""
    AGENT_NAME = "fe_frontend_code_generation"
    OUTPUT_KEY = "frontend_package"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["fe_analysis", "fe_routing_spec", "fe_state_spec", "fe_api_spec",
                  "fe_shared_component_spec", "fe_form_validation_spec", "fe_feature_module_spec"]
    SYSTEM_PROMPT = """
Assemble the frontend layer handoff package. Return JSON:
{
  "frontend_package": {
    "framework": "",
    "modules_defined": 0,
    "components_defined": 0,
    "routes_defined": 0,
    "forms_defined": 0,
    "ready_for_aiml_or_integration": true,
    "summary": ""
  }
}
"""

    async def run(self, state):
        result = await super().run(state)
        pkg = result.get("frontend_package", {})
        if isinstance(pkg, dict) and "frontend_package" in pkg:
            pkg = pkg["frontend_package"]
        pkg.update({
            "analysis":              state.get("fe_analysis"),
            "routing_spec":          state.get("fe_routing_spec"),
            "state_spec":            state.get("fe_state_spec"),
            "api_spec":              state.get("fe_api_spec"),
            "shared_component_spec": state.get("fe_shared_component_spec"),
            "form_validation_spec":  state.get("fe_form_validation_spec"),
            "feature_module_spec":   state.get("fe_feature_module_spec"),
        })
        result["frontend_package"] = pkg
        return result
