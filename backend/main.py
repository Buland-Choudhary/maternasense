from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import joblib
import anthropic
import os
import json
import pandas as pd
import numpy as np
from pathlib import Path

# ─────────────────────────────────────────────
# LOAD ARTIFACTS
# ─────────────────────────────────────────────
MODEL_PATH    = "artifacts/final_model.pkl"
FEATURES_PATH = "artifacts/feature_names.pkl"
THRESHOLD_PATH= "artifacts/threshold.pkl"
TIERS_PATH    = "artifacts/tiers.pkl"

model         = joblib.load(MODEL_PATH)
feature_names = joblib.load(FEATURES_PATH)
THRESHOLD     = joblib.load(THRESHOLD_PATH)
TIERS         = joblib.load(TIERS_PATH)

TIER1 = TIERS["tier1"]
TIER2 = TIERS["tier2"]
TIER3 = TIERS["tier3"]

print(f"✅ Model loaded")
print(f"✅ Features: {len(feature_names)}")
print(f"✅ Threshold: {THRESHOLD}")
print(f"✅ Tier1: {len(TIER1)} | Tier2: {len(TIER2)} | Tier3: {len(TIER3)}")

# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="MaternaSense API",
    version="3.0",
    description="AI-powered Preeclampsia Risk Screening — Tiered Clinical Input",
)

# ── CORS — allow all local dev ports ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# REQUEST SCHEMA — all Tier2/Tier3 are Optional
# ─────────────────────────────────────────────
class PredictRequest(BaseModel):
    # ── TIER 1 (required) ──
    age:                    float
    bmi:                    float
    gestational_age_weeks:  float
    gravida:                int
    parity:                 int
    ethnicity:              int       # 0=White,1=Black,2=Asian,3=Hispanic
    prev_pe:                int       # 0/1
    family_hx_pe:           int       # 0/1
    chronic_htn:            int       # 0/1
    diabetes:               int       # 0/1
    autoimmune:             int       # 0/1
    ivf_pregnancy:          int       # 0/1
    twin_pregnancy:         int       # 0/1
    smoking:                int       # 0/1
    systolic_bp:            float
    diastolic_bp:           float
    headache_severity:      int       # 0-3
    visual_disturbance:     int       # 0/1
    epigastric_pain:        int       # 0/1
    edema_score:            int       # 0-3

    # ── TIER 2 (optional — routine labs) ──
    hemoglobin:             Optional[float] = None
    platelets:              Optional[float] = None
    uric_acid:              Optional[float] = None
    creatinine:             Optional[float] = None
    alt:                    Optional[float] = None
    ast:                    Optional[float] = None
    urine_pcr:              Optional[float] = None

    # ── TIER 3 (optional — specialist tests) ──
    plgf_mom:               Optional[float] = None
    pappa_mom:              Optional[float] = None
    sflt1_plgf_ratio:       Optional[float] = None
    utapi:                  Optional[float] = None
    fetal_growth_pct:       Optional[float] = None


class TrendVisit(BaseModel):
    age:                    float
    bmi:                    float
    gestational_age_weeks:  float
    gravida:                int
    parity:                 int
    ethnicity:              int
    prev_pe:                int
    family_hx_pe:           int
    chronic_htn:            int
    diabetes:               int
    autoimmune:             int
    ivf_pregnancy:          int
    twin_pregnancy:         int
    smoking:                int
    systolic_bp:            float
    diastolic_bp:           float
    headache_severity:      int
    visual_disturbance:     int
    epigastric_pain:        int
    edema_score:            int
    hemoglobin:             Optional[float] = None
    platelets:              Optional[float] = None
    uric_acid:              Optional[float] = None
    creatinine:             Optional[float] = None
    alt:                    Optional[float] = None
    ast:                    Optional[float] = None
    urine_pcr:              Optional[float] = None
    plgf_mom:               Optional[float] = None
    pappa_mom:              Optional[float] = None
    sflt1_plgf_ratio:       Optional[float] = None
    utapi:                  Optional[float] = None
    fetal_growth_pct:       Optional[float] = None


