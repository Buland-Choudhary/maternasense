import { jsPDF } from "jspdf";

// ── Palette ───────────────────────────────────────────────────────
const C = {
  navy:     [15,  23,  42],
  slate:    [51,  65,  85],
  muted:    [100, 116, 139],
  dim:      [148, 163, 184],
  border:   [226, 232, 240],
  bg:       [248, 250, 252],
  white:    [255, 255, 255],
  indigo:   [79,  70,  229],
  indigoBg: [238, 242, 255],
  indigoBd: [165, 180, 252],
  // Risk
  green:    [22,  163,  69],
  greenBg:  [240, 253, 244],
  amber:    [180,  83,   9],
  amberBg:  [255, 251, 235],
  orange:   [194,  65,  12],
  orangeBg: [255, 247, 237],
  red:      [185,  28,  28],
  redBg:    [254, 242, 242],
};

const RISK_C = {
  Low:      { text: C.green,  bg: C.greenBg,  border: [187, 247, 208] },
  Moderate: { text: C.amber,  bg: C.amberBg,  border: [253, 230, 138] },
  High:     { text: C.orange, bg: C.orangeBg, border: [254, 215, 170] },
  Critical: { text: C.red,    bg: C.redBg,    border: [254, 202, 202] },
};

const FIELD_NAMES = {
  age:"Age", bmi:"BMI", gestational_age_weeks:"Gestational Age",
  gravida:"Gravida", parity:"Parity", ethnicity:"Ethnicity",
  systolic_bp:"Systolic BP", diastolic_bp:"Diastolic BP",
  headache_severity:"Headache Severity", edema_score:"Oedema Score",
  visual_disturbance:"Visual Disturbance", epigastric_pain:"Epigastric Pain",
  prev_pe:"Previous PE", family_hx_pe:"Family Hx PE", chronic_htn:"Chronic HTN",
  diabetes:"Diabetes", autoimmune:"Autoimmune", ivf_pregnancy:"IVF / ART",
  twin_pregnancy:"Twin Pregnancy", smoking:"Smoker",
  hemoglobin:"Haemoglobin", platelets:"Platelets", uric_acid:"Uric Acid",
  creatinine:"Creatinine", alt:"ALT", ast:"AST", urine_pcr:"Urine PCR",
  plgf_mom:"PlGF (MoM)", pappa_mom:"PAPP-A (MoM)",
  sflt1_plgf_ratio:"sFlt-1/PlGF Ratio", utapi:"Uterine Artery PI",
  fetal_growth_pct:"Fetal Growth %ile",
};

const FIELD_UNITS = {
  age:"yrs", bmi:"kg/m²", gestational_age_weeks:"wks",
  systolic_bp:"mmHg", diastolic_bp:"mmHg",
  hemoglobin:"g/dL", platelets:"×10⁹/L", uric_acid:"mg/dL",
  creatinine:"mg/dL", alt:"IU/L", ast:"IU/L",
  plgf_mom:"MoM", pappa_mom:"MoM", fetal_growth_pct:"%ile",
};

const RANGES = {
  systolic_bp:      { lo:90,   hi:139,  inv:false },
  diastolic_bp:     { lo:60,   hi:89,   inv:false },
  hemoglobin:       { lo:10.5, hi:14,   inv:false },
  platelets:        { lo:150,  hi:400,  inv:true  },
  uric_acid:        { lo:2.5,  hi:5.0,  inv:false },
  creatinine:       { lo:0.4,  hi:0.89, inv:false },
  alt:              { lo:8,    hi:40,   inv:false },
  ast:              { lo:8,    hi:40,   inv:false },
  urine_pcr:        { lo:0,    hi:0.29, inv:false },
  plgf_mom:         { lo:0.40, hi:2.0,  inv:true  },
  pappa_mom:        { lo:0.5,  hi:2.5,  inv:true  },
  sflt1_plgf_ratio: { lo:0,    hi:38,   inv:false },
  utapi:            { lo:0.5,  hi:1.6,  inv:false },
  fetal_growth_pct: { lo:10,   hi:90,   inv:true  },
};

