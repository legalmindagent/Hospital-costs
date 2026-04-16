import { useMemo, useState, useRef } from "react";
import generatedData from "./data/generatedData.json";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n) => {
  if (!n || n === 0) return "—";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 100) return "$" + Number(n).toFixed(0);
  return "$" + Number(n).toFixed(2);
};

/* ─── category config ─────────────────────────────────────── */
const TABS = [
  { id: "all",   label: "All",       icon: "⊞" },
  { id: "drugs", label: "Drugs",     icon: "💊" },
  { id: "costs", label: "Hospitals", icon: "🏥" },
];
const tabFor = (item) => (item.cat === "Drugs & IV" ? "drugs" : "costs");

/* ─── view config ─────────────────────────────────────────── */
const VIEWS = [
  { k: "sticker",   label: "Sticker",   full: "Sticker Price",    desc: "What they bill",        color: "#f87171" },
  { k: "cost",      label: "Cost",       full: "Actual Cost",      desc: "What it costs them",    color: "#c084fc" },
  { k: "cash",      label: "Cash",       full: "Cash Price",       desc: "Pay without insurance", color: "#34d399" },
  { k: "insurance", label: "Insurance",  full: "Insurance Pays",   desc: "Lowest rate",           color: "#60a5fa" },
];

// For hospital cost reports, pr[0].$ === cost (no real insurer rates in data).
// For NADAC drugs, g === cost === cash === pr[0].$ (single acquisition cost).
const hasRealInsurance = (item) => {
  const ins = item.pr?.[0]?.$ || 0;
  return ins > 0 && ins !== item.cost && ins !== item.g;
};

const getPrice = (item, view) => {
  if (view === "sticker")   return item.g    || 0;
  if (view === "cost")      return item.cost || 0;
  if (view === "cash") {
    // Don't show cash if it's the same as sticker (NADAC sets all equal)
    const c = item.cash || 0;
    return c > 0 && c !== item.g ? c : 0;
  }
  if (view === "insurance") {
    // Only show insurer rate if it's genuinely different from cost
    return hasRealInsurance(item) ? item.pr[0].$ : 0;
  }
  return 0;
};

const sortData = (data, view) => {
  const arr = [...data];
  if (view === "cost") {
    arr.sort((a, b) => {
      const am = a.cost && a.g ? a.g / a.cost : 0;
      const bm = b.cost && b.g ? b.g / b.cost : 0;
      return bm - am;
    });
  } else {
    arr.sort((a, b) => (getPrice(b, view) || 0) - (getPrice(a, view) || 0));
  }
  return arr;
};