class TrendRequest(BaseModel):
    visits: list[TrendVisit]


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def build_dataframe(req) -> pd.DataFrame:
    """Build feature dataframe — missing optional fields become NaN"""
    row = {
        # Tier 1
        "age":                   req.age,
        "bmi":                   req.bmi,
        "gestational_age_weeks": req.gestational_age_weeks,
        "gravida":               req.gravida,
        "parity":                req.parity,
        "ethnicity":             req.ethnicity,
        "prev_pe":               req.prev_pe,
        "family_hx_pe":          req.family_hx_pe,
        "chronic_htn":           req.chronic_htn,
        "diabetes":              req.diabetes,
        "autoimmune":            req.autoimmune,
        "ivf_pregnancy":         req.ivf_pregnancy,
        "twin_pregnancy":        req.twin_pregnancy,
        "smoking":               req.smoking,
        "nullipara":             int(req.parity == 0),
        "systolic_bp":           req.systolic_bp,
        "diastolic_bp":          req.diastolic_bp,
        "map":                   req.diastolic_bp + (req.systolic_bp - req.diastolic_bp) / 3,
        "pulse_pressure":        req.systolic_bp - req.diastolic_bp,
        "headache_severity":     req.headache_severity,
        "visual_disturbance":    req.visual_disturbance,
        "epigastric_pain":       req.epigastric_pain,
        "edema_score":           req.edema_score,

        # Tier 2 — None becomes NaN automatically
        "hemoglobin":            req.hemoglobin,
        "platelets":             req.platelets,
        "uric_acid":             req.uric_acid,
        "creatinine":            req.creatinine,
        "alt":                   req.alt,
        "ast":                   req.ast,
        "urine_pcr":             req.urine_pcr,

        # Tier 3
        "plgf_mom":              req.plgf_mom,
        "pappa_mom":             req.pappa_mom,
        "sflt1_plgf_ratio":      req.sflt1_plgf_ratio,
        "utapi":                 req.utapi,
        "fetal_growth_pct":      req.fetal_growth_pct,
    }

    df = pd.DataFrame([row])
    return df.reindex(columns=feature_names)


def risk_band(prob: float) -> str:
    if prob < 0.25:  return "Low"
    if prob < 0.50:  return "Moderate"
    if prob < 0.75:  return "High"
    return "Critical"


