/**
 * Fetches Medicare published hospital pricing data from CMS and merges with
 * existing cost report data to create a comprehensive transparency dataset.
 *
 * Data sources:
 *  1. Medicare Inpatient by Provider & Service (DRG-level per hospital)
 *     - What hospitals charge (sticker) vs what Medicare pays per procedure
 *  2. Medicare Outpatient by Provider & Service (APC-level per hospital)
 *  3. Existing hospital cost reports (already in public/data/)
 *  4. NADAC drug acquisition costs (already in public/data/)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "public", "data");
const OUT = path.join(ROOT, "src", "data", "generatedData.json");

const INPATIENT_DATASET = "690ddc6c-2767-4618-b277-420ffb2bf27c";
const OUTPATIENT_DATASET = "ccbc9a44-40d4-46b4-a709-5caa59212e50";

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;

async function fetchPaged(datasetId, pageSize = 5000) {
  const all = [];
  let offset = 0;
  while (true) {
    const url = `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?size=${pageSize}&offset=${offset}`;
    console.log(`  Fetching offset=${offset}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// Common DRGs that people care about (top 30 most common/impactful)
const KEY_DRGS = new Set([
  "470", // Major Hip And Knee Joint Replacement
  "871", // Septicemia Or Severe Sepsis
  "291", // Heart Failure
  "392", // Esophagitis, Gastroenteritis
  "690", // Kidney & Urinary Tract Infections
  "194", // Simple Pneumonia & Pleurisy
  "683", // Renal Failure
  "641", // Misc Disorders of Nutrition, Metabolism
  "603", // Cellulitis
  "689", // Kidney & UTI
  "065", // Intracranial Hemorrhage
  "377", // GI Hemorrhage
  "247", // Perc Cardiovascular Proc w Drug-Eluting Stent
  "473", // Cervical Spinal Fusion
  "460", // Spinal Fusion
  "743", // Uterine & Adnexa Proc - benign
  "766", // Cesarean Section
  "775", // Vaginal Delivery
  "027", // Craniotomy
  "329", // Major Small & Large Bowel Procedures
  "216", // Cardiac Valve & Other Major Cardiothoracic Proc
  "469", // Major Hip and Knee Joint Replacement or Reattachment
  "190", // COPD
  "193", // Simple Pneumonia
  "301", // Cardiac Arrhythmia
  "480", // Hip & Femur Procedures
  "419", // Laparoscopic Cholecystectomy  
  "312", // Syncope & Collapse
  "191", // COPD w CC
  "378", // GI Hemorrhage w MCC
]);

async function run() {
  console.log("=== Fetching Medicare Inpatient data (by Provider & Service) ===");
  const inpatientRaw = await fetchPaged(INPATIENT_DATASET);
  console.log(`  Total inpatient records: ${inpatientRaw.length}`);

  console.log("\n=== Fetching Medicare Outpatient data (by Provider & Service) ===");
  const outpatientRaw = await fetchPaged(OUTPATIENT_DATASET);
  console.log(`  Total outpatient records: ${outpatientRaw.length}`);

  // Save raw data
  await fs.writeFile(
    path.join(RAW_DIR, "medicare_inpatient_by_provider_service.json"),
    JSON.stringify(inpatientRaw)
  );
  await fs.writeFile(
    path.join(RAW_DIR, "medicare_outpatient_by_provider_service.json"),
    JSON.stringify(outpatientRaw)
  );
  console.log("  Raw files saved.");

  // ── Process Inpatient DRG data ──
  // Group by hospital, then pick top procedures by markup
  const hospMap = new Map(); // CCN -> hospital info + procedures

  for (const r of inpatientRaw) {
    const ccn = r.Rndrng_Prvdr_CCN;
    const charge = toNum(r.Avg_Submtd_Cvrd_Chrg);
    const totalPaid = toNum(r.Avg_Tot_Pymt_Amt);
    const medicarePaid = toNum(r.Avg_Mdcr_Pymt_Amt);
    const discharges = toNum(r.Tot_Dschrgs);
    const drg = r.DRG_Cd;

    if (charge <= 0 || totalPaid <= 0 || discharges < 11) continue; // CMS suppresses <11

    const markup = round2(charge / totalPaid);

    if (!hospMap.has(ccn)) {
      hospMap.set(ccn, {
        ccn,
        name: r.Rndrng_Prvdr_Org_Name,
        city: r.Rndrng_Prvdr_City,
        state: r.Rndrng_Prvdr_State_Abrvtn,
        zip: r.Rndrng_Prvdr_Zip5,
        procedures: [],
      });
    }

    hospMap.get(ccn).procedures.push({
      drg,
      desc: r.DRG_Desc,
      discharges,
      charge: round2(charge),
      totalPaid: round2(totalPaid),
      medicarePaid: round2(medicarePaid),
      markup,
      isKey: KEY_DRGS.has(drg),
    });
  }

  console.log(`\n  Hospitals with inpatient data: ${hospMap.size}`);

  // ── Process Outpatient APC data ──
  // Add outpatient procedures to hospital map
  for (const r of outpatientRaw) {
    const ccn = r.Rndrng_Prvdr_CCN;
    const charge = toNum(r.Avg_Tot_Sbmtd_Chrgs);
    const allowed = toNum(r.Avg_Mdcr_Alowd_Amt);
    const medicarePaid = toNum(r.Avg_Mdcr_Pymt_Amt);
    const services = toNum(r.CAPC_Srvcs);

    if (charge <= 0 || allowed <= 0 || services < 11) continue;

    const markup = round2(charge / allowed);

    if (!hospMap.has(ccn)) {
      hospMap.set(ccn, {
        ccn,
        name: r.Rndrng_Prvdr_Org_Name,
        city: r.Rndrng_Prvdr_City,
        state: r.Rndrng_Prvdr_State_Abrvtn,
        zip: r.Rndrng_Prvdr_Zip5,
        procedures: [],
      });
    }

    hospMap.get(ccn).procedures.push({
      apc: r.APC_Cd,
      desc: r.APC_Desc,
      services,
      charge: round2(charge),
      totalPaid: round2(allowed), // For outpatient, "allowed" is what was approved
      medicarePaid: round2(medicarePaid),
      markup,
      isOutpatient: true,
    });
  }

  // ── Build final hospital records ──
  const hospitals = [];
  for (const [ccn, hosp] of hospMap) {
    const procs = hosp.procedures;
    if (procs.length === 0) continue;

    // Pick top 10 procedures: prioritize key DRGs, then highest-markup
    const keyProcs = procs.filter((p) => p.isKey).sort((a, b) => b.markup - a.markup);
    const otherProcs = procs
      .filter((p) => !p.isKey)
      .sort((a, b) => b.markup - a.markup);

    const topProcs = [...keyProcs.slice(0, 7), ...otherProcs.slice(0, 5)].slice(0, 10);

    // Hospital-level averages
    const avgMarkup = round2(
      procs.reduce((s, p) => s + p.markup, 0) / procs.length
    );
    const totalCharged = procs.reduce(
      (s, p) => s + p.charge * (p.discharges || p.services || 1),
      0
    );
    const totalPaid = procs.reduce(
      (s, p) => s + p.totalPaid * (p.discharges || p.services || 1),
      0
    );

    hospitals.push({
      type: "hospital",
      ccn,
      name: hosp.name,
      city: hosp.city,
      state: hosp.state,
      zip: hosp.zip,
      avgMarkup,
      totalCharged: round2(totalCharged),
      totalPaid: round2(totalPaid),
      procedureCount: procs.length,
      procedures: topProcs.map((p) => ({
        code: p.drg || p.apc,
        desc: p.desc,
        type: p.isOutpatient ? "outpatient" : "inpatient",
        volume: p.discharges || p.services,
        charge: p.charge,
        paid: p.totalPaid,
        medicarePaid: p.medicarePaid,
        markup: p.markup,
      })),
    });
  }

  // Sort by worst avg markup
  hospitals.sort((a, b) => b.avgMarkup - a.avgMarkup);
  console.log(`  Final hospital records: ${hospitals.length}`);
  if (hospitals.length > 0) {
    const h = hospitals[0];
    console.log(
      `  Worst markup: ${h.name} (${h.city}, ${h.state}) — ${h.avgMarkup}× avg`
    );
  }

  // ── Load existing NADAC drug data ──
  const rawDrugs = JSON.parse(
    await fs.readFile(path.join(RAW_DIR, "nadac_top_2000_2024.json"), "utf8")
  );
  const byNdc = new Map();
  for (const r of rawDrugs) {
    if (!r.ndc || r.unitCost <= 0) continue;
    const existing = byNdc.get(r.ndc);
    if (!existing || r.asOf > existing.asOf) byNdc.set(r.ndc, r);
  }
  const drugs = [...byNdc.values()]
    .map((r) => ({
      type: "drug",
      name: r.desc,
      ndc: r.ndc,
      nadac: round2(r.unitCost),
      unit: r.unit || "EA",
      asOf: r.asOf,
    }))
    .sort((a, b) => b.nadac - a.nadac);

  console.log(`  Drug records: ${drugs.length}`);

  // ── Compact format for smaller bundle (2.4MB vs 5.3MB) ──
  const compact = hospitals.map((h) => ({
    T: "H",
    n: h.name,
    ci: h.city,
    st: h.state,
    z: h.zip,
    ccn: h.ccn,
    mk: h.avgMarkup,
    tc: h.totalCharged,
    tp: h.totalPaid,
    pc: h.procedureCount,
    pr: h.procedures.slice(0, 5).map((p) => ({
      c: p.code,
      d: p.desc.length > 55 ? p.desc.slice(0, 55) + "…" : p.desc,
      t: p.type === "outpatient" ? "O" : "I",
      v: p.volume,
      ch: p.charge,
      pd: p.paid,
      mp: p.medicarePaid,
      mk: p.markup,
    })),
  }));

  // ── Merge and write ──
  const merged = [...compact, ...drugs];
  await fs.writeFile(OUT, JSON.stringify(merged));
  console.log(`\n  WROTE ${merged.length} records to generatedData.json`);
  console.log(`  Hospitals: ${compact.length}`);
  console.log(`  Drugs: ${drugs.length}`);

  // Quick stats
  const markups = hospitals.map((h) => h.avgMarkup);
  markups.sort((a, b) => a - b);
  console.log(`  Avg hospital markup: ${(markups.reduce((a, b) => a + b, 0) / markups.length).toFixed(1)}×`);
  console.log(`  Median hospital markup: ${markups[Math.floor(markups.length / 2)].toFixed(1)}×`);
  console.log(`  Top 5 worst markups:`);
  hospitals.slice(0, 5).forEach((h) => {
    console.log(`    ${h.avgMarkup}× — ${h.name} (${h.city}, ${h.state})`);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
