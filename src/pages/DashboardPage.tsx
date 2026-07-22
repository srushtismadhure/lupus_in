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

  return (
    <AppShell
      title="Welcome Back, Dr. Madhure!"
      subtitle="LoopedIn doctor view for renal changes, overdue monitoring, and unresolved follow-up."
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
              <div key={i} className="h-24 animate-pulse rounded-lg bg-[#E7F1F8]" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-lg bg-[#E7F1F8]" />
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
              label="Lupus nephritis"
              value={data.summary.lupusNephritisPatients}
              accent="purple"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Needing review"
              value={data.summary.needsReview}
              accent="red"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Monitoring overdue"
              value={data.summary.monitoringOverdue}
              accent="amber"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Open high-priority tasks"
              value={data.summary.openHighPriorityTasks}
              accent="amber"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
            <SummaryStatCard
              label="Insufficient data"
              value={data.summary.insufficientData}
              accent="neutral"
              actionLabel="View report"
              onAction={() => navigate("/patients")}
            />
          </div>

          <section>
            <h2 className="mb-3 text-base font-semibold text-[#1F2430]">Attention Queue</h2>
            <AttentionQueueTable patients={data.attentionQueue} />
          </section>
        </>
      )}
    </AppShell>
  );
}
