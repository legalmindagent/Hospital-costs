import { useMemo, useState } from "react";
import generatedData from "./data/generatedData.json";

const DATA = generatedData;

const fmt = (n) => {
  if (!n || n === 0) return "-";
  if (n >= 1000) return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 100) return "$" + Number(n).toFixed(0);
  return "$" + Number(n).toFixed(2);
};

const CATS = ["All", ...Array.from(new Set(DATA.map((d) => d.cat))).sort()];
const HOSPS = ["All", ...Array.from(new Set(DATA.map((d) => d.h))).sort()];
const HC = { Erlanger: "#3b82f6", "CHI Memorial": "#14b8a6", Parkridge: "#ef4444", "Parkridge East": "#f97316" };
const VIEWS = [
  { k: "sticker", label: "Sticker Price", sub: "What they bill", color: "#ef4444" },
  { k: "cost", label: "Actual Cost", sub: "What it costs them", color: "#a855f7" },
  { k: "cash", label: "Cash Price", sub: "Pay without insurance", color: "#10b981" },
  { k: "insurance", label: "Insurance Pays", sub: "Lowest insurer rate", color: "#3b82f6" },
];

function Card({ item, view }) {
  const [open, setOpen] = useState(false);
  const g = item.g || 0;
  const cash = item.cash || 0;
  const cost = item.cost || 0;
  const lowestIns = item.pr && item.pr.length > 0 ? item.pr[0].$ : 0;
  const hc = HC[item.h] || "#888";

  const prices = { sticker: g, cost: cost, cash: cash > 0 ? cash : 0, insurance: lowestIns };
  const labels = {
    sticker: "Sticker Price",
    cost: "Est. Actual Cost",
    cash: cash > 0 ? "Cash Price" : "No Cash Listed",
    insurance: lowestIns > 0 ? "Lowest Insurer Rate" : "No Rate Listed",
  };
  const colors = {
    sticker: "#ef4444",
    cost: "#a855f7",
    cash: cash > 0 ? "#10b981" : "#64748b",
    insurance: lowestIns > 0 ? "#3b82f6" : "#64748b",
  };

  const mainPrice = prices[view];
  const mainLabel = labels[view];
  const mainColor = colors[view];
  const costMarkup = cost > 0 && g > 0 ? Math.round(g / cost) : 0;

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 8,
        borderLeft: `4px solid ${hc}`,
        cursor: "pointer",
      }}
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{item.d}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: hc, background: `${hc}18`, padding: "1px 7px", borderRadius: 10 }}>{item.h}</span>
            <span style={{ fontSize: 9, color: "#64748b", background: "#1e293b", padding: "1px 5px", borderRadius: 4 }}>{item.cat}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: mainColor, fontFamily: "monospace" }}>{mainPrice > 0 ? fmt(mainPrice) : "-"}</div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>{mainLabel}</div>
          {view === "cost" && costMarkup > 2 && <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b" }}>{costMarkup.toLocaleString()}x markup</div>}
        </div>
      </div>

      {open && item.pr && item.pr.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>WHAT EACH INSURER PAYS:</div>
          {item.pr.map((p, i) => {
            const barW = g > 0 ? Math.max((p.$ / g) * 100, 3) : 50;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <div style={{ width: 100, fontSize: 10, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>{p.n}</div>
                <div style={{ flex: 1, height: 18, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(barW, 100)}%`, height: "100%", borderRadius: 3, background: i === 0 ? "#10b981" : "#3b82f6" }} />
                </div>
                <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: "#e2e8f0", textAlign: "right", fontFamily: "monospace" }}>{fmt(p.$)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [hospital, setHospital] = useState("All");
  const [view, setView] = useState("sticker");

  const filtered = useMemo(() => {
    const f = DATA.filter((item) => {
      if (cat !== "All" && item.cat !== cat) return false;
      if (hospital !== "All" && item.h !== hospital) return false;
      if (search && !item.d.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    if (view === "cost") {
      f.sort((a, b) => {
        const am = a.cost && a.g ? a.g / a.cost : 0;
        const bm = b.cost && b.g ? b.g / b.cost : 0;
        return bm - am;
      });
    } else if (view === "cash") {
      f.sort((a, b) => (b.cash || 0) - (a.cash || 0));
    } else if (view === "insurance") {
      f.sort((a, b) => {
        const am = a.pr?.length && a.g ? a.g / a.pr[0].$ : 0;
        const bm = b.pr?.length && b.g ? b.g / b.pr[0].$ : 0;
        return bm - am;
      });
    } else {
      f.sort((a, b) => (b.g || 0) - (a.g || 0));
    }

    return f;
  }, [search, cat, hospital, view]);

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#f1f5f9", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box;margin:0;padding:0}body{background:#020617;margin:0}
        input::placeholder{color:#475569}button{font-family:inherit;cursor:pointer}
      `}</style>

      <div style={{ background: "linear-gradient(180deg,#0f172a,#020617)", borderBottom: "1px solid #1e293b", padding: "24px 16px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#f87171", fontWeight: 700, letterSpacing: 2, fontFamily: "monospace" }}>PUBLIC DATA - CHATTANOOGA, TN</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>What Hospitals Actually Charge vs What It Costs Them</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>
            {DATA.length} items from public hospital cost and drug cost datasets. Search and compare sticker prices, costs, cash prices, and insurer rates.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid #334155" }}>
          {VIEWS.map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              style={{
                padding: "10px 4px",
                border: "none",
                background: view === v.k ? `${v.color}18` : "#0f172a",
                borderBottom: view === v.k ? `3px solid ${v.color}` : "3px solid transparent",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: view === v.k ? v.color : "#94a3b8" }}>{v.label}</div>
              <div style={{ fontSize: 8, color: "#64748b" }}>{v.sub}</div>
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search... (aspirin, MRI, room charge, blood test)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, color: "#f1f5f9", fontSize: 14, outline: "none", marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
          {HOSPS.map((h) => (
            <button
              key={h}
              onClick={() => setHospital(h)}
              style={{
                padding: "5px 10px",
                borderRadius: 18,
                border: hospital === h ? `1px solid ${HC[h] || "#f59e0b"}` : "1px solid #334155",
                background: hospital === h ? `${HC[h] || "#f59e0b"}15` : "transparent",
                color: hospital === h ? HC[h] || "#fbbf24" : "#94a3b8",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {h}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: "4px 8px",
                borderRadius: 14,
                border: cat === c ? "1px solid #f59e0b" : "1px solid #1e293b",
                background: cat === c ? "#f59e0b12" : "transparent",
                color: cat === c ? "#fbbf24" : "#64748b",
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{filtered.length} items</div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 24px" }}>
        {filtered.map((item, i) => (
          <div key={item.h + item.d + i} style={{ animation: `fadeIn 0.2s ease ${Math.min(i * 0.02, 0.2)}s both` }}>
            <Card item={item} view={view} />
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>No results.</div>}
      </div>
    </div>
  );
}
