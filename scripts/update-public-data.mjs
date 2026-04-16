import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const parseCsvLine = (line) => {
  const out = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell);
  return out;
};

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cols[i] ?? "";
    }
    return row;
  });
};

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
};

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
};

const hospitalCostUrl =
  "https://data.cms.gov/data-api/v1/dataset/44060663-47d8-4ced-a115-b53b4c270acb/data?size=1200";
const transparencyUrl =
  "https://data.cms.gov/data-api/v1/dataset/6a3aa708-3c9d-411a-a1a4-e046d3ade7ef/data?size=1200";
const nadacCsvUrl =
  "https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-12-25-2024.csv";

const run = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });

  const [hospitalCostRows, transparencyRows, nadacCsv] = await Promise.all([
    fetchJson(hospitalCostUrl),
    fetchJson(transparencyUrl),
    fetchText(nadacCsvUrl),
  ]);

  const nadacRows = parseCsv(nadacCsv)
    .map((r) => ({
      desc: r["NDC Description"],
      ndc: r["NDC"],
      unitCost: toNumber(r["NADAC Per Unit"]),
      unit: r["Pricing Unit"],
      asOf: r["As of Date"],
    }))
    .filter((r) => r.desc && r.ndc && r.unitCost > 0)
    .sort((a, b) => b.unitCost - a.unitCost)
    .slice(0, 2000);

  const hospitalItems = hospitalCostRows
    .map((r) => {
      const totalCost = toNumber(r["Total Costs"]);
      const totalCharges = toNumber(r["Combined Outpatient + Inpatient Total Charges"] || r["Total Patient Revenue"]);
      if (!r["Hospital Name"] || !totalCost || !totalCharges) return null;
      return {
        h: r["Hospital Name"],
        d: `Cost report FY ending ${r["Fiscal Year End Date"] || "N/A"}`,
        c: r["Provider CCN"] || "",
        g: totalCharges,
        cash: 0,
        mn: 0,
        mx: totalCharges,
        pr: [
          {
            n: "CMS",
            p: "Hospital Cost Report",
            $: totalCost,
          },
        ],
        cat: "Hospital Cost Report",
        cost: totalCost,
      };
    })
    .filter(Boolean);

  const nadacItems = nadacRows.map((r) => ({
    h: "Medicaid NADAC",
    d: r.desc,
    c: r.ndc,
    g: r.unitCost,
    cash: r.unitCost,
    mn: r.unitCost,
    mx: r.unitCost,
    pr: [
      {
        n: "NADAC",
        p: `As of ${r.asOf} (${r.unit})`,
        $: r.unitCost,
      },
    ],
    cat: "Drugs & IV",
    cost: r.unitCost,
  }));

  const merged = [...hospitalItems, ...nadacItems];

  await fs.writeFile(path.join(DATA_DIR, "generatedData.json"), JSON.stringify(merged, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "hospital_cost_report_raw.json"), JSON.stringify(hospitalCostRows, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "hospital_price_transparency_enforcement_raw.json"), JSON.stringify(transparencyRows, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "nadac_top_2000_2024.json"), JSON.stringify(nadacRows, null, 2));

  console.log(`Generated ${merged.length} merged records.`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
