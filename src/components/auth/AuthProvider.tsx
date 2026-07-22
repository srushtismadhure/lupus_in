import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  extendSession as extendSessionRequest,
  getSession,
  logout as logoutRequest,
  startDemoSession,
  type DemoRole,
  type DemoUser,
} from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user?: DemoUser;
  expiresAt?: number;
  startDemoSession: (role: DemoRole) => Promise<{ ok: boolean; role?: DemoRole }>;
  logout: () => Promise<void>;
  extendSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<DemoUser | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      setStatus(session.authenticated ? "authenticated" : "unauthenticated");
      setUser(session.user);
      setExpiresAt(session.expiresAt);
    } catch {
      // Never leave the UI stuck on "loading" — treat any unexpected failure as unauthenticated.
      setStatus("unauthenticated");
      setUser(undefined);
      setExpiresAt(undefined);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enterDemo = useCallback(async (role: DemoRole) => {
    const result = await startDemoSession(role);
    if (result.ok) {
      setStatus("authenticated");
      setUser(result.user);
      const session = await getSession();
      setExpiresAt(session.expiresAt);
    }
    return { ok: result.ok, role: result.user?.role };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setStatus("unauthenticated");
    setUser(undefined);
    setExpiresAt(undefined);
  }, []);

  const extendSession = useCallback(async () => {
    const session = await extendSessionRequest();
    if (!session.authenticated) return false;
    setStatus("authenticated");
    setUser(session.user);
    setExpiresAt(session.expiresAt);
    return true;
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, expiresAt, startDemoSession: enterDemo, logout, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
