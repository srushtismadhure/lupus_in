import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "./AuthProvider";

export function LoginForm() {
  const { startDemoSession, logout } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnterDemo() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const result = await startDemoSession();
    setSubmitting(false);

    if (!result.ok) {
      setError("Unable to start the demo. Please try again.");
      return;
    }

    navigate("/", { replace: true });
  }

  async function handleResetDemoSession() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    await logout();
    const result = await startDemoSession();
    setSubmitting(false);

    if (!result.ok) {
      setError("Unable to start the demo. Please try again.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="button" className="w-full" onClick={handleEnterDemo} disabled={submitting}>
        {submitting ? "Opening demo..." : "Enter Demo"}
      </Button>

      <button
        type="button"
        onClick={handleResetDemoSession}
        disabled={submitting}
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        Reset demo session
      </button>

      <p className="text-center text-xs text-muted-foreground">
        This environment contains synthetic demonstration data only.
      </p>
    </div>
  );
}