def clinical_risk_adjustment(prob: float, req) -> float:
    """
    Evidence-based clinical risk adjustment.
    Sources:
      - Bartsch et al. meta-analysis (RR values from 25M pregnancies)
      - WHO PLOS One AOR study (647K pregnancies)
      - ACOG Practice Bulletin 222 — high/moderate risk classification
      - FMF competing-risks model — biomarker thresholds
      - PROGNOSIS NEJM 2016 — sFlt-1/PlGF cutoffs
    """
    adjustment = 0.0

    # ══ ACOG HIGH-RISK FACTORS (any single one = 8%+ PE rate) ══
    if getattr(req, 'prev_pe', 0) == 1:
        adjustment += 0.20
    if getattr(req, 'chronic_htn', 0) == 1:
        adjustment += 0.15
    if getattr(req, 'autoimmune', 0) == 1:
        adjustment += 0.14
    if getattr(req, 'twin_pregnancy', 0) == 1:
        adjustment += 0.10

    # ══ ACOG MODERATE-RISK FACTORS ══
    if getattr(req, 'diabetes', 0) == 1:
        adjustment += 0.07
    if getattr(req, 'family_hx_pe', 0) == 1:
        adjustment += 0.06
    if getattr(req, 'ethnicity', 0) == 1:
        adjustment += 0.06
    if getattr(req, 'ivf_pregnancy', 0) == 1:
        adjustment += 0.04
    if getattr(req, 'parity', 1) == 0:
        adjustment += 0.03

    # ══ CUMULATIVE RISK BOOSTS ══
    high_risk_count = sum([
        getattr(req, 'prev_pe', 0) == 1,
        getattr(req, 'chronic_htn', 0) == 1,
        getattr(req, 'autoimmune', 0) == 1,
        getattr(req, 'twin_pregnancy', 0) == 1,
    ])
    mod_risk_count = sum([
        getattr(req, 'diabetes', 0) == 1,
        getattr(req, 'family_hx_pe', 0) == 1,
        getattr(req, 'ethnicity', 0) == 1,
        getattr(req, 'ivf_pregnancy', 0) == 1,
        getattr(req, 'parity', 1) == 0,
    ])
    if high_risk_count >= 2:
        adjustment += 0.10
    if mod_risk_count >= 3:
        adjustment += 0.06

    # ══ SYMPTOM SIGNALS ══
    hs = getattr(req, 'headache_severity', 0)
    if hs:
        adjustment += hs * 0.025
    if getattr(req, 'visual_disturbance', 0) == 1:
        adjustment += 0.050
    if getattr(req, 'epigastric_pain', 0) == 1:
        adjustment += 0.050
    es = getattr(req, 'edema_score', 0)
    if es:
        adjustment += es * 0.012

    # ══ BLOOD PRESSURE SIGNALS ══
    sbp = getattr(req, 'systolic_bp', 0)
    dbp = getattr(req, 'diastolic_bp', 0)
    if 120 <= sbp < 140 and (high_risk_count + mod_risk_count) > 0:
        adjustment += 0.09
    elif sbp >= 140:
        adjustment += 0.08
    if 80 <= dbp < 90 and (high_risk_count + mod_risk_count) > 0:
        adjustment += 0.05
    elif dbp >= 90:
        adjustment += 0.07

    # ══ LAB SIGNALS (ACOG thresholds) ══
    ua = getattr(req, 'uric_acid', None)
    if ua is not None:
        if ua > 4.5: adjustment += 0.04
        if ua > 5.5: adjustment += 0.06
        if ua > 7.0: adjustment += 0.06

    pcr = getattr(req, 'urine_pcr', None)
    if pcr is not None:
        if pcr > 0.15: adjustment += 0.04
        if pcr >= 0.30: adjustment += 0.10
        if pcr > 1.00: adjustment += 0.06

    plt = getattr(req, 'platelets', None)
    if plt is not None:
        if plt < 150: adjustment += 0.06
        if plt < 100: adjustment += 0.10

    cr = getattr(req, 'creatinine', None)
    if cr is not None:
        if cr > 0.90: adjustment += 0.04
        if cr > 1.10: adjustment += 0.08

    ast_val = getattr(req, 'ast', None)
    if ast_val is not None:
        if ast_val > 40: adjustment += 0.04
        if ast_val > 70: adjustment += 0.06

    alt_val = getattr(req, 'alt', None)
    if alt_val is not None:
        if alt_val > 40: adjustment += 0.03
        if alt_val > 70: adjustment += 0.05

    # ══ BIOMARKER SIGNALS (FMF / PROGNOSIS) ══
    sflt = getattr(req, 'sflt1_plgf_ratio', None)
    if sflt is not None:
        if sflt > 38:  adjustment += 0.18
        if sflt > 85:  adjustment += 0.12
        if sflt > 200: adjustment += 0.08

    plgf = getattr(req, 'plgf_mom', None)
    if plgf is not None:
        if plgf < 0.50: adjustment += 0.06
        if plgf < 0.40: adjustment += 0.10

    pappa = getattr(req, 'pappa_mom', None)
    if pappa is not None:
        if pappa < 0.50: adjustment += 0.06

    utapi_val = getattr(req, 'utapi', None)
    if utapi_val is not None:
        if utapi_val > 1.60: adjustment += 0.06
        if utapi_val > 2.00: adjustment += 0.06

    fgr = getattr(req, 'fetal_growth_pct', None)
    if fgr is not None:
        if fgr < 10: adjustment += 0.06

    # ══ BIOMARKER PROTECTION — normal biomarkers reduce adjustment ══
    sflt_protect  = getattr(req, 'sflt1_plgf_ratio', None)
    plgf_protect  = getattr(req, 'plgf_mom', None)
    utapi_protect = getattr(req, 'utapi', None)

    n_normal_biomarkers = sum([
        sflt_protect  is not None and sflt_protect  <= 38,
        plgf_protect  is not None and plgf_protect  >= 0.80,
        utapi_protect is not None and utapi_protect <= 1.20,
    ])
    biomarker_protection = (
        0.40 if n_normal_biomarkers >= 3 else
        0.60 if n_normal_biomarkers == 2 else
        0.80 if n_normal_biomarkers == 1 else
        1.00
    )
    has_abnormal_biomarkers = (
        (sflt_protect  is not None and sflt_protect  > 38)  or
        (plgf_protect  is not None and plgf_protect  < 0.40) or
        (utapi_protect is not None and utapi_protect > 1.60)
    )
    if not has_abnormal_biomarkers and n_normal_biomarkers > 0:
        adjustment = adjustment * biomarker_protection

    # ══ APPLY ADJUSTMENT ══
    adjustment = min(adjustment, 0.75)

    if prob < 0.15:
        adjusted = prob + adjustment * 0.88
    elif prob < 0.40:
        adjusted = prob + adjustment * 0.55
    else:
        adjusted = prob + adjustment * 0.25

    return float(min(adjusted, 0.99))


