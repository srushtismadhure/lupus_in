import { parse } from "csv-parse/sync";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DialysisFacility,
  KidneyServiceImportDatasetReport,
  KidneyServiceImportReport,
  KidneyServiceInvalidRow,
  KidneyTransplantProgram,
} from "./types.js";

type DatasetKind = "transplant" | "dialysis";
type CsvRows = string[][];

interface DiscoveredRawFile {
  kind: DatasetKind;
  filePath: string;
  sourceFile: string;
  headerRowIndex: number;
  headers: string[];
  rows: CsvRows;
}

interface HeaderMap<T extends string> {
  mapped: Partial<Record<T, number>>;
  unrecognizedHeaders: string[];
}

interface NormalizedValueOptions {
  preserveLeadingZeros?: boolean;
}

const GENERATED_DIR = path.join("data", "generated");

const NULLISH_VALUES = new Set([
  "",
  "-",
  "--",
  "—",
  "n/a",
  "na",
  "not available",
  "not reported",
  "not applicable",
  "suppressed",
  "unavailable",
  "null",
]);

const TRANSPLANT_ALIAS = {
  centerCode: ["ctr_cd", "center code", "center id", "program code"],
  name: ["entire_name", "center name", "program name", "transplant center name"],
  location: ["location"],
  city: ["city"],
  state: ["state"],
  organ: ["org", "organ"],
  deceasedDonorTransplants: ["deceased donor transplants in a year"],
  livingDonorTransplants: ["living donor transplants in a year"],
  srtrAccessScore: ["get a deceased donor transplant faster"],
  srtrOneYearOutcomeScore: ["one year kidney survival", "one year kidney survival", "one year kidney survival"],
  releaseDate: ["release_date", "release date"],
} as const;

type TransplantField = keyof typeof TRANSPLANT_ALIAS;

