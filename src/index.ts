import { serve } from "bun";
import index from "./index.html";
import { handleRequest } from "./server/router";

// This file is the entry point for the Bun-native deployment target (local
// dev via `bun --hot`, and containerized hosts like Railway/Render/Fly via
// the Dockerfile). All request handling is delegated to ./server/router.ts's
// handleRequest(), which is the single implementation shared with the one
// Vercel serverless function under /api for deployments that need that model.
const server = serve({
  routes: {
    "/fhir/*": handleRequest,
    "/api/*": handleRequest,
    "/cds-services": handleRequest,
    "/cds-services/*": handleRequest,

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
