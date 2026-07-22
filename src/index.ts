import { serve } from "bun";
import index from "./index.html";
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
} from "./server/handlers";

// This file is the entry point for the Bun-native deployment target (local
// dev via `bun --hot`, and containerized hosts like Railway/Render/Fly via
// the Dockerfile). It's a thin router — all actual request handling lives in
// ./server/handlers.ts, which is shared with the Vercel serverless functions
// under /api for deployments that need that model instead.
const server = serve({
  routes: {
    "/fhir/*": req => proxyFhirRequest(req, new URL(req.url).pathname.replace(/^\/fhir/, "") || "/"),

    "/api/demo-login": { POST: handleDemoLogin },
    "/api/logout": { POST: handleLogout },
    "/api/session": { GET: handleSession },

    "/api/patients": { POST: handleCreatePatient },
    "/api/patients/:patientId": { PUT: req => handleUpdatePatient(req, req.params.patientId) },
    "/api/patients/:patientId/deactivate": { POST: req => handleDeactivatePatient(req, req.params.patientId) },

    "/api/clinician-worklist": { GET: handleClinicianWorklist },
    "/api/nurse/mnt-worklist": { GET: handleNurseMntWorklist },

    "/api/mnt/patients/:patientId": { GET: req => handleGetMntState(req, req.params.patientId) },
    "/api/mnt/referrals": { POST: handleCreateMntReferral },
    "/api/mnt/referrals/:serviceRequestId/send-for-signature": { POST: req => handleSendForSignature(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/sign": { POST: req => handleSignMntReferral(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/decline": { POST: req => handleDeclineMntReferral(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/modify": { POST: req => handleModifyMntReferral(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/barrier": { POST: req => handleDocumentBarrier(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/contact": { POST: req => handleContactPatient(req, req.params.serviceRequestId) },
    "/api/mnt/referrals/:serviceRequestId/schedule": { POST: req => handleCoordinateScheduling(req, req.params.serviceRequestId) },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
