import { useState, useRef, useEffect } from "react";
import { explain } from "../lib/api";
import { generateReport } from "../lib/generateReport";
import ChatPanel from "../components/ChatPanel";

const DISP = "'Fraunces', Georgia, serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Risk config ─────────────────────────────────────────────
const RISK = {
  Low:      { color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0", label:"Low Risk",      verb:"No significant preeclampsia indicators identified." },
  Moderate: { color:"#b45309", bg:"#fffbeb", border:"#fde68a", label:"Moderate Risk", verb:"Elevated risk — enhanced monitoring recommended." },
  High:     { color:"#c2410c", bg:"#fff7ed", border:"#fed7aa", label:"High Risk",     verb:"Multiple high-risk indicators — urgent specialist review." },
  Critical: { color:"#b91c1c", bg:"#fef2f2", border:"#fecaca", label:"Critical Risk", verb:"Immediate clinical assessment required." },
};

// ─── Field info ───────────────────────────────────────────────
const FINFO = {
  age:{ name:"Patient Age", what:"Age of the mother at assessment.", normal:"Any — risk increases at 35+", why:"Women ≥40 have ~2× higher PE risk due to vascular ageing.", tag:"ACOG moderate risk factor" },
  bmi:{ name:"BMI", what:"Weight (kg) ÷ height² (m).", normal:"18.5–34.9 kg/m²", why:"BMI ≥35 carries 3.9× higher PE risk (AOR). Excess adipose tissue drives chronic inflammation.", tag:"WHO Multi-country: AOR 3.90" },
  gestational_age_weeks:{ name:"Gestational Age", what:"Weeks pregnant at assessment.", normal:"Full term = 37–42 weeks", why:"Early-onset PE (<34 wks) is more severe. Biomarker thresholds adjust by gestational age.", tag:"FMF Competing-Risks Model" },
  gravida:{ name:"Gravida", what:"Total pregnancies including current.", normal:"Any", why:"Combined with parity, helps assess obstetric history.", tag:"ACOG risk stratification" },
  parity:{ name:"Parity", what:"Previous deliveries past 20 weeks.", normal:"0 = nulliparous (first delivery)", why:"Nulliparity carries ~3× higher PE risk — first exposure to paternal antigens.", tag:"Bartsch meta-analysis, WHO study" },
  systolic_bp:{ name:"Systolic BP", what:"Upper BP number (mmHg) — heart beating.", normal:"90–139 mmHg", why:"SBP ≥140 on two readings ≥4 hours apart is an ACOG PE diagnostic criterion.", tag:"ACOG Diagnostic Criterion: ≥140 mmHg" },
  diastolic_bp:{ name:"Diastolic BP", what:"Lower BP number (mmHg) — between beats.", normal:"60–89 mmHg", why:"DBP ≥90 is the second ACOG BP criterion. DBP ≥110 = severe feature requiring emergency treatment.", tag:"ACOG Diagnostic Criterion: ≥90 mmHg" },
  headache_severity:{ name:"Headache Severity", what:"0=none · 1=mild · 2=moderate · 3=severe/persistent.", normal:"0–1", why:"Severe persistent headaches reflect hypertensive cerebral blood flow changes — ACOG severe feature.", tag:"ACOG Severe Features" },
  edema_score:{ name:"Oedema Score", what:"0=none · 1=ankles · 2=face/hands · 3=generalised.", normal:"0–1", why:"Face/hand swelling with elevated BP suggests vascular leakage consistent with PE.", tag:"Clinical assessment" },
  visual_disturbance:{ name:"Visual Disturbance", what:"Blurring, flashing lights, spots, double vision.", normal:"None", why:"Reflects hypertensive damage to retina or occipital cortex — ACOG severe feature requiring immediate assessment.", tag:"ACOG Severe Feature — urgent" },
  epigastric_pain:{ name:"Epigastric / RUQ Pain", what:"Persistent upper-middle or right upper abdominal pain.", normal:"None", why:"Indicates liver involvement — hepatic capsule swelling or HELLP. An ACOG severe feature.", tag:"ACOG Severe Feature, HELLP criterion" },
  prev_pe:{ name:"Previous PE", what:"Preeclampsia in a prior pregnancy?", normal:"No", why:"Strongest single clinical predictor. Prior PE = 8.4× higher recurrence risk (RR 8.4, CI 7.1–9.9).", tag:"Bartsch meta-analysis: RR 8.4" },
  family_hx_pe:{ name:"Family Hx of PE", what:"Mother or sister had preeclampsia?", normal:"No", why:"First-degree family history confers ~3× higher risk (RR 2.90) — heritable vascular gene variants.", tag:"Bartsch meta-analysis: RR 2.90" },
  chronic_htn:{ name:"Chronic Hypertension", what:"Hypertension before pregnancy or <20 weeks.", normal:"No", why:"AOR 7.75 — one of the most potent risk factors. Pre-existing vascular disease impairs placentation.", tag:"WHO study: AOR 7.75 — HIGH-RISK" },
  diabetes:{ name:"Pre-existing Diabetes", what:"Type 1 or Type 2 diabetes before pregnancy.", normal:"No", why:"Increases PE risk 3.7× (RR 3.7). Chronic hyperglycaemia damages endothelium and placental vessels.", tag:"Bartsch meta-analysis: RR 3.7" },
  autoimmune:{ name:"Autoimmune Condition", what:"SLE, antiphospholipid syndrome (APS), or similar.", normal:"No", why:"RR 9.72 for APS — highest single risk factor. Autoantibodies attack placental cells causing thrombosis.", tag:"Bartsch meta-analysis: RR 9.72" },
  ivf_pregnancy:{ name:"IVF / ART", what:"Conception via IVF or assisted reproduction.", normal:"Natural conception", why:"~1.8× higher PE risk from hormonal stimulation and reduced immune tolerance to paternal antigens.", tag:"Bartsch meta-analysis: RR 1.8" },
  twin_pregnancy:{ name:"Twin / Multiple Pregnancy", what:"Twin or higher-order multiple.", normal:"Singleton", why:"Nearly triples PE risk (RR 2.93) — larger placental mass + greater cardiovascular demands.", tag:"Bartsch meta-analysis: RR 2.93" },
  smoking:{ name:"Current Smoker", what:"Does the patient currently smoke?", normal:"Non-smoker", why:"Counterintuitively, smoking slightly reduces PE incidence, but carries significant other risks including FGR.", tag:"Complex relationship — Bartsch" },
  hemoglobin:{ name:"Haemoglobin", what:"Oxygen-carrying protein in RBCs. g/dL.", normal:"10.5–14.0 g/dL", why:"Low Hb may indicate anaemia or haemolysis (H in HELLP). Elevated Hb = haemoconcentration from plasma leakage.", tag:"Normal pregnancy reference" },
  platelets:{ name:"Platelets", what:"Blood clotting cells. ×10⁹/L.", normal:"150–400 ×10⁹/L", why:"PE rapidly consumes platelets. <100 = ACOG severe feature. <50 = HELLP. Often earliest lab change.", tag:"ACOG Severe Feature: <100 ×10⁹/L" },
  uric_acid:{ name:"Uric Acid", what:"Waste product filtered by kidneys. mg/dL.", normal:"2.5–5.0 mg/dL", why:"Elevated = reduced kidney clearance and cell breakdown — hallmarks of PE. Rises weeks before delivery.", tag:"Prognostic marker" },
  creatinine:{ name:"Creatinine", what:"Muscle waste product filtered by kidneys. mg/dL.", normal:"0.4–0.8 mg/dL (pregnancy)", why:"Normally falls in pregnancy. >0.9 elevated for pregnancy. >1.1 = ACOG severe feature.", tag:"ACOG Severe Feature: >1.1 mg/dL" },
  alt:{ name:"ALT (Liver)", what:"Alanine transaminase — liver cell damage marker. IU/L.", normal:"8–40 IU/L", why:"Rises when PE obstructs liver blood flow. >70 IU/L (2× normal) = ACOG severe feature.", tag:"ACOG Severe Feature: >70 IU/L" },
  ast:{ name:"AST (Liver)", what:"Aspartate transaminase — liver + haemolysis marker. IU/L.", normal:"8–40 IU/L", why:"Elevates from hepatic necrosis and RBC destruction. >70 = ACOG severe; >200 in HELLP.", tag:"ACOG Severe Feature + HELLP" },
  urine_pcr:{ name:"Urine Protein:Creatinine", what:"Spot urine test for kidney protein leakage.", normal:"<0.30", why:"PE damages the glomerular filtration barrier. PCR ≥0.30 (~300mg/day) = ACOG diagnostic criterion.", tag:"ACOG Diagnostic Criterion: ≥0.30" },
  plgf_mom:{ name:"PlGF (MoM)", what:"Placental growth factor. MoM = Multiples of Median, adjusted for GA.", normal:"0.40–2.0 MoM", why:"In PE, the placenta produces far less PlGF. <0.40 = FMF high-risk. Drops 6–8 weeks before BP rises.", tag:"FMF triple test: 96% detection" },
  pappa_mom:{ name:"PAPP-A (MoM)", what:"First trimester marker (11–13 weeks). MoM = Multiples of Median.", normal:"0.50–2.5 MoM", why:"Low PAPP-A (<0.50 MoM) reflects impaired early trophoblast invasion — root cause of early-onset PE.", tag:"FMF model, first-trimester" },
  sflt1_plgf_ratio:{ name:"sFlt-1/PlGF Ratio", what:"Ratio of anti-angiogenic (sFlt-1) to pro-angiogenic (PlGF) proteins.", normal:"<38 — rules out PE (NPV 99.3%)", why:"PROGNOSIS Study (NEJM 2016): ≤38 rules OUT PE within 1 week. >38 rules IN PE within 4 weeks. >85 = severe.", tag:"PROGNOSIS Study · NEJM 2016" },
  utapi:{ name:"Uterine Artery PI", what:"Doppler measurement of blood flow resistance to the placenta.", normal:"0.5–1.60", why:"In PE, placenta fails to remodel uterine arteries. PI >1.6 = impaired uteroplacental perfusion.", tag:"FMF Competing-Risks Model" },
  fetal_growth_pct:{ name:"Fetal Growth Percentile", what:"Baby's estimated weight vs peers at same gestational age.", normal:"10th–90th percentile", why:"FGR (<10th percentile) = placenta cannot nourish the baby. Strong indicator of placental insufficiency.", tag:"ACOG FGR criteria" },
};

// ─── Normal ranges ─────────────────────────────────────────────
const RANGES = {
  systolic_bp:       { lo:90,   hi:139,  inv:false, unit:"mmHg" },
  diastolic_bp:      { lo:60,   hi:89,   inv:false, unit:"mmHg" },
  urine_pcr:         { lo:0,    hi:0.29, inv:false, unit:"" },
  uric_acid:         { lo:2.5,  hi:5.0,  inv:false, unit:"mg/dL" },
  sflt1_plgf_ratio:  { lo:0,    hi:38,   inv:false, unit:"" },
  utapi:             { lo:0.5,  hi:1.60, inv:false, unit:"" },
  plgf_mom:          { lo:0.40, hi:2.0,  inv:true,  unit:"MoM" },
  platelets:         { lo:150,  hi:400,  inv:true,  unit:"×10⁹" },
  creatinine:        { lo:0.4,  hi:0.89, inv:false, unit:"mg/dL" },
  ast:               { lo:8,    hi:40,   inv:false, unit:"IU/L" },
  alt:               { lo:8,    hi:40,   inv:false, unit:"IU/L" },
  pappa_mom:         { lo:0.5,  hi:2.5,  inv:true,  unit:"MoM" },
  fetal_growth_pct:  { lo:10,   hi:90,   inv:true,  unit:"%ile" },
  hemoglobin:        { lo:10.5, hi:14,   inv:false, unit:"g/dL" },
};

function getStatus(key, val) {
  const r = RANGES[key];
  if (!r || val == null || val === "") return null;
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

const SSTYLE = {
  normal:    { color:"#16a34a", bg:"#f0fdf4", label:"Normal" },
  borderline:{ color:"#b45309", bg:"#fffbeb", label:"Borderline" },
  high:      { color:"#c2410c", bg:"#fff7ed", label:"Elevated" },
  low:       { color:"#c2410c", bg:"#fff7ed", label:"Low" },
  critical:  { color:"#b91c1c", bg:"#fef2f2", label:"Abnormal" },
};

// ─── Tooltip — always <span>, never <button> ─────────────────
function Tip({ info }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  if (!info) return null;

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", verticalAlign:"middle", marginLeft:4, flexShrink:0 }}>
      <span
        role="button" tabIndex={0}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); e.stopPropagation(); setOpen(o=>!o); }}}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          background: open ? "#eef2ff" : "#f1f5f9",
          border: `1px solid ${open ? "#6366f1" : "#d1d5db"}`,
          color: open ? "#4f46e5" : "#9ca3af",
          fontSize: 9, fontWeight: 700, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.12s", userSelect: "none", lineHeight: 1,
        }}
      >?</span>

      {open && (
        <div style={{
          position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 500,
          width: 280, background: "#fff",
          border: "1px solid #e2e8f0", borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.12)", padding: "14px 16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{info.name}</p>
            <span role="button" tabIndex={0} onClick={() => setOpen(false)}
              style={{ cursor:"pointer", color:"#94a3b8", fontSize:16, lineHeight:1, userSelect:"none", flexShrink:0 }}>×</span>
          </div>
          <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.65, marginBottom: 10 }}>{info.what}</p>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 10px", marginBottom: 9 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Normal Range</p>
            <p style={{ fontSize: 12.5, color: "#0c4a6e", fontWeight: 500 }}>{info.normal}</p>
          </div>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Clinical significance</p>
          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65, marginBottom: 8 }}>{info.why}</p>
          {info.tag && (
            <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 5,
              background: "#f5f3ff", color: "#7c3aed", fontSize: 10.5, fontWeight: 600,
              border: "1px solid #ddd6fe" }}>📖 {info.tag}</span>
          )}
        </div>
      )}
    </span>
  );
}