function getStatus(key, val) {
  const r = RANGES[key];
  if (!r || val == null) return null;
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  if (r.inv) {
    if (v < r.lo * 0.85) return "critical";
    if (v < r.lo)         return "low";
    return "normal";
  }
  if (v > r.hi * 1.20) return "critical";
  if (v > r.hi)         return "high";
  if (v > r.hi * 0.90) return "borderline";
  return "normal";
}

const STATUS_COLORS = {
  normal:    C.green,
  borderline:C.amber,
  high:      C.orange,
  low:       C.orange,
  critical:  C.red,
};
const STATUS_LABELS = {
  normal:"Normal", borderline:"Borderline", high:"Elevated", low:"Low", critical:"Abnormal"
};

function displayVal(key, val) {
  if (val === null || val === undefined || val === "") return "—";
  const bools = ["prev_pe","family_hx_pe","chronic_htn","diabetes","autoimmune","ivf_pregnancy","twin_pregnancy","smoking","visual_disturbance","epigastric_pain"];
  if (bools.includes(key)) return Number(val) === 1 ? "Yes" : "No";
  if (key === "ethnicity") return ["White/Other","Black/Afro-Caribbean","Asian","Hispanic"][Number(val)] ?? "—";
  const v = parseFloat(val);
  if (isNaN(v)) return "—";
  if (["creatinine","plgf_mom","pappa_mom","urine_pcr","utapi"].includes(key)) return v.toFixed(2);
  if (v % 1 === 0) return v.toFixed(0);
  return v.toFixed(1);
}

function normalRangeStr(key) {
  const r = RANGES[key];
  if (!r) return "—";
  const u = FIELD_UNITS[key] || "";
  if (r.inv)       return `> ${r.lo}${u ? " "+u : ""}`;
  if (r.lo === 0)  return `< ${r.hi}${u ? " "+u : ""}`;
  return `${r.lo}–${r.hi}${u ? " "+u : ""}`;
}

// ── Drawing helpers ───────────────────────────────────────────────
const PW = 210, ML = 20, MR = 20, CW = PW - ML - MR;

function sf(doc, [r,g,b]) { doc.setFillColor(r,g,b); }
function sd(doc, [r,g,b]) { doc.setDrawColor(r,g,b); }
function st(doc, [r,g,b]) { doc.setTextColor(r,g,b); }

function rect(doc, x, y, w, h, fill, stroke, r=0) {
  if (fill)  sf(doc, fill);
  if (stroke) sd(doc, stroke); else doc.setDrawColor(0,0,0,0);
  doc.setLineWidth(stroke ? 0.3 : 0);
  const s = fill && stroke ? "FD" : fill ? "F" : "D";
  if (r > 0) doc.roundedRect(x, y, w, h, r, r, s);
  else        doc.rect(x, y, w, h, s);
}

function text(doc, str, x, y, {
  color = C.navy, size = 10, bold = false, align = "left", maxW = null
} = {}) {
  st(doc, color);
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  const s = String(str);
  if (maxW) {
    const lines = doc.splitTextToSize(s, maxW);
    doc.text(lines, x, y, { align });
    return lines.length;
  }
  doc.text(s, x, y, { align });
  return 1;
}

