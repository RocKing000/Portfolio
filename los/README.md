# LOS — Loan Portfolio Analytics

A data analytics platform for loan portfolio risk management. Monthly data feeds through a feature engineering pipeline and is scored across five dimensions using trained ML models. Output is served via a FastAPI backend to an Angular frontend for portfolio-level visibility and decision support.

---

## What It Does

Five scikit-learn models, each covering a distinct analytical function:

| Model | Function |
|---|---|
| Risk Scorer | Composite risk score across multiple input features |
| Default Predictor | Binary classification: probability of default |
| Collection Engine | Priority scoring and action recommendation per account |
| Bucket Forecaster | Time-series segment transition forecasting |
| Alert Engine | Signal detection and alert generation |

Model performance metrics are persisted to `metrics.json` after each training run for tracking.

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Python FastAPI |
| ML | scikit-learn |
| Frontend | Angular |
| Data pipeline | Python (pandas, custom scripts) |

---

## Structure

```
backend/
    api.py              ← FastAPI application: all model endpoints
    data_processor.py   ← Feature engineering and transformation pipeline
    train_models.py     ← Training script for all five models
    models/             ← Trained .pkl files + metrics.json
frontend/
    src/app/            ← Angular application
distribute_data.py      ← Distributes processed data across targets
enrich_from_files.py    ← Enriches records from monthly upload files
fetch_last_month.py     ← Pulls the most recent monthly data snapshot
```

---

## Notes

- Models are trained independently and scored per record, then aggregated into a composite portfolio view.
- A rolling data window feeds training; the most recent snapshot feeds inference.
- The system was designed for a monthly data cadence, not real-time streaming.