// ─── Field label ───────────────────────────────────────────────
function FL({ children, fk }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{children}</span>
      <Tip info={FINFO[fk]}/>
    </div>
  );
}

// ─── Number input ──────────────────────────────────────────────
function NI({ fk, label, step, hint, value, onChange }) {
  const has = value !== "" && value !== null && value !== undefined;
  return (
    <div>
      <FL fk={fk}>{label}</FL>
      <input type="number" step={step} placeholder="—" value={value ?? ""}
        onChange={e => onChange(fk, e.target.value === "" ? null : e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14.5,
          fontFamily: BODY, outline: "none", transition: "all 0.15s",
          background: has ? "#f5f8ff" : "#fff",
          border: `1.5px solid ${has ? "#a5b4fc" : "#e2e8f0"}`,
          color: "#1e293b",
        }}
        onFocus={e => { e.target.style.borderColor="#4f46e5"; e.target.style.boxShadow="0 0 0 3px rgba(79,70,229,0.10)"; }}
        onBlur={e  => { e.target.style.borderColor=has?"#a5b4fc":"#e2e8f0"; e.target.style.boxShadow="none"; }}
      />
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

// ─── Toggle button — Tip is BESIDE button, never inside ────────
function TB({ fk, label, value, onChange }) {
  const on = value === 1;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <button type="button" onClick={() => onChange(fk, on ? 0 : 1)} style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "8px 14px", borderRadius: 8, border: "1.5px solid",
        cursor: "pointer", fontFamily: BODY, fontSize: 13.5, fontWeight: 500,
        transition: "all 0.15s",
        background:   on ? "#eef2ff" : "#f8fafc",
        color:        on ? "#4338ca" : "#6b7280",
        borderColor:  on ? "#a5b4fc" : "#e5e7eb",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, display: "inline-block",
          background: on ? "#4f46e5" : "#d1d5db" }}/>
        {label}
      </button>
      {/* Tip sits outside button */}
      <Tip info={FINFO[fk]}/>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────
function SHdr({ num, title, sub, badge, color, bg, done, total }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: DISP, fontSize: 16, fontWeight: 700, color, flexShrink: 0 }}>{num}</div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</p>
          <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 1 }}>{sub}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {badge && <span style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 20, background: "#f1f5f9",
          color: "#64748b", fontWeight: 600, border: "1px solid #e2e8f0" }}>{badge}</span>}
        <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
          background: done >= total ? "#f0fdf4" : "#fffbeb",
          color:      done >= total ? "#16a34a"  : "#b45309",
          border:     `1px solid ${done >= total ? "#bbf7d0" : "#fde68a"}` }}>
          {done}/{total}
        </span>
      </div>
    </div>
  );
}

