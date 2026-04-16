import { useMemo, useState } from "react";
import rawData from "./data/generatedData.json";

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt = (n) => {
  if (!n || n === 0) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1000) return "$" + Math.round(n).toLocaleString();
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
};
const fmtX = (n) => (n > 0 ? n.toFixed(1) + "×" : "—");
const accentForMarkup = (mk) =>
  mk >= 10 ? "#ef4444" : mk >= 6 ? "#f97316" : mk >= 3 ? "#eab308" : "#22c55e";

/* ─── Pre-process ─────────────────────────────────────────── */
const hospitals = rawData.filter((r) => r.T === "H");
const drugs = rawData.filter((r) => r.type === "drug");

const SORTS = [
  { k: "markup", label: "Worst Markup", color: "#f87171" },
  { k: "total",  label: "Total Billed", color: "#60a5fa" },
  { k: "procs",  label: "Most Services", color: "#c084fc" },
];
function sortHospitals(list, key) {
  const a = [...list];
  if (key === "markup") return a.sort((x, y) => y.mk - x.mk);
  if (key === "total") return a.sort((x, y) => y.tc - x.tc);
  if (key === "procs") return a.sort((x, y) => y.pc - x.pc);
  return a;
}

/* ─── Bar ─────────────────────────────────────────────────── */
function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(Math.min((value / max) * 100, 100), 1.5) : 0;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace" }}>{fmt(value)}</span>
      </div>
      <div style={{ height: 6, background: "#1e293b", borderRadius: 99 }}>
        <div style={{ height: 6, width: pct + "%", background: color, borderRadius: 99, transition: "width .3s" }} />
      </div>
    </div>
  );
}

/* ─── Procedure Row ───────────────────────────────────────── */
function ProcRow({ p }) {
  const accent = accentForMarkup(p.mk);
  return (
    <div style={{ background: "#020617", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.35 }}>{p.d}</div>
          <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>
            {p.t === "I" ? "Inpatient" : "Outpatient"} · Code {p.c} · {p.v.toLocaleString()} cases
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: accent, fontFamily: "monospace" }}>{fmtX(p.mk)}</div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <Bar label="Hospital Charges" value={p.ch} max={p.ch} color="#f87171" />
        <Bar label="Total Paid (all payers)" value={p.pd} max={p.ch} color="#60a5fa" />
        <Bar label="Medicare Pays" value={p.mp} max={p.ch} color="#34d399" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", background: "#7f1d1d22", borderRadius: 6, padding: "5px 10px", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: "#fca5a5" }}>Overcharge per patient</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>{fmt(p.ch - p.pd)}</span>
      </div>
    </div>
  );
}

/* ─── Hospital Card ───────────────────────────────────────── */
function HospCard({ h }) {
  const [open, setOpen] = useState(false);
  const accent = accentForMarkup(h.mk);

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{
        background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
        padding: "16px 16px 12px 20px", marginBottom: 10, cursor: "pointer",
        WebkitTapHighlightColor: "transparent", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: "16px 0 0 16px" }} />

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.35 }}>{h.n}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
            {h.ci}, {h.st} {h.z} · {h.pc} services on file
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: accent, fontFamily: "monospace", lineHeight: 1 }}>{fmtX(h.mk)}</div>
          <div style={{ fontSize: 8, color: "#64748b", fontWeight: 700, letterSpacing: 0.5 }}>AVG MARKUP</div>
        </div>
      </div>

      {/* summary bars */}
      <div style={{ marginTop: 12 }}>
        <Bar label="Total Billed to Patients" value={h.tc} max={h.tc} color="#f87171" />
        <Bar label="Total Actually Paid" value={h.tp} max={h.tc} color="#34d399" />
      </div>

      <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d55", borderRadius: 10, padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#fca5a5" }}>Total overcharge</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>{fmt(h.tc - h.tp)}</span>
      </div>

      <div style={{ marginTop: 10, textAlign: "center" }}>
        <span style={{ fontSize: 11, color: "#334155" }}>{open ? "▲ hide procedures" : "▼ see what they charge per procedure"}</span>
      </div>

      {/* expanded: per-procedure breakdown */}
      {open && (
        <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", letterSpacing: 1, marginBottom: 10 }}>
            TOP PROCEDURES — WHAT THEY CHARGE VS WHAT GETS PAID
          </div>
          {h.pr.map((p, i) => <ProcRow key={i} p={p} />)}
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#020617", borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: "#475569" }}>
              Source: CMS Medicare Inpatient/Outpatient by Provider & Service · Provider CCN: {h.ccn}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Drug Card ───────────────────────────────────────────── */
function DrugCard({ d }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
      padding: "16px 16px 14px 20px", marginBottom: 10, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#f59e0b", borderRadius: "16px 0 0 16px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.35 }}>{d.name}</div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>NDC: {d.ndc} · Unit: {d.unit}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace", lineHeight: 1 }}>{fmt(d.nadac)}</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>per {d.unit}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, padding: "6px 10px", background: "#422006", borderRadius: 8, display: "inline-block" }}>
        <span style={{ fontSize: 10, color: "#fbbf24" }}>Pharmacy acquisition cost (what wholesalers charge)</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 9, color: "#475569" }}>Source: Medicaid NADAC · As of {d.asOf}</div>
    </div>
  );
}

