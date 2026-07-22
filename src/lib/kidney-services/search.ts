import { calculateDistanceMiles } from "./distance.js";
import type {
  DialysisFacility,
  KidneyServiceApiResponse,
  KidneyServiceSearchResult,
  KidneyTransplantProgram,
} from "./types.js";

export type DialysisModality = "in-center" | "peritoneal" | "home-hemodialysis";

export interface KidneyServiceSearchOptions {
  search?: string;
  state?: string;
  city?: string;
  limit: number;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}

export interface DialysisSearchOptions extends KidneyServiceSearchOptions {
  modality?: DialysisModality;
}

export type ParsedSearchOptions<T extends KidneyServiceSearchOptions> =
  | { ok: true; options: T }
  | { ok: false; error: string };

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MODALITIES = new Set<DialysisModality>(["in-center", "peritoneal", "home-hemodialysis"]);

function normalizeFilter(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseNumberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = normalizeFilter(params.get(key));
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseKidneyServiceSearchParams(
  params: URLSearchParams,
): ParsedSearchOptions<KidneyServiceSearchOptions> {
  const limitParam = parseNumberParam(params, "limit");
  const latitude = parseNumberParam(params, "latitude");
  const longitude = parseNumberParam(params, "longitude");
  const radiusMiles = parseNumberParam(params, "radiusMiles");

  if (limitParam !== undefined && (!Number.isFinite(limitParam) || limitParam <= 0)) return { ok: false, error: "limit must be a positive number." };
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return { ok: false, error: "latitude must be between -90 and 90." };
  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return { ok: false, error: "longitude must be between -180 and 180." };
  if (radiusMiles !== undefined && (!Number.isFinite(radiusMiles) || radiusMiles < 0)) return { ok: false, error: "radiusMiles must be zero or greater." };
  if ((latitude === undefined) !== (longitude === undefined)) return { ok: false, error: "latitude and longitude must be supplied together." };
  if (radiusMiles !== undefined && (latitude === undefined || longitude === undefined)) {
    return { ok: false, error: "radiusMiles requires latitude and longitude." };
  }

  return {
    ok: true,
    options: {
      search: normalizeFilter(params.get("search")),
      state: normalizeFilter(params.get("state")),
      city: normalizeFilter(params.get("city")),
      limit: Math.min(Math.floor(limitParam ?? DEFAULT_LIMIT), MAX_LIMIT),
      latitude,
      longitude,
      radiusMiles,
    },
  };
}

export function parseDialysisSearchParams(params: URLSearchParams): ParsedSearchOptions<DialysisSearchOptions> {
  const parsed = parseKidneyServiceSearchParams(params);
  if (!parsed.ok) return parsed;
  const modality = normalizeFilter(params.get("modality"));
  if (modality && !MODALITIES.has(modality as DialysisModality)) {
    return { ok: false, error: "modality must be in-center, peritoneal, or home-hemodialysis." };
  }
  return { ok: true, options: { ...parsed.options, modality: modality as DialysisModality | undefined } };
}

function includesFilter(value: string | null | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

function equalsFilter(value: string | null | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  return (value ?? "").toLowerCase() === filter.toLowerCase();
}

function attachDistance<T extends KidneyTransplantProgram | DialysisFacility>(
  record: T,
  options: KidneyServiceSearchOptions,
): T & { distanceMiles?: number } {
  if (options.latitude === undefined || options.longitude === undefined) return record;
  if (!("latitude" in record) || record.latitude === null || record.longitude === null) return record;
  const distanceMiles = calculateDistanceMiles(options.latitude, options.longitude, record.latitude, record.longitude);
  return { ...record, distanceMiles: Math.round(distanceMiles * 10) / 10 };
}

function sortByDistanceThenName(a: KidneyServiceSearchResult, b: KidneyServiceSearchResult): number {
  if (a.distanceMiles !== undefined && b.distanceMiles !== undefined) return a.distanceMiles - b.distanceMiles;
  if (a.distanceMiles !== undefined) return -1;
  if (b.distanceMiles !== undefined) return 1;
  return a.name.localeCompare(b.name);
}

function hasSearchMatch(record: KidneyTransplantProgram | DialysisFacility, search: string | undefined): boolean {
  if (!search) return true;
  const haystack = [
    record.name,
    record.city,
    record.state,
    "centerCode" in record ? record.centerCode : record.facilityId,
    "address" in record ? record.address : null,
    "zipCode" in record ? record.zipCode : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export function searchTransplantPrograms(
  records: KidneyTransplantProgram[],
  options: KidneyServiceSearchOptions,
): KidneyServiceApiResponse<KidneyTransplantProgram & { distanceMiles?: number }> {
  const matched = records
    .filter(record => hasSearchMatch(record, options.search))
    .filter(record => equalsFilter(record.state, options.state))
    .filter(record => includesFilter(record.city, options.city))
    .map(record => attachDistance(record, options))
    .filter(record => options.radiusMiles === undefined || (record.distanceMiles !== undefined && record.distanceMiles <= options.radiusMiles))
    .sort(sortByDistanceThenName);

  return { source: "SRTR", count: Math.min(matched.length, options.limit), totalMatched: matched.length, results: matched.slice(0, options.limit) };
}

function matchesModality(record: DialysisFacility, modality: DialysisModality | undefined): boolean {
  if (!modality) return true;
  if (modality === "in-center") return record.offersInCenterHemodialysis === true;
  if (modality === "peritoneal") return record.offersPeritonealDialysis === true;
  return record.offersHomeHemodialysisTraining === true;
}

export function searchDialysisFacilities(
  records: DialysisFacility[],
  options: DialysisSearchOptions,
): KidneyServiceApiResponse<DialysisFacility & { distanceMiles?: number }> {
  const matched = records
    .filter(record => hasSearchMatch(record, options.search))
    .filter(record => equalsFilter(record.state, options.state))
    .filter(record => includesFilter(record.city, options.city))
    .filter(record => matchesModality(record, options.modality))
    .map(record => attachDistance(record, options))
    .filter(record => options.radiusMiles === undefined || (record.distanceMiles !== undefined && record.distanceMiles <= options.radiusMiles))
    .sort(sortByDistanceThenName);

  return { source: "CMS", count: Math.min(matched.length, options.limit), totalMatched: matched.length, results: matched.slice(0, options.limit) };
}