// ─── Card style ────────────────────────────────────────────────
const CARD = {
  background: "#fff", border: "1px solid #e8edf5",
  borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

// ─── Parameter card ────────────────────────────────────────────
function PCard({ feature, impact, allValues }) {
  const info  = FINFO[feature];
  const range = RANGES[feature];
  const val   = allValues?.[feature];
  const hasV  = val !== null && val !== undefined && val !== "";
  const status = hasV ? getStatus(feature, val) : null;
  const ss    = status ? SSTYLE[status] : null;
  if (!range) return null;

  const v = hasV ? parseFloat(val) : null;
  const maxBar = range.hi * (range.inv ? 1 : 1.6);
  const pct  = v != null ? Math.min(100, Math.max(0, (v / maxBar) * 100)) : 0;
  const nLo  = (range.lo / maxBar) * 100;
  const nHi  = (range.hi / maxBar) * 100;

  const dv = v != null
    ? (["creatinine","plgf_mom","pappa_mom","urine_pcr","utapi"].includes(feature) ? v.toFixed(2)
      : v % 1 === 0 ? v.toFixed(0) : v.toFixed(1))
    : null;

  const normLabel = range.inv
    ? `>${range.lo} ${range.unit}`.trim()
    : range.lo === 0 ? `<${range.hi} ${range.unit}`.trim()
    : `${range.lo}–${range.hi} ${range.unit}`.trim();

  return (
    <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: 12,
      padding: "14px 15px", borderLeft: `3px solid ${ss ? ss.color : "#e2e8f0"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {info?.name || feature}
          </p>
          <Tip info={info}/>
        </div>
        {ss && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0, marginLeft: 6,
            background: ss.bg, color: ss.color, border: `1px solid ${ss.color}30` }}>
            {ss.label}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
        {hasV ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700, color: ss?.color || "#1e293b", lineHeight: 1 }}>{dv}</span>
            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{range.unit}</span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Not provided</span>
        )}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 1 }}>Normal</p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b" }}>{normLabel}</p>
        </div>
      </div>

      {hasV && (
        <div style={{ position: "relative", height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ position: "absolute", left: `${nLo}%`, width: `${nHi-nLo}%`, height: "100%", background: "#dcfce7", borderRadius: 1 }}/>
          <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%",
            background: ss?.color || "#16a34a", borderRadius: 2, transition: "width 0.6s ease" }}/>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
        <p style={{ fontSize: 10.5, color: "#94a3b8" }}>Model contribution</p>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>{(impact*100).toFixed(1)}%</p>
      </div>
    </div>
  );
}

// ─── Clinical steps ────────────────────────────────────────────
const STEPS = {
  Low:      ["Continue routine antenatal visits as scheduled.","Repeat blood pressure at next visit — document two readings ≥4 hours apart if elevated.","Advise on PE warning signs: persistent headache, visual changes, epigastric pain.","Reassess if new symptoms develop or blood pressure changes."],
  Moderate: ["Increase blood pressure monitoring — at minimum weekly.","Order full PE panel if not done: FBC, uric acid, creatinine, AST/ALT, urine PCR.","Consider aspirin 150 mg nightly if <36 weeks (ACOG/FMF recommendation).","Refer to specialist if any lab results are abnormal.","Educate patient on when to seek urgent review."],
  High:     ["Urgent referral to Maternal-Fetal Medicine or obstetric consultant — same day.","Hospital admission if SBP ≥140 or DBP ≥90 on presentation.","Urgent bloods: FBC, LFTs, uric acid, creatinine, coagulation screen.","sFlt-1/PlGF ratio if not already available.","Continuous fetal monitoring — CTG and biophysical profile.","Corticosteroids for fetal lung maturity if <34 weeks gestation."],
  Critical: ["IMMEDIATE hospital admission — do not discharge pending results.","Continuous blood pressure monitoring every 15 minutes.","Commence MgSO4 for seizure prophylaxis per unit protocol.","Antihypertensives if SBP ≥160 or DBP ≥110 (IV labetalol or hydralazine).","Neonatology team involvement for delivery planning.","Senior obstetric input required for delivery timing decision."],
};

function buildFindings(values) {
  const ff = [];
  const rules = [
    { k:"sflt1_plgf_ratio", fn:v => v>85?`sFlt-1/PlGF ratio critically elevated at ${v} — ${(v/38).toFixed(1)}× above the 38 diagnostic threshold (PROGNOSIS study). Active placental dysfunction confirmed.`:v>38?`sFlt-1/PlGF ratio of ${v} exceeds the PE diagnostic threshold of 38 — significant angiogenic imbalance present.`:null },
    { k:"plgf_mom",         fn:v => v<0.40?`PlGF critically reduced at ${v} MoM — below the FMF high-risk threshold of 0.40. Severely impaired placental growth factor production.`:v<0.50?`PlGF of ${v} MoM below the 0.50 alert level — reduced placental growth factor output.`:null },
    { k:"urine_pcr",        fn:v => v>=0.30?`Urine PCR of ${v} meets the ACOG diagnostic criterion for significant proteinuria (≥0.30) — one of three criteria for preeclampsia.`:null },
    { k:"platelets",        fn:v => v<100?`Platelet count critically low at ${v}K — an ACOG severe feature. Haematological involvement and urgent HELLP assessment required.`:v<150?`Platelets reduced at ${v}K — approaching the 100K ACOG severe threshold. Monitor closely.`:null },
    { k:"systolic_bp",      fn:v => v>=160?`Systolic BP of ${v} mmHg — ACOG severe hypertension requiring immediate antihypertensive treatment.`:v>=140?`Systolic BP of ${v} mmHg meets the ACOG PE diagnostic criterion (≥140 mmHg).`:null },
    { k:"diastolic_bp",     fn:v => v>=110?`Diastolic BP of ${v} mmHg — ACOG severe hypertension requiring immediate treatment.`:v>=90?`Diastolic BP of ${v} mmHg meets the ACOG PE diagnostic criterion (≥90 mmHg).`:null },
    { k:"ast",              fn:v => v>70?`AST of ${v} IU/L (${(v/40).toFixed(1)}× normal) — ACOG severe feature indicating liver involvement. Assess for HELLP.`:v>40?`AST mildly elevated at ${v} IU/L — early hepatic stress. Monitor.`:null },
    { k:"creatinine",       fn:v => v>1.1?`Creatinine of ${v} mg/dL — ACOG severe feature indicating significant renal impairment.`:v>0.9?`Creatinine of ${v} mg/dL above the normal pregnancy range.`:null },
    { k:"uric_acid",        fn:v => v>7.0?`Uric acid critically elevated at ${v} mg/dL — severe renal stress.`:v>5.5?`Uric acid of ${v} mg/dL exceeds the 5.5 threshold for renal involvement in PE.`:null },
    { k:"utapi",            fn:v => v>2.0?`Uterine artery PI of ${v} — markedly impaired uteroplacental blood flow, strong evidence of failed placental remodelling.`:v>1.6?`Uterine artery PI of ${v} exceeds the normal threshold (≤1.6).`:null },
    { k:"fetal_growth_pct", fn:v => v<10?`Fetal growth at ${v}th percentile — confirms FGR, consistent with placental insufficiency.`:null },
    { k:"hemoglobin",       fn:v => v<9?`Haemoglobin critically low at ${v} g/dL — haemolysis (H in HELLP) must be excluded urgently.`:v<10.5?`Haemoglobin of ${v} g/dL below the normal pregnancy range.`:null },
  ];
  for (const r of rules) {
    const val = values?.[r.k];
    if (val == null || val === "") continue;
    const msg = r.fn(parseFloat(val));
    if (msg) ff.push(msg);
    if (ff.length >= 5) break;
  }
  const rfs = ["prev_pe","chronic_htn","autoimmune","diabetes","twin_pregnancy","family_hx_pe"]
    .filter(k => Number(values?.[k]) === 1)
    .map(k => ({ prev_pe:"prior preeclampsia", chronic_htn:"chronic hypertension", autoimmune:"autoimmune condition",
      diabetes:"diabetes mellitus", twin_pregnancy:"twin pregnancy", family_hx_pe:"family history of PE" })[k]);
  if (rfs.length >= 2 && ff.length < 5)
    ff.push(`Risk profile includes: ${rfs.join(", ")} — ${rfs.length >= 3 ? "ACOG high-risk combination" : "multiple ACOG risk factors"}.`);
  return ff;
}

function buildSummary(level, values, tops) {
  const tNames = (tops||[]).slice(0,2).map(c => FINFO[c.feature]?.name || c.feature);
  return {
    Low:      "Based on all available data, this patient shows no significant indicators of preeclampsia. Blood pressure, laboratory values, and risk profile are within expected ranges. Routine antenatal monitoring is recommended.",
    Moderate: `Multiple risk factors have elevated this patient's PE risk above baseline. ${tNames[0]?`Key contributors include ${tNames.join(" and ")}. `:""}This does not confirm active PE but warrants closer surveillance and proactive investigation.`,
    High:     `Multiple high-risk indicators are present. ${tNames[0]?`Key concerns include ${tNames.join(" and ")}. `:""}The clinical picture suggests significant placental or vascular stress. Same-day specialist review is strongly recommended.`,
    Critical: `Critical warning signs require immediate clinical attention. ${tNames[0]?`${tNames.join(" and ")} represent the most urgent concerns. `:""}This profile indicates active or imminent preeclampsia with potential for rapid deterioration.`,
  }[level] || "";
}

// ─── Demo presets ──────────────────────────────────────────────
const BLANK = {
  age:"",bmi:"",gestational_age_weeks:"",gravida:1,parity:0,ethnicity:0,
  prev_pe:0,family_hx_pe:0,chronic_htn:0,diabetes:0,autoimmune:0,ivf_pregnancy:0,twin_pregnancy:0,smoking:0,
  systolic_bp:"",diastolic_bp:"",headache_severity:0,visual_disturbance:0,epigastric_pain:0,edema_score:0,
  hemoglobin:"",platelets:"",uric_acid:"",creatinine:"",alt:"",ast:"",urine_pcr:"",
  plgf_mom:"",pappa_mom:"",sflt1_plgf_ratio:"",utapi:"",fetal_growth_pct:"",
};

const DEMOS = {
  low:      { ...BLANK, age:24,bmi:21,gestational_age_weeks:20,gravida:1,parity:0,systolic_bp:106,diastolic_bp:66,hemoglobin:12.8,platelets:245,uric_acid:3.1,creatinine:0.52,alt:17,ast:15,urine_pcr:0.06 },
  high:     { ...BLANK, age:34,bmi:30,gestational_age_weeks:29,gravida:2,parity:1,ethnicity:1,prev_pe:1,family_hx_pe:1,chronic_htn:1,diabetes:1,systolic_bp:138,diastolic_bp:88,headache_severity:2,edema_score:2,hemoglobin:10.6,platelets:158,uric_acid:5.9,creatinine:0.84,alt:41,ast:46,urine_pcr:0.21,plgf_mom:0.37,sflt1_plgf_ratio:58,utapi:1.78 },
  critical: { ...BLANK, age:30,bmi:34,gestational_age_weeks:32,gravida:2,parity:1,ethnicity:1,prev_pe:1,chronic_htn:1,autoimmune:1,systolic_bp:160,diastolic_bp:106,headache_severity:3,visual_disturbance:1,epigastric_pain:1,edema_score:3,hemoglobin:9.0,platelets:82,uric_acid:7.8,creatinine:1.22,alt:88,ast:104,urine_pcr:1.6,plgf_mom:0.18,sflt1_plgf_ratio:196,utapi:2.4,fetal_growth_pct:7 },
};

// ─── MAIN ──────────────────────────────────────────────────────
export default function SingleCheck() {
  const [vals,     setVals]     = useState({ ...BLANK });
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [err,      setErr]      = useState("");
  const [pdfState, setPdfState] = useState("idle");
  const resultsRef = useRef(null);

  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));

  function toPayload() {
    const ints = ["gravida","parity","ethnicity","prev_pe","family_hx_pe","chronic_htn","diabetes","autoimmune",
      "ivf_pregnancy","twin_pregnancy","smoking","headache_severity","visual_disturbance","epigastric_pain","edema_score"];
    const out = {};
    for (const k in vals) {
      const v = vals[k];
      out[k] = (v === "" || v === null || v === undefined) ? null
             : ints.includes(k) ? parseInt(v) : parseFloat(v);
    }
    return out;
  }

  async function run() {
    setErr(""); setLoading(true);
    try {
      const data = await explain(toPayload());
      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch(e) { setErr(e.message || "Request failed — is the backend running?"); }
    finally { setLoading(false); }
  }

  async function handlePdf() {
    if (!result) return;
    setPdfState("loading");
    try {
      await new Promise(r => setTimeout(r, 80));
      generateReport(result, vals);
      setPdfState("done");
      setTimeout(() => setPdfState("idle"), 3000);
    } catch(e) {
      console.error(e);
      setPdfState("error");
      setTimeout(() => setPdfState("idle"), 3000);
    }
  }

  const riskCfg  = result?.risk_level ? RISK[result.risk_level] : null;
  const contribs = result?.top_contributors || [];
  const findings = result ? buildFindings(vals) : [];
  const summary  = result ? buildSummary(result.risk_level, vals, contribs) : "";

  const t1 = ["age","bmi","gestational_age_weeks","systolic_bp","diastolic_bp"].filter(k => vals[k]!==""&&vals[k]!==null).length;
  const t2 = ["hemoglobin","platelets","uric_acid","creatinine","alt","ast","urine_pcr"].filter(k => vals[k]!==""&&vals[k]!==null).length;
  const t3 = ["plgf_mom","pappa_mom","sflt1_plgf_ratio","utapi","fetal_growth_pct"].filter(k => vals[k]!==""&&vals[k]!==null).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 22, alignItems: "start" }}>

      {/* ══ LEFT FORM ══ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Action bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button onClick={run} disabled={loading} style={{
            padding: "11px 26px", background: loading ? "#e2e8f0" : "#4f46e5",
            color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: 10,
            fontSize: 14.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: BODY, display: "flex", alignItems: "center", gap: 7,
            boxShadow: loading ? "none" : "0 2px 8px rgba(79,70,229,0.30)",
            transition: "all 0.15s",
          }}>
            {loading ? "⏳ Analysing…" : "▶ Run Screening"}
          </button>
          <button onClick={() => { setVals({...BLANK}); setResult(null); setErr(""); }} style={{
            padding: "11px 16px", background: "#fff", color: "#64748b",
            border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13.5,
            fontWeight: 600, cursor: "pointer", fontFamily: BODY,
          }}>Reset</button>
          <div style={{ display: "flex", gap: 7 }}>
            {[["Low","low","#16a34a"],["High","high","#b45309"],["Critical","critical","#b91c1c"]].map(([label,k,color]) => (
              <button key={k} onClick={() => { setVals({...DEMOS[k]}); setResult(null); setErr(""); }} style={{
                padding: "8px 13px", background: "#fff", color,
                border: `1px solid ${color}40`, borderRadius: 8, fontSize: 12.5,
                fontWeight: 600, cursor: "pointer", fontFamily: BODY,
              }}>{label}</button>
            ))}
          </div>
          {err && <p style={{ fontSize: 13, color: "#dc2626" }}>⚠ {err}</p>}
        </div>

        {/* Tier 1 */}
        <div style={CARD}>
          <div style={{ padding: "22px 24px" }}>
            <SHdr num="1" title="Clinical Baseline" sub="Demographics, vitals & risk factors" badge="Required" color="#4f46e5" bg="#eef2ff" done={t1} total={5}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
              <NI fk="age"                   label="Age (years)"           step="1"   value={vals.age}                   onChange={set}/>
              <NI fk="bmi"                   label="BMI (kg/m²)"           step="0.1" value={vals.bmi}                   onChange={set}/>
              <NI fk="gestational_age_weeks" label="Gestation (weeks)"     step="0.5" value={vals.gestational_age_weeks} onChange={set}/>
              <NI fk="gravida"               label="Gravida"               step="1"   value={vals.gravida}               onChange={set}/>
              <NI fk="parity"                label="Parity"                step="1"   value={vals.parity}                onChange={set}/>
              <div>
                <FL fk="ethnicity">Ethnicity</FL>
                <select value={vals.ethnicity} onChange={e => set("ethnicity", parseInt(e.target.value))} style={{
                  width:"100%", padding:"10px 12px", borderRadius:9, fontSize:14,
                  fontFamily:BODY, border:"1.5px solid #e2e8f0", background:"#fff",
                  color:"#1e293b", outline:"none", cursor:"pointer"
                }}>
                  {[["0","White / Other"],["1","Black / Afro-Caribbean"],["2","Asian"],["3","Hispanic"]].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <NI fk="systolic_bp"       label="Systolic BP (mmHg)"    step="1"   hint="≥140 = ACOG PE criterion"        value={vals.systolic_bp}       onChange={set}/>
              <NI fk="diastolic_bp"      label="Diastolic BP (mmHg)"   step="1"   hint="≥90 = ACOG PE criterion"         value={vals.diastolic_bp}      onChange={set}/>
              <NI fk="headache_severity" label="Headache (0–3)"         step="1"   hint="0=none · 3=severe"               value={vals.headache_severity} onChange={set}/>
              <NI fk="edema_score"       label="Oedema (0–3)"           step="1"   hint="0=none · 2=face/hands"           value={vals.edema_score}       onChange={set}/>
            </div>
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginBottom: 14 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 10 }}>Medical History</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {[["prev_pe","Prev PE"],["family_hx_pe","Family Hx PE"],["chronic_htn","Chronic HTN"],
                  ["diabetes","Diabetes"],["autoimmune","Autoimmune"],["ivf_pregnancy","IVF / ART"],["twin_pregnancy","Twins"]
                ].map(([k,l]) => <TB key={k} fk={k} label={l} value={vals[k]} onChange={set}/>)}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 10 }}>Symptoms</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {[["visual_disturbance","Visual Disturbance"],["epigastric_pain","Epigastric Pain"],["smoking","Current Smoker"]
                ].map(([k,l]) => <TB key={k} fk={k} label={l} value={vals[k]} onChange={set}/>)}
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2 */}
        <div style={CARD}>
          <div style={{ padding: "22px 24px" }}>
            <SHdr num="2" title="Routine Lab Results" sub="Standard blood & urine tests" badge="Optional" color="#0891b2" bg="#ecfeff" done={t2} total={7}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <NI fk="hemoglobin" label="Haemoglobin (g/dL)"       step="0.1"  hint="Normal: 10.5–14.0"         value={vals.hemoglobin} onChange={set}/>
              <NI fk="platelets"  label="Platelets (×10⁹/L)"       step="1"    hint="Normal: 150–400"            value={vals.platelets}  onChange={set}/>
              <NI fk="uric_acid"  label="Uric Acid (mg/dL)"         step="0.1"  hint="Normal: 2.5–5.0"           value={vals.uric_acid}  onChange={set}/>
              <NI fk="creatinine" label="Creatinine (mg/dL)"        step="0.01" hint="Pregnancy normal: 0.4–0.8" value={vals.creatinine} onChange={set}/>
              <NI fk="alt"        label="ALT (IU/L)"                step="1"    hint="Normal: 8–40"              value={vals.alt}        onChange={set}/>
              <NI fk="ast"        label="AST (IU/L)"                step="1"    hint="Normal: 8–40"              value={vals.ast}        onChange={set}/>
              <NI fk="urine_pcr"  label="Urine Protein:Creatinine"  step="0.01" hint="PE diagnostic: ≥0.30"      value={vals.urine_pcr}  onChange={set}/>
            </div>
          </div>
        </div>

        {/* Tier 3 */}
        <div style={CARD}>
          <div style={{ padding: "22px 24px" }}>
            <SHdr num="3" title="Specialist Biomarkers" sub="Placental markers — detect PE weeks before BP rises" badge="Highest impact" color="#dc2626" bg="#fef2f2" done={t3} total={5}/>
            <div style={{ background: "#fef9f0", border: "1px solid #fed7aa", borderRadius: 9, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ fontSize: 13.5, color: "#9a3412", lineHeight: 1.7 }}>
                <strong>These catch what BP monitoring misses.</strong> PlGF and sFlt-1/PlGF shift 6–8 weeks before blood pressure rises.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <NI fk="plgf_mom"         label="PlGF (MoM)"         step="0.01" hint="High risk: <0.40"        value={vals.plgf_mom}         onChange={set}/>
              <NI fk="pappa_mom"        label="PAPP-A (MoM)"       step="0.01" hint="Alert: <0.50"            value={vals.pappa_mom}        onChange={set}/>
              <NI fk="sflt1_plgf_ratio" label="sFlt-1/PlGF Ratio"  step="0.1"  hint="PE risk if >38"          value={vals.sflt1_plgf_ratio} onChange={set}/>
              <NI fk="utapi"            label="Uterine Artery PI"   step="0.01" hint="Elevated if >1.6"        value={vals.utapi}            onChange={set}/>
              <NI fk="fetal_growth_pct" label="Fetal Growth %ile"   step="1"    hint="FGR if <10th percentile" value={vals.fetal_growth_pct} onChange={set}/>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT RESULTS ══ */}
      <div ref={resultsRef} style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 78 }}>

        {/* Empty */}
        {!result && !loading && (
          <div style={{ ...CARD, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🩺</div>
            <p style={{ fontFamily: DISP, fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Ready to screen</p>
            <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.8, maxWidth: 260, margin: "0 auto 24px" }}>
              Fill in Tier 1 and click Run Screening. Tier 2 & 3 improve accuracy.
            </p>
            <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "12px 16px", textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>💡 Try demo presets</p>
              <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.7 }}>Click <strong>Low</strong>, <strong>High</strong>, or <strong>Critical</strong> above to instantly load example data.</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ ...CARD, padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>⏳</p>
            <p style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Analysing…</p>
            <p style={{ fontSize: 14, color: "#64748b" }}>Running 35-feature ensemble model</p>
          </div>
        )}

        {result && riskCfg && (
          <>
            {/* Risk hero */}
            <div style={{ ...CARD, overflow: "hidden" }}>
              <div style={{ background: riskCfg.bg, borderBottom: `1px solid ${riskCfg.border}`, padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: riskCfg.color, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 5 }}>
                      Screening Result
                    </p>
                    <p style={{ fontFamily: DISP, fontSize: 30, fontWeight: 700, color: "#0f172a", lineHeight: 1.1, marginBottom: 6 }}>
                      {riskCfg.label}
                    </p>
                    <p style={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.6 }}>{riskCfg.verb}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <p style={{ fontFamily: DISP, fontSize: 48, fontWeight: 700, color: riskCfg.color, lineHeight: 1 }}>
                      {Math.round(result.probability*100)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span>
                    </p>
                    <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>PE probability</p>
                  </div>
                </div>
                {/* Bar */}
                <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(result.probability*100)}%`,
                    background: riskCfg.color, borderRadius: 3, transition: "width 0.8s ease" }}/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: "#94a3b8" }}>0%</span>
                  <span style={{ fontSize: 10.5, color: "#94a3b8" }}>▲ Threshold 30%</span>
                  <span style={{ fontSize: 10.5, color: "#94a3b8" }}>100%</span>
                </div>
              </div>
              <div style={{ padding: "16px 24px" }}>
                <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.85 }}>{summary}</p>
              </div>
            </div>

            {/* Findings */}
            {findings.length > 0 && (
              <div style={CARD}>
                <div style={{ padding: "18px 24px" }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 14 }}>
                    What we found
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {findings.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: riskCfg.bg,
                          border: `1px solid ${riskCfg.border}`, display: "flex", alignItems: "center",
                          justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: riskCfg.color }}>{i+1}</span>
                        </div>
                        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75 }}>{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Next steps */}
            <div style={{ ...CARD, border: `1px solid ${riskCfg.border}` }}>
              <div style={{ background: riskCfg.bg, borderBottom: `1px solid ${riskCfg.border}`, padding: "12px 24px", borderRadius: "16px 16px 0 0" }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: riskCfg.color, letterSpacing: "0.6px", textTransform: "uppercase" }}>
                  🩺 Recommended Clinical Actions
                </p>
              </div>
              <div style={{ padding: "18px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {STEPS[result.risk_level]?.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, background: riskCfg.bg,
                        border: `1px solid ${riskCfg.border}`, display: "inline-flex", alignItems: "center",
                        justifyContent: "center", fontSize: 10.5, fontWeight: 700, color: riskCfg.color, flexShrink: 0, marginTop: 2 }}>
                        {i+1}
                      </span>
                      <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.75 }}>{s}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 14, fontStyle: "italic" }}>
                  Based on ACOG Practice Bulletin 222. Always apply clinical judgement.
                </p>
              </div>
            </div>

            {/* Parameter cards */}
            {contribs.length > 0 && (
              <div style={CARD}>
                <div style={{ padding: "18px 24px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.6px", textTransform: "uppercase" }}>Key Parameters</p>
                    <p style={{ fontSize: 12.5, color: "#94a3b8" }}>vs normal range</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 14 }}>
                    {contribs.slice(0,8).filter(c => RANGES[c.feature]).map((c,i) => (
                      <PCard key={i} feature={c.feature} impact={c.impact} allValues={vals}/>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Confidence */}
            {result.confidence && (
              <div style={{ ...CARD, padding: "16px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>Confidence</p>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#4f46e5" }}>{result.confidence.label}</span>
                </div>
                <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${result.confidence.score*100}%`,
                    background: "linear-gradient(90deg,#6366f1,#0891b2)", borderRadius: 3 }}/>
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["Tier 1",t1,5],["Tier 2",t2,7],["Tier 3",t3,5]].map(([l,d,t]) => (
                    <div key={l}>
                      <p style={{ fontSize: 11.5, color: "#94a3b8" }}>{l}</p>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: d===t?"#16a34a":d>0?"#b45309":"#94a3b8" }}>{d}/{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDF button */}
            <button onClick={handlePdf} disabled={pdfState==="loading"} style={{
              width: "100%", padding: "14px 20px",
              background: pdfState==="done"?"#16a34a":pdfState==="error"?"#dc2626":pdfState==="loading"?"#f1f5f9":"#1e293b",
              color: pdfState==="loading"?"#94a3b8":"#fff",
              border: "none", borderRadius: 12, fontSize: 14.5, fontWeight: 600,
              cursor: pdfState==="loading"?"not-allowed":"pointer",
              fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s", boxShadow: pdfState==="idle"?"0 2px 8px rgba(0,0,0,0.15)":"none"
            }}>
              {pdfState==="idle"    && <><span>⬇</span> Download Clinical Report (PDF)</>}
              {pdfState==="loading" && <>⏳ Generating PDF…</>}
              {pdfState==="done"    && <>✓ Report Downloaded!</>}
              {pdfState==="error"   && <>✗ Failed — try again</>}
            </button>

             <ChatPanel result={result} patientValues={vals} />
          </>
        )}
      </div>
    </div>
  );
}