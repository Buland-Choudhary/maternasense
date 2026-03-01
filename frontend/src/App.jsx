import { useState, useEffect, useRef } from "react";
import SingleCheck from "./pages/SingleCheck";
import TrendMonitor from "./pages/TrendMonitor";

// ─── Google Fonts + Global Reset ────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    background: #f4f6fb;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }

  :root {
    --bg:       #f4f6fb;
    --surface:  #ffffff;
    --border:   #e8edf5;
    --border2:  #d1d9e6;
    --indigo:   #4f46e5;
    --indigo2:  #6366f1;
    --indigo-light: #eef2ff;
    --cyan:     #0891b2;
    --cyan-light: #ecfeff;
    --text:     #1e293b;
    --muted:    #64748b;
    --dim:      #94a3b8;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow:    0 4px 16px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04);
    --shadow-md: 0 8px 32px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
    --radius:    14px;
    --radius-sm: 9px;
    --display:   'Fraunces', Georgia, serif;
    --body:      'Plus Jakarta Sans', system-ui, sans-serif;
  }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; } to { opacity:1; }
  }
  @keyframes scaleIn {
    from { opacity:0; transform:scale(0.96); }
    to   { opacity:1; transform:scale(1); }
  }

  .au1 { animation: fadeUp 0.6s ease both; }
  .au2 { animation: fadeUp 0.6s 0.1s ease both; }
  .au3 { animation: fadeUp 0.6s 0.2s ease both; }
  .au4 { animation: fadeUp 0.6s 0.3s ease both; }
  .au5 { animation: fadeUp 0.6s 0.4s ease both; }

  @media (max-width: 768px) {
    .hide-mob { display: none !important; }
    .two-col  { grid-template-columns: 1fr !important; }
    .three-col{ grid-template-columns: 1fr !important; }
    .mob-px   { padding-left: 20px !important; padding-right: 20px !important; }
  }