const DIALYSIS_ALIAS = {
  facilityId: ["cms certification number (ccn)", "provider number", "facility id", "ccn"],
  name: ["facility name", "name"],
  address: ["address line 1", "address", "street address"],
  address2: ["address line 2"],
  city: ["city/town", "city"],
  state: ["state"],
  zipCode: ["zip code", "zip"],
  phone: ["telephone number", "phone", "phone number"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  dialysisStations: ["# of dialysis stations", "number of dialysis stations", "dialysis stations"],
  offersInCenterHemodialysis: ["offers in-center hemodialysis"],
  offersPeritonealDialysis: ["offers peritoneal dialysis"],
  offersHomeHemodialysisTraining: ["offers home hemodialysis training"],
  qualityRating: ["five star", "quality rating", "star rating"],
  sourceDate: ["five star date", "source date", "date"],
} as const;

type DialysisField = keyof typeof DIALYSIS_ALIAS;

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeLooseHeader(header: string): string {
  return normalizeHeader(header).replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvRows(contents: string): CsvRows {
  return parse(contents, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as CsvRows;
}

async function findCsvFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findCsvFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) files.push(entryPath);
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function hasHeader(headers: string[], aliases: readonly string[]): boolean {
  const normalized = headers.map(normalizeHeader);
  const loose = headers.map(normalizeLooseHeader);
  return aliases.some(alias => {
    const normalizedAlias = normalizeHeader(alias);
    const looseAlias = normalizeLooseHeader(alias);
    return normalized.includes(normalizedAlias) || loose.includes(looseAlias);
  });
}

function identifyHeaderRow(rows: CsvRows): { kind: DatasetKind; index: number; headers: string[] } | null {
  for (let index = 0; index < Math.min(rows.length, 8); index++) {
    const headers = rows[index] ?? [];
    const looksTransplant =
      hasHeader(headers, TRANSPLANT_ALIAS.name) &&
      hasHeader(headers, TRANSPLANT_ALIAS.deceasedDonorTransplants) &&
      hasHeader(headers, TRANSPLANT_ALIAS.livingDonorTransplants);
    if (looksTransplant) return { kind: "transplant", index, headers };

    const looksDialysis =
      hasHeader(headers, DIALYSIS_ALIAS.facilityId) &&
      hasHeader(headers, DIALYSIS_ALIAS.name) &&
      hasHeader(headers, DIALYSIS_ALIAS.dialysisStations);
    if (looksDialysis) return { kind: "dialysis", index, headers };
  }
  return null;
}

export async function discoverRawKidneyServiceFiles(rootDir = process.cwd()): Promise<{
  transplant: DiscoveredRawFile | null;
  dialysis: DiscoveredRawFile | null;
}> {
  const rawDir = path.join(rootDir, "data", "raw");
  const csvFiles = await findCsvFiles(rawDir);
  const discovered: { transplant: DiscoveredRawFile | null; dialysis: DiscoveredRawFile | null } = { transplant: null, dialysis: null };

  for (const filePath of csvFiles) {
    const contents = await readFile(filePath, "utf8");
    const rows = parseCsvRows(contents);
    const identified = identifyHeaderRow(rows);
    if (!identified) continue;
    const sourceFile = path.relative(rootDir, filePath);
    const file: DiscoveredRawFile = { kind: identified.kind, filePath, sourceFile, headerRowIndex: identified.index, headers: identified.headers, rows };
    if (identified.kind === "transplant") discovered.transplant ??= file;
    if (identified.kind === "dialysis") discovered.dialysis ??= file;
  }

  return discovered;
}

function buildHeaderMap<T extends string>(headers: string[], aliases: Record<T, readonly string[]>): HeaderMap<T> {
  const mapped: Partial<Record<T, number>> = {};
  const recognizedIndexes = new Set<number>();
  const normalizedHeaders = headers.map(normalizeHeader);
  const looseHeaders = headers.map(normalizeLooseHeader);

  for (const [field, fieldAliases] of Object.entries(aliases) as Array<[T, readonly string[]]>) {
    const index = fieldAliases
      .map(alias => {
        const normalizedAlias = normalizeHeader(alias);
        const looseAlias = normalizeLooseHeader(alias);
        const strictIndex = normalizedHeaders.indexOf(normalizedAlias);
        return strictIndex >= 0 ? strictIndex : looseHeaders.indexOf(looseAlias);
      })
      .find(foundIndex => foundIndex >= 0);
    if (index !== undefined) {
      mapped[field] = index;
      recognizedIndexes.add(index);
    }
  }

  const unrecognizedHeaders = headers
    .map(header => header.trim())
    .filter((header, index) => header.length > 0 && !recognizedIndexes.has(index));
  return { mapped, unrecognizedHeaders };
}

export function normalizeCell(value: string | undefined, options: NormalizedValueOptions = {}): string | null {
  const trimmed = (value ?? "").replace(/^\uFEFF/, "").trim();
  if (NULLISH_VALUES.has(trimmed.toLowerCase())) return null;
  return options.preserveLeadingZeros ? trimmed : trimmed.replace(/\s+/g, " ");
}

export function parseNumberCell(value: string | undefined): number | null {
  const normalized = normalizeCell(value);
  if (normalized === null) return null;
  const numeric = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseBooleanCell(value: string | undefined): boolean | null {
  const normalized = normalizeCell(value);
  if (normalized === null) return null;
  const lower = normalized.toLowerCase();
  if (["yes", "y", "true", "1"].includes(lower)) return true;
  if (["no", "n", "false", "0"].includes(lower)) return false;
  return null;
}

export function parseCityState(location: string | null, city: string | null, state: string | null): { city: string | null; state: string | null } {
  if (city || state) return { city, state };
  if (!location) return { city: null, state: null };
  const [parsedCity, parsedState] = location.split(",").map(part => normalizeCell(part));
  return { city: parsedCity ?? null, state: parsedState ?? null };
}

function stableCodeFromName(name: string, city: string | null, state: string | null): string {
  const normalized = [name, city, state]
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 64).replace(/-+$/g, "");
}

function rowValue<T extends string>(row: string[], headerMap: HeaderMap<T>, field: T): string | undefined {
  const index = headerMap.mapped[field];
  return index === undefined ? undefined : row[index];
}

function reportFor(sourceFile: string, inputRows: number, outputRows: number, duplicatesRemoved: number, invalidRows: KidneyServiceInvalidRow[], unrecognizedHeaders: string[]): KidneyServiceImportDatasetReport {
  return { sourceFile, inputRows, outputRows, duplicatesRemoved, invalidRows, unrecognizedHeaders };
}

export function normalizeTransplantPrograms(file: DiscoveredRawFile): {
  records: KidneyTransplantProgram[];
  report: KidneyServiceImportDatasetReport;
} {
  const headerMap = buildHeaderMap<TransplantField>(file.headers, TRANSPLANT_ALIAS);
  const bodyRows = file.rows.slice(file.headerRowIndex + 1);
  const invalidRows: KidneyServiceInvalidRow[] = [];
  const byId = new Map<string, KidneyTransplantProgram>();
  let duplicatesRemoved = 0;
  const unrecognizedHeaders = [...headerMap.unrecognizedHeaders];
  if (headerMap.mapped.centerCode === undefined) {
    unrecognizedHeaders.push("Official center code header missing; deterministic source identifier used for this file.");
  }

  bodyRows.forEach((row, rowIndex) => {
    const sourceRowNumber = file.headerRowIndex + rowIndex + 2;
    const name = normalizeCell(rowValue(row, headerMap, "name"));
    const location = normalizeCell(rowValue(row, headerMap, "location"));
    const parsed = parseCityState(
      location,
      normalizeCell(rowValue(row, headerMap, "city")),
      normalizeCell(rowValue(row, headerMap, "state")),
    );
    const centerCode = normalizeCell(rowValue(row, headerMap, "centerCode"), { preserveLeadingZeros: true }) ?? (name ? stableCodeFromName(name, parsed.city, parsed.state) : null);
    const organ = normalizeCell(rowValue(row, headerMap, "organ"));

    if (!name || !centerCode) {
      invalidRows.push({ rowNumber: sourceRowNumber, reason: "Missing required transplant program name or center code.", sourceId: centerCode });
      return;
    }
    if (organ && organ.toLowerCase() !== "ki" && !organ.toLowerCase().includes("kidney")) return;

    const record: KidneyTransplantProgram = {
      centerCode,
      name,
      city: parsed.city,
      state: parsed.state,
      organ: "kidney",
      deceasedDonorTransplants: parseNumberCell(rowValue(row, headerMap, "deceasedDonorTransplants")),
      livingDonorTransplants: parseNumberCell(rowValue(row, headerMap, "livingDonorTransplants")),
      srtrAccessScore: parseNumberCell(rowValue(row, headerMap, "srtrAccessScore")),
      srtrOneYearOutcomeScore: parseNumberCell(rowValue(row, headerMap, "srtrOneYearOutcomeScore")),
      releaseDate: normalizeCell(rowValue(row, headerMap, "releaseDate")),
      source: "SRTR",
      sourceFile: file.sourceFile,
      srtrReportUrl: `https://srtr.hrsa.gov/interactive-report?center=${encodeURIComponent(centerCode)}&type=TX1&organ=KI`,
    };

    if (byId.has(centerCode)) duplicatesRemoved++;
    byId.set(centerCode, record);
  });

  const records = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    records,
    report: reportFor(file.sourceFile, bodyRows.length, records.length, duplicatesRemoved, invalidRows, unrecognizedHeaders),
  };
}

export function normalizeDialysisFacilities(file: DiscoveredRawFile): {
  records: DialysisFacility[];
  report: KidneyServiceImportDatasetReport;
} {
  const headerMap = buildHeaderMap<DialysisField>(file.headers, DIALYSIS_ALIAS);
  const bodyRows = file.rows.slice(file.headerRowIndex + 1);
  const invalidRows: KidneyServiceInvalidRow[] = [];
  const byId = new Map<string, DialysisFacility>();
  let duplicatesRemoved = 0;

  bodyRows.forEach((row, rowIndex) => {
    const sourceRowNumber = file.headerRowIndex + rowIndex + 2;
    const facilityId = normalizeCell(rowValue(row, headerMap, "facilityId"), { preserveLeadingZeros: true });
    const name = normalizeCell(rowValue(row, headerMap, "name"));
    if (!facilityId || !name) {
      invalidRows.push({ rowNumber: sourceRowNumber, reason: "Missing required dialysis facility ID or name.", sourceId: facilityId });
      return;
    }

    const address1 = normalizeCell(rowValue(row, headerMap, "address"));
    const address2 = normalizeCell(rowValue(row, headerMap, "address2"));
    const address = [address1, address2].filter(Boolean).join(", ") || null;
    const record: DialysisFacility = {
      facilityId,
      name,
      address,
      city: normalizeCell(rowValue(row, headerMap, "city")),
      state: normalizeCell(rowValue(row, headerMap, "state")),
      zipCode: normalizeCell(rowValue(row, headerMap, "zipCode"), { preserveLeadingZeros: true }),
      phone: normalizeCell(rowValue(row, headerMap, "phone")),
      latitude: parseNumberCell(rowValue(row, headerMap, "latitude")),
      longitude: parseNumberCell(rowValue(row, headerMap, "longitude")),
      dialysisStations: parseNumberCell(rowValue(row, headerMap, "dialysisStations")),
      offersInCenterHemodialysis: parseBooleanCell(rowValue(row, headerMap, "offersInCenterHemodialysis")),
      offersPeritonealDialysis: parseBooleanCell(rowValue(row, headerMap, "offersPeritonealDialysis")),
      offersHomeHemodialysisTraining: parseBooleanCell(rowValue(row, headerMap, "offersHomeHemodialysisTraining")),
      qualityRating: parseNumberCell(rowValue(row, headerMap, "qualityRating")),
      sourceDate: normalizeCell(rowValue(row, headerMap, "sourceDate")),
      facilityType: "dialysis-facility",
      source: "CMS",
      sourceFile: file.sourceFile,
    };

    if (byId.has(facilityId)) duplicatesRemoved++;
    byId.set(facilityId, record);
  });

  const records = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    records,
    report: reportFor(file.sourceFile, bodyRows.length, records.length, duplicatesRemoved, invalidRows, headerMap.unrecognizedHeaders),
  };
}

