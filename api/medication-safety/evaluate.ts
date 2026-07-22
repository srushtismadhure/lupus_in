import type { IncomingMessage, ServerResponse } from "node:http";
import { vercelHandler } from "../_lib/adapter.js";
import { handleRequest } from "../../src/server/router.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return vercelHandler(handleRequest)(req, res);
}
