/**
 * Transforms raw downloaded data (already in public/data/) into
 * the app's generatedData.json with correct per-unit metrics.
 *
 * Hospital records: per-inpatient-stay and per-day costs from CMS cost reports
 * Drug records: per-unit acquisition cost from NADAC (deduplicated)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "public", "data");
const OUT = path.join(ROOT, "src", "data", "generatedData.json");

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

async function run() {
  /* ── Hospitals ──────────────────────────────────────────── */
  const rawHospitals = JSON.parse(
    await fs.readFile(path.join(RAW_DIR, "hospital_cost_report_raw.json"), "utf8")
  );
  console.log(`Raw hospital records: ${rawHospitals.length}`);

  const hospitals = rawHospitals
    .map((r) => {
      const totalCost = toNum(r["Total Costs"]);
      const totalCharges = toNum(r["Combined Outpatient + Inpatient Total Charges"]);
      const inpatientCharges = toNum(r["Inpatient Total Charges"]);
      const outpatientCharges = toNum(r["Outpatient Total Charges"]);
      const discharges = toNum(r["Total Discharges (V + XVIII + XIX + Unknown)"]);
      const patientDays = toNum(r["Total Days (V + XVIII + XIX + Unknown)"]);
      const beds = toNum(r["Number of Beds"]);
      const name = (r["Hospital Name"] || "").trim();
      const city = (r["City"] || "").trim();
      const state = (r["State Code"] || "").trim();
      const fyEnd = r["Fiscal Year End Date"] || "";
      const ccn = r["Provider CCN"] || "";

      // Skip records without enough data for per-unit calculations
      if (!name || totalCost <= 0 || totalCharges <= 0 || discharges <= 0) return null;

      // Per-inpatient-stay metrics (using inpatient charges only, not outpatient)
      const chargePerStay = round2(inpatientCharges / discharges);
      // Estimate inpatient cost as proportion of total cost based on charge ratio
      const inpatientCostRatio = totalCharges > 0 ? inpatientCharges / totalCharges : 0.5;
      const estimatedInpatientCost = totalCost * inpatientCostRatio;
      const costPerStay = round2(estimatedInpatientCost / discharges);

      // Per-day metrics (inpatient)
      const chargePerDay = patientDays > 0 ? round2(inpatientCharges / patientDays) : 0;
      const costPerDay = patientDays > 0 ? round2(estimatedInpatientCost / patientDays) : 0;

      // Overall markup
      const markup = totalCost > 0 ? round2(totalCharges / totalCost) : 0;

      // Skip records with unreasonable per-stay charges (data quality)
      if (chargePerStay <= 0 || costPerStay <= 0) return null;

      return {
        type: "hospital",
        name,
        city,
        state,
        ccn,
        beds,
        fy: fyEnd ? fyEnd.slice(0, 4) : "",
        discharges,
        patientDays,
        totalCharges,
        totalCost,
        inpatientCharges,
        outpatientCharges,
        chargePerStay,
        costPerStay,
        chargePerDay,
        costPerDay,
        markup,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.markup - a.markup);

  console.log(`Valid hospital records: ${hospitals.length}`);
  if (hospitals.length > 0) {
    const h = hospitals[0];
    console.log(
      `  Top markup: ${h.name} (${h.city}, ${h.state}) — ${h.markup}×, $${h.chargePerStay}/stay charge, $${h.costPerStay}/stay cost`
    );
  }

  /* ── Drugs (NADAC) ──────────────────────────────────────── */
  const rawDrugs = JSON.parse(
    await fs.readFile(path.join(RAW_DIR, "nadac_top_2000_2024.json"), "utf8")
  );
  console.log(`Raw NADAC records: ${rawDrugs.length}`);

  // Deduplicate by NDC — keep latest "asOf" date entry
  const byNdc = new Map();
  for (const r of rawDrugs) {
    if (!r.ndc || r.unitCost <= 0) continue;
    const existing = byNdc.get(r.ndc);
    if (!existing || r.asOf > existing.asOf) {
      byNdc.set(r.ndc, r);
    }
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

  console.log(`Unique drug records: ${drugs.length}`);

  /* ── Merge & write ──────────────────────────────────────── */
  const merged = [...hospitals, ...drugs];
  await fs.writeFile(OUT, JSON.stringify(merged, null, 2));
  console.log(`\nWrote ${merged.length} records to ${OUT}`);
  console.log(`  Hospitals: ${hospitals.length}`);
  console.log(`  Drugs: ${drugs.length}`);

  // Quick stats
  const markups = hospitals.map((h) => h.markup);
  const avgMarkup = (markups.reduce((s, m) => s + m, 0) / markups.length).toFixed(1);
  const medianMarkup = markups.sort((a, b) => a - b)[Math.floor(markups.length / 2)].toFixed(1);
  console.log(`  Avg hospital markup: ${avgMarkup}×`);
  console.log(`  Median hospital markup: ${medianMarkup}×`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
