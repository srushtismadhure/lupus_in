import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "./_lib/adapter";
import { handleClinicianWorklist } from "../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  return vercelHandler(handleClinicianWorklist)(req, res);
}
