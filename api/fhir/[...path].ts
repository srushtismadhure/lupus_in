import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../_lib/adapter";
import { pathAfterMarker } from "../_lib/params";
import { proxyFhirRequest } from "../../src/server/handlers";

// The public URL is /fhir/* (see vercel.json rewrites: /fhir/:path* -> /api/fhir/:path*).
// Vercel Node.js functions always receive the real incoming request path in req.url,
// so this works whether req.url shows "/fhir/..." (client-visible) or "/api/fhir/..."
// (destination) — pathAfterMarker finds "/fhir" wherever it appears.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const subPath = pathAfterMarker(req.url, "/fhir");
  return vercelHandler(webReq => proxyFhirRequest(webReq, subPath))(req, res);
}
