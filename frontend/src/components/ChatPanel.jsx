import { useState, useRef, useEffect } from "react";

const DISP = "'Fraunces', Georgia, serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
console.log('🔍 ChatPanel BASE URL:', BASE);

// ── Suggested questions per risk level ───────────────────────────
const SUGGESTIONS = {
  Low: [
    "Is routine monitoring sufficient or should I do anything extra?",
    "When should I be concerned and bring her back sooner?",
    "Should I start aspirin prophylaxis?",
    "What should I tell the patient to watch for at home?",
  ],
  Moderate: [
    "What labs should I order today?",
    "Should I start aspirin and what dose?",
    "How often should I be checking her blood pressure?",
    "At what point should I refer to MFM specialist?",
  ],
  High: [
    "Should I admit this patient now?",
    "What bloods do I need urgently?",
    "Should I start antihypertensives and which one?",
    "She's 32 weeks — when should we deliver?",
  ],
  Critical: [
    "She has BP 160/110 — what do I give right now?",
    "Do I need to start magnesium sulphate?",
    "How quickly can this deteriorate into eclampsia?",
    "We're 32 weeks — is it safe to deliver now?",
  ],
};

// ── Markdown-ish renderer (bold, lists, headings) ─────────────────
function RenderMessage({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <p key={i} style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", marginTop: 10, marginBottom: 4 }}>
          {line.slice(4)}
        </p>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 12, marginBottom: 4 }}>
          {line.slice(3)}
        </p>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      elements.push(
        <p key={i} style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.match(/^[-•]\s/)) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3 }}>
          <span style={{ color: "#4f46e5", fontWeight: 700, marginTop: 2, flexShrink: 0 }}>·</span>
          <span style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7 }}>
            {renderInline(line.slice(2))}
          </span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)[1];
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: "#eef2ff",
            color: "#4f46e5", fontSize: 11, fontWeight: 700, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{num}</span>
          <span style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7 }}>
            {renderInline(line.replace(/^\d+\.\s/, ""))}
          </span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 6 }}/>);
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.75, marginBottom: 2 }}>
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }
  return <div>{elements}</div>;
}

function renderInline(text) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ fontWeight: 700, color: "#1e293b" }}>{p.slice(2,-2)}</strong>
      : p
  );
}

