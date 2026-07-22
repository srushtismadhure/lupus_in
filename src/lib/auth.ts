import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Demonstration authentication only. This is a public, one-click synthetic
 * demo session — not a real identity system and must never be used with
 * real patient data. The signed session cookie exists purely to gate
 * `/fhir/*`, `/api/patients/*`, and `/api/mnt/*` behind an explicit
 * "enter demo" action.
 *
 * PRODUCTION NOTE: in a real SMART on FHIR deployment, the application must
 * not let the user pick a role. Instead, after the SMART launch it should
 * read the authenticated `fhirUser` claim, resolve the corresponding
 * PractitionerRole resource(s), and select the RN Care Coordinator vs.
 * Clinician experience (and the write permissions below) from that —
 * never from a client-supplied value.
 */

export const DEMO_ROLES = ["nurse", "clinician"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && (DEMO_ROLES as readonly string[]).includes(value);
}

export const DEMO_USERS: Record<DemoRole, { email: string; displayName: string }> = {
  nurse: { email: "rn@nephra.app", displayName: "NEPHRA RN Care Coordinator" },
  clinician: { email: "demo@nephra.app", displayName: "NEPHRA Demo Clinician" },
};

const SESSION_COOKIE_NAME = "nephra_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DEMO_ENVIRONMENT = "synthetic-demo";

function readAuthConfig() {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!sessionSecret) throw new Error("Missing required environment variable: APP_SESSION_SECRET");
  return { sessionSecret };
}

export const authConfig = readAuthConfig();

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", authConfig.sessionSecret).update(payload).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface SessionPayload {
  email: string;
  displayName: string;
  role: DemoRole;
  environment: string;
  exp: number;
}

/** Role is validated against `DEMO_ROLES` server-side — the client cannot request an arbitrary role. */
export function createDemoSessionToken(role: DemoRole): string {
  const user = DEMO_USERS[role];
  const payload: SessionPayload = { ...user, role, environment: DEMO_ENVIRONMENT, exp: Date.now() + SESSION_TTL_MS };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!constantTimeEqual(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number" || !isDemoRole(payload.role)) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie");
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

/** Server-side role gate — the actual security boundary. Returns the session only if it matches one of `allowedRoles`. */
export function requireRole(req: Request, ...allowedRoles: DemoRole[]): SessionPayload | null {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  if (!allowedRoles.includes(session.role)) return null;
  return session;
}

export function buildSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearedSessionCookie(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export function forbiddenResponse(message = "You do not have permission to perform this action."): Response {
  return Response.json({ error: message }, { status: 403 });
}
