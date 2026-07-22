import { Navigate } from "react-router-dom";
import type { DemoRole } from "@/lib/auth-client";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: DemoRole[] }) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading session...</div>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to={user?.role === "patient" ? "/portal" : "/"} replace />;
  }

  return <>{children}</>;
}
