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
  handleGetMedicationState,
  handleCreateMedicationDraft,
  handleSignMedicationRequest,
  handleHoldMedicationRequest,
  handleStopMedicationRequest,
  handleReplaceMedicationRequest,
  handleCreateMedicationStatement,
  handleCreateMedicationAssessment,
  handleResolveDetectedIssue,
  handleMedicationSafetyEvaluate,
  handleAnalyzeClinicalNote,
  handleApproveClinicalConcept,
  handleApproveSdohReferralDraft,
  handleCancelSdohReferralDraft,
  handleCdsDiscovery,
  handleCdsOrderSelect,
  handleCdsOrderSign,
  handleCdsPatientView,
  handleConfirmPriorAuthEvidence,
  handleCreateClinicalNoteDraft,
  handleCreatePriorAuthTask,
  handleCreateSdohReferralDraft,
  handleFinalizeClinicalNote,
  handlePriorAuthReadiness,
  handleRejectClinicalConcept,
  handleSaveClinicalNoteDraft,
} from "./handlers.js";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

const CDS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/** Clones a Response with CORS headers added, so an external CDS Hooks sandbox can call these endpoints cross-origin. */
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CDS_CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
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

  // --- CDS Hooks: public path per spec (not under /api), rewritten to /api/cds-services/* on Vercel.
  // CORS is enabled here (and only here) so an external CDS Hooks sandbox can call these endpoints
  // cross-origin without our app's session cookie — see handleCdsPatientView for why that's safe. ---
  if (pathname === "/cds-services" || pathname === "/api/cds-services") {
    if (method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
    if (method !== "GET") return withCors(jsonError("Method not allowed", 405));
    return withCors(await handleCdsDiscovery());
  }
  if (pathname.startsWith("/cds-services/") || pathname.startsWith("/api/cds-services/")) {
    if (method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
    if (method !== "POST") return withCors(jsonError("Method not allowed", 405));
    const serviceId = pathname.split("/").filter(Boolean).pop();
    if (serviceId === "luppedin-medication-order-select") return withCors(await handleCdsOrderSelect(req));
    if (serviceId === "luppedin-medication-order-sign") return withCors(await handleCdsOrderSign(req));
    if (serviceId === "luppedin-patient-view") return withCors(await handleCdsPatientView(req));
    return withCors(jsonError("Not found", 404));
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
    if (segments.length === 3 && segments[2] === "medications") {
      if (method !== "GET") return jsonError("Method not allowed", 405);
      return handleGetMedicationState(req, segments[1]!);
    }
    if (segments.length === 3 && segments[2] === "medication-drafts") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreateMedicationDraft(req, segments[1]!);
    }
    if (segments.length === 3 && segments[2] === "medication-statements") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreateMedicationStatement(req, segments[1]!);
    }
    if (segments.length === 3 && segments[2] === "medication-assessments") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreateMedicationAssessment(req, segments[1]!);
    }
    if (segments.length === 3 && segments[2] === "prior-auth-readiness") {
      if (method !== "GET") return jsonError("Method not allowed", 405);
      return handlePriorAuthReadiness(req, segments[1]!);
    }
    if (segments.length === 4 && segments[2] === "clinical-notes" && segments[3] === "drafts") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreateClinicalNoteDraft(req, segments[1]!);
    }
    if (segments.length === 4 && segments[2] === "clinical-notes" && segments[3] === "analyze") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleAnalyzeClinicalNote(req, segments[1]!);
    }
    if (segments.length === 5 && segments[2] === "prior-auth" && segments[3] === "evidence" && segments[4] === "confirm") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleConfirmPriorAuthEvidence(req, segments[1]!);
    }
    if (segments.length === 4 && segments[2] === "prior-auth" && segments[3] === "tasks") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreatePriorAuthTask(req, segments[1]!);
    }
    if (segments.length === 4 && segments[2] === "sdoh" && segments[3] === "referral-drafts") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleCreateSdohReferralDraft(req, segments[1]!);
    }
    return jsonError("Not found", 404);
  }

  // --- clinical-note draft lifecycle ---
  if (segments[0] === "clinical-notes" && segments.length >= 3) {
    const draftId = segments[1]!;
    if (segments.length === 3 && segments[2] === "save") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleSaveClinicalNoteDraft(req, draftId);
    }
    if (segments.length === 3 && segments[2] === "finalize") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleFinalizeClinicalNote(req, draftId);
    }
    if (segments.length === 5 && segments[2] === "concepts" && segments[4] === "approve") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleApproveClinicalConcept(req, draftId, segments[3]!);
    }
    if (segments.length === 5 && segments[2] === "concepts" && segments[4] === "reject") {
      if (method !== "POST") return jsonError("Method not allowed", 405);
      return handleRejectClinicalConcept(req, draftId, segments[3]!);
    }
    return jsonError("Not found", 404);
  }

  // --- SDOH/community referral draft lifecycle ---
  if (segments[0] === "referral-drafts" && segments.length === 3) {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    if (segments[2] === "approve") return handleApproveSdohReferralDraft(req, segments[1]!);
    if (segments[2] === "cancel") return handleCancelSdohReferralDraft(req, segments[1]!);
    return jsonError("Not found", 404);
  }

  // --- medication safety review ---
  if (segments.length === 2 && segments[0] === "medication-safety" && segments[1] === "evaluate") {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    return handleMedicationSafetyEvaluate(req);
  }

  // --- medication order actions ---
  if (segments[0] === "medication-requests" && segments.length === 3) {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    const id = segments[1]!;
    switch (segments[2]) {
      case "sign":
        return handleSignMedicationRequest(req, id);
      case "hold":
        return handleHoldMedicationRequest(req, id);
      case "stop":
        return handleStopMedicationRequest(req, id);
      case "replace":
        return handleReplaceMedicationRequest(req, id);
      default:
        return jsonError("Not found", 404);
    }
  }

  // --- detected issue review ---
  if (segments[0] === "detected-issues" && segments.length === 3 && segments[2] === "resolve") {
    if (method !== "POST") return jsonError("Method not allowed", 405);
    return handleResolveDetectedIssue(req, segments[1]!);
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
