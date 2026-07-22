import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { MntReferralQueueTable } from "@/components/dashboard/MntReferralQueueTable";
import { getNurseMntWorklist } from "@/lib/mnt-client";
import type { MntWorklistResponse } from "@/lib/mnt-types";

export function NurseDashboardPage() {
  const [data, setData] = useState<MntWorklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const worklist = await getNurseMntWorklist();
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the MNT referral worklist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <AppShell
      title="LoopedIn — Care Coordination"
      subtitle="Medical nutrition therapy referral workflow and outreach queue."
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
          <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryStatCard label="Awaiting signature" value={data.summary.awaitingSignature} accent="amber" />
            <SummaryStatCard label="Awaiting scheduling" value={data.summary.approvedAwaitingScheduling} accent="purple" />
            <SummaryStatCard label="Not yet contacted" value={data.summary.notContacted} accent="red" />
            <SummaryStatCard label="Appointments scheduled" value={data.summary.appointmentsScheduled} accent="blue" />
            <SummaryStatCard label="Completed" value={data.summary.completed} accent="green" />
            <SummaryStatCard label="Blocked by access barriers" value={data.summary.blockedByBarriers} accent="amber" />
          </div>

          <section>
            <h2 className="mb-3 text-base font-semibold text-[#1F2430]">MNT Referral Queue</h2>
            <MntReferralQueueTable items={data.queue} />
          </section>
        </>
      )}
    </AppShell>
  );
}
