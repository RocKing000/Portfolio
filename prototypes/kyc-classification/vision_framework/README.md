# Vision Framework

A modular, reusable Computer Vision and ML framework in Python with a .NET
wrapper for enterprise integration.

**The core engine never changes — only use cases, models, and datasets are
swapped in and out.**

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy and edit environment config
cp .env.example .env

# 3. Start the API server
python main.py

# 4. Open API docs
# http://localhost:8000/docs
```

---

## Architecture

```
vision_framework/
├── core/          ← NEVER changes — pure framework (interfaces + engine)
├── plugins/       ← One folder per use case (kyc/, fraud/, id_verify/, …)
├── api/           ← FastAPI layer — routes generated per plugin
├── dotnet_wrapper/← .NET HTTP client for enterprise integration
├── training/      ← Generic train / evaluate / synthetic generation
└── tests/         ← Independent test per layer
```

### SOLID Principles Enforced

| Principle | How |
|-----------|-----|
| **SRP** | Every class does exactly one thing (processor transforms, detector locates, extractor reads data) |
| **OCP** | New use cases are added as plugins — no core file is modified |
| **DIP** | Pipelines depend on abstractions (`BaseProcessor`, `BaseDetector`, …) — never concrete classes |
| **ISP** | Eight small focused interfaces, never a fat god-interface |
| **LSP** | Every concrete class is fully substitutable for its base |

---

## How to Add a New Use Case Plugin

### Step 1 — Create the plugin folder

```
plugins/
└── your_use_case/
    ├── __init__.py
    ├── your_plugin.py          ← plugin entry point
    ├── config/
    │   └── your_config.py
    ├── processors/
    ├── classifiers/
    ├── extractors/
    ├── validators/
    ├── models/
    └── pipelines/
```

### Step 2 — Implement the required interfaces

Each component implements one interface from `core/interfaces/`:

```python
# processors/my_processor.py
from vision_framework.core.interfaces.base_processor import BaseProcessor

class MyProcessor(BaseProcessor):
    @property
    def processor_name(self) -> str:
        return "my_processor"

    def validate_input(self, image: np.ndarray) -> bool:
        return image is not None and image.size > 0

    def process(self, image: np.ndarray, **kwargs) -> dict:
        # ... your logic ...
        return {"success": True, "image": result, "metadata": {}, "message": "ok"}
```

### Step 3 — Create `your_plugin.py` with `plugin_name` and `get_pipelines()`

```python
# your_plugin.py
from vision_framework.plugins.your_use_case.pipelines.your_pipeline import YourPipeline

class YourPlugin:
    plugin_name = "your_use_case"
    version = "1.0.0"

    def initialize(self, config: dict) -> bool:
        # register models, load config
        return True

    def get_pipelines(self) -> dict:
        return {"your_pipeline": YourPipeline()}

    def get_routes(self) -> list:
        from vision_framework.plugins.your_use_case.routes import build_router
        return [build_router(self)]
```

### Step 4 — Register with PluginManager

```python
# In your startup code or in fastapi_app.py
from vision_framework.core.engine.plugin_manager import PluginManager
from vision_framework.plugins.your_use_case.your_plugin import YourPlugin

pm = PluginManager()
pm.load_plugin_class(YourPlugin())
pm.initialize_plugin("your_use_case", config)
```

### Step 5 — Your endpoints are automatically available

The `fastapi_app.py` calls `plugin.get_routes()` for every loaded plugin
and mounts the returned routers.  No changes to any framework file.

```bash
# Your new endpoints appear automatically
curl http://localhost:8000/api/your_use_case/your-endpoint
```

---

## KYC Reference Plugin

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/kyc/scan-document` | Scan via multipart file upload |
| `POST` | `/api/kyc/scan-document-json` | Scan via base64 JSON body |
| `POST` | `/api/kyc/capture-face` | Detect and locate a face |
| `POST` | `/api/kyc/verify-liveness` | Passive + active liveness check |
| `POST` | `/api/kyc/match-face` | Cosine similarity face match |
| `WS`   | `/ws/kyc/stream` | Real-time camera stream |
| `GET`  | `/framework/health` | System health + GPU status |
| `GET`  | `/framework/plugins` | Loaded plugins |
| `GET`  | `/framework/models` | Registered models |

### Document Pipeline (7 steps)

```
blur_check → document_detection → perspective_correction
          → classification → ocr_extraction → validation → digit_masking
```

Each step is independently testable.  Required steps trigger early exit on
failure; optional steps (digit_masking) are skipped gracefully.

### Liveness Challenges

| Challenge | Method |
|-----------|--------|
| `passive` | Optical flow magnitude across frames |
| `blink` | Eye Aspect Ratio < 0.25 for ≥ 2 frames |
| `turn_left` / `turn_right` | Nose x-coordinate shift ≥ 20 px |
| `nod` | Nose y-coordinate shift ≥ 15 px |
| `smile` | Mouth-corner distance increase ≥ 15% |

---

## .NET Integration

```csharp
// appsettings.json
{
  "VisionFramework": {
    "BaseUrl": "http://localhost:8000"
  }
}

// Usage
using VisionFramework.Client;

var client = new VisionFrameworkClient("http://localhost:8000");
var result = await client.ScanDocumentFromFileAsync("id_card.jpg");

if (result.Success)
{
    Console.WriteLine($"Document type: {result.DocumentType}");
    Console.WriteLine($"Name: {result.ExtractedData?["name"]}");
}
```

---

## Training a New Model

```python
from vision_framework.training.synthetic_pipeline import SyntheticTrainingPipeline
from vision_framework.plugins.kyc.models.document_model import DocumentModel

pipeline = SyntheticTrainingPipeline(
    min_accuracy_threshold=0.85,
    synthetic_count_per_class=500,
)

results = pipeline.run(
    model=DocumentModel(),
    reference_dataset_path="datasets/kyc_references/",
    output_dir="training_output/",
    epochs=30,
)

print(f"Final accuracy: {results['final_accuracy']:.2%}")
print(f"Model registered: {results['model_registered']}")
```

---

## Running Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run a specific module
python -m pytest tests/test_kyc_plugin.py -v

# Run with coverage
python -m pytest tests/ --cov=vision_framework --cov-report=term-missing
```

---

## Configuration

All thresholds are in `plugins/kyc/config/kyc_config.py`.
Environment overrides via `.env` (see `.env.example`).
No numeric value is hardcoded in any processor, detector, or extractor.
