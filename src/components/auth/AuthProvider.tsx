import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, logout as logoutRequest, startDemoSession, type DemoRole, type DemoUser } from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user?: DemoUser;
  startDemoSession: (role: DemoRole) => Promise<{ ok: boolean; role?: DemoRole }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<DemoUser | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      setStatus(session.authenticated ? "authenticated" : "unauthenticated");
      setUser(session.user);
    } catch {
      // Never leave the UI stuck on "loading" — treat any unexpected failure as unauthenticated.
      setStatus("unauthenticated");
      setUser(undefined);
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
    }
    return { ok: result.ok, role: result.user?.role };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setStatus("unauthenticated");
    setUser(undefined);
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, startDemoSession: enterDemo, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
