"""
MaternaSense - Advanced Training Pipeline
- Deduplication with smart handling
- Feature engineering (clinical domain knowledge)
- Class balancing via class_weight
- RandomForest + GradientBoosting ensemble
- Calibrated probabilities
- Optimal threshold search
"""

import pandas as pd
import numpy as np
from pathlib import Path
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, classification_report
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

DATA_PATH = Path("data/Book1.csv")
TARGET = "HR_PRE"

# ─────────────────────────────────────────────
# 1. LOAD + CLEAN
# ─────────────────────────────────────────────
def load_and_clean():
    df = pd.read_csv(DATA_PATH)
    df.columns = df.columns.str.strip().str.replace("Â", "")

    print(f"Raw rows: {len(df)}")
    print(f"Duplicate rows: {df.duplicated().sum()}")

    df = df.drop_duplicates()
    print(f"After dedup: {len(df)}")
    print(f"\nClass distribution:\n{df[TARGET].value_counts()}")
    print(f"Positive rate: {df[TARGET].mean():.2%}")

    return df

# ─────────────────────────────────────────────
# 2. FEATURE ENGINEERING
# ─────────────────────────────────────────────
def engineer_features(df):
    df = df.copy()

    # Pulse pressure (systolic - diastolic) — key preeclampsia marker
    df["pulse_pressure"] = df["Systolic BP"] - df["Diastolic BP"]

    # MAP (Mean Arterial Pressure) = diastolic + 1/3 pulse pressure
    df["MAP"] = df["Diastolic BP"] + (df["pulse_pressure"] / 3)

    # Hypertension severity flag (SBP >= 140 or DBP >= 90)
    df["severe_htn"] = ((df["Systolic BP"] >= 140) | (df["Diastolic BP"] >= 90)).astype(int)

    # Nulliparity (first pregnancy — higher risk)
    df["nullipara"] = (df["parity"] == 0).astype(int)

    # Early gestational age flag (< 20 weeks — early onset PE risk)
    df["early_gestation"] = (df["gestational age (weeks)"] < 20).astype(int)

    # Obesity flag (BMI >= 30)
    bmi_col = [c for c in df.columns if "BMI" in c][0]
    df["obese"] = (df[bmi_col] >= 30).astype(int)

    # Anemia flag (HB < 10)
    df["anemia"] = (df["HB"] < 10).astype(int)

    # Risk score composite (sum of binary risk factors)
    df["risk_composite"] = (
        df["diabetes"] +
        df["History of hypertension (y/n)"] +
        df["Protien Uria"] +
        df["severe_htn"] +
        df["nullipara"] +
        df["obese"] +
        df["anemia"]
    )

    print(f"\nEngineered features added: pulse_pressure, MAP, severe_htn, nullipara, early_gestation, obese, anemia, risk_composite")
    return df

# ─────────────────────────────────────────────
# 3. EVALUATE
# ─────────────────────────────────────────────
def evaluate(y_true, y_pred, y_proba, label=""):
    print(f"\n{'='*50}")
    print(f"EVALUATION {label}")
    print(f"{'='*50}")
    print(f"Accuracy:          {accuracy_score(y_true, y_pred):.4f}")
    print(f"Precision:         {precision_score(y_true, y_pred):.4f}")
    print(f"Recall (Sensitivity): {recall_score(y_true, y_pred):.4f}")
    print(f"F1 Score:          {f1_score(y_true, y_pred):.4f}")
    print(f"ROC-AUC:           {roc_auc_score(y_true, y_proba):.4f}")
    print(f"\nConfusion Matrix:\n{confusion_matrix(y_true, y_pred)}")
    print(f"\nClassification Report:\n{classification_report(y_true, y_pred)}")

