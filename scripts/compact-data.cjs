// Quick re-compact from already-fetched raw data
const fs = require("fs");

function toNum(v) {
  if (!v) return 0;
  const n = Number(String(v).replace(/[,$]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function round2(n) { return Math.round(n * 100) / 100; }

const raw_inp = JSON.parse(fs.readFileSync("public/data/medicare_inpatient_by_provider_service.json"));
const raw_out = JSON.parse(fs.readFileSync("public/data/medicare_outpatient_by_provider_service.json"));
const rawDrugs = JSON.parse(fs.readFileSync("public/data/nadac_top_2000_2024.json"));

const KEY_DRGS = new Set(["470","871","291","392","690","194","683","641","603","689","065","377","247","473","460","743","766","775","027","329","216","469","190","193","301","480","419","312","191","378"]);

const hospMap = new Map();
for (const r of raw_inp) {
  const ccn = r.Rndrng_Prvdr_CCN;
  const charge = toNum(r.Avg_Submtd_Cvrd_Chrg);
  const totalPaid = toNum(r.Avg_Tot_Pymt_Amt);
  const medicarePaid = toNum(r.Avg_Mdcr_Pymt_Amt);
  const discharges = toNum(r.Tot_Dschrgs);
  if (charge <= 0 || totalPaid <= 0 || discharges < 11) continue;
  if (!hospMap.has(ccn)) {
    hospMap.set(ccn, { ccn, name: r.Rndrng_Prvdr_Org_Name, city: r.Rndrng_Prvdr_City, state: r.Rndrng_Prvdr_State_Abrvtn, zip: r.Rndrng_Prvdr_Zip5, procs: [] });
  }
  hospMap.get(ccn).procs.push({
    drg: r.DRG_Cd, desc: r.DRG_Desc, vol: discharges,
    charge, totalPaid, medicarePaid,
    markup: round2(charge / totalPaid),
    isKey: KEY_DRGS.has(r.DRG_Cd), isOut: false,
  });
}

for (const r of raw_out) {
  const ccn = r.Rndrng_Prvdr_CCN;
  const charge = toNum(r.Avg_Tot_Sbmtd_Chrgs);
  const allowed = toNum(r.Avg_Mdcr_Alowd_Amt);
  const medicarePaid = toNum(r.Avg_Mdcr_Pymt_Amt);
  const services = toNum(r.CAPC_Srvcs);
  if (charge <= 0 || allowed <= 0 || services < 11) continue;
  if (!hospMap.has(ccn)) {
    hospMap.set(ccn, { ccn, name: r.Rndrng_Prvdr_Org_Name, city: r.Rndrng_Prvdr_City, state: r.Rndrng_Prvdr_State_Abrvtn, zip: r.Rndrng_Prvdr_Zip5, procs: [] });
  }
  hospMap.get(ccn).procs.push({
    apc: r.APC_Cd, desc: r.APC_Desc, vol: services,
    charge, totalPaid: allowed, medicarePaid,
    markup: round2(charge / allowed),
    isKey: false, isOut: true,
  });
}

const hospitals = [];
for (const [ccn, h] of hospMap) {
  if (h.procs.length === 0) continue;
  const key = h.procs.filter(p => p.isKey).sort((a, b) => b.markup - a.markup);
  const other = h.procs.filter(p => !p.isKey).sort((a, b) => b.markup - a.markup);
  const top = [...key.slice(0, 7), ...other.slice(0, 5)].slice(0, 5);
  const avgMk = round2(h.procs.reduce((s, p) => s + p.markup, 0) / h.procs.length);
  const tc = h.procs.reduce((s, p) => s + p.charge * p.vol, 0);
  const tp = h.procs.reduce((s, p) => s + p.totalPaid * p.vol, 0);
  hospitals.push({
    T: "H", n: h.name, ci: h.city, st: h.state, z: h.zip, ccn,
    mk: avgMk, tc: round2(tc), tp: round2(tp), pc: h.procs.length,
    pr: top.map(p => ({
      c: p.drg || p.apc,
      d: p.desc.length > 55 ? p.desc.slice(0, 55) + "…" : p.desc,
      t: p.isOut ? "O" : "I",
      v: p.vol, ch: round2(p.charge), pd: round2(p.totalPaid),
      mp: round2(p.medicarePaid), mk: p.markup,
    })),
  });
}
hospitals.sort((a, b) => b.mk - a.mk);

// Drugs
const byNdc = new Map();
for (const r of rawDrugs) {
  if (!r.ndc || r.unitCost <= 0) continue;
  const ex = byNdc.get(r.ndc);
  if (!ex || r.asOf > ex.asOf) byNdc.set(r.ndc, r);
}
const drugs = [...byNdc.values()]
  .map(r => ({ type: "drug", name: r.desc, ndc: r.ndc, nadac: round2(r.unitCost), unit: r.unit || "EA", asOf: r.asOf }))
  .sort((a, b) => b.nadac - a.nadac);

const merged = [...hospitals, ...drugs];
fs.writeFileSync("src/data/generatedData.json", JSON.stringify(merged));
console.log("Wrote", merged.length, "records. Size:", (JSON.stringify(merged).length / 1024 / 1024).toFixed(1), "MB");
console.log("Hospitals:", hospitals.length, "/ Drugs:", drugs.length);

// Show sample
const s = hospitals.find(h => h.pr.length >= 3 && h.mk > 3 && h.mk < 10);
if (s) {
  console.log("\nSample hospital:", JSON.stringify(s, null, 2));
}
