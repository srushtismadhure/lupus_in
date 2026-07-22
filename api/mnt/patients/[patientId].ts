import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../../_lib/adapter";
import { pathSegment } from "../../_lib/params";
import { handleGetMntState } from "../../../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const patientId = pathSegment(req.url, 4);
  return vercelHandler(webReq => handleGetMntState(webReq, patientId))(req, res);
}