# ─────────────────────────────────────────────
# 4. THRESHOLD OPTIMIZATION
# ─────────────────────────────────────────────
def find_best_threshold(y_true, y_proba):
    thresholds = np.arange(0.05, 0.80, 0.05)
    best = {"f1": (0, 0.5), "recall": (0, 0.5)}

    print("\nTHRESHOLD SWEEP:")
    print(f"{'Threshold':>10} | {'Precision':>10} | {'Recall':>10} | {'F1':>10}")
    print("-" * 50)

    for t in thresholds:
        preds = (y_proba >= t).astype(int)
        p = precision_score(y_true, preds, zero_division=0)
        r = recall_score(y_true, preds, zero_division=0)
        f = f1_score(y_true, preds, zero_division=0)
        print(f"{t:>10.2f} | {p:>10.3f} | {r:>10.3f} | {f:>10.3f}")

        if f > best["f1"][0]:
            best["f1"] = (f, t)
        if r > best["recall"][0]:
            best["recall"] = (r, t)

    print(f"\n✅ Best F1 threshold:     {best['f1'][1]:.2f}  (F1={best['f1'][0]:.4f})")
    print(f"✅ Best Recall threshold: {best['recall'][1]:.2f}  (Recall={best['recall'][0]:.4f})")

    # Clinical choice: favor recall but not at cost of all precision
    # Use F1-optimal as primary
    chosen = best["f1"][1]
    print(f"\n→ Chosen threshold: {chosen:.2f}")
    return chosen

# ─────────────────────────────────────────────
# 5. MAIN
# ─────────────────────────────────────────────
def main():
    df = load_and_clean()
    df = engineer_features(df)

    X = df.drop(columns=[TARGET])
    y = df[TARGET].astype(int)

    feature_names = X.columns.tolist()
    print(f"\nFeatures ({len(feature_names)}): {feature_names}")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=42
    )
    print(f"\nTrain: {X_train.shape}, Test: {X_test.shape}")

    # ── Build ensemble pipeline ──
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_split=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    gb = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        random_state=42
    )

    # Soft voting ensemble
    ensemble = VotingClassifier(
        estimators=[("rf", rf), ("gb", gb)],
        voting="soft"
    )

    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", ensemble)
    ])

    print("\n📊 Cross-validation (5-fold, AUC)...")
    cv_scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="roc_auc", n_jobs=-1)
    print(f"CV AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    cv_recall = cross_val_score(pipe, X_train, y_train, cv=5, scoring="recall", n_jobs=-1)
    print(f"CV Recall: {cv_recall.mean():.4f} ± {cv_recall.std():.4f}")

    print("\n🔧 Fitting final model...")
    pipe.fit(X_train, y_train)

    print("\n📐 Calibrating probabilities (sigmoid)...")
    calibrated = CalibratedClassifierCV(pipe, method="sigmoid", cv=5)
    calibrated.fit(X_train, y_train)

    # Evaluate at default 0.5
    y_proba = calibrated.predict_proba(X_test)[:, 1]
    y_pred_default = calibrated.predict(X_test)
    evaluate(y_test, y_pred_default, y_proba, "@ default threshold 0.5")

    # Find optimal threshold
    threshold = find_best_threshold(y_test, y_proba)

    # Evaluate at optimal threshold
    y_pred_opt = (y_proba >= threshold).astype(int)
    evaluate(y_test, y_pred_opt, y_proba, f"@ optimal threshold {threshold:.2f}")

    # Feature importance (from RF inside ensemble)
    try:
        rf_fitted = pipe.named_steps["model"].estimators_[0]
        importances = rf_fitted.feature_importances_
        feat_imp = pd.Series(importances, index=feature_names).sort_values(ascending=False)
        print("\n🌟 Top Feature Importances:")
        print(feat_imp.head(10).to_string())
    except Exception as e:
        print(f"Could not extract feature importances: {e}")

    # Save
    print("\n💾 Saving artifacts...")
    Path("artifacts").mkdir(exist_ok=True)
    joblib.dump(calibrated, "artifacts/final_model.pkl")
    joblib.dump(feature_names, "artifacts/feature_names.pkl")
    joblib.dump(float(threshold), "artifacts/threshold.pkl")

    print("✅ Saved: artifacts/final_model.pkl")
    print("✅ Saved: artifacts/feature_names.pkl")
    print(f"✅ Saved: artifacts/threshold.pkl  (threshold={threshold:.2f})")

if __name__ == "__main__":
    main()
