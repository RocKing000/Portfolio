"""
train_models.py
Trains 5 scikit-learn models for the Loan Threat System and saves them
as .pkl files in the models/ sub-directory.

Models
------
1. default_predictor  — RandomForestClassifier  → P(default)
2. risk_scorer        — GradientBoostingRegressor → risk score 0-100
3. bucket_forecaster  — RandomForestClassifier   → next-month DPD bucket
4. alert_engine       — GradientBoostingClassifier → alert level
5. collection_engine  — RandomForestRegressor    → predicted collection efficiency

Run:  python train_models.py
"""

import os, json, pickle, time
import numpy as np
import pandas as pd
from sklearn.ensemble import (RandomForestClassifier, RandomForestRegressor,
                              GradientBoostingClassifier, GradientBoostingRegressor)
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (accuracy_score, f1_score,
                             mean_absolute_error, r2_score,
                             classification_report)
from sklearn.inspection import permutation_importance

import sys
sys.path.insert(0, os.path.dirname(__file__))
from data_processor import load_dataset, get_feature_columns, BUCKET_LABELS

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLS = get_feature_columns()
ALERT_LEVELS = ["REGULAR", "MODERATE", "RISK", "CRITICAL", "VERY CRITICAL"]


def save(obj, name: str):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    with open(path, "wb") as f:
        pickle.dump(obj, f)
    print(f"   Saved  →  {path}")


def load_model(name: str):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    with open(path, "rb") as f:
        return pickle.load(f)


def feature_importance_dict(model, feature_names: list) -> dict:
    if hasattr(model, "feature_importances_"):
        imp = model.feature_importances_
    else:
        return {}
    pairs = sorted(zip(feature_names, imp), key=lambda x: -x[1])
    return {k: round(float(v), 4) for k, v in pairs[:15]}


# ─────────────────────────────────────────────────────────────────────────────
# 1. Default Predictor
# ─────────────────────────────────────────────────────────────────────────────

