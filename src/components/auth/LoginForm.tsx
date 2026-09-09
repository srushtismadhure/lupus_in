import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DemoRole } from "@/lib/auth-client";
import { useAuth } from "./AuthProvider";
import { MADISON_GRACE_PATIENT_ID } from "@/lib/madison-class-iv-data";

const ROLE_HOME: Record<DemoRole, string> = {
  nurse: "/nurse/visits",
  clinician: `/patients/${MADISON_GRACE_PATIENT_ID}`,
  patient: "/portal",
};

export function LoginForm() {
  const { startDemoSession } = useAuth();
  const navigate = useNavigate();
  const [submittingRole, setSubmittingRole] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitting = submittingRole !== null;

  async function handleEnterDemo(role: DemoRole) {
    if (submitting) return;
    setSubmittingRole(role);
    setError(null);

    const result = await startDemoSession(role);
    setSubmittingRole(null);

    if (!result.ok) {
      setError("Unable to start the demo. Please try again.");
      return;
    }

    navigate(ROLE_HOME[role], { replace: true });
  }

  return (
    <div className="w-full space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <section aria-labelledby="ambulatory-workspace" className="space-y-2">
          <div>
            <h2 id="ambulatory-workspace" className="text-xs font-semibold text-foreground">Ambulatory Care</h2>
            <p className="mt-1 text-sm text-muted-foreground">PCP / Pulmonologist</p>
          </div>
          <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 text-sm font-semibold text-foreground shadow-none hover:text-foreground focus-visible:ring-primary" onClick={() => handleEnterDemo("clinician")} disabled={submitting}>
            {submittingRole === "clinician" ? "Opening workspace..." : "Open Clinician Workspace"}
          </Button>
        </section>
        <section aria-labelledby="home-health-workspace" className="space-y-2">
          <div>
            <h2 id="home-health-workspace" className="text-xs font-semibold text-foreground">Home Health</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nurse / Case Manager</p>
          </div>
          <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal bg-[var(--brand-aqua)] py-2 text-sm font-semibold text-foreground shadow-none hover:bg-[#8ED8CF] hover:text-foreground focus-visible:ring-primary" onClick={() => handleEnterDemo("nurse")} disabled={submitting}>
            {submittingRole === "nurse" ? "Opening workspace..." : "Open Home Health Workspace"}
          </Button>
        </section>
        <section aria-labelledby="patient-workspace" className="space-y-2">
          <h2 id="patient-workspace" className="text-xs font-semibold text-foreground">Patient &amp; Caregiver</h2>
          <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 text-sm font-semibold text-foreground shadow-none hover:text-foreground focus-visible:ring-primary" onClick={() => handleEnterDemo("patient")} disabled={submitting}>
            {submittingRole === "patient" ? "Opening patient portal..." : "View Patient Portal"}
          </Button>
        </section>
      </div>

    </div>
  );
}
