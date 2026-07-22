import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../../../_lib/adapter";
import { pathSegment } from "../../../_lib/params";
import { handleSendForSignature } from "../../../../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const serviceRequestId = pathSegment(req.url, 4);
  return vercelHandler(webReq => handleSendForSignature(webReq, serviceRequestId))(req, res);
}
