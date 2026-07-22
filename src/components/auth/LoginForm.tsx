import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DemoRole } from "@/lib/auth-client";
import { useAuth } from "./AuthProvider";

const ROLE_HOME: Record<DemoRole, string> = { nurse: "/nurse", clinician: "/clinician" };

export function LoginForm() {
  const { startDemoSession, logout } = useAuth();
  const navigate = useNavigate();
  const [submittingRole, setSubmittingRole] = useState<DemoRole | null>(null);
  const [lastRole, setLastRole] = useState<DemoRole>("clinician");
  const [error, setError] = useState<string | null>(null);

  const submitting = submittingRole !== null;

  async function handleEnterDemo(role: DemoRole) {
    if (submitting) return;
    setSubmittingRole(role);
    setLastRole(role);
    setError(null);

    const result = await startDemoSession(role);
    setSubmittingRole(null);

    if (!result.ok) {
      setError("Unable to start the demo. Please try again.");
      return;
    }

    navigate(ROLE_HOME[role], { replace: true });
  }

  async function handleResetDemoSession() {
    if (submitting) return;
    setSubmittingRole(lastRole);
    setError(null);

    await logout();
    const result = await startDemoSession(lastRole);
    setSubmittingRole(null);

    if (!result.ok) {
      setError("Unable to start the demo. Please try again.");
      return;
    }

    navigate(ROLE_HOME[lastRole], { replace: true });
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <p className="text-xs font-semibold uppercase text-[#4F5E70]">Demo roles</p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Button type="button" className="w-full" onClick={() => handleEnterDemo("nurse")} disabled={submitting}>
          {submittingRole === "nurse" ? "Opening demo..." : "Enter as RN Care Coordinator"}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => handleEnterDemo("clinician")} disabled={submitting}>
          {submittingRole === "clinician" ? "Opening demo..." : "Enter as Clinician"}
        </Button>
      </div>

      <button
        type="button"
        onClick={handleResetDemoSession}
        disabled={submitting}
        className="min-h-8 w-full rounded-lg text-center text-sm font-medium text-[#4F5E70] underline-offset-4 outline-none hover:text-[#245D86] hover:underline focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/35 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        Reset demo session
      </button>

      <p className="text-center text-xs font-medium text-[#4F5E70]">
        This environment contains synthetic demonstration data only.
      </p>
    </div>
  );
}
