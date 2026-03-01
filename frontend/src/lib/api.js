const BASE = "http://127.0.0.1:8000";;

async function post(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const predict = (payload) => post("/predict", payload);
export const explain = (payload) => post("/explain", payload);
export const trend   = (payload) => post("/trend", payload);