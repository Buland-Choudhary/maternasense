const COLORS = {
  Low:      "#2d7a4f",
  Moderate: "#b07a1a",
  High:     "#c45c18",
  Critical: "#c8253a",
};

function arcPath(pct) {
  const r = 66, cx = 80, cy = 88;
  const startAngle = Math.PI;
  const endAngle   = Math.PI + Math.max(0.001, pct) * Math.PI;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = pct > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export default function RiskGauge({ score = 0, label = "—" }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const pct     = clamped / 100;
  const color   = COLORS[label] || "#9ca3af";
  const needleAngle = pct * 180 - 90;

  return (
    <div className="flex items-center gap-6">
      <svg width="168" height="100" viewBox="0 0 160 100">
        <path d="M 14 88 A 66 66 0 0 1 146 88" fill="none" stroke="#e2ddd7" strokeWidth="10" strokeLinecap="round"/>
        {clamped > 0 && (
          <path d={arcPath(pct)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"/>
        )}
        <g transform={`rotate(${needleAngle}, 80, 88)`}>
          <line x1="80" y1="88" x2="80" y2="28" stroke="#1a1714" strokeWidth="2.5" strokeLinecap="round"/>
        </g>
        <circle cx="80" cy="88" r="5" fill="#1a1714"/>
        <text x="8"   y="98" fontSize="9" fill="#7a7068" fontFamily="sans-serif">0</text>
        <text x="152" y="98" fontSize="9" fill="#7a7068" fontFamily="sans-serif" textAnchor="end">100</text>
      </svg>
      <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#7a7068" }}>Risk Score</p>
        <p className="text-5xl font-bold leading-none" style={{ color, letterSpacing: "-2px" }}>
          {clamped.toFixed(0)}
        </p>
        <p className="text-sm mt-1 font-medium" style={{ color }}>{label !== "—" ? label : "—"}</p>
      </div>
    </div>
  );
}