/** Extracts a path segment by index from a request URL (e.g. "/api/patients/abc123" -> segment(url, 3) === "abc123"). */
export function pathSegment(url: string | undefined, index: number): string {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  const segments = pathname.split("/");
  return decodeURIComponent(segments[index] ?? "");
}

/** Returns everything after the first occurrence of `marker` in the URL's pathname — used by the /fhir proxy. */
export function pathAfterMarker(url: string | undefined, marker: string): string {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  const idx = pathname.indexOf(marker);
  if (idx < 0) return "/";
  return pathname.slice(idx + marker.length) || "/";
}
