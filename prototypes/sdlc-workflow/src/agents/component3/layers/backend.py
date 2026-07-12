"""Component 3 — Backend layer agents (8 agents)."""
from __future__ import annotations

from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent

_BE_CONTEXT = ["design_package", "implementation_context", "database_package", "dependency_map"]


class BEBackendAnalysisAgent(LayerSpecAgent):
    AGENT_NAME = "be_backend_analysis"
    OUTPUT_KEY = "be_analysis"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = _BE_CONTEXT
    SYSTEM_PROMPT = """
Analyse the backend requirements and define the service structure.

Return JSON:
{
  "services": [
    {"name": "", "type": "api|worker|scheduler|gateway",
     "framework": "", "port": 0, "responsibilities": [],
     "depends_on_services": [], "depends_on_db_tables": []}
  ],
  "api_versioning": "<url_path|header>",
  "auth_strategy": "<JWT validation at gateway|per-service|both>",
  "backend_pattern": "<hexagonal|layered|clean>",
  "async_operations": ["<operations that run asynchronously>"]
}
"""


class BERepositorySpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_repository_specification"
    OUTPUT_KEY = "be_repository_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["be_analysis", "database_package", "dependency_map"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Specify all repository interfaces and implementations for data access.

Return JSON:
{
  "repositories": [
    {
      "name": "<e.g. IUserRepository>",
      "entity": "<database entity>",
      "interface_methods": [
        {"signature": "<method(params): ReturnType>", "sql_hint": "<query pattern>", "is_async": true}
      ],
      "implementation": "<Dapper|EF Core|SQLAlchemy|Prisma>",
      "transaction_support": true,
      "caching_strategy": "none|read-through|write-through"
    }
  ]
}
"""


class BEServiceSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_service_specification"
    OUTPUT_KEY = "be_service_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["be_analysis", "be_repository_spec", "design_package"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Specify all business logic service classes with their methods and business rules.

Return JSON:
{
  "services": [
    {
      "name": "<IUserService>",
      "dependencies": ["IUserRepository", "IEmailService"],
      "methods": [
        {"name": "", "params": [{"name": "", "type": ""}], "returns": "",
         "business_rules": ["<rule this method enforces>"],
         "events_published": ["<domain event if any>"],
         "is_transactional": false}
      ],
      "invariants": ["<class-level business invariants>"]
    }
  ]
}
"""


class BEControllerSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_controller_specification"
    OUTPUT_KEY = "be_controller_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["be_service_spec", "design_package"]
    MAX_TOKENS = 8000
    SYSTEM_PROMPT = """
Specify all API controllers/routers mapping HTTP to services.

Return JSON:
{
  "controllers": [
    {
      "name": "<UsersController>",
      "base_route": "/api/v1/users",
      "service_dependency": "<IUserService>",
      "endpoints": [
        {"method": "GET|POST|PUT|PATCH|DELETE", "route": "/{id}",
         "auth_required": true, "roles": [],
         "request_dto": "<DTO name>", "response_dto": "<DTO name>",
         "service_method": "<method called>",
         "validation": "<DTO validation class>",
         "status_codes": {"success": 200, "not_found": 404}}
      ]
    }
  ],
  "dtos": [
    {"name": "<CreateUserRequest>", "direction": "request|response",
     "fields": [{"name": "", "type": "", "required": true, "validation": ""}]}
  ]
}
"""


class BEAuthSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_auth_specification"
    OUTPUT_KEY = "be_auth_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["be_analysis", "design_package", "implementation_context"]
    SYSTEM_PROMPT = """
Specify the authentication and authorisation implementation.

Return JSON:
{
  "jwt_validation": {
    "issuer": "<Keycloak realm URL>",
    "audience": "<client ID>",
    "algorithms": ["RS256"],
    "cache_public_keys": true,
    "key_rotation_supported": true
  },
  "role_definitions": [{"role": "", "permissions": ["<resource:action>"]}],
  "policy_handlers": [
    {"policy": "<policy name>", "requirement": "<IAuthorizationRequirement>", "handler": "<class name>"}
  ],
  "resource_ownership": "<how user-resource ownership is verified>",
  "rate_limiting": {"enabled": true, "rules": [{"endpoint_pattern": "", "limit": 60, "window": "1m"}]}
}
"""


class BEMiddlewareSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_middleware_specification"
    OUTPUT_KEY = "be_middleware_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["be_analysis", "implementation_context"]
    SYSTEM_PROMPT = """
Specify all middleware pipeline components.

Return JSON:
{
  "middleware_pipeline": [
    {"order": 1, "name": "<middleware name>", "purpose": "",
     "configuration": {}, "applies_to": "all|api_only|specific_routes"}
  ],
  "correlation_id": {"header": "X-Correlation-Id", "generated_if_absent": true},
  "request_logging": {"log_body": false, "log_headers": ["Content-Type", "X-Correlation-Id"]},
  "response_compression": {"enabled": true, "threshold_bytes": 1024}
}
"""


class BEErrorHandlingSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "be_error_handling_specification"
    OUTPUT_KEY = "be_error_handling_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["be_analysis", "be_controller_spec"]
    SYSTEM_PROMPT = """
Specify the global error handling strategy.

Return JSON:
{
  "exception_hierarchy": [
    {"exception": "<DomainException>", "base": "Exception", "http_status": 400, "is_logged": false}
  ],
  "global_handler": "<GlobalExceptionMiddleware|ExceptionFilter>",
  "error_response_format": {
    "type": "https://tools.ietf.org/html/rfc7807",
    "fields": ["type", "title", "status", "detail", "instance", "errors"]
  },
  "logging_strategy": {
    "domain_errors": "Warning",
    "unexpected_errors": "Error",
    "include_stack_trace": "never_in_prod"
  }
}
"""


class BECodeGenerationAgent(LayerSpecAgent):
    """Assembles the complete backend package."""
    AGENT_NAME = "be_backend_code_generation"
    OUTPUT_KEY = "backend_package"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["be_analysis", "be_repository_spec", "be_service_spec",
                  "be_controller_spec", "be_auth_spec", "be_middleware_spec",
                  "be_error_handling_spec"]
    SYSTEM_PROMPT = """
Assemble the backend layer handoff package. Return JSON:
{
  "backend_package": {
    "pattern": "",
    "services_defined": 0,
    "endpoints_defined": 0,
    "ready_for_frontend": true,
    "api_base_url": "/api/v1",
    "auth_approach": "",
    "summary": "<2-3 sentence summary>"
  }
}
"""

    async def run(self, state):
        result = await super().run(state)
        # Carry all sub-specs into the package
        pkg = result.get("backend_package", {})
        if isinstance(pkg, dict) and "backend_package" in pkg:
            pkg = pkg["backend_package"]
        pkg.update({
            "analysis":          state.get("be_analysis"),
            "repository_spec":   state.get("be_repository_spec"),
            "service_spec":      state.get("be_service_spec"),
            "controller_spec":   state.get("be_controller_spec"),
            "auth_spec":         state.get("be_auth_spec"),
            "middleware_spec":   state.get("be_middleware_spec"),
            "error_handling_spec": state.get("be_error_handling_spec"),
        })
        result["backend_package"] = pkg
        return result
