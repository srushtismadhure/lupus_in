import type { IncomingMessage, ServerResponse } from "node:http";

/** Every handler in src/server/handlers.ts matches this shape — plain Web Request/Response. */
export type WebHandler = (req: Request) => Promise<Response> | Response;

async function readRawBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function nodeRequestToWebRequest(req: IncomingMessage, body: Buffer | undefined): Request {
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }

  return new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined });
}

/** Wraps a Web-standard (req: Request) => Response handler as a Vercel Node.js function. */
export function vercelHandler(handler: WebHandler) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let webResponse: Response;
    try {
      const body = await readRawBody(req);
      const webRequest = nodeRequestToWebRequest(req, body);
      webResponse = await handler(webRequest);
    } catch (error) {
      console.error("Unhandled error in Vercel function:", error instanceof Error ? error.message : "unknown error");
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }

    res.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await webResponse.arrayBuffer());
    res.end(buffer);
  };
}
