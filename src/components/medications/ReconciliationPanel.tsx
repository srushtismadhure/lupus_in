import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MedicationStatementView, ReconciliationIssueView } from "@/lib/medication-types";

interface ReconciliationPanelProps {
  issues: ReconciliationIssueView[];
  statements?: MedicationStatementView[];
  prescribedMedicationNames?: string[];
  onReconcile: (issue: ReconciliationIssueView) => void;
  onReconcileStatement?: (statement: MedicationStatementView) => void;
  onContactPatient: () => void;
}

function normalized(text: string) {
  return text.trim().toLowerCase();
}

export function ReconciliationPanel({
  issues,
  statements = [],
  prescribedMedicationNames = [],
  onReconcile,
  onReconcileStatement,
  onContactPatient,
}: ReconciliationPanelProps) {
  const prescribed = new Set(prescribedMedicationNames.map(normalized));
  const foundAtHome = statements.filter(statement => {
    const note = statement.note?.toLowerCase() ?? "";
    return note.includes("patient-reported medication found at home") || (!prescribed.has(normalized(statement.medicationText)) && statement.status === "active");
  });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Medication reconciliation</h2>
          <p className="text-xs text-[color:var(--muted-foreground)]">Compare prescribed therapy with what Home Health confirmed the patient is actually taking.</p>
        </div>
      </div>

      {foundAtHome.length > 0 && (
        <div className="mb-4 space-y-3">
          {foundAtHome.map(statement => (
            <Card key={`home-${statement.id}`} className="border-[var(--yellow)] bg-[var(--warning-bg)]/30">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[color:var(--foreground)]">{statement.medicationText}</span>
                      <Badge variant="warning">Needs clinician review</Badge>
                    </div>
                    <p className="mt-1 text-xs font-medium text-[color:var(--muted-foreground)]">Medication found at home · Patient-reported</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-white px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--foreground)]">Patient reports</p>
                    <p className="mt-1 text-[color:var(--muted-foreground)]">{statement.dose ?? "Dose/frequency not documented"}</p>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--foreground)]">Source</p>
                    <p className="mt-1 text-[color:var(--muted-foreground)]">Home Health visit</p>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--foreground)]">Last confirmed</p>
                    <p className="mt-1 text-[color:var(--muted-foreground)]">{statement.dateAsserted ? new Date(statement.dateAsserted).toLocaleDateString() : "Not available"}</p>
                  </div>
                </div>

                {statement.note && <p className="text-xs text-[color:var(--muted-foreground)]">{statement.note}</p>}

                <div className="flex flex-wrap gap-2">
                  {onReconcileStatement && <Button size="sm" onClick={() => onReconcileStatement(statement)}>Review / Reconcile</Button>}
                  <Button size="sm" variant="outline" onClick={onContactPatient}>Contact patient</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {issues.length === 0 && foundAtHome.length === 0 ? (
        <Card className="border-dashed bg-[var(--background)]">
          <CardContent className="text-center text-sm text-[color:var(--muted-foreground)]">No reconciliation issues detected from available data.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <Card key={`${issue.medicationRequestId}-${issue.statementId ?? "none"}`} className="border-[var(--yellow)]">
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Requires reconciliation</Badge>
                  <span className="text-sm font-medium text-[color:var(--foreground)]">{issue.medicationText}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-[var(--background)] px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--foreground)]">Ordered</p>
                    <p className="text-[color:var(--muted-foreground)]">{issue.orderedSummary}</p>
                  </div>
                  <div className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--foreground)]">Patient reports</p>
                    <p className="text-[color:var(--muted-foreground)]">{issue.reportedSummary}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => onReconcile(issue)}>Reconcile</Button>
                  <Button size="sm" variant="outline" onClick={onContactPatient}>Contact patient</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
