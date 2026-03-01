import { useState, useRef, useEffect } from "react";
import { trend } from "../lib/api";

const S = {
  card:      { background: "#fff", border: "1px solid #e2ddd7", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)" },
  label:     { fontSize: 11, fontWeight: 500, color: "#7a7068", letterSpacing: "0.3px", textTransform: "uppercase", display: "block", marginBottom: 5 },
  input:     { width: "100%", padding: "7px 10px", border: "1px solid #e2ddd7", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1a1714" },
  cardTitle: { fontSize: 12, fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", color: "#7a7068" },
  metaBox:   { background: "#f0ece6", border: "1px solid #e2ddd7", borderRadius: 8, padding: "10px 14px" },
};

const TREND_BADGE = {
  Increasing: { bg: "#fde8ec", color: "#c8253a" },
  Decreasing: { bg: "#eaf4ee", color: "#2d7a4f" },
  Stable:     { bg: "#fdf5e0", color: "#b07a1a" },
};

function colorForScore(s) {
  return s < 25 ? "#2d7a4f" : s < 50 ? "#b07a1a" : s < 75 ? "#c45c18" : "#c8253a";
}

function emptyVisit(week = 20) {
  return {
    age: 26, bmi: 24, gestational_age_weeks: week,
    gravida: 1, parity: 0, ethnicity: 0,
    prev_pe: 0, family_hx_pe: 0, chronic_htn: 0, diabetes: 0,
    autoimmune: 0, ivf_pregnancy: 0, twin_pregnancy: 0, smoking: 0,
    systolic_bp: 112, diastolic_bp: 72,
    headache_severity: 0, visual_disturbance: 0, epigastric_pain: 0, edema_score: 0,
    hemoglobin: null, platelets: null, uric_acid: null, creatinine: null,
    alt: null, ast: null, urine_pcr: null,
    plgf_mom: null, pappa_mom: null, sflt1_plgf_ratio: null, utapi: null, fetal_growth_pct: null,
  };
}

const VISIT_FIELDS = [
  ["gestational_age_weeks", "Week",          "0.1"],
  ["systolic_bp",           "Sys BP",        "1"],
  ["diastolic_bp",          "Dia BP",        "1"],
  ["urine_pcr",             "Urine PCR",     "0.01"],
  ["uric_acid",             "Uric Acid",     "0.1"],
  ["hemoglobin",            "Hemoglobin",    "0.1"],
  ["platelets",             "Platelets",     "1"],
  ["headache_severity",     "Headache(0–3)", "1"],
  ["edema_score",           "Edema(0–3)",    "1"],
  ["visual_disturbance",    "Visual (0/1)",  "1"],
  ["epigastric_pain",       "Epigastric(0/1)","1"],
];

function Btn({ onClick, disabled, variant = "primary", children, small }) {
  const base = { padding: small ? "5px 12px" : "9px 18px", borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 500, fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, border: "none", transition: "all 0.15s" };
  const variants = {
    primary: { background: "#1a1714", color: "#fff" },
    ghost:   { background: "transparent", color: "#7a7068", border: "1px solid #e2ddd7" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

export default function TrendMonitor() {
  const [visits, setVisits] = useState([
    { ...emptyVisit(20), systolic_bp: 112, diastolic_bp: 72 },
    { ...emptyVisit(26), systolic_bp: 120, diastolic_bp: 76, uric_acid: 4.2 },
    { ...emptyVisit(32), systolic_bp: 138, diastolic_bp: 88, uric_acid: 5.8, urine_pcr: 0.4, headache_severity: 1, edema_score: 1 },
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    if (result) drawChart(result.risk_over_time);
  }, [result]);

  function updateVisit(i, key, val) {
    setVisits(prev => {
      const next = [...prev];
      const intKeys = ["gravida","parity","prev_pe","family_hx_pe","chronic_htn","diabetes",
                       "autoimmune","ivf_pregnancy","twin_pregnancy","smoking",
                       "headache_severity","visual_disturbance","epigastric_pain","edema_score","ethnicity"];
      next[i] = {
        ...next[i],
        [key]: val === "" ? null : intKeys.includes(key) ? parseInt(val) : parseFloat(val),
      };
      return next;
    });
  }

  function addVisit() {
    const lastWeek = visits[visits.length - 1]?.gestational_age_weeks || 20;
    setVisits(prev => [...prev, emptyVisit(Math.min(lastWeek + 4, 38))]);
  }

  function removeVisit(i) {
    if (visits.length <= 1) return;
    setVisits(prev => prev.filter((_, idx) => idx !== i));
  }

  async function runTrend() {
    setErr(""); setLoading(true);
    try {
      const data = await trend({ visits });
      setResult(data);
    } catch (e) {
      setErr(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function drawChart(series) {
    const canvas = canvasRef.current;
    if (!canvas || !series?.length) return;
    const W = canvas.offsetWidth || 500;
    const H = 260;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 24, right: 28, bottom: 44, left: 52 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const weeks = series.map(s => s.week);
    const minW = Math.min(...weeks), maxW = Math.max(...weeks);
    const xS = w => pad.left + ((w - minW) / (maxW - minW || 1)) * cW;
    const yS = s => pad.top + cH - (s / 100) * cH;

    // Risk zone backgrounds
    [
      { min: 75, max: 100, color: "rgba(200,37,58,0.06)"  },
      { min: 50, max: 75,  color: "rgba(196,92,24,0.06)"  },
      { min: 25, max: 50,  color: "rgba(176,122,26,0.06)" },
      { min: 0,  max: 25,  color: "rgba(45,122,79,0.06)"  },
    ].forEach(z => {
      ctx.fillStyle = z.color;
      ctx.fillRect(pad.left, yS(z.max), cW, yS(z.min) - yS(z.max));
    });

    // Zone labels on right
    [
      { y: 87.5, label: "Critical", color: "rgba(200,37,58,0.5)" },
      { y: 62.5, label: "High",     color: "rgba(196,92,24,0.5)" },
      { y: 37.5, label: "Moderate", color: "rgba(176,122,26,0.5)" },
      { y: 12.5, label: "Low",      color: "rgba(45,122,79,0.5)"  },
    ].forEach(z => {
      ctx.fillStyle = z.color;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(z.label, W - 4, yS(z.y) + 3);
    });

    // Grid lines
    ctx.strokeStyle = "#e2ddd7"; ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(y => {
      ctx.beginPath(); ctx.moveTo(pad.left, yS(y)); ctx.lineTo(pad.left + cW, yS(y)); ctx.stroke();
      ctx.fillStyle = "#7a7068";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(y + "%", pad.left - 6, yS(y) + 4);
    });

    // Line
    ctx.beginPath(); ctx.strokeStyle = "#1a1714"; ctx.lineWidth = 2.5;
    series.forEach((s, i) => {
      const x = xS(s.week), y = yS(s.risk_score);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots + labels
    series.forEach(s => {
      const x = xS(s.week), y = yS(s.risk_score);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = colorForScore(s.risk_score); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();

      ctx.fillStyle = colorForScore(s.risk_score);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.risk_score.toFixed(0) + "%", x, y - 14);

      ctx.fillStyle = "#7a7068";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Wk " + s.week, x, H - 6);

      // Confidence dot
      const confColor = s.confidence >= 70 ? "#2d7a4f" : s.confidence >= 50 ? "#b07a1a" : "#c45c18";
      ctx.fillStyle = confColor;
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(`${s.confidence}% conf`, x, H - 18);
    });
  }

  const badge = result?.trend ? TREND_BADGE[result.trend] : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>

      {/* ── LEFT: VISITS ── */}
      <div style={S.card}>
        <div className="flex items-center justify-between" style={{ padding: "18px 20px 0" }}>
          <span style={S.cardTitle}>Patient Visits</span>
          {badge ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              Trend: {result.trend}
            </span>
          ) : (
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, background: "#f0ece6", color: "#7a7068", border: "1px solid #e2ddd7" }}>Waiting…</span>
          )}
        </div>

        <div style={{ padding: "14px 20px 20px" }}>
          <div className="flex flex-col gap-3">
            {visits.map((v, i) => (
              <div key={i} style={{ background: "#f7f4f0", border: "1px solid #e2ddd7", borderRadius: 10, padding: "12px 14px" }}>
                <div className="flex items-center justify-between mb-2.5">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Visit {i + 1} — Week {v.gestational_age_weeks}
                  </span>
                  <button
                    onClick={() => removeVisit(i)}
                    disabled={visits.length <= 1}
                    style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #e2ddd7", background: "transparent", color: "#7a7068", cursor: visits.length <= 1 ? "not-allowed" : "pointer", opacity: visits.length <= 1 ? 0.4 : 1, fontFamily: "inherit" }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {VISIT_FIELDS.map(([key, label, step]) => (
                    <div key={key}>
                      <label style={S.label}>{label}</label>
                      <input
                        type="number" step={step}
                        value={v[key] ?? ""}
                        placeholder="—"
                        onChange={e => updateVisit(i, key, e.target.value)}
                        style={S.input}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Btn onClick={addVisit} variant="ghost" small>+ Add Visit</Btn>
            <Btn onClick={runTrend} disabled={loading}>
              {loading ? "⏳ Analyzing…" : "▶ Analyze Trend"}
            </Btn>
            {err && <span style={{ fontSize: 12, color: "#c8253a" }}>⚠ {err}</span>}
          </div>
        </div>
      </div>

      {/* ── RIGHT: CHART ── */}
      <div className="flex flex-col gap-4">
        <div style={S.card}>
          <div style={{ padding: "18px 20px 0" }}>
            <span style={S.cardTitle}>Risk Over Time</span>
          </div>
          <div style={{ padding: "14px 20px 20px" }}>
            {result ? (
              <>
                <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} height={260} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
                  {[
                    ["Trend",       result.trend],
                    ["Peak Risk",   result.peak_risk?.toFixed(1) + "%"],
                    ["Latest",      result.latest_level],
                  ].map(([label, val]) => (
                    <div key={label} style={S.metaBox}>
                      <p style={{ fontSize: 11, color: "#7a7068", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
                      <p style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{val}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, color: "#9a9088" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📈</p>
                <p style={{ fontSize: 13 }}>Click "Analyze Trend" to see chart</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Confidence score shown per visit</p>
              </div>
            )}
          </div>
        </div>

        {/* Alert box */}
        {result && result.trend === "Increasing" && (
          <div style={{ background: "#fde8ec", border: "1px solid rgba(200,37,58,0.3)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#c8253a", marginBottom: 4 }}>
              ⚠️ Risk Escalating
            </p>
            <p style={{ fontSize: 12, color: "#a01e2e", lineHeight: 1.5 }}>
              Risk is increasing across visits. Recommend immediate clinical review, increased monitoring frequency, and consider specialist referral per ACOG guidelines.
            </p>
          </div>
        )}

        {result && result.trend === "Decreasing" && (
          <div style={{ background: "#eaf4ee", border: "1px solid rgba(45,122,79,0.3)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#2d7a4f", marginBottom: 4 }}>
              ✅ Risk Improving
            </p>
            <p style={{ fontSize: 12, color: "#1f5c38", lineHeight: 1.5 }}>
              Risk is decreasing across visits. Continue current management plan and maintain regular monitoring schedule.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}