// ── Typing indicator ───────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 14px" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#94a3b8",
          animation: `bounce 1.2s ease ${i*0.15}s infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0)}
          30%{transform:translateY(-5px)}
        }
      `}</style>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  const time   = msg.time ? new Date(msg.time).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }) : "";

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ maxWidth: "78%" }}>
          <div style={{
            background: "#4f46e5", color: "#fff",
            padding: "11px 16px", borderRadius: "16px 16px 4px 16px",
            boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
          }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>{msg.content}</p>
          </div>
          <p style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", marginTop: 4 }}>{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2, fontSize: 14 }}>
        🩺
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>Clinical AI</span>
          <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20,
            background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontWeight: 600 }}>MFM Consultant</span>
          {time && <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{time}</span>}
        </div>
        <div style={{
          background: "#fff", border: "1px solid #e8edf5",
          padding: "14px 16px", borderRadius: "4px 16px 16px 16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {msg.streaming
            ? <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.75 }}>{msg.content}<span style={{ opacity: 0.5, animation: "pulse 1s infinite" }}>▍</span></p>
            : <RenderMessage text={msg.content}/>
          }
        </div>
        {!msg.streaming && msg.content && (
          <p style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 5, fontStyle: "italic" }}>
            Decision support only. Apply clinical judgement.
          </p>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function ChatPanel({ result, patientValues }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [opened,    setOpened]    = useState(false);
  const [error,     setError]     = useState("");
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);

  const risk      = result?.risk_level || "Moderate";
  const riskColor = { Low:"#16a34a", Moderate:"#b45309", High:"#c2410c", Critical:"#b91c1c" }[risk] || "#4f46e5";
  const suggestions = SUGGESTIONS[risk] || SUGGESTIONS.Moderate;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Welcome message on open
  useEffect(() => {
    if (opened && messages.length === 0) {
      const prob    = result?.probability || 0;
      const probPct = Math.round(prob * 100);
      const conf    = result?.confidence?.label || "Basic";
      const tops    = result?.top_contributors || [];
      const topName = tops[0]
        ? { sflt1_plgf_ratio:"sFlt-1/PlGF ratio", plgf_mom:"PlGF", urine_pcr:"urine protein", platelets:"platelet count",
            systolic_bp:"systolic BP", diastolic_bp:"diastolic BP", ast:"AST", creatinine:"creatinine",
            uric_acid:"uric acid", utapi:"uterine artery PI" }[tops[0].feature] || tops[0].feature
        : "blood pressure";

      const welcome = {
        Low:      `I've reviewed this patient's full data. **Good news — the model shows ${probPct}% PE probability, which places her in the Low Risk category.** The ${conf.toLowerCase()} confidence screening suggests no significant preeclampsia indicators at this time.\n\nThe most influential parameter in this assessment was **${topName}**. Routine monitoring should be sufficient, but I'm here if you have any clinical questions.`,
        Moderate: `I've reviewed this patient's complete data. **She shows a ${probPct}% PE probability — Moderate Risk.** This is above the baseline population risk and warrants closer attention.\n\nThe top driver in this prediction was **${topName}**. I'd recommend proactive lab investigation now rather than waiting. What would you like to discuss?`,
        High:     `I've reviewed this patient in full. **This is a High Risk case — ${probPct}% PE probability.** The combination of clinical findings here is concerning and I would not defer specialist review.\n\nThe dominant factor driving this prediction is **${topName}**. I'd suggest treating this as urgent. What's your clinical question?`,
        Critical: `⚠️ I've reviewed this patient and the findings are **critically concerning — ${probPct}% PE probability.** This patient needs immediate clinical assessment. Do not discharge.\n\nThe most critical finding is **${topName}**. Time is a factor here. What do you need to know right now?`,
      }[risk];

      setMessages([{ role: "assistant", content: welcome, time: Date.now() }]);
    }
  }, [opened]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setError("");

    const userMsg = { role: "user", content: text, time: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    // Placeholder for streaming response
    const assistantMsg = { role: "assistant", content: "", streaming: true, time: Date.now() };
    setMessages([...history, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const chatUrl = `${BASE}/chat`;
      console.log('🔍 ChatPanel fetching:', chatUrl, '| BASE:', BASE);

      const res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          patient_values: patientValues || {},
          result: result || {},
        }),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              full += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMsg, content: full, streaming: true };
                return updated;
              });
            } else if (data.type === "done") {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMsg, content: full, streaming: false };
                return updated;
              });
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message || "Connection failed");
      setMessages(prev => prev.slice(0, -1)); // Remove placeholder
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Collapsed state
  if (!opened) {
    return (
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setOpened(true)}
          style={{
            width: "100%", padding: "16px 20px",
            background: "#0f172a", color: "#fff",
            border: "none", borderRadius: 14, cursor: "pointer",
            fontFamily: BODY, display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", transition: "all 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.background="#1e293b"}
          onMouseLeave={e => e.currentTarget.style.background="#0f172a"}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            🩺
          </div>
          <div style={{ textAlign: "left", flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Ask the Clinical AI</p>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              Senior MFM consultant briefed on this patient — ask anything
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}/>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Online</span>
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column",
      border: "1px solid #e8edf5", borderRadius: 16, overflow: "hidden",
      background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>

      {/* Header */}
      <div style={{ background: "#0f172a", padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🩺</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>Clinical AI Consultant</p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}/>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Briefed on this patient · MFM specialist level</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20,
            background: `${riskColor}20`, color: riskColor,
            border: `1px solid ${riskColor}40`, fontWeight: 700 }}>
            {risk} Risk Patient
          </span>
          <button onClick={() => setOpened(false)} style={{
            background: "rgba(255,255,255,0.08)", border: "none", color: "#94a3b8",
            cursor: "pointer", borderRadius: 7, padding: "4px 9px", fontSize: 13,
          }}>−</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ height: 420, overflowY: "auto", padding: "18px 16px",
        background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", margin: "auto", color: "#94a3b8" }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🩺</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Loading patient context…</p>
          </div>
        )}

        {messages.map((msg, i) => <Bubble key={i} msg={msg}/>)}
        {loading && messages[messages.length-1]?.streaming === false && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#0f172a",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🩺</div>
            <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: "4px 16px 16px 16px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <TypingDots/>
            </div>
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            padding: "10px 14px", marginBottom: 8 }}>
            <p style={{ fontSize: 13, color: "#b91c1c" }}>⚠ {error} — Is the backend running? Is ANTHROPIC_API_KEY set?</p>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && !loading && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid #e8edf5", background: "#fff" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px",
            textTransform: "uppercase", marginBottom: 8 }}>Suggested questions</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{
                padding: "6px 12px", background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 20, fontSize: 12.5, color: "#374151", cursor: "pointer",
                fontFamily: BODY, transition: "all 0.15s", fontWeight: 500,
              }}
                onMouseEnter={e => { e.currentTarget.style.background="#eef2ff"; e.currentTarget.style.borderColor="#a5b4fc"; e.currentTarget.style.color="#4f46e5"; }}
                onMouseLeave={e => { e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#374151"; }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #e8edf5", background: "#fff",
        display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a clinical question about this patient…"
          rows={1}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10, resize: "none",
            border: "1.5px solid #e2e8f0", fontFamily: BODY, fontSize: 13.5,
            color: "#1e293b", outline: "none", lineHeight: 1.6, maxHeight: 100,
            overflowY: "auto", transition: "border-color 0.15s",
            background: "#f8fafc",
          }}
          onFocus={e => { e.target.style.borderColor="#4f46e5"; e.target.style.background="#fff"; }}
          onBlur={e  => { e.target.style.borderColor="#e2e8f0"; e.target.style.background="#f8fafc"; }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: 10, border: "none",
            background: loading || !input.trim() ? "#e2e8f0" : "#4f46e5",
            color: loading || !input.trim() ? "#94a3b8" : "#fff",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s",
            boxShadow: input.trim() && !loading ? "0 2px 8px rgba(79,70,229,0.30)" : "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>

      {/* Footer disclaimer */}
      <div style={{ padding: "8px 14px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
        <p style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center" }}>
          Clinical decision support only · Not a substitute for clinical assessment · Always apply local protocols
        </p>
      </div>
    </div>
  );
}