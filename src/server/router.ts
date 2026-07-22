/**
 * The single, central request router — used identically by both deployment
 * targets (Bun.serve() locally/Docker, and the one Vercel serverless function
 * under /api). All actual business logic lives in ./handlers.ts; this file
 * only does URL/method matching and dispatch, so there is exactly one
 * implementation of every route, never two.
 */
import {
  handleClinicianWorklist,
  handleContactPatient,
  handleCoordinateScheduling,
  handleCreateMntReferral,
  handleCreatePatient,
  handleDeactivatePatient,
  handleDeclineMntReferral,
  handleDemoLogin,
  handleDocumentBarrier,
  handleGetMntState,
  handleLogout,
  handleModifyMntReferral,
  handleNurseMntWorklist,
  handleSendForSignature,
  handleSession,
  handleSignMntReferral,
  handleUpdatePatient,
  proxyFhirRequest,
} from "./handlers.js";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

const MNT_REFERRAL_ACTIONS = {
  "send-for-signature": handleSendForSignature,
  sign: handleSignMntReferral,
  decline: handleDeclineMntReferral,
  modify: handleModifyMntReferral,
  barrier: handleDocumentBarrier,
  contact: handleContactPatient,
  schedule: handleCoordinateScheduling,
} as const;

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method.toUpperCase();

  // --- FHIR proxy: preserve the full path + query string, whatever prefix it arrived under ---
  if (pathname === "/fhir" || pathname.startsWith("/fhir/")) {
    return proxyFhirRequest(req, pathname.replace(/^\/fhir/, "") || "/");
  }
  if (pathname === "/api/fhir" || pathname.startsWith("/api/fhir/")) {
    return proxyFhirRequest(req, pathname.replace(/^\/api\/fhir/, "") || "/");
  }

  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return jsonError("Not found", 404);
  }

  const segments = pathname.split("/").filter(Boolean).slice(1); // drop "api"

  // --- /api/health ---
  if (segments.length === 1 && segments[0] === "health") {
    if (method !== "GET") return jsonError("Method not allowed", 405);
    return Response.json({ status: "ok" }, { status: 200 });
  }

  // --- auth ---
  if (segments.length === 1 && segments[0] === "demo-login") {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    return handleDemoLogin(req);
  }
  if (segments.length === 1 && segments[0] === "logout") {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    return handleLogout();
  }
  if (segments.length === 1 && segments[0] === "session") {
    if (method !== "GET") return jsonError("Method not allowed", 405);
    return handleSession(req);
  }

  // --- worklists ---
  if (segments.length === 1 && segments[0] === "clinician-worklist") {
    if (method !== "GET") return jsonError("Method not allowed", 405);
    return handleClinicianWorklist(req);
  }
  if (segments.length === 2 && segments[0] === "nurse" && segments[1] === "mnt-worklist") {
    if (method !== "GET") return jsonError("Method not allowed", 405);
    return handleNurseMntWorklist(req);
  }

  // --- patients ---
  if (segments[0] === "patients") {
    if (segments.length === 1) {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreatePatient(req);
    }
    if (segments.length === 2) {
      if (method !== "PUT") return jsonError("Method not allowed", 405);
      return handleUpdatePatient(req, segments[1]!);
    }
    if (segments.length === 3 && segments[2] === "deactivate") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleDeactivatePatient(req, segments[1]!);
    }
    return jsonError("Not found", 404);
  }

  // --- medical nutrition therapy (MNT) referrals ---
  if (segments[0] === "mnt") {
    if (segments[1] === "patients" && segments.length === 3) {
      if (method !== "GET") return jsonError("Method not allowed", 405);
      return handleGetMntState(req, segments[2]!);
    }

    if (segments[1] === "referrals") {
      if (segments.length === 2) {
        if (method !== "POST") return jsonError("Method not allowed", 405);
        return handleCreateMntReferral(req);
      }
      if (segments.length === 4) {
        const action = MNT_REFERRAL_ACTIONS[segments[3] as keyof typeof MNT_REFERRAL_ACTIONS];
        if (!action) return jsonError("Not found", 404);
        if (method !== "POST") return jsonError("Method not allowed", 405);
        return action(req, segments[2]!);
      }
    }
    return jsonError("Not found", 404);
  }

  return jsonError("Not found", 404);
}
