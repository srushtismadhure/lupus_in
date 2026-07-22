import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "./_lib/adapter";
import { handleRequest } from "../src/server/router";

// The ONE Vercel serverless function for the entire backend — every /api/*
// route (rewritten from /fhir/* too, see vercel.json) lands here and is
// dispatched by the same handleRequest() used by the local Bun server, so
// there is a single implementation of every route, not two.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return vercelHandler(handleRequest)(req, res);
}
