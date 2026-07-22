import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../_lib/adapter";
import { pathSegment } from "../_lib/params";
import { handleUpdatePatient } from "../../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "PUT") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const patientId = pathSegment(req.url, 3);
  return vercelHandler(webReq => handleUpdatePatient(webReq, patientId))(req, res);
}
