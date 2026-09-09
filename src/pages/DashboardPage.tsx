import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { AttentionQueueTable } from "@/components/dashboard/AttentionQueueTable";
import { getClinicianWorklist } from "@/lib/worklist-client";
import type { ClinicianWorklistResponse } from "@/lib/worklist-types";

export function DashboardPage() {
  const navigate = useNavigate();
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
      setError(err instanceof Error ? err.message : "Unable to load the clinician worklist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const copdPatients = data?.allPatients.filter(view => /copd|chronic obstructive pulmonary disease/i.test(view.primaryConditionText ?? "")) ?? [];
  const copdAttentionQueue = copdPatients.filter(view => view.openTaskCount > 0 || view.primaryAttentionReason);

  return (
    <AppShell
      title="Welcome Back, Dr. Madhure!"
      subtitle="Review COPD status, home-health updates, care gaps, and follow-up needs."
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
          {(data.partial.conditions || data.partial.observations || data.partial.tasks) && (
            <Alert variant="warning" className="mb-4">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>
                  Some FHIR data could not be fully loaded
                  {data.partial.conditions && " (Conditions)"}
                  {data.partial.observations && " (Observations)"}
                  {data.partial.tasks && " (Tasks)"}. Figures below may be incomplete.
                </span>
                <Button size="sm" variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryStatCard
              label="Total patients"
              value={data.summary.totalPatients}
              accent="purple"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="COPD patients"
              value={copdPatients.length}
              accent="blue"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Needs review"
              value={copdAttentionQueue.length}
              accent="amber"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Recent exacerbations"
              value="—"
              accent="neutral"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Open tasks"
              value={copdPatients.reduce((total, view) => total + view.openTaskCount, 0)}
              accent="amber"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Home health active"
              value="—"
              accent="green"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
          </div>

          <section>
            <h2 className="mb-3 text-base font-semibold text-[color:var(--foreground)]">Attention Queue</h2>
            <AttentionQueueTable patients={copdAttentionQueue} />
          </section>
        </>
      )}
    </AppShell>
  );
}