def compute_confidence(req) -> dict:
    tier1_filled = sum(1 for f in TIER1 if f != "nullipara" and
                       getattr(req, f, None) is not None)
    tier1_total  = len(TIER1) - 1

    tier2_fields = ["hemoglobin","platelets","uric_acid","creatinine","alt","ast","urine_pcr"]
    tier2_filled = sum(1 for f in tier2_fields if getattr(req, f, None) is not None)
    tier2_total  = len(tier2_fields)

    tier3_fields = ["plgf_mom","pappa_mom","sflt1_plgf_ratio","utapi","fetal_growth_pct"]
    tier3_filled = sum(1 for f in tier3_fields if getattr(req, f, None) is not None)
    tier3_total  = len(tier3_fields)

    score = (
        0.50 * (tier1_filled / tier1_total) +
        0.30 * (tier2_filled / tier2_total if tier2_total > 0 else 0) +
        0.20 * (tier3_filled / tier3_total if tier3_total > 0 else 0)
    )

    return {
        "score":         round(score, 3),
        "label":         "High" if score >= 0.85 else "Good" if score >= 0.65 else "Moderate" if score >= 0.45 else "Basic",
        "confidence_score": round(score * 100, 1),
        "tier1_filled":  tier1_filled,
        "tier1_total":   tier1_total,
        "tier2_filled":  tier2_filled,
        "tier2_total":   tier2_total,
        "tier3_filled":  tier3_filled,
        "tier3_total":   tier3_total,
        "message":       confidence_message(score, tier2_filled, tier3_filled),
    }


def confidence_message(score: float, t2: int, t3: int) -> str:
    if score >= 0.90:
        return "High confidence — comprehensive clinical data provided."
    if score >= 0.70:
        if t3 == 0:
            return "Good confidence. Adding specialist tests (PlGF, sFlt-1) would improve accuracy."
        return "Good confidence — sufficient clinical data."
    if score >= 0.50:
        return "Moderate confidence. Adding routine labs (Tier 2) will improve accuracy."
    return "Basic screening only. Add lab results for a more accurate prediction."


def get_feature_importances() -> list[dict]:
    try:
        pipeline = model.calibrated_classifiers_[0].estimator
        voting   = pipeline.named_steps["model"]
        rf       = voting.estimators_[0]
        imp      = rf.feature_importances_
        result   = [{"feature": f, "impact": round(float(i), 4)}
                    for f, i in zip(feature_names, imp)]
        result.sort(key=lambda x: x["impact"], reverse=True)
        return result[:8]
    except Exception as e:
        print(f"Feature importance error: {e}")
        return []


