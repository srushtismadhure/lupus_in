import { getFhirConfig } from "./fhir-config.js";

/** Server-only helper for writing to Medblocks directly (not through the passthrough proxy). */

export interface FhirServerResponse<T> {
  status: number;
  body: T;
  location: string | null;
  etag: string | null;
}

async function fhirServerRequest<T>(
  path: string,
  init: { method: string; body?: unknown; ifMatch?: string },
): Promise<FhirServerResponse<T>> {
  const fhirConfig = getFhirConfig();
  const headers = new Headers({
    Authorization: `Bearer ${fhirConfig.bearerToken}`,
    Accept: "application/fhir+json",
    "Content-Type": "application/fhir+json",
  });
  if (init.ifMatch) headers.set("If-Match", init.ifMatch);

  const response = await fetch(`${fhirConfig.baseUrl}${path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const body = (await response.json().catch(() => null)) as T;

  return {
    status: response.status,
    body,
    location: response.headers.get("location"),
    etag: response.headers.get("etag"),
  };
}

export function createFhirResource<T>(resourceType: string, resource: unknown) {
  return fhirServerRequest<T>(`/${resourceType}`, { method: "POST", body: resource });
}

export function updateFhirResource<T>(resourceType: string, id: string, resource: unknown, ifMatch?: string) {
  return fhirServerRequest<T>(`/${resourceType}/${encodeURIComponent(id)}`, { method: "PUT", body: resource, ifMatch });
}

export function readFhirResource<T>(resourceType: string, id: string) {
  return fhirServerRequest<T>(`/${resourceType}/${encodeURIComponent(id)}`, { method: "GET" });
}

export function searchFhirResource<T>(resourceType: string, query: string) {
  return fhirServerRequest<T>(`/${resourceType}?${query}`, { method: "GET" });
}

/** Extracts a resource ID from a Location header such as `.../Patient/abc123/_history/1`. */
export function extractIdFromLocation(location: string | null): string | null {
  if (!location) return null;
  const match = location.match(/\/([A-Za-z0-9\-.]+)(?:\/_history\/[^/]+)?\/?$/);
  return match ? match[1] ?? null : null;
}

export interface PagedFetchResult<T> {
  resources: T[];
  /** false when a page request failed partway through — callers should show a partial-data indicator, never fabricate data. */
  complete: boolean;
}

const MAX_PAGES = 25;

/**
 * Medblocks returns pagination `next` links with a hardcoded `http://` scheme even when queried over
 * `https://`; following that link cross-scheme causes `fetch` to treat it as a cross-origin redirect
 * and drop the Authorization header. Force the link to use the same scheme as the configured base URL.
 */
function normalizeSchemeToBaseUrl(link: string): string {
  const fhirConfig = getFhirConfig();
  const baseProtocol = new URL(fhirConfig.baseUrl).protocol;
  const linkUrl = new URL(link);
  linkUrl.protocol = baseProtocol;
  return linkUrl.toString();
}

/** Fetches every page of a FHIR search Bundle by following its `next` link, aggregating all matching resources. */
export async function fetchAllPages<T extends { resourceType: string }>(
  resourceType: string,
  query: string,
): Promise<PagedFetchResult<T>> {
  const fhirConfig = getFhirConfig();
  const resources: T[] = [];
  let url: string | null = `${fhirConfig.baseUrl}/${resourceType}?${query}`;
  let complete = true;
  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    pageCount++;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${fhirConfig.bearerToken}`, Accept: "application/fhir+json" },
      });
    } catch {
      complete = false;
      break;
    }

    if (!response.ok) {
      complete = false;
      break;
    }

    const bundle = (await response.json().catch(() => null)) as fhir4.Bundle | null;
    if (!bundle || !Array.isArray(bundle.entry)) break;

    for (const entry of bundle.entry) {
      if (entry.resource && entry.resource.resourceType === resourceType) {
        resources.push(entry.resource as T);
      }
    }

    const nextLink = bundle.link?.find(link => link.relation === "next")?.url ?? null;
    url = nextLink ? normalizeSchemeToBaseUrl(nextLink) : null;
  }

  return { resources, complete };
}