function hline(doc, x1, x2, y, color = C.border, w = 0.25) {
  sd(doc, color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}

function badge(doc, label, x, y, color, bgColor) {
  const w = doc.getTextWidth(label) + 10;
  rect(doc, x, y - 4, w, 6, bgColor, null, 2);
  text(doc, label, x + w/2, y, { color, size: 7.5, bold: true, align: "center" });
  return w;
}

function sectionTitle(doc, title, y) {
  rect(doc, ML, y, CW, 7.5, C.bg, null, 2);
  rect(doc, ML, y, 3, 7.5, C.indigo, null, 1);
  text(doc, title, ML + 7, y + 5, { color: C.slate, size: 8.5, bold: true });
  return y + 11;
}

function pageHeader(doc, dateStr, pageNum) {
  rect(doc, 0, 0, PW, 12, C.navy);
  text(doc, "MaternaSense", ML, 8, { color: C.white, size: 9.5, bold: true });
  text(doc, "Preeclampsia Risk Assessment Report", ML + 35, 8, { color: [148, 163, 184], size: 8 });
  text(doc, `${dateStr}  ·  Page ${pageNum}`, PW - MR, 8, { color: [148, 163, 184], size: 8, align: "right" });
}

function pageFooter(doc, total, pageNum) {
  const PH = 297;
  hline(doc, ML, PW - MR, PH - 12);
  text(doc, "For clinical decision support only. Not a medical diagnosis. Always apply professional clinical judgement.", PW/2, PH - 7.5, { color: C.dim, size: 7.5, align: "center" });
  text(doc, `${pageNum} / ${total}`, PW - MR, PH - 7.5, { color: C.dim, size: 7.5, align: "right" });
}

// ── Main generator ────────────────────────────────────────────────
export function generateReport(result, patientValues = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
  const reportId = `MS-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const risk    = result?.risk_level || "Low";
  const prob    = result?.probability || 0;
  const conf    = result?.confidence;
  const tops    = result?.top_contributors || [];
  const rc      = RISK_C[risk];
  const probPct = Math.round(prob * 100);

  // ════════════════════════════════════════════
  // PAGE 1
  // ════════════════════════════════════════════
  let y = 0;
  pageHeader(doc, dateStr, 1);
  y = 18;

  // ── Cover band ──────────────────────────────
  rect(doc, ML, y, CW, 28, rc.bg, null, 3);
  rect(doc, ML, y, 4, 28, rc.text, null, 2);

  // Risk level + probability
  text(doc, "SCREENING RESULT", ML + 9, y + 6, { color: rc.text, size: 7.5, bold: true });
  text(doc, `${risk} Risk`, ML + 9, y + 14, { color: C.navy, size: 18, bold: true });
  text(doc, { Low:"No significant indicators identified.", Moderate:"Elevated risk — enhanced monitoring recommended.", High:"Multiple high-risk indicators — urgent specialist review.", Critical:"Immediate clinical assessment required." }[risk],
    ML + 9, y + 21, { color: C.slate, size: 8.5, maxW: 110 });

  // Probability circle
  const cx2 = PW - MR - 18, cy2 = y + 14;
  rect(doc, PW - MR - 36, y + 2, 34, 24, C.white, rc.border, 3);
  text(doc, `${probPct}%`, cx2, cy2 + 1, { color: rc.text, size: 20, bold: true, align: "center" });
  text(doc, "PE Risk", cx2, cy2 + 8, { color: C.muted, size: 7.5, align: "center" });

  y += 33;

  // Probability bar
  rect(doc, ML, y, CW, 5, C.border, null, 2);
  if (probPct > 0) {
    sf(doc, rc.text);
    doc.roundedRect(ML, y, (probPct/100)*CW, 5, 2, 2, "F");
  }
  // Threshold marker at 30%
  sd(doc, C.muted);
  doc.setLineWidth(0.4);
  doc.line(ML + CW*0.30, y - 1, ML + CW*0.30, y + 6);
  text(doc, "30%", ML + CW*0.30, y + 9, { color: C.muted, size: 7, align: "center" });
  text(doc, "0%", ML, y + 9, { color: C.dim, size: 7 });
  text(doc, "100%", PW - MR, y + 9, { color: C.dim, size: 7, align: "right" });

  y += 16;

  // ── Two column: Patient Info + Report Info ──
  const colW = (CW - 5) / 2;

  // Left — Patient Info
  rect(doc, ML, y, colW, 38, C.bg, null, 3);
  text(doc, "PATIENT INFORMATION", ML + 5, y + 6, { color: C.muted, size: 7, bold: true });
  hline(doc, ML + 4, ML + colW - 4, y + 8.5, C.border);

  const pv = patientValues;
  const patRows = [
    ["Age",          displayVal("age", pv.age) + (pv.age ? " years" : "")],
    ["BMI",          displayVal("bmi", pv.bmi) + (pv.bmi ? " kg/m²" : "")],
    ["Gestation",    displayVal("gestational_age_weeks", pv.gestational_age_weeks) + (pv.gestational_age_weeks ? " wks" : "")],
    ["Parity/Grav",  `P${pv.parity ?? "—"}  G${pv.gravida ?? "—"}`],
    ["Ethnicity",    displayVal("ethnicity", pv.ethnicity)],
  ];
  let py = y + 13;
  for (const [l, v] of patRows) {
    text(doc, l, ML + 5, py, { color: C.muted, size: 8.5 });
    text(doc, v, ML + colW - 4, py, { color: C.navy, size: 8.5, bold: true, align: "right" });
    py += 5.5;
  }

  // Right — Report info
  const rx = ML + colW + 5;
  rect(doc, rx, y, colW, 38, C.bg, null, 3);
  text(doc, "REPORT INFORMATION", rx + 5, y + 6, { color: C.muted, size: 7, bold: true });
  hline(doc, rx + 4, rx + colW - 4, y + 8.5, C.border);

  const confScore = conf?.score || 0;
  const confLabel = conf?.label || "Basic";
  const repRows = [
    ["Report ID",   reportId],
    ["Generated",   `${dateStr}, ${timeStr}`],
    ["Model",       "RF + GBM Ensemble"],
    ["Threshold",   "30% probability"],
    ["Confidence",  `${confLabel} (${Math.round(confScore*100)}%)`],
  ];
  let ry2 = y + 13;
  for (const [l, v] of repRows) {
    text(doc, l, rx + 5, ry2, { color: C.muted, size: 8.5 });
    text(doc, v, rx + colW - 4, ry2, { color: C.navy, size: 8.5, bold: true, align: "right" });
    ry2 += 5.5;
  }
  y += 43;

  // ── Clinical Summary ────────────────────────
  y = sectionTitle(doc, "CLINICAL ASSESSMENT SUMMARY", y);
  const summaries = {
    Low:      "Based on all available clinical data, this patient shows no significant indicators of preeclampsia. Blood pressure, laboratory values, and risk profile are all within expected ranges for this gestational age. Routine antenatal monitoring is recommended with standard scheduling.",
    Moderate: "Multiple risk factors have elevated this patient's preeclampsia probability above baseline. While this does not confirm active preeclampsia, the combination of clinical indicators warrants closer surveillance and proactive laboratory investigation. Early aspirin intervention, if not already commenced, should be considered.",
    High:     "Multiple high-risk indicators have been identified. The clinical picture suggests significant placental or vascular stress. Key biomarkers and clinical findings are driving the elevated risk prediction. Same-day specialist referral is strongly recommended — do not wait until the next scheduled appointment.",
    Critical: "Critical warning signs are present and require immediate clinical attention. This patient's profile indicates active or imminent preeclampsia with potential for rapid clinical deterioration. Any delay in assessment carries significant risk to both mother and baby. Immediate hospital assessment, continuous monitoring, and delivery planning are required.",
  };
  const summLines = text(doc, summaries[risk], ML, y, { color: C.slate, size: 9.5, maxW: CW });
  y += summLines * 5 + 10;

  // ── Key Findings ────────────────────────────
  const findingRules = [
    { k:"sflt1_plgf_ratio", fn:v => v>85?`sFlt-1/PlGF critically elevated at ${v} (${(v/38).toFixed(1)}x above diagnostic threshold of 38). Active placental dysfunction confirmed (PROGNOSIS, NEJM 2016).`:v>38?`sFlt-1/PlGF ratio of ${v} exceeds PE diagnostic threshold of 38. Significant angiogenic imbalance present.`:null },
    { k:"plgf_mom",         fn:v => v<0.40?`PlGF critically reduced at ${v} MoM — below FMF high-risk threshold of 0.40. Severely impaired placental growth factor production.`:v<0.50?`PlGF of ${v} MoM below alert level of 0.50 MoM.`:null },
    { k:"urine_pcr",        fn:v => v>=0.30?`Urine PCR of ${v} meets ACOG diagnostic criterion for significant proteinuria (PCR >= 0.30).`:null },
    { k:"platelets",        fn:v => v<100?`Platelet count critically low at ${v} x10^9/L — ACOG severe feature. HELLP assessment required urgently.`:v<150?`Platelets reduced at ${v} x10^9/L — approaching ACOG severe feature threshold.`:null },
    { k:"systolic_bp",      fn:v => v>=160?`Systolic BP of ${v} mmHg — ACOG severe hypertension criterion. Immediate antihypertensive treatment required.`:v>=140?`Systolic BP of ${v} mmHg meets ACOG PE diagnostic criterion (>= 140 mmHg).`:null },
    { k:"diastolic_bp",     fn:v => v>=110?`Diastolic BP of ${v} mmHg — ACOG severe hypertension. Immediate treatment required.`:v>=90?`Diastolic BP of ${v} mmHg meets ACOG PE diagnostic criterion (>= 90 mmHg).`:null },
    { k:"ast",              fn:v => v>70?`AST of ${v} IU/L (${(v/40).toFixed(1)}x upper limit of normal) — ACOG severe feature. Liver involvement confirmed. Assess for HELLP.`:v>40?`AST mildly elevated at ${v} IU/L — early hepatic stress.`:null },
    { k:"creatinine",       fn:v => v>1.1?`Creatinine of ${v} mg/dL — ACOG severe feature indicating significant renal impairment.`:v>0.9?`Creatinine of ${v} mg/dL above the normal pregnancy range.`:null },
    { k:"uric_acid",        fn:v => v>7.0?`Uric acid critically elevated at ${v} mg/dL — severe renal stress.`:v>5.5?`Uric acid of ${v} mg/dL exceeds 5.5 mg/dL threshold for significant renal involvement.`:null },
  ];

  const findings = [];
  for (const r of findingRules) {
    const val = patientValues?.[r.k];
    if (val == null || val === "") continue;
    const msg = r.fn(parseFloat(val));
    if (msg) findings.push(msg);
    if (findings.length >= 5) break;
  }

  if (findings.length > 0) {
    if (y > 220) { doc.addPage(); pageHeader(doc, dateStr, 2); y = 18; }
    y = sectionTitle(doc, "KEY CLINICAL FINDINGS", y);
    for (const [i, f] of findings.entries()) {
      if (y > 255) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
      rect(doc, ML, y - 3.5, 6, 6, rc.bg, null, 1.5);
      text(doc, String(i+1), ML + 3, y, { color: rc.text, size: 8, bold: true, align: "center" });
      const lines = text(doc, f, ML + 9, y, { color: C.slate, size: 9, maxW: CW - 10 });
      y += lines * 4.8 + 5;
    }
    y += 4;
  }

  // ── Top Contributors Table ───────────────────
  if (y > 210) { doc.addPage(); pageHeader(doc, dateStr, 2); y = 18; }
  y = sectionTitle(doc, "TOP CONTRIBUTING PARAMETERS", y);

  // Table header
  rect(doc, ML, y, CW, 7, [241, 245, 249], null, 2);
  text(doc, "Parameter",      ML + 3,        y + 5, { color: C.muted, size: 8, bold: true });
  text(doc, "Patient Value",  ML + 68,       y + 5, { color: C.muted, size: 8, bold: true, align:"center" });
  text(doc, "Normal Range",   ML + 100,      y + 5, { color: C.muted, size: 8, bold: true, align:"center" });
  text(doc, "Status",         ML + 130,      y + 5, { color: C.muted, size: 8, bold: true, align:"center" });
  text(doc, "Impact",         ML + CW - 3,   y + 5, { color: C.muted, size: 8, bold: true, align:"right" });
  hline(doc, ML, PW - MR, y + 7, C.border);
  y += 9;

  for (const [i, c] of tops.slice(0, 10).entries()) {
    if (y > 262) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
    const rowBg = i % 2 === 0 ? C.white : [248, 250, 252];
    rect(doc, ML, y, CW, 8, rowBg, null);

    const name   = FIELD_NAMES[c.feature] || c.feature;
    const val    = patientValues?.[c.feature];
    const unit   = FIELD_UNITS[c.feature] || "";
    const raw    = displayVal(c.feature, val);
    const valStr = raw === "—" ? "—" : raw + (unit ? " " + unit : "");
    const nrm    = normalRangeStr(c.feature);
    const status = getStatus(c.feature, val);
    const sColor = status ? STATUS_COLORS[status] : C.dim;
    const sLabel = status ? STATUS_LABELS[status] : "—";
    const impact = `${(c.impact * 100).toFixed(1)}%`;

    text(doc, name,   ML + 3,      y + 5.5, { color: C.navy,   size: 8.5 });
    text(doc, valStr, ML + 68,     y + 5.5, { color: C.navy,   size: 8.5, bold: true, align:"center" });
    text(doc, nrm,    ML + 100,    y + 5.5, { color: C.muted,  size: 8, align:"center" });

    // Status badge
    if (status) {
      const bg = status === "normal" ? [240,253,244] : status === "borderline" ? [255,251,235] : status === "critical" ? [254,242,242] : [255,247,237];
      rect(doc, ML + 118, y + 1.5, 24, 5, bg, null, 1.5);
      text(doc, sLabel, ML + 130, y + 5.5, { color: sColor, size: 7.5, bold: true, align:"center" });
    } else {
      text(doc, "—", ML + 130, y + 5.5, { color: C.dim, size: 8, align:"center" });
    }

    // Impact bar
    const bx = ML + 148, bw = CW - 150, bh = 3;
    rect(doc, bx, y + 2.5, bw, bh, C.border, null, 1);
    if (c.impact > 0) {
      sf(doc, [99, 102, 241]);
      doc.roundedRect(bx, y + 2.5, Math.max(1, Math.min(c.impact * 4 * bw, bw)), bh, 1, 1, "F");
    }
    text(doc, impact, PW - MR - 1, y + 5.5, { color: C.muted, size: 7.5, align:"right" });

    hline(doc, ML, PW - MR, y + 8, C.border);
    y += 9;
  }

  y += 6;

  // ════════════════════════════════════════════
  // PAGE 2
  // ════════════════════════════════════════════
  doc.addPage();
  pageHeader(doc, dateStr, 2);
  y = 18;

  // ── Clinical Next Steps ─────────────────────
  const STEPS = {
    Low:      ["Continue routine antenatal visits as scheduled.", "Repeat blood pressure at next visit — document two readings >=4 hours apart if elevated.", "Advise patient on PE warning signs: persistent headache, visual disturbance, epigastric pain.", "Reassess if new symptoms develop or blood pressure changes."],
    Moderate: ["Increase blood pressure monitoring — at minimum weekly.", "Order full PE panel: FBC, uric acid, creatinine, AST/ALT, urine PCR.", "Consider aspirin 150 mg nightly if <36 weeks (ACOG/FMF recommendation).", "Refer to specialist if any laboratory results are abnormal.", "Educate patient on when to seek urgent review."],
    High:     ["Urgent referral to Maternal-Fetal Medicine — same day.", "Hospital admission if SBP >=140 or DBP >=90 on presentation.", "Urgent bloods: FBC, LFTs, uric acid, creatinine, coagulation screen.", "sFlt-1/PlGF ratio if not already available.", "Continuous fetal monitoring — CTG and biophysical profile.", "Corticosteroids for fetal lung maturity if <34 weeks gestation."],
    Critical: ["IMMEDIATE hospital admission — do not discharge pending results.", "Continuous BP monitoring every 15 minutes.", "Commence MgSO4 for seizure prophylaxis per unit protocol.", "Antihypertensives if SBP >=160 or DBP >=110 (IV labetalol or hydralazine).", "Neonatology team involvement for delivery planning.", "Senior obstetric input required for delivery timing decision."],
  };

  y = sectionTitle(doc, `RECOMMENDED CLINICAL ACTIONS — ${risk.toUpperCase()} RISK`, y);
  rect(doc, ML, y, CW, 8, rc.bg, null, 3);
  text(doc, { Low:"Routine monitoring — continue standard antenatal care.", Moderate:"Enhanced monitoring and investigation recommended — do not delay labs.", High:"Urgent specialist review required — same-day referral advised.", Critical:"IMMEDIATE hospital admission required — do not discharge." }[risk],
    ML + 5, y + 5.5, { color: rc.text, size: 9.5, bold: true });
  y += 13;

  for (const [i, step] of (STEPS[risk] || []).entries()) {
    if (y > 260) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
    rect(doc, ML, y - 3.5, 6, 6, rc.bg, null, 1.5);
    text(doc, String(i+1), ML + 3, y, { color: rc.text, size: 8, bold: true, align: "center" });
    const lines = text(doc, step, ML + 9, y, { color: C.slate, size: 9.5, maxW: CW - 10 });
    y += lines * 5 + 5;
  }
  y += 6;

  // ── Complete Parameters ─────────────────────
  const groups = [
    { title: "TIER 1 — CLINICAL BASELINE", color: [79,70,229], fields: ["age","bmi","gestational_age_weeks","gravida","parity","ethnicity","systolic_bp","diastolic_bp","headache_severity","edema_score","prev_pe","family_hx_pe","chronic_htn","diabetes","autoimmune","ivf_pregnancy","twin_pregnancy","smoking","visual_disturbance","epigastric_pain"] },
    { title: "TIER 2 — ROUTINE LABORATORY", color: [8,145,178], fields: ["hemoglobin","platelets","uric_acid","creatinine","alt","ast","urine_pcr"] },
    { title: "TIER 3 — SPECIALIST BIOMARKERS", color: [185,28,28], fields: ["plgf_mom","pappa_mom","sflt1_plgf_ratio","utapi","fetal_growth_pct"] },
  ];

  if (y > 220) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
  y = sectionTitle(doc, "COMPLETE PARAMETER OVERVIEW", y);

  for (const g of groups) {
    if (y > 255) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
    rect(doc, ML, y, CW, 6.5, [...g.color, 0.12], null, 2);
    sf(doc, g.color); doc.roundedRect(ML, y, 3, 6.5, 1, 1, "F");
    text(doc, g.title, ML + 6, y + 4.5, { color: g.color, size: 7.5, bold: true });
    y += 9;

    // Sub-header
    rect(doc, ML, y, CW, 6, [241,245,249], null);
    text(doc, "Parameter",    ML + 3,     y + 4.2, { color: C.muted, size: 7.5, bold: true });
    text(doc, "Value",        ML + 80,    y + 4.2, { color: C.muted, size: 7.5, bold: true, align:"center" });
    text(doc, "Normal Range", ML + 120,   y + 4.2, { color: C.muted, size: 7.5, bold: true, align:"center" });
    text(doc, "Status",       ML + CW - 3, y + 4.2, { color: C.muted, size: 7.5, bold: true, align:"right" });
    y += 7;

    for (const [i, fk] of g.fields.entries()) {
      const val = patientValues?.[fk];
      if (y > 265) { doc.addPage(); pageHeader(doc, dateStr, 3); y = 18; }
      const rowBg = i % 2 === 0 ? C.white : [248,250,252];
      rect(doc, ML, y, CW, 7, rowBg, null);

      const raw    = displayVal(fk, val);
      const unit   = FIELD_UNITS[fk] || "";
      const valStr = raw === "—" ? "—" : raw + (unit ? " " + unit : "");
      const nrm    = normalRangeStr(fk);
      const status = getStatus(fk, val);
      const sColor = status ? STATUS_COLORS[status] : C.dim;
      const sLabel = status ? STATUS_LABELS[status] : (raw !== "—" ? "—" : "No data");

      text(doc, FIELD_NAMES[fk] || fk, ML + 3, y + 5, { color: C.navy, size: 8.5 });
      text(doc, valStr, ML + 80, y + 5, { color: raw==="—" ? C.dim : C.navy, size: 8.5, bold: raw!=="—", align:"center" });
      if (RANGES[fk]) {
        text(doc, nrm, ML + 120, y + 5, { color: C.muted, size: 8, align:"center" });
        if (status) {
          const bg2 = status==="normal"?[240,253,244]:status==="borderline"?[255,251,235]:status==="critical"?[254,242,242]:[255,247,237];
          rect(doc, ML+CW-26, y+1.5, 24, 4, bg2, null, 1.5);
          text(doc, sLabel, ML+CW-14, y+5, { color: sColor, size: 7, bold:true, align:"center" });
        }
      } else {
        text(doc, raw !== "—" ? "—" : "No data", ML + 120, y + 5, { color: C.dim, size: 8, align:"center" });
      }
      hline(doc, ML, PW-MR, y+7, C.border);
      y += 8;
    }
    y += 6;
  }

  // ── Evidence Base ────────────────────────────
  if (y > 240) { doc.addPage(); pageHeader(doc, dateStr, 4); y = 18; }
  y = sectionTitle(doc, "CLINICAL EVIDENCE BASE", y);

  const sources = [
    ["Bartsch et al. (2016)",          "Meta-analysis · 92 studies · 25M+ pregnancies. Definitive odds ratios for all clinical risk factors. Prev PE RR=8.4, Autoimmune RR=9.72, Chronic HTN RR=5.1."],
    ["ACOG Practice Bulletin 222",     "2020 US diagnostic criteria: SBP >=140 or DBP >=90 plus proteinuria >=0.3 (PCR >=0.30). Defines severe features, management thresholds and prevention protocols."],
    ["FMF Competing-Risks (Nicolaides)","57,000 pregnancies. Triple test (MAP + UtA-PI + PlGF) achieves 96% detection at 10% false positive rate. PlGF <0.40 MoM = high-risk threshold."],
    ["PROGNOSIS Study (NEJM 2016)",    "1,273 women. sFlt-1/PlGF ratio <=38 rules out PE within 1 week with NPV 99.3%. Ratio >38 rules in PE within 4 weeks. Gold-standard predictive biomarker."],
    ["WHO Multi-Country Study",        "647,000 pregnancies, 29 countries. Adjusted odds ratios for global populations. Chronic HTN AOR 7.75 — highest in any study."],
  ];

  for (const [src, desc] of sources) {
    if (y > 262) { doc.addPage(); pageHeader(doc, dateStr, 4); y = 18; }
    rect(doc, ML, y - 1, 3, 6, C.indigo, null, 1);
    text(doc, src, ML + 6, y + 2.5, { color: C.navy, size: 9, bold: true });
    const lines = text(doc, desc, ML + 6, y + 7.5, { color: C.muted, size: 8.5, maxW: CW - 8 });
    y += lines * 4.5 + 12;
  }

  // ── Disclaimer ───────────────────────────────
  if (y > 248) { doc.addPage(); pageHeader(doc, dateStr, 5); y = 18; }
  y += 4;
  rect(doc, ML, y, CW, 24, [248,250,252], C.border, 3);
  text(doc, "CLINICAL DISCLAIMER", ML + 5, y + 6, { color: C.slate, size: 8, bold: true });
  text(doc,
    "This report is generated by MaternaSense v3.0 as a clinical decision support tool only. It does not constitute a medical diagnosis and must not replace professional clinical judgement, physical examination, or local institutional protocols. All predictions are based on statistical models. Individual patient circumstances may differ. Clinicians should apply their expertise and consult current ACOG, NICE, and FMF guidelines. For medical emergencies, contact emergency services immediately.",
    ML + 5, y + 12, { color: C.muted, size: 8, maxW: CW - 10 });

  // ── Page numbers on all pages ────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    pageFooter(doc, total, p);
  }

  // ── Save ─────────────────────────────────────
  const fname = `MaternaSense_Report_${now.toISOString().slice(0,10)}.pdf`;
  doc.save(fname);
  return fname;
}