FEAT_DISPLAY = {
    "map":               "Mean Art. Pressure",
    "systolic_bp":       "Systolic BP",
    "diastolic_bp":      "Diastolic BP",
    "urine_pcr":         "Urine Protein Ratio",
    "uric_acid":         "Uric Acid",
    "sflt1_plgf_ratio":  "sFlt-1/PlGF Ratio",
    "utapi":             "Uterine Art. PI",
    "plgf_mom":          "PlGF (MoM)",
    "pappa_mom":         "PAPP-A (MoM)",
    "creatinine":        "Creatinine",
    "ast":               "AST",
    "alt":               "ALT",
    "platelets":         "Platelet Count",
    "bmi":               "BMI",
    "prev_pe":           "Previous PE",
    "chronic_htn":       "Chronic Hypertension",
    "pulse_pressure":    "Pulse Pressure",
    "hemoglobin":        "Hemoglobin",
    "fetal_growth_pct":  "Fetal Growth %ile",
    "edema_score":       "Edema Score",
    "headache_severity": "Headache Severity",
    "visual_disturbance":"Visual Disturbance",
}


def to_plain_english(prob: float, top_feats: list, confidence: dict) -> str:
    lvl  = risk_band(prob)
    pct  = round(prob * 100, 1)
    conf = confidence["confidence_score"]
    if not top_feats:
        return f"{lvl} risk ({pct}%). Confidence: {conf}%."
    top3 = [FEAT_DISPLAY.get(t["feature"], t["feature"]) for t in top_feats[:3]]
    msg  = confidence["message"]
    return (
        f"{lvl} risk ({pct}%). "
        f"Key drivers: {top3[0]}, {top3[1]}, {top3[2]}. "
        f"Prediction confidence: {conf}%. {msg}"
    )


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":    "MaternaSense API v3.0",
        "features":  len(feature_names),
        "threshold": THRESHOLD,
        "tiers":     {"tier1": len(TIER1), "tier2": len(TIER2), "tier3": len(TIER3)},
    }


@app.post("/predict")
def predict(request: PredictRequest):
    df         = build_dataframe(request)
    raw_prob   = float(model.predict_proba(df)[0][1])
    prob       = clinical_risk_adjustment(raw_prob, request)
    label      = int(prob >= THRESHOLD)
    confidence = compute_confidence(request)

    return {
        "probability":      round(prob, 4),
        "risk_score":       round(prob * 100, 2),
        "threshold_used":   THRESHOLD,
        "prediction_label": label,
        "risk_level":       risk_band(prob),
        "confidence":       confidence,
        "raw_model_prob":   round(raw_prob, 4),
    }


@app.post("/explain")
def explain(request: PredictRequest):
    df         = build_dataframe(request)
    raw_prob   = float(model.predict_proba(df)[0][1])
    prob       = clinical_risk_adjustment(raw_prob, request)
    top        = get_feature_importances()
    confidence = compute_confidence(request)

    for t in top:
        t["display_name"] = FEAT_DISPLAY.get(t["feature"], t["feature"])

    return {
        "probability":      round(prob, 4),
        "risk_score":       round(prob * 100, 2),
        "risk_level":       risk_band(prob),
        "top_contributors": top,
        "confidence":       confidence,
        "plain_english":    to_plain_english(prob, top, confidence),
        "raw_model_prob":   round(raw_prob, 4),
    }


@app.post("/trend")
def trend(request: TrendRequest):
    series = []
    for v in request.visits:
        df       = build_dataframe(v)
        raw_prob = float(model.predict_proba(df)[0][1])
        prob     = clinical_risk_adjustment(raw_prob, v)
        conf     = compute_confidence(v)
        series.append({
            "week":        v.gestational_age_weeks,
            "probability": round(prob, 4),
            "risk_score":  round(prob * 100, 2),
            "risk_level":  risk_band(prob),
            "confidence":  conf["confidence_score"],
        })

    series    = sorted(series, key=lambda x: x["week"])
    probs     = [s["probability"] for s in series]

    if len(probs) >= 2:
        delta = probs[-1] - probs[0]
        if delta > 0.05:    trend_dir = "Increasing"
        elif delta < -0.05: trend_dir = "Decreasing"
        else:               trend_dir = "Stable"
    else:
        trend_dir = "Insufficient data"

    return {
        "risk_over_time": series,
        "trend":          trend_dir,
        "peak_risk":      max(s["risk_score"] for s in series),
        "latest_level":   series[-1]["risk_level"],
    }
