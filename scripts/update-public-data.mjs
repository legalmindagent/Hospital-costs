import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");

const COST_REPORT_DATASET = "44060663-47d8-4ced-a115-b53b4c270acb";
const TRANSPARENCY_DATASET = "6a3aa708-3c9d-411a-a1a4-e046d3ade7ef";
const NADAC_CSV_URL = "https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-12-25-2024.csv";

const TARGET_MARKETS = {
  Chattanooga: {
    states: ["TN", "GA"],
    cities: [
      "CHATTANOOGA",
      "CLEVELAND",
      "HIXSON",
      "EAST RIDGE",
      "SODDY DAISY",
      "FORT OGLETHORPE",
      "RINGGOLD",
      "DALTON",
    ],
  },
  Atlanta: {
    states: ["GA"],
    cities: [
      "ATLANTA",
      "MARIETTA",
      "ROSWELL",
      "ALPHARETTA",
      "SANDY SPRINGS",
      "DECATUR",
      "DULUTH",
      "LAWRENCEVILLE",
      "SMYRNA",
      "KENNESAW",
      "AUSTELL",
      "DOUGLASVILLE",
      "CONYERS",
      "JONESBORO",
      "RIVERDALE",
      "LITHONIA",
      "FAYETTEVILLE",
      "SNELLVILLE",
      "NEWNAN",
      "TUCKER",
      "MCDONOUGH",
      "CANTON",
      "WOODSTOCK",
      "GAINESVILLE",
    ],
  },
  Nashville: {
    states: ["TN"],
    cities: [
      "NASHVILLE",
      "BRENTWOOD",
      "FRANKLIN",
      "MURFREESBORO",
      "HENDERSONVILLE",
      "GALLATIN",
      "HERMITAGE",
      "SMYRNA",
      "CLARKSVILLE",
      "LEBANON",
      "SPRING HILL",
      "MT JULIET",
      "MOUNT JULIET",
      "COLUMBIA",
    ],
  },
  FloridaMajorCities: {
    states: ["FL"],
    cities: [
      "MIAMI",
      "ORLANDO",
      "TAMPA",
      "JACKSONVILLE",
      "ST PETERSBURG",
      "ST. PETERSBURG",
      "FORT LAUDERDALE",
      "WEST PALM BEACH",
      "BOCA RATON",
      "HOLLYWOOD",
      "HIALEAH",
      "TALLAHASSEE",
      "GAINESVILLE",
      "SARASOTA",
      "NAPLES",
      "FORT MYERS",
      "PENSACOLA",
      "KISSIMMEE",
      "LAKELAND",
      "CLEARWATER",
      "DAYTONA BEACH",
    ],
  },
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const norm = (value) => String(value || "").trim().toUpperCase();

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

const fetchPagedCmsDataset = async (datasetId, pageSize = 5000, maxPages = 50) => {
  const allRows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const url = `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?size=${pageSize}&page=${page}`;
    const rows = await fetchJson(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }
  return allRows;
};

const classifyMarket = (row) => {
  const city = norm(row.City || row["City"]);
  const state = norm(row["State Code"] || row.State || row.state);

  for (const [marketName, market] of Object.entries(TARGET_MARKETS)) {
    if (!market.states.includes(state)) continue;
    if (market.cities.some((c) => city === c)) return marketName;
  }

  return null;
};

const toHospitalItem = (row) => {
  const totalCost = toNumber(row["Total Costs"]);
  const totalCharges = toNumber(row["Combined Outpatient + Inpatient Total Charges"] || row["Total Patient Revenue"]);
  const medicaidRevenue = toNumber(row["Net Revenue from Medicaid"]);
  const medicaidCharges = toNumber(row["Medicaid Charges"]);
  const medicareDays = toNumber(row["Total Days Title XVIII"]);
  const cashOnHand = toNumber(row["Cash on Hand and in Banks"]);

  if (!row["Hospital Name"] || totalCost <= 0 || totalCharges <= 0) return null;

  const payerRows = [];
  payerRows.push({ n: "CMS Cost Report", p: "Total Costs", $: totalCost });
  if (medicaidRevenue > 0) payerRows.push({ n: "Medicaid", p: "Net Revenue", $: medicaidRevenue });
  if (medicaidCharges > 0) payerRows.push({ n: "Medicaid", p: "Billed Charges", $: medicaidCharges });
  if (cashOnHand > 0) payerRows.push({ n: "Hospital", p: "Cash on Hand", $: cashOnHand });

  return {
    h: row["Hospital Name"],
    d: `FY ${row["Fiscal Year Begin Date"] || "N/A"} to ${row["Fiscal Year End Date"] || "N/A"}`,
    c: row["Provider CCN"] || "",
    g: totalCharges,
    cash: 0,
    mn: 0,
    mx: totalCharges,
    pr: payerRows,
    cat: "Hospital Cost Report",
    cost: totalCost,
    market: row.market,
    city: row.City || "",
    state: row["State Code"] || "",
    medicareDays,
  };
};

const run = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });

  const [costReportRows, transparencyRows, nadacCsv] = await Promise.all([
    fetchPagedCmsDataset(COST_REPORT_DATASET, 5000, 60),
    fetchPagedCmsDataset(TRANSPARENCY_DATASET, 5000, 10),
    fetchText(NADAC_CSV_URL),
  ]);

  const marketFilteredRows = costReportRows
    .map((row) => ({ ...row, market: classifyMarket(row) }))
    .filter((row) => row.market !== null);

  const hospitalItems = marketFilteredRows
    .map((row) => toHospitalItem(row))
    .filter(Boolean)
    .sort((a, b) => b.g - a.g);

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
    .slice(0, 3000);

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
    market: "National",
    city: "",
    state: "US",
  }));

  const merged = [...hospitalItems, ...nadacItems];

  const summary = {
    generatedAt: new Date().toISOString(),
    targetMarkets: Object.keys(TARGET_MARKETS),
    hospitalRowsFetched: costReportRows.length,
    transparencyRowsFetched: transparencyRows.length,
    hospitalRowsInTargetMarkets: hospitalItems.length,
    nadacRowsIncluded: nadacItems.length,
    totalMergedRows: merged.length,
  };

  await fs.writeFile(path.join(DATA_DIR, "generatedData.json"), JSON.stringify(merged, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "hospital_cost_report_target_markets_raw.json"), JSON.stringify(marketFilteredRows, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "hospital_price_transparency_enforcement_raw.json"), JSON.stringify(transparencyRows, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "nadac_top_3000_2024.json"), JSON.stringify(nadacRows, null, 2));
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, "data_summary.json"), JSON.stringify(summary, null, 2));

  console.log(summary);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