/* ─── PriceBar ────────────────────────────────────────────── */
function PriceBar({ label, value, max, color }) {
  const w = max > 0 ? Math.max(Math.min((value / max) * 100, 100), 2) : 0;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "monospace" }}>{fmt(value)}</span>
      </div>
      <div style={{ height: 5, background: "#1e293b", borderRadius: 99 }}>
        <div style={{ height: 5, width: w + "%", background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

/* ─── Card ────────────────────────────────────────────────── */
function Card({ item, view }) {
  const [open, setOpen] = useState(false);
  const g = item.g || 0;
  const cost = item.cost || 0;
  const cash = item.cash || 0;
  const lowestIns = hasRealInsurance(item) ? item.pr[0].$ : 0;
  const rawHighlight = getPrice(item, view);
  // Fall back to cost for Insurance/Cash views when no real data exists
  const highlight = rawHighlight > 0 ? rawHighlight : (view === "insurance" || view === "cash") ? 0 : rawHighlight;
  const vcfg = VIEWS.find((v) => v.k === view);
  const markup = cost > 0 && g > 0 ? (g / cost).toFixed(1) : null;
  const catColor = item.cat === "Drugs & IV" ? "#f59e0b" : "#60a5fa";
  const catBg = item.cat === "Drugs & IV" ? "#f59e0b18" : "#60a5fa18";
  const hasInsurers = item.pr && item.pr.length > 0;

  return (
    <div
      onClick={() => hasInsurers && setOpen((o) => !o)}
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 16,
        padding: "16px 16px 16px 20px",
        marginBottom: 10,
        cursor: hasInsurers ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: vcfg.color, borderRadius: "16px 0 0 16px" }} />

      {/* top row */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.35 }}>{item.d}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: catColor, background: catBg, padding: "2px 8px", borderRadius: 10 }}>{item.cat}</span>
            {item.h && item.h !== "Medicaid NADAC" && (
              <span style={{ fontSize: 10, color: "#64748b", background: "#1e293b", padding: "2px 7px", borderRadius: 10 }}>{item.h}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: vcfg.color, fontFamily: "monospace", lineHeight: 1 }}>
            {highlight > 0 ? fmt(highlight) : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{vcfg.full}</div>
          {view === "cost" && markup && parseFloat(markup) > 1.5 && (
            <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>{markup}× markup</div>
          )}
        </div>
      </div>

      {/* price bars — only show bars where values genuinely differ */}
      {(g > 0 || cash > 0 || cost > 0) && (
        <div style={{ marginTop: 12 }}>
          {g > 0 && <PriceBar label="Sticker / Billed" value={g} max={g} color="#f87171" />}
          {cost > 0 && cost !== g && <PriceBar label="Actual Cost" value={cost} max={g || cost} color="#c084fc" />}
          {cash > 0 && cash !== g && cash !== cost && <PriceBar label="Cash Price" value={cash} max={g || cash} color="#34d399" />}
          {lowestIns > 0 && <PriceBar label="Insurance Rate" value={lowestIns} max={g || lowestIns} color="#60a5fa" />}
        </div>
      )}

      {hasInsurers && (
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#334155" }}>{open ? "▲ collapse" : "▼ see insurer rates"}</span>
        </div>
      )}

      {open && hasInsurers && (
        <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#334155", letterSpacing: 1, marginBottom: 10 }}>INSURER RATES</div>
          {item.pr.map((p, i) => {
            const w = g > 0 ? Math.max(Math.min((p.$ / g) * 100, 100), 2) : 50;
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.n}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0", fontFamily: "monospace" }}>{fmt(p.$)}</span>
                </div>
                <div style={{ height: 6, background: "#0f172a", borderRadius: 99 }}>
                  <div style={{ width: w + "%", height: "100%", background: "#3b82f6", borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main App ────────────────────────────────────────────── */
export default function App() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("sticker");
  const [hosp, setHosp] = useState("All");

  const allHospitals = useMemo(() => {
    const raw = generatedData
      .filter((d) => tab === "all" || tabFor(d) === tab)
      .map((d) => d.h);
    return ["All", ...Array.from(new Set(raw)).sort()];
  }, [tab]);

  const filtered = useMemo(() => {
    const base = generatedData.filter((item) => {
      if (tab !== "all" && tabFor(item) !== tab) return false;
      if (hosp !== "All" && item.h !== hosp) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.d.toLowerCase().includes(q) && !item.h?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return sortData(base, view).slice(0, 300);
  }, [search, tab, hosp, view]);

  const avgMarkup = useMemo(() => {
    const items = filtered.filter((d) => d.cost > 0 && d.g > 0);
    if (!items.length) return null;
    return (items.reduce((s, d) => s + d.g / d.cost, 0) / items.length).toFixed(1);
  }, [filtered]);

  const vcfg = VIEWS.find((v) => v.k === view);

  return (
    <div style={{ minHeight: "100dvh", background: "#020617", color: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#020617;margin:0;-webkit-font-smoothing:antialiased}
        input,button{font-family:inherit;cursor:pointer}
        input::placeholder{color:#334155}
        ::-webkit-scrollbar{display:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* header */}
      <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e293b", padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#f87171", fontWeight: 800, letterSpacing: 2, fontFamily: "monospace" }}>LIVE · PUBLIC DATA</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.5 }}>Hospital Price Transparency</h1>
          <p style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>Real costs vs. what hospitals bill</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "14px 12px 100px" }}>

        {/* view toggle */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", marginBottom: 12, background: "#0f172a", borderRadius: 14, padding: 4, border: "1px solid #1e293b" }}>
          {VIEWS.map((v) => (
            <button key={v.k} onClick={() => setView(v.k)} style={{ padding: "8px 4px", border: "none", background: view === v.k ? v.color + "22" : "transparent", borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: view === v.k ? v.color : "#475569" }}>{v.label}</div>
              <div style={{ fontSize: 9, color: view === v.k ? v.color + "99" : "#334155", marginTop: 1 }}>{v.desc}</div>
            </button>
          ))}
        </div>

        {/* tab bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", marginBottom: 12, background: "#0f172a", borderRadius: 14, padding: 4, border: "1px solid #1e293b" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setHosp("All"); }} style={{ padding: "9px 4px", border: "none", background: tab === t.id ? "#1e40af22" : "transparent", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: tab === t.id ? "#93c5fd" : "#475569" }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            inputMode="search"
            placeholder="Search procedures, drugs, hospitals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 40px 12px 38px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, color: "#f1f5f9", fontSize: 15, outline: "none" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", fontSize: 18, lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* hospital filter pills */}
        {allHospitals.length > 2 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
            {allHospitals.slice(0, 20).map((h) => (
              <button key={h} onClick={() => setHosp(h)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, border: hosp === h ? "1.5px solid #3b82f6" : "1.5px solid #1e293b", background: hosp === h ? "#3b82f618" : "transparent", color: hosp === h ? "#60a5fa" : "#475569", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </button>
            ))}
          </div>
        )}

        {/* stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 800, letterSpacing: 1 }}>SHOWING</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9", fontFamily: "monospace" }}>{filtered.length.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "#334155" }}>items</div>
          </div>
          {avgMarkup && (
            <div style={{ background: "#0f172a", border: "1px solid #7f1d1d", borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "#475569", fontWeight: 800, letterSpacing: 1 }}>AVG MARKUP</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>{avgMarkup}×</div>
              <div style={{ fontSize: 10, color: "#7f1d1d" }}>sticker vs actual cost</div>
            </div>
          )}
        </div>

        {/* legend */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <div key={v.k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} />
              <span style={{ fontSize: 10, color: "#475569" }}>{v.label}</span>
            </div>
          ))}
        </div>

        {/* cards */}
        {filtered.map((item, i) => (
          <div key={i} style={{ animation: `fadeUp 0.18s ease ${Math.min(i * 0.012, 0.2)}s both` }}>
            <Card item={item} view={view} />
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>No results</div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>Try a different search or filter</div>
          </div>
        )}

        {filtered.length === 300 && (
          <div style={{ textAlign: "center", padding: 16, fontSize: 12, color: "#334155" }}>
            Showing top 300 — refine your search to narrow results
          </div>
        )}
      </div>

      {/* bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0f1e", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-around", padding: "8px 8px max(8px, env(safe-area-inset-bottom))", zIndex: 100 }}>
        {VIEWS.map((v) => (
          <button key={v.k} onClick={() => setView(v.k)} style={{ flex: 1, padding: "6px 4px", background: "none", border: "none", borderTop: view === v.k ? "2px solid " + v.color : "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: view === v.k ? v.color : "#1e293b" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: view === v.k ? v.color : "#334155" }}>{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