# ─────────────────────────────────────────────
# CHAT ENDPOINT — Claude AI Clinical Consultant
# ─────────────────────────────────────────────

# ── Anthropic client ──────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
anthropic_client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ── Chat request schema ───────────────────────
class ChatMessage(BaseModel):
    role:    str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages:       list[ChatMessage]
    patient_values: dict              = {}
    result:         dict              = {}


# ── Build system prompt from patient context ──
def build_system_prompt(patient_values: dict, result: dict) -> str:
    risk    = result.get("risk_level", "Unknown")
    prob    = result.get("probability", 0)
    probPct = round(prob * 100, 1)
    conf    = result.get("confidence", {})
    tops    = result.get("top_contributors", [])
    plain   = result.get("plain_english", "")

    pv = patient_values

    # Build patient summary
    ethnicity_map = {0:"White/Other", 1:"Black/Afro-Caribbean", 2:"Asian", 3:"Hispanic"}
    bool_fields   = ["prev_pe","family_hx_pe","chronic_htn","diabetes","autoimmune",
                     "ivf_pregnancy","twin_pregnancy","smoking","visual_disturbance","epigastric_pain"]

    def fmt(k, v):
        if v is None or v == "": return "Not provided"
        if k in bool_fields: return "Yes" if int(v) == 1 else "No"
        if k == "ethnicity": return ethnicity_map.get(int(v), "Unknown")
        return str(v)

    # Top contributors summary
    feat_display = {
        "map":"Mean Arterial Pressure", "systolic_bp":"Systolic BP",
        "diastolic_bp":"Diastolic BP", "urine_pcr":"Urine Protein:Creatinine Ratio",
        "uric_acid":"Uric Acid", "sflt1_plgf_ratio":"sFlt-1/PlGF Ratio",
        "utapi":"Uterine Artery PI", "plgf_mom":"PlGF (MoM)",
        "pappa_mom":"PAPP-A (MoM)", "creatinine":"Creatinine",
        "ast":"AST", "alt":"ALT", "platelets":"Platelet Count",
        "bmi":"BMI", "prev_pe":"Previous PE", "chronic_htn":"Chronic HTN",
        "hemoglobin":"Haemoglobin", "fetal_growth_pct":"Fetal Growth %ile",
    }
    top_str = ""
    for t in tops[:5]:
        name   = feat_display.get(t["feature"], t["feature"])
        impact = round(t["impact"] * 100, 1)
        top_str += f"\n  - {name}: {impact}% contribution"

    patient_block = f"""
PATIENT CLINICAL DATA
─────────────────────
Demographics:
  Age: {fmt('age', pv.get('age'))} years
  BMI: {fmt('bmi', pv.get('bmi'))} kg/m²
  Gestational age: {fmt('gestational_age_weeks', pv.get('gestational_age_weeks'))} weeks
  Gravida: {fmt('gravida', pv.get('gravida'))}  Parity: {fmt('parity', pv.get('parity'))}
  Ethnicity: {fmt('ethnicity', pv.get('ethnicity'))}

Vital Signs:
  Systolic BP: {fmt('systolic_bp', pv.get('systolic_bp'))} mmHg
  Diastolic BP: {fmt('diastolic_bp', pv.get('diastolic_bp'))} mmHg
  Headache severity: {fmt('headache_severity', pv.get('headache_severity'))} / 3
  Oedema score: {fmt('edema_score', pv.get('edema_score'))} / 3
  Visual disturbance: {fmt('visual_disturbance', pv.get('visual_disturbance'))}
  Epigastric pain: {fmt('epigastric_pain', pv.get('epigastric_pain'))}

Risk Factors:
  Previous PE: {fmt('prev_pe', pv.get('prev_pe'))}
  Family history of PE: {fmt('family_hx_pe', pv.get('family_hx_pe'))}
  Chronic hypertension: {fmt('chronic_htn', pv.get('chronic_htn'))}
  Diabetes: {fmt('diabetes', pv.get('diabetes'))}
  Autoimmune condition: {fmt('autoimmune', pv.get('autoimmune'))}
  IVF pregnancy: {fmt('ivf_pregnancy', pv.get('ivf_pregnancy'))}
  Twin pregnancy: {fmt('twin_pregnancy', pv.get('twin_pregnancy'))}
  Smoker: {fmt('smoking', pv.get('smoking'))}

Laboratory Results (Tier 2):
  Haemoglobin: {fmt('hemoglobin', pv.get('hemoglobin'))} g/dL (normal: 10.5–14.0)
  Platelets: {fmt('platelets', pv.get('platelets'))} ×10⁹/L (normal: 150–400)
  Uric acid: {fmt('uric_acid', pv.get('uric_acid'))} mg/dL (normal: 2.5–5.0)
  Creatinine: {fmt('creatinine', pv.get('creatinine'))} mg/dL (normal: 0.4–0.8 in pregnancy)
  ALT: {fmt('alt', pv.get('alt'))} IU/L (normal: 8–40)
  AST: {fmt('ast', pv.get('ast'))} IU/L (normal: 8–40)
  Urine PCR: {fmt('urine_pcr', pv.get('urine_pcr'))} (diagnostic: ≥0.30)

Specialist Biomarkers (Tier 3):
  PlGF (MoM): {fmt('plgf_mom', pv.get('plgf_mom'))} (high risk: <0.40)
  PAPP-A (MoM): {fmt('pappa_mom', pv.get('pappa_mom'))} (alert: <0.50)
  sFlt-1/PlGF ratio: {fmt('sflt1_plgf_ratio', pv.get('sflt1_plgf_ratio'))} (PE diagnostic: >38)
  Uterine artery PI: {fmt('utapi', pv.get('utapi'))} (elevated: >1.6)
  Fetal growth: {fmt('fetal_growth_pct', pv.get('fetal_growth_pct'))}th percentile (FGR: <10)

AI MODEL RESULT
───────────────
  Risk level: {risk}
  PE probability: {probPct}%
  Model confidence: {conf.get('label', 'Unknown')} ({conf.get('confidence_score', 0)}%)
  Summary: {plain}

Top contributing parameters:{top_str}
"""

    return f"""You are a senior Maternal-Fetal Medicine (MFM) consultant and preeclampsia specialist providing clinical decision support through the MaternaSense AI platform. You have just reviewed a full patient screening result.

Your role is to help the clinician — typically a midwife, registrar, or junior obstetrician — understand this patient's risk profile and decide on the best clinical course of action.

{patient_block}

GUIDELINES FOR YOUR RESPONSES:
1. You have full knowledge of this patient's data above. Reference specific values when relevant (e.g. "Given her sFlt-1/PlGF of 196...", "With her platelets at 82×10⁹/L...").
2. Base all clinical recommendations on current ACOG Practice Bulletin 222, FMF guidelines, NICE NG133, and PROGNOSIS Study evidence.
3. Be direct and clinically specific — this clinician needs actionable guidance, not vague reassurance.
4. For Critical or High risk patients, be appropriately urgent. Do not downplay severity.
5. When asked about medications, give specific doses and routes (e.g. "labetalol 200mg orally" or "IV hydralazine 5mg bolus").
6. Structure longer answers with clear headings when helpful.
7. Always end responses that involve clinical decisions with: "Apply your clinical judgement and local protocols — this is decision support, not a substitute for assessment."
8. You may use medical abbreviations (BP, MgSO4, CTG, BPP, MFM, FGR, etc.) — this is a clinical tool for trained professionals.
9. If asked something outside your scope (non-obstetric topics), politely redirect to the clinical context.
10. Keep responses concise but complete. This is a busy clinical environment.

You are NOT a chatbot. You are a clinical AI consultant who has reviewed this patient's data in full."""


# ── Streaming chat endpoint ───────────────────
@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Streaming chat endpoint. Returns Server-Sent Events.
    Frontend reads the stream and appends tokens in real time.
    """
    if not ANTHROPIC_API_KEY:
        return {"error": "ANTHROPIC_API_KEY not configured on server."}

    system_prompt = build_system_prompt(request.patient_values, request.result)

    # Convert to Anthropic message format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def generate():
        try:
            with anthropic_client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    # SSE format: data: <json>\n\n
                    yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )