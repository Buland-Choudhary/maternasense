import { useState } from "react";
import { generateReport } from "../lib/generateReport";

/**
 * Drop this button anywhere in the results panel.
 * Props: result (API response), patientValues (form state)
 *
 * <DownloadReportBtn result={result} patientValues={vals} />
 */
export default function DownloadReportBtn({ result, patientValues }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error

  async function handleClick() {
    if (!result) return;
    setState("loading");
    try {
      // Small delay so the spinner renders before jsPDF blocks the thread
      await new Promise(r => setTimeout(r, 80));
      const filename = generateReport(result, patientValues);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch (e) {
      console.error("PDF generation failed:", e);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const styles = {
    idle:    { bg:"linear-gradient(135deg,#1d6a82,#1a3c4e)", color:"#fff", text:"⬇  Download Clinical Report" },
    loading: { bg:"rgba(255,255,255,0.06)",                  color:"#64748b", text:"⏳  Generating PDF…" },
    done:    { bg:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", text:"✓  Report Downloaded!" },
    error:   { bg:"linear-gradient(135deg,#f43f5e,#e11d48)", color:"#fff", text:"✗  Generation failed" },
  };

  const s = styles[state];

  return (
    <button
      onClick={handleClick}
      disabled={!result || state === "loading"}
      style={{
        width: "100%",
        padding: "14px 20px",
        background: s.bg,
        color: s.color,
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        cursor: !result || state === "loading" ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "all 0.2s",
        opacity: !result ? 0.45 : 1,
        letterSpacing: "0.1px",
      }}
    >
      {s.text}
    </button>
  );
}