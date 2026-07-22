import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "./_lib/adapter";
import { handleLogout } from "../src/server/handlers";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  return vercelHandler(handleLogout)(req, res);
}
