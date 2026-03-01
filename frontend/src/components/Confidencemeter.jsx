export default function ConfidenceMeter({ confidence }) {
  if (!confidence) return null;

  const { confidence_score, tier1_filled, tier1_total,
          tier2_filled, tier2_total, tier3_filled, tier3_total, message } = confidence;

  const color = confidence_score >= 80 ? "#2d7a4f"
              : confidence_score >= 60 ? "#b07a1a"
              : "#c45c18";

  const tiers = [
    { label: "Tier 1", filled: tier1_filled, total: tier1_total, note: "Basic info" },
    { label: "Tier 2", filled: tier2_filled, total: tier2_total, note: "Routine labs" },
    { label: "Tier 3", filled: tier3_filled, total: tier3_total, note: "Specialist" },
  ];

  return (
    <div style={{ background: "#f7f4f0", border: "1px solid #e2ddd7", borderRadius: 10, padding: "14px 16px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#7a7068" }}>
          Prediction Confidence
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.5px" }}>
          {confidence_score.toFixed(0)}%
        </span>
      </div>

      {/* Main bar */}
      <div style={{ height: 8, background: "#e2ddd7", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%",
          width: `${confidence_score}%`,
          background: color,
          borderRadius: 4,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)"
        }}/>
      </div>

      {/* Tier breakdown */}
      <div className="flex gap-3 mb-2">
        {tiers.map((t) => (
          <div key={t.label} style={{ flex: 1 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, color: "#7a7068" }}>{t.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: t.filled === t.total ? "#2d7a4f" : "#b07a1a" }}>
                {t.filled}/{t.total}
              </span>
            </div>
            <div style={{ height: 4, background: "#e2ddd7", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(t.filled / t.total) * 100}%`,
                background: t.filled === t.total ? "#2d7a4f" : "#b07a1a",
                borderRadius: 2,
                transition: "width 0.6s ease"
              }}/>
            </div>
            <p style={{ fontSize: 9, color: "#9a9088", marginTop: 2 }}>{t.note}</p>
          </div>
        ))}
      </div>

      {/* Message */}
      <p style={{ fontSize: 11, color: "#7a7068", lineHeight: 1.4, marginTop: 6, borderTop: "1px solid #e2ddd7", paddingTop: 8 }}>
        💡 {message}
      </p>
    </div>
  );
}