`;

const DISP = "'Fraunces', Georgia, serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Logo ─────────────────────────────────────────────────────
function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="11" fill="#4f46e5"/>
      <path d="M20 10 C14 10 10 14 10 20 C10 26 14 30 20 30 C26 30 30 26 30 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M15 20 L18.5 23.5 L25 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="28" cy="12" r="4" fill="#f43f5e"/>
    </svg>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────
function Landing({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const sec = { maxWidth: 1100, margin: "0 auto", padding: "0 40px" };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "none",
        transition: "all 0.25s",
      }}>
        <div style={{ ...sec, height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={34}/>
            <span style={{ fontFamily: DISP, fontSize: 19, fontWeight: 700, color: "#1e293b" }}>MaternaSense</span>
          </div>
          <div className="hide-mob" style={{ display: "flex", gap: 4 }}>
            {[["#about","About PE"],["#how","How It Works"],["#evidence","Evidence"]].map(([h,l]) => (
              <a key={h} href={h} style={{ color:"#64748b", fontSize:14, textDecoration:"none", padding:"7px 14px",
                borderRadius:8, transition:"all 0.15s", fontWeight:500, fontFamily:BODY }}
                onMouseEnter={e => { e.target.style.color="#1e293b"; e.target.style.background="#f1f5f9"; }}
                onMouseLeave={e => { e.target.style.color="#64748b"; e.target.style.background="transparent"; }}>
                {l}
              </a>
            ))}
          </div>
          <button onClick={onStart} style={{
            padding: "10px 22px", background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: BODY, transition: "all 0.15s",
          }}
            onMouseEnter={e => e.target.style.background="#4338ca"}
            onMouseLeave={e => e.target.style.background="#4f46e5"}>
            Open Screening Tool →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 130, paddingBottom: 80 }}>
        <div className="mob-px" style={{ ...sec }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }} className="au1">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f46e5" }}/>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", letterSpacing: "0.5px", fontFamily: BODY }}>
              AI-Powered Maternal Health Screening
            </span>
          </div>

          <h1 className="au2" style={{
            fontFamily: DISP, fontSize: 60, fontWeight: 700, lineHeight: 1.06,
            color: "#0f172a", marginBottom: 24, letterSpacing: "-1px", maxWidth: 680
          }}>
            Detect preeclampsia{" "}
            <em style={{ color: "#4f46e5", fontStyle: "italic" }}>before it strikes</em>
          </h1>

          <p className="au3" style={{
            fontSize: 19, color: "#475569", lineHeight: 1.8, maxWidth: 540, marginBottom: 40, fontWeight: 400
          }}>
            Identifies PE risk <strong style={{ color: "#1e293b", fontWeight: 600 }}>6–8 weeks before blood pressure rises</strong> — using placental biomarkers from 25 million pregnancies.
          </p>

          <div className="au4" style={{ display: "flex", gap: 12, marginBottom: 56, flexWrap: "wrap" }}>
            <button onClick={onStart} style={{
              padding: "15px 32px", background: "#4f46e5", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600,
              cursor: "pointer", fontFamily: BODY, display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 16px rgba(79,70,229,0.35)", transition: "all 0.15s"
            }}
              onMouseEnter={e => e.currentTarget.style.transform="translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform="none"}>
              Start Risk Screening
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <a href="#about" style={{
              padding: "15px 28px", background: "#fff", color: "#374151",
              border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 16, fontWeight: 500,
              cursor: "pointer", fontFamily: BODY, textDecoration: "none", display: "inline-flex", alignItems: "center"
            }}>
              Learn more
            </a>
          </div>

          {/* Stats strip */}
          <div className="au5" style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {[["10M+","pregnancies affected/year"],["76K","maternal deaths annually"],["96%","detection with biomarkers"],["62%","risk reduction with early aspirin"]].map(([n,l]) => (
              <div key={n}>
                <p style={{ fontFamily: DISP, fontSize: 30, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{n}</p>
                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, fontWeight: 400 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About PE */}
      <section id="about" style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div className="mob-px" style={{ ...sec }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4f46e5", marginBottom: 10, fontFamily: BODY }}>Understanding the condition</p>
          <h2 style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: "#0f172a", marginBottom: 16, letterSpacing: "-0.5px" }}>What is Preeclampsia?</h2>
          <p style={{ fontSize: 17, color: "#64748b", maxWidth: 540, marginBottom: 52, lineHeight: 1.8 }}>
            A serious pregnancy complication affecting the entire vascular system — the leading cause of preventable maternal death globally.
          </p>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { n:"01", color:"#fef3c7", accent:"#d97706", title:"How it starts", body:"Abnormal placentation prevents proper blood vessel remodelling. The poorly-formed placenta releases inflammatory signals that damage blood vessels throughout the mother's body." },
              { n:"02", color:"#dbeafe", accent:"#2563eb", title:"The silent phase", body:"Placental biomarkers (PlGF, sFlt-1) shift 6–8 weeks before symptoms appear. By the time BP reaches 140mmHg, significant vascular damage may already be occurring." },
              { n:"03", color:"#dcfce7", accent:"#16a34a", title:"What we can do", body:"Early screening plus aspirin before 16 weeks reduces severe early-onset PE by 62%. Close monitoring allows timely delivery — the only definitive treatment." },
            ].map(c => (
              <div key={c.n} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 26px", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow="var(--shadow-md)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: DISP, fontSize: 15, fontWeight: 700, color: c.accent, marginBottom: 18 }}>{c.n}</div>
                <h3 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.8 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: "80px 0", background: "#fff", borderTop: "1px solid var(--border)" }}>
        <div className="mob-px" style={{ ...sec }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#0891b2", marginBottom: 10, fontFamily: BODY }}>Three-tier system</p>
          <h2 style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: "#0f172a", marginBottom: 16, letterSpacing: "-0.5px" }}>How MaternaSense Works</h2>
          <p style={{ fontSize: 17, color: "#64748b", maxWidth: 520, marginBottom: 52, lineHeight: 1.8 }}>
            More data means greater accuracy — but meaningful results are available with just basic clinical information.
          </p>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { n:"1", color:"#4f46e5", bg:"#eef2ff", badge:"Required", title:"Clinical Baseline",
                desc:"Available at any antenatal visit.", items:["Age, BMI & gestational age","Blood pressure readings","Symptom assessment","Medical & family history"] },
              { n:"2", color:"#0891b2", bg:"#ecfeff", badge:"Optional", title:"Routine Lab Results",
                desc:"Standard blood and urine tests. Significantly improves accuracy.", items:["Full blood count (platelets, Hb)","Uric acid & creatinine","Liver enzymes (AST, ALT)","Urine protein:creatinine ratio"] },
              { n:"3", color:"#dc2626", bg:"#fef2f2", badge:"Highest impact", title:"Specialist Biomarkers",
                desc:"Placental markers that detect PE weeks before BP rises.", items:["PlGF & PAPP-A (MoM)","sFlt-1/PlGF ratio (NPV 99.3%)","Uterine artery PI","Fetal growth percentile"] },
            ].map(t => (
              <div key={t.n} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16,
                padding: "26px 24px", borderTop: `3px solid ${t.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: DISP, fontSize: 18, fontWeight: 700, color: t.color }}>{t.n}</div>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: t.bg,
                    color: t.color, fontWeight: 600, border: `1px solid ${t.color}30` }}>{t.badge}</span>
                </div>
                <h3 style={{ fontFamily: DISP, fontSize: 19, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>{t.title}</h3>
                <p style={{ fontSize: 13.5, color: "#64748b", marginBottom: 18, lineHeight: 1.7 }}>{t.desc}</p>
                {t.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13.5, color: "#475569" }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section id="evidence" style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div className="mob-px" style={{ ...sec }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#16a34a", marginBottom: 10, fontFamily: BODY }}>Peer-reviewed research</p>
          <h2 style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: "#0f172a", marginBottom: 52, letterSpacing: "-0.5px" }}>Built on Clinical Evidence</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
            {[
              { s:"Bartsch et al.", t:"Meta-analysis", d:"92 studies · 25M+ pregnancies. Gold-standard risk odds ratios.", c:"#7c3aed" },
              { s:"ACOG PB-222", t:"Guidelines 2020", d:"US diagnostic criteria and management thresholds.", c:"#2563eb" },
              { s:"FMF Nicolaides", t:"Competing-risks", d:"57,000 pregnancies. Triple test: 96% detection at 10% FPR.", c:"#0891b2" },
              { s:"PROGNOSIS (NEJM)", t:"RCT 2016", d:"sFlt-1/PlGF ≤38 rules out PE with NPV 99.3%.", c:"#dc2626" },
              { s:"WHO Multi-country", t:"Population", d:"647,000 pregnancies across 29 countries.", c:"#16a34a" },
            ].map(e => (
              <div key={e.s} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14,
                padding: "20px 18px", borderLeft: `3px solid ${e.c}` }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{e.s}</p>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                  background: `${e.c}15`, color: e.c, fontWeight: 600 }}>{e.t}</span>
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 10, lineHeight: 1.7 }}>{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <div className="mob-px" style={{ ...sec }}>
          <h2 style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: "#0f172a", marginBottom: 16, letterSpacing: "-0.5px" }}>
            Ready to screen a patient?
          </h2>
          <p style={{ fontSize: 17, color: "#64748b", marginBottom: 36, lineHeight: 1.8 }}>
            Enter what you have — even just Tier 1 gives a meaningful risk assessment.
          </p>
          <button onClick={onStart} style={{
            padding: "16px 40px", background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 17, fontWeight: 600,
            cursor: "pointer", fontFamily: BODY, boxShadow: "0 4px 16px rgba(79,70,229,0.35)",
            transition: "all 0.15s"
          }}>
            Begin Patient Screening →
          </button>
          <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 16 }}>
            For clinical decision support only. Always apply professional medical judgement.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 40px" }}>
        <div style={{ ...sec, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={26}/>
            <span style={{ fontFamily: DISP, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>MaternaSense</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>v3.0</span>
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Evidence-based preeclampsia screening · Clinical decision support</p>
        </div>
      </footer>
    </div>
  );
}

// ─── APP SHELL ─────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");

  if (view === "home") return <Landing onStart={() => setView("single")}/>;

  return (
    <div style={{ background: "#f4f6fb", minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e8edf5",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "0 28px",
          height: 62, display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("home")} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13.5, color: "#64748b", fontFamily: BODY, fontWeight: 500,
              padding: "6px 10px", borderRadius: 7, display: "flex", alignItems: "center", gap: 4,
              transition: "all 0.12s"
            }}
              onMouseEnter={e => e.currentTarget.style.background="#f1f5f9"}
              onMouseLeave={e => e.currentTarget.style.background="none"}>
              ← Back
            </button>
            <div style={{ width: 1, height: 20, background: "#e2e8f0" }}/>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Logo size={28}/>
              <span style={{ fontFamily: DISP, fontSize: 17, fontWeight: 700, color: "#1e293b" }}>MaternaSense</span>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {[["single","Risk Screening"],["trend","Trend Monitor"]].map(([t,l]) => (
              <button key={t} onClick={() => setView(t)} style={{
                padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: BODY, fontSize: 13.5, fontWeight: 600, transition: "all 0.15s",
                background: view === t ? "#fff" : "transparent",
                color:      view === t ? "#4f46e5" : "#64748b",
                boxShadow:  view === t ? "var(--shadow-sm)" : "none",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 8,
              background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontWeight: 600 }}>
              ● API Online
            </span>
            <span className="hide-mob" style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 8,
              background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
              35 features · RF+GBM
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 60px" }}>
        {view === "single" ? <SingleCheck/> : <TrendMonitor/>}
      </main>
    </div>
  );
}