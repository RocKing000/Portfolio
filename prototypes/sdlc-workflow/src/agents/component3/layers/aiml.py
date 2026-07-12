"""Component 3 — AI/ML layer agents (7 agents, conditional on aiml_required flag)."""
from __future__ import annotations

from shared.llm_gateway.base import ModelTier
from ..base_spec_agent import LayerSpecAgent

_ML_CONTEXT = ["design_package", "implementation_context", "backend_package", "dependency_map"]


class MLAIMLAnalysisAgent(LayerSpecAgent):
    AGENT_NAME = "ml_aiml_analysis"
    OUTPUT_KEY = "ml_analysis"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = _ML_CONTEXT
    SYSTEM_PROMPT = """
Analyse the AI/ML requirements and define the ML system architecture.

Return JSON:
{
  "ml_use_cases": [
    {"id": "ML-001", "name": "", "type": "classification|regression|nlp|vision|recommendation|anomaly",
     "input_features": [], "output": "", "latency_requirement": "real_time|batch|async",
     "training_frequency": "once|daily|weekly|continuous"}
  ],
  "ml_framework": "<scikit-learn|PyTorch|TensorFlow|Hugging Face|OpenAI API>",
  "serving_strategy": "<REST API|embedded|batch job|streaming>",
  "data_requirements": {
    "volume": "low|medium|high",
    "labelling_needed": false,
    "data_sources": ["<table or external source>"]
  },
  "build_vs_buy": [
    {"use_case": "ML-001", "decision": "build|buy|api", "rationale": ""}
  ]
}
"""


class MLDataPipelineSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "ml_data_pipeline_specification"
    OUTPUT_KEY = "ml_data_pipeline_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["ml_analysis", "database_package"]
    SYSTEM_PROMPT = """
Specify the data pipeline for ML feature extraction and model training.

Return JSON:
{
  "pipelines": [
    {"name": "", "use_case_id": "ML-001",
     "steps": [
       {"order": 1, "name": "", "operation": "extract|transform|validate|load|feature_engineer",
        "input": "", "output": "", "config": {}}
     ],
     "schedule": "<cron expression or 'on-demand'>",
     "storage": {"raw": "<location>", "processed": "<location>", "features": "<location>"}
    }
  ],
  "feature_store": {"required": false, "tool": "<Feast|Tecton|custom|none>"},
  "data_versioning": "<DVC|MLflow|none>"
}
"""


class MLModelSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "ml_model_specification"
    OUTPUT_KEY = "ml_model_spec"
    MODEL_TIER = ModelTier.PREMIUM
    INPUT_KEYS = ["ml_analysis", "ml_data_pipeline_spec"]
    SYSTEM_PROMPT = """
Specify each ML model: architecture, training config, and evaluation criteria.

Return JSON:
{
  "models": [
    {"id": "MODEL-001", "use_case_id": "ML-001",
     "architecture": "<model type and structure>",
     "hyperparameters": {"<param>": "<value>"},
     "training_data_split": {"train": 0.8, "val": 0.1, "test": 0.1},
     "evaluation_metrics": [{"metric": "accuracy|F1|RMSE|AUC", "threshold": 0.0, "direction": "maximize|minimize"}],
     "baseline": "<naive baseline to beat>",
     "interpretability": "required|nice_to_have|not_required",
     "fairness_requirements": "<protected attributes to monitor>"}
  ],
  "experiment_tracking": "<MLflow|W&B|none>",
  "model_registry": "<MLflow|SageMaker|none>"
}
"""


class MLTrainingPipelineSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "ml_training_pipeline_specification"
    OUTPUT_KEY = "ml_training_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["ml_model_spec", "ml_data_pipeline_spec"]
    SYSTEM_PROMPT = """
Specify the training pipeline orchestration.

Return JSON:
{
  "training_pipelines": [
    {"model_id": "MODEL-001",
     "orchestrator": "<Airflow|Prefect|Kubeflow|script>",
     "compute": {"type": "cpu|gpu", "instance": "", "parallelism": 1},
     "stages": ["data_prep", "feature_engineering", "training", "evaluation", "registration"],
     "early_stopping": {"enabled": true, "patience": 5, "metric": "val_loss"},
     "checkpointing": {"frequency": "epoch", "keep_last": 3},
     "notifications": {"on_completion": true, "on_failure": true}}
  ],
  "ci_cd_integration": "<trigger training on data drift|scheduled|manual>",
  "reproducibility": {"seed": 42, "pinned_dependencies": true}
}
"""


class MLInferenceServiceSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "ml_inference_service_specification"
    OUTPUT_KEY = "ml_inference_spec"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["ml_model_spec", "be_analysis"]
    SYSTEM_PROMPT = """
Specify the model inference service that the backend will call.

Return JSON:
{
  "inference_services": [
    {"model_id": "MODEL-001",
     "service_name": "<PredictionService>",
     "api": {"path": "/predict", "method": "POST", "auth": "api_key|jwt|none"},
     "request_schema": {},
     "response_schema": {},
     "latency_p99_target_ms": 200,
     "batch_support": false,
     "caching": {"enabled": true, "ttl_seconds": 60, "cache_key": "<feature hash>"},
     "fallback": "<what to return if model unavailable>",
     "scaling": {"min_replicas": 1, "max_replicas": 4, "scale_metric": "cpu|rps"}}
  ]
}
"""


class MLModelMonitoringSpecificationAgent(LayerSpecAgent):
    AGENT_NAME = "ml_model_monitoring_specification"
    OUTPUT_KEY = "ml_monitoring_spec"
    MODEL_TIER = ModelTier.ECONOMY
    INPUT_KEYS = ["ml_model_spec", "ml_inference_spec"]
    SYSTEM_PROMPT = """
Specify model monitoring and drift detection.

Return JSON:
{
  "monitoring": [
    {"model_id": "MODEL-001",
     "performance_metrics": [{"metric": "", "alert_threshold": 0.0, "window": "24h|7d"}],
     "data_drift": {"detector": "KS-test|PSI|none", "features_monitored": [], "alert_threshold": 0.1},
     "concept_drift": {"enabled": true, "method": "page_hinkley|ADWIN"},
     "prediction_logging": {"enabled": true, "sample_rate": 1.0, "retention_days": 90},
     "retraining_trigger": "scheduled|drift_alert|performance_drop"}
  ]
}
"""


class MLCodeGenerationAgent(LayerSpecAgent):
    """Assembles the AI/ML layer package."""
    AGENT_NAME = "ml_aiml_code_generation"
    OUTPUT_KEY = "aiml_package"
    MODEL_TIER = ModelTier.STANDARD
    INPUT_KEYS = ["ml_analysis", "ml_data_pipeline_spec", "ml_model_spec",
                  "ml_training_spec", "ml_inference_spec", "ml_monitoring_spec"]
    SYSTEM_PROMPT = """
Assemble the AI/ML layer handoff package. Return JSON:
{
  "aiml_package": {
    "use_cases": 0, "models": 0,
    "serving_endpoint": "",
    "monitoring_enabled": true,
    "ready_for_integration": true,
    "summary": ""
  }
}
"""

    async def run(self, state):
        result = await super().run(state)
        pkg = result.get("aiml_package", {})
        if isinstance(pkg, dict) and "aiml_package" in pkg:
            pkg = pkg["aiml_package"]
        pkg.update({
            "analysis":          state.get("ml_analysis"),
            "data_pipeline":     state.get("ml_data_pipeline_spec"),
            "model_spec":        state.get("ml_model_spec"),
            "training_spec":     state.get("ml_training_spec"),
            "inference_spec":    state.get("ml_inference_spec"),
            "monitoring_spec":   state.get("ml_monitoring_spec"),
        })
        result["aiml_package"] = pkg
        return result
