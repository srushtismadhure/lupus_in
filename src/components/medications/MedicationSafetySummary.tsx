import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import type { MedicationSafetyCounts } from "@/lib/medication-types";

export function MedicationSafetySummary({ counts }: { counts: MedicationSafetyCounts }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <SummaryStatCard label="High-priority conflicts" value={counts.conflicts} accent={counts.conflicts > 0 ? "red" : "green"} />
      <SummaryStatCard label="Monitoring gaps" value={counts.monitoringGaps} accent={counts.monitoringGaps > 0 ? "amber" : "green"} />
      <SummaryStatCard label="Reconciliation issues" value={counts.reconciliationIssues} accent={counts.reconciliationIssues > 0 ? "amber" : "green"} />
      <SummaryStatCard label="Symptoms requiring review" value={counts.symptomsRequiringReview} accent={counts.symptomsRequiringReview > 0 ? "amber" : "green"} />
      <SummaryStatCard label="Open medication tasks" value={counts.openTasks} accent="purple" />
    </div>
  );
}
