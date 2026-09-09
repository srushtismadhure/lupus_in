import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { AllPatientsTable } from "@/components/dashboard/AllPatientsTable";
import { getClinicianWorklist } from "@/lib/worklist-client";
import type { ClinicianWorklistResponse } from "@/lib/worklist-types";

export function NurseDashboardPage() {
  const [data, setData] = useState<ClinicianWorklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const worklist = await getClinicianWorklist();
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the home-health worklist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <AppShell
      title="Home Health"
      subtitle="COPD home-health visits, assessments, and care transitions."
    >
      <div className="mb-5 flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--info-bg)]" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-lg bg-[var(--info-bg)]" />
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && data && (
        <>
          {(() => {
            const copdPatients = data.allPatients.filter(view => view.hasCopd);
            const needsReview = copdPatients.filter(view => view.openTaskCount > 0 || view.primaryAttentionReason).length;
            const medicationDiscrepancies = "—";
            return <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStatCard label="Today's visits" value="—" accent="blue" />
              <SummaryStatCard label="Assessments due" value="—" accent="amber" />
              <SummaryStatCard label="Needs review" value={needsReview} accent="amber" />
              <SummaryStatCard label="Medication discrepancies" value={medicationDiscrepancies} accent="neutral" />
            </div>;
          })()}

          <section>
            <h2 className="mb-3 text-base font-semibold text-[color:var(--foreground)]">Home Health Worklist</h2>
            <AllPatientsTable patients={data.allPatients.filter(view => view.hasCopd)} quickLooks={{}} onEdit={() => undefined} onDeactivate={() => undefined} />
          </section>
        </>
      )}
    </AppShell>
  );
}