def train_default_predictor(df: pd.DataFrame) -> dict:
    print("\n[1/5] Training Default Predictor (RandomForest Classifier)…")
    t0 = time.time()
    X  = df[FEATURE_COLS].fillna(0)
    y  = df["default_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=200, max_depth=12, min_samples_leaf=5,
        class_weight="balanced", n_jobs=-1, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    proba  = model.predict_proba(X_test)[:, 1]

    acc    = accuracy_score(y_test, y_pred)
    f1     = f1_score(y_test, y_pred, average="weighted")
    cv     = cross_val_score(model, X, y, cv=5, scoring="f1_weighted").mean()

    print(f"   Accuracy : {acc:.4f}   F1 : {f1:.4f}   CV-F1 : {cv:.4f}")
    print(f"   Time     : {time.time()-t0:.1f}s")
    print(classification_report(y_test, y_pred, target_names=["No Default", "Default"]))

    save({"model": model, "features": FEATURE_COLS, "type": "classifier",
          "classes": ["No Default", "Default"]}, "default_predictor")

    return {
        "name": "Default Predictor", "type": "classification",
        "accuracy": round(acc, 4), "f1_score": round(f1, 4), "cv_f1": round(cv, 4),
        "feature_importance": feature_importance_dict(model, FEATURE_COLS),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Risk Scorer
# ─────────────────────────────────────────────────────────────────────────────

def train_risk_scorer(df: pd.DataFrame) -> dict:
    print("\n[2/5] Training Risk Scorer (GradientBoosting Regressor)…")
    t0 = time.time()
    X  = df[FEATURE_COLS].fillna(0)
    y  = df["structural_risk"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=200, max_depth=5, learning_rate=0.05,
        subsample=0.8, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    r2     = r2_score(y_test, y_pred)

    print(f"   MAE      : {mae:.4f}   R²  : {r2:.4f}")
    print(f"   Time     : {time.time()-t0:.1f}s")

    save({"model": model, "features": FEATURE_COLS, "type": "regressor",
          "output_range": [0, 100]}, "risk_scorer")

    return {
        "name": "Risk Scorer", "type": "regression",
        "mae": round(mae, 4), "r2_score": round(r2, 4),
        "feature_importance": feature_importance_dict(model, FEATURE_COLS),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Bucket Forecaster
# ─────────────────────────────────────────────────────────────────────────────

def train_bucket_forecaster(df: pd.DataFrame) -> dict:
    print("\n[3/5] Training Bucket Forecaster (RandomForest Classifier)…")
    t0 = time.time()

    le = LabelEncoder()
    le.fit(BUCKET_LABELS)

    X  = df[FEATURE_COLS].fillna(0)
    y  = le.transform(df["bucket"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=300, max_depth=15, min_samples_leaf=3,
        class_weight="balanced", n_jobs=-1, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    f1     = f1_score(y_test, y_pred, average="weighted")
    cv     = cross_val_score(model, X, y, cv=5, scoring="f1_weighted").mean()

    print(f"   Accuracy : {acc:.4f}   F1 : {f1:.4f}   CV-F1 : {cv:.4f}")
    print(f"   Time     : {time.time()-t0:.1f}s")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    save({"model": model, "label_encoder": le, "features": FEATURE_COLS,
          "type": "classifier", "classes": list(le.classes_)}, "bucket_forecaster")

    return {
        "name": "Bucket Forecaster", "type": "classification",
        "accuracy": round(acc, 4), "f1_score": round(f1, 4), "cv_f1": round(cv, 4),
        "feature_importance": feature_importance_dict(model, FEATURE_COLS),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Alert Engine
# ─────────────────────────────────────────────────────────────────────────────

def train_alert_engine(df: pd.DataFrame) -> dict:
    print("\n[4/5] Training Alert Engine (GradientBoosting Classifier)…")
    t0 = time.time()

    le = LabelEncoder()
    le.fit(ALERT_LEVELS)

    X  = df[FEATURE_COLS].fillna(0)
    y  = le.transform(df["alert_level"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    model = GradientBoostingClassifier(
        n_estimators=200, max_depth=6, learning_rate=0.05,
        subsample=0.8, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    f1     = f1_score(y_test, y_pred, average="weighted")
    cv     = cross_val_score(model, X, y, cv=5, scoring="f1_weighted").mean()

    print(f"   Accuracy : {acc:.4f}   F1 : {f1:.4f}   CV-F1 : {cv:.4f}")
    print(f"   Time     : {time.time()-t0:.1f}s")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    save({"model": model, "label_encoder": le, "features": FEATURE_COLS,
          "type": "classifier", "classes": list(le.classes_)}, "alert_engine")

    return {
        "name": "Alert Engine", "type": "classification",
        "accuracy": round(acc, 4), "f1_score": round(f1, 4), "cv_f1": round(cv, 4),
        "feature_importance": feature_importance_dict(model, FEATURE_COLS),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Collection Engine
# ─────────────────────────────────────────────────────────────────────────────

def train_collection_engine(df: pd.DataFrame) -> dict:
    print("\n[5/5] Training Collection Engine (RandomForest Regressor)…")
    t0 = time.time()
    X  = df[FEATURE_COLS].fillna(0)
    y  = df["collection_eff"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(
        n_estimators=200, max_depth=12, min_samples_leaf=5,
        n_jobs=-1, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    r2     = r2_score(y_test, y_pred)

    print(f"   MAE      : {mae:.4f}   R²  : {r2:.4f}")
    print(f"   Time     : {time.time()-t0:.1f}s")

    save({"model": model, "features": FEATURE_COLS, "type": "regressor",
          "output_range": [0, 100]}, "collection_engine")

    return {
        "name": "Collection Engine", "type": "regression",
        "mae": round(mae, 4), "r2_score": round(r2, 4),
        "feature_importance": feature_importance_dict(model, FEATURE_COLS),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("  LOS — Model Training Pipeline")
    print("=" * 65)
    total_start = time.time()

    df = load_dataset()
    print(f"\n[Dataset] {len(df):,} rows  |  {len(FEATURE_COLS)} features")

    results = {}
    results["default_predictor"] = train_default_predictor(df)
    results["risk_scorer"]       = train_risk_scorer(df)
    results["bucket_forecaster"] = train_bucket_forecaster(df)
    results["alert_engine"]      = train_alert_engine(df)
    results["collection_engine"] = train_collection_engine(df)

    metrics_path = os.path.join(MODELS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[Done] Metrics saved → {metrics_path}")

    print("\n" + "=" * 65)
    print("  TRAINING SUMMARY")
    print("=" * 65)
    for k, v in results.items():
        if v["type"] == "classification":
            print(f"  {v['name']:<25}  Acc={v['accuracy']:.4f}  F1={v['f1_score']:.4f}")
        else:
            print(f"  {v['name']:<25}  MAE={v['mae']:.4f}   R²={v['r2_score']:.4f}")

    print(f"\n  Total training time: {time.time()-total_start:.1f}s")
    print("=" * 65)
    return results


if __name__ == "__main__":
    main()