/* ─── Main App ────────────────────────────────────────────── */
export default function App() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("hospitals");
  const [sort, setSort] = useState("markup");
  const [stateFilter, setStateFilter] = useState("All");

  const allStates = useMemo(() => {
    const s = new Set(hospitals.map((h) => h.st));
    return ["All", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (tab === "hospitals") {
      let list = hospitals;
      if (stateFilter !== "All") list = list.filter((h) => h.st === stateFilter);
      if (q) list = list.filter((h) => h.n.toLowerCase().includes(q) || h.ci.toLowerCase().includes(q) || h.z.includes(q));
      return sortHospitals(list, sort).slice(0, 200);
    }
    let list = drugs;
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.ndc.includes(q));
    return list;
  }, [search, tab, sort, stateFilter]);

  const stats = useMemo(() => {
    const h = tab === "hospitals" ? filtered.filter((r) => r.T === "H") : hospitals;
    if (!h.length) return {};
    const mks = h.map((r) => r.mk);
    const avg = mks.reduce((a, b) => a + b, 0) / mks.length;
    const sorted = [...mks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const totalC = h.reduce((s, r) => s + r.tc, 0);
    const totalP = h.reduce((s, r) => s + r.tp, 0);
    return { avg, median, totalC, totalP, count: filtered.length };
  }, [tab, filtered]);

  return (
    <div style={{ minHeight: "100dvh", background: "#020617", color: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#020617;margin:0;-webkit-font-smoothing:antialiased}
        input,button{font-family:inherit;cursor:pointer}
        input::placeholder{color:#475569}
        ::-webkit-scrollbar{display:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* header */}
      <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e293b", padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#f87171", fontWeight: 800, letterSpacing: 2, fontFamily: "monospace" }}>LIVE · CMS PUBLISHED DATA</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.5 }}>Hospital Price Transparency</h1>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>What hospitals charge vs. what actually gets paid — per procedure, per hospital</p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 12px 40px" }}>

        {/* tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 12, background: "#0f172a", borderRadius: 14, padding: 4, border: "1px solid #1e293b" }}>
          {[
            { id: "hospitals", icon: "🏥", label: "Hospitals", count: hospitals.length },
            { id: "drugs",     icon: "💊", label: "Drugs",     count: drugs.length },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); setStateFilter("All"); }} style={{ padding: "10px 4px", border: "none", background: tab === t.id ? "#1e40af22" : "transparent", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: tab === t.id ? "#93c5fd" : "#475569" }}>{t.label}</span>
              <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* sort (hospitals only) */}
        {tab === "hospitals" && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${SORTS.length},1fr)`, marginBottom: 12, background: "#0f172a", borderRadius: 14, padding: 4, border: "1px solid #1e293b" }}>
            {SORTS.map((s) => (
              <button key={s.k} onClick={() => setSort(s.k)} style={{ padding: "8px 4px", border: "none", background: sort === s.k ? s.color + "22" : "transparent", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: sort === s.k ? s.color : "#475569" }}>{s.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: 0.5 }}>🔍</span>
          <input
            type="text" inputMode="search"
            placeholder={tab === "hospitals" ? "Search hospitals, cities, zip…" : "Search drugs, NDC…"}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 40px 12px 38px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, color: "#f1f5f9", fontSize: 15, outline: "none" }}
          />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", fontSize: 18, lineHeight: 1 }}>✕</button>}
        </div>

        {/* state filter */}
        {tab === "hospitals" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
            {allStates.map((s) => (
              <button key={s} onClick={() => setStateFilter(s)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, border: stateFilter === s ? "1.5px solid #3b82f6" : "1.5px solid #1e293b", background: stateFilter === s ? "#3b82f618" : "transparent", color: stateFilter === s ? "#60a5fa" : "#475569", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* stats */}
        {tab === "hospitals" && stats.avg && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={{ background: "#0f172a", border: "1px solid #7f1d1d", borderRadius: 12, padding: "10px 10px" }}>
              <div style={{ fontSize: 8, color: "#475569", fontWeight: 800, letterSpacing: 1 }}>AVG MARKUP</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>{stats.avg.toFixed(1)}×</div>
              <div style={{ fontSize: 8, color: "#7f1d1d" }}>charge ÷ payment</div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 10px" }}>
              <div style={{ fontSize: 8, color: "#475569", fontWeight: 800, letterSpacing: 1 }}>TOTAL BILLED</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>{fmt(stats.totalC)}</div>
              <div style={{ fontSize: 8, color: "#334155" }}>sticker prices</div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 10px" }}>
              <div style={{ fontSize: 8, color: "#475569", fontWeight: 800, letterSpacing: 1 }}>ACTUALLY PAID</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>{fmt(stats.totalP)}</div>
              <div style={{ fontSize: 8, color: "#334155" }}>what they received</div>
            </div>
          </div>
        )}

        {/* legend */}
        {tab === "hospitals" && (
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { c: "#f87171", l: "What they charge" },
              { c: "#60a5fa", l: "Total paid (all payers)" },
              { c: "#34d399", l: "Medicare actually pays" },
            ].map((x) => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>{x.l}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
          Showing {filtered.length.toLocaleString()} {tab === "hospitals" ? "hospitals" : "drugs"}
          {stateFilter !== "All" ? ` in ${stateFilter}` : ""}
          {search ? ` matching "${search}"` : ""}
        </div>

        {/* cards */}
        {filtered.map((item, i) => (
          <div key={item.ccn || item.ndc || i} style={{ animation: `fadeUp .15s ease ${Math.min(i * 0.01, 0.15)}s both` }}>
            {item.T === "H" ? <HospCard h={item} /> : <DrugCard d={item} />}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>No results</div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>Try a different search or filter</div>
          </div>
        )}

        {filtered.length >= 200 && tab === "hospitals" && (
          <div style={{ textAlign: "center", padding: 16, fontSize: 12, color: "#334155" }}>
            Showing top 200 — use search or state filter to narrow results
          </div>
        )}

        {/* footer */}
        <div style={{ marginTop: 40, borderTop: "1px solid #1e293b", paddingTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#334155", lineHeight: 1.6 }}>
            Data: CMS Medicare Inpatient &amp; Outpatient by Provider and Service + Medicaid NADAC<br />
            Hospital charges &amp; payments are averages per patient per DRG/APC code.<br />
            "Charge" = what the hospital submits. "Paid" = what payers actually pay.<br />
            Drug prices are pharmacy acquisition cost (NADAC), not retail price.<br />
            {hospitals.length.toLocaleString()} hospitals · {drugs.length} drugs · {hospitals.reduce((s, h) => s + h.pc, 0).toLocaleString()} total procedures
          </div>
        </div>
      </div>
    </div>
  );
}
