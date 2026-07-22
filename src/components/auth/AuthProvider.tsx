import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, logout as logoutRequest, startDemoSession, type DemoUser } from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user?: DemoUser;
  startDemoSession: () => Promise<{ ok: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<DemoUser | undefined>(undefined);

  const refresh = useCallback(async () => {
    const session = await getSession();
    setStatus(session.authenticated ? "authenticated" : "unauthenticated");
    setUser(session.user);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enterDemo = useCallback(async () => {
    const result = await startDemoSession();
    if (result.ok) {
      setStatus("authenticated");
      setUser(result.user);
    }
    return { ok: result.ok };
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
