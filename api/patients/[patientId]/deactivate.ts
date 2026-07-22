import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../../_lib/adapter";
import { pathSegment } from "../../_lib/params";
import { handleDeactivatePatient } from "../../../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const patientId = pathSegment(req.url, 3);
  return vercelHandler(webReq => handleDeactivatePatient(webReq, patientId))(req, res);
}
