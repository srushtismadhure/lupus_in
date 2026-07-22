export interface DemoUser {
  email: string;
  displayName: string;
  role: string;
}

export interface SessionState {
  authenticated: boolean;
  user?: DemoUser;
}

export async function getSession(): Promise<SessionState> {
  const response = await fetch("/api/session", { credentials: "include" });
  return (await response.json()) as SessionState;
}

export interface DemoLoginResult {
  ok: boolean;
  user?: DemoUser;
}

export async function startDemoSession(): Promise<DemoLoginResult> {
  const response = await fetch("/api/demo-login", { method: "POST", credentials: "include" });
  if (!response.ok) return { ok: false };
  const body = (await response.json()) as SessionState;
  return { ok: true, user: body.user };
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}