export async function importKidneyServices(rootDir = process.cwd()): Promise<{
  transplantPrograms: KidneyTransplantProgram[];
  dialysisFacilities: DialysisFacility[];
  report: KidneyServiceImportReport;
}> {
  const discovered = await discoverRawKidneyServiceFiles(rootDir);
  if (!discovered.transplant) throw new Error("Could not confidently identify the SRTR kidney transplant program CSV.");
  if (!discovered.dialysis) throw new Error("Could not confidently identify the CMS dialysis facility CSV.");

  const transplant = normalizeTransplantPrograms(discovered.transplant);
  const dialysis = normalizeDialysisFacilities(discovered.dialysis);
  const generatedAt = new Date().toISOString();
  const report: KidneyServiceImportReport = { generatedAt, transplant: transplant.report, dialysis: dialysis.report };

  const outputDir = path.join(rootDir, GENERATED_DIR);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "kidney-transplant-programs.json"), `${JSON.stringify(transplant.records, null, 2)}\n`);
  await writeFile(path.join(outputDir, "dialysis-facilities.json"), `${JSON.stringify(dialysis.records, null, 2)}\n`);
  await writeFile(path.join(outputDir, "kidney-services-import-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  return { transplantPrograms: transplant.records, dialysisFacilities: dialysis.records, report };
}
