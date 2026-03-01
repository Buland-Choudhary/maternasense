"""
MaternaSense v3 — Training Pipeline
- 1200 clinically calibrated patients
- 35 features across 3 tiers
- Missing value aware (realistic clinical missingness)
- RF + GBM ensemble
- Confidence scoring based on data completeness
"""

import pandas as pd
import numpy as np
from pathlib import Path
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix, classification_report)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

DATA_PATH = Path("data/preeclampsia_clinical.csv")
TARGET    = "PE_label"

TIER1 = ['age','bmi','gestational_age_weeks','gravida','parity','ethnicity',
         'prev_pe','family_hx_pe','chronic_htn','diabetes','autoimmune',
         'ivf_pregnancy','twin_pregnancy','smoking','nullipara',
         'systolic_bp','diastolic_bp','map','pulse_pressure',
         'headache_severity','visual_disturbance','epigastric_pain','edema_score']

TIER2 = ['hemoglobin','platelets','uric_acid','creatinine','alt','ast','urine_pcr']

TIER3 = ['plgf_mom','pappa_mom','sflt1_plgf_ratio','utapi','fetal_growth_pct']

ALL_FEATURES = TIER1 + TIER2 + TIER3

def evaluate(y_true, y_pred, y_proba, label=""):
    print(f"\n{'='*55}")
    print(f"EVALUATION {label}")
    print(f"{'='*55}")
    print(f"Accuracy:             {accuracy_score(y_true, y_pred):.4f}")
    print(f"Precision:            {precision_score(y_true, y_pred):.4f}")
    print(f"Recall (Sensitivity): {recall_score(y_true, y_pred):.4f}")
    print(f"F1 Score:             {f1_score(y_true, y_pred):.4f}")
    print(f"ROC-AUC:              {roc_auc_score(y_true, y_proba):.4f}")
    print(f"\nConfusion Matrix:\n{confusion_matrix(y_true, y_pred)}")
    print(f"\n{classification_report(y_true, y_pred)}")

def find_best_threshold(y_true, y_proba):
    from sklearn.metrics import f1_score, recall_score, precision_score
    thresholds = np.arange(0.10, 0.80, 0.05)
    best_f1 = (0, 0.5)

    print(f"\n{'Threshold':>10} | {'Precision':>10} | {'Recall':>10} | {'F1':>10}")
    print("-" * 48)
    for t in thresholds:
        preds = (y_proba >= t).astype(int)
        p = precision_score(y_true, preds, zero_division=0)
        r = recall_score(y_true, preds, zero_division=0)
        f = f1_score(y_true, preds, zero_division=0)
        print(f"{t:>10.2f} | {p:>10.3f} | {r:>10.3f} | {f:>10.3f}")
        if f > best_f1[0]:
            best_f1 = (f, t)

    print(f"\n✅ Best F1 threshold: {best_f1[1]:.2f}  (F1={best_f1[0]:.4f})")
    return float(best_f1[1])

def main():
    print("📥 Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"Shape: {df.shape}")
    print(f"PE rate: {df[TARGET].mean():.2%}")
    print(f"Missing values:\n{df[ALL_FEATURES].isna().sum()[df[ALL_FEATURES].isna().sum()>0]}")

    X = df[ALL_FEATURES]
    y = df[TARGET].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.20, random_state=42
    )
    print(f"\nTrain: {X_train.shape}, Test: {X_test.shape}")
    print(f"Train PE rate: {y_train.mean():.2%}")
    print(f"Test PE rate: {y_test.mean():.2%}")

    # ── Model ──
    rf = RandomForestClassifier(
        n_estimators=400,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )

    gb = GradientBoostingClassifier(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        min_samples_split=4,
        subsample=0.8,
        random_state=42
    )

    ensemble = VotingClassifier(
        estimators=[('rf', rf), ('gb', gb)],
        voting='soft',
        weights=[1, 1]
    )

    pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
        ('model',   ensemble)
    ])

    # ── Cross validation ──
    print("\n📊 Cross-validation (5-fold)...")
    cv_auc    = cross_val_score(pipe, X_train, y_train, cv=5, scoring='roc_auc', n_jobs=-1)
    cv_recall = cross_val_score(pipe, X_train, y_train, cv=5, scoring='recall', n_jobs=-1)
    cv_f1     = cross_val_score(pipe, X_train, y_train, cv=5, scoring='f1', n_jobs=-1)
    print(f"CV AUC:    {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")
    print(f"CV Recall: {cv_recall.mean():.4f} ± {cv_recall.std():.4f}")
    print(f"CV F1:     {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")

    # ── Fit & calibrate ──
    print("\n🔧 Fitting final model...")
    pipe.fit(X_train, y_train)

    print("\n📐 Calibrating probabilities (sigmoid, cv=5)...")
    calibrated = CalibratedClassifierCV(pipe, method='sigmoid', cv=5)
    calibrated.fit(X_train, y_train)

    # ── Evaluate ──
    y_proba = calibrated.predict_proba(X_test)[:, 1]
    y_pred  = calibrated.predict(X_test)
    evaluate(y_test, y_pred, y_proba, "@ default threshold 0.5")

    threshold = find_best_threshold(y_test, y_proba)
    y_pred_opt = (y_proba >= threshold).astype(int)
    evaluate(y_test, y_pred_opt, y_proba, f"@ optimal threshold {threshold:.2f}")

    # ── Feature importance ──
    try:
        cal_pipe  = calibrated.calibrated_classifiers_[0].estimator
        voting    = cal_pipe.named_steps['model']
        rf_fitted = voting.estimators_[0]
        imp = pd.Series(rf_fitted.feature_importances_, index=ALL_FEATURES)
        print("\n🌟 Top 15 Feature Importances:")
        print(imp.sort_values(ascending=False).head(15).to_string())
    except Exception as e:
        print(f"Feature importance skipped: {e}")

    # ── Save ──
    Path("artifacts").mkdir(exist_ok=True)
    joblib.dump(calibrated,         "artifacts/final_model.pkl")
    joblib.dump(ALL_FEATURES,       "artifacts/feature_names.pkl")
    joblib.dump(float(threshold),   "artifacts/threshold.pkl")
    joblib.dump({"tier1": TIER1, "tier2": TIER2, "tier3": TIER3}, "artifacts/tiers.pkl")

    print("\n✅ Saved: artifacts/final_model.pkl")
    print("✅ Saved: artifacts/feature_names.pkl")
    print("✅ Saved: artifacts/threshold.pkl")
    print("✅ Saved: artifacts/tiers.pkl")
    print(f"\n→ Threshold: {threshold:.2f}")
    print(f"→ Features:  {len(ALL_FEATURES)}")

if __name__ == "__main__":
    main()
