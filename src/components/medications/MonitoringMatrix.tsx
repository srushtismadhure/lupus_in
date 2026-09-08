import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MedicationRegimenItem } from "@/lib/medication-types";

function monitoringBadge(status: MedicationRegimenItem["monitoring"][number]["status"]) {
  switch (status) {
    case "current":
      return <Badge variant="success">Current</Badge>;
    case "overdue":
      return <Badge variant="warning">Review</Badge>;
    case "unavailable":
      return <Badge variant="neutral">Monitoring unavailable</Badge>;
    default:
      return <Badge variant="neutral">Insufficient information</Badge>;
  }
}

export function MonitoringMatrix({ regimenItems }: { regimenItems: MedicationRegimenItem[] }) {
  const rows = regimenItems.flatMap(item =>
    item.monitoring.map(m => ({
      medication: item.medicationText,
      domain: m.label,
      evidence: item.patientReportedUseText ?? "No current symptoms documented",
      status: m,
    })),
  );

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-[color:var(--foreground)]">Monitoring and side-effect matrix</h2>
      {rows.length === 0 ? (
        <Card className="border-dashed bg-[var(--background)]">
          <CardContent className="text-center text-sm text-[color:var(--muted-foreground)]">No configured monitoring parameters apply to this patient's active regimen.</CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)] text-xs uppercase text-[color:var(--muted-foreground)]">
                  <th className="px-4 py-3 font-semibold">Medication</th>
                  <th className="px-4 py-3 font-semibold">Safety domain</th>
                  <th className="px-4 py-3 font-semibold">Patient evidence</th>
                  <th className="px-4 py-3 font-semibold">Monitoring</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.medication}-${row.domain}-${index}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">{row.medication}</td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{row.domain}</td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{row.evidence}</td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{row.status.lastDate ?? "Not available"}</td>
                    <td className="px-4 py-3">{monitoringBadge(row.status.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
