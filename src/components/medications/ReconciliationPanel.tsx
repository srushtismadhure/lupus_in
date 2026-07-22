import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ReconciliationIssueView } from "@/lib/medication-types";

interface ReconciliationPanelProps {
  issues: ReconciliationIssueView[];
  onReconcile: (issue: ReconciliationIssueView) => void;
  onContactPatient: () => void;
}

export function ReconciliationPanel({ issues, onReconcile, onContactPatient }: ReconciliationPanelProps) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-[#1F2430]">Medication reconciliation</h2>

      {issues.length === 0 ? (
        <Card className="border-dashed bg-[#F8FBFD]">
          <CardContent className="text-center text-sm text-[#4F5E70]">No reconciliation issues detected from available data.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <Card key={`${issue.medicationRequestId}-${issue.statementId ?? "none"}`} className="border-[#F5DAA7]">
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Requires reconciliation</Badge>
                  <span className="text-sm font-medium text-[#1F2430]">{issue.medicationText}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-[#F8FAFD] px-3 py-2 text-xs">
                    <p className="font-medium text-[#1F2430]">Ordered</p>
                    <p className="text-[#4F5E70]">{issue.orderedSummary}</p>
                  </div>
                  <div className="rounded-md bg-[#FFF4DD] px-3 py-2 text-xs">
                    <p className="font-medium text-[#1F2430]">Patient reports</p>
                    <p className="text-[#4F5E70]">{issue.reportedSummary}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => onReconcile(issue)}>
                    Reconcile
                  </Button>
                  <Button size="sm" variant="outline" onClick={onContactPatient}>
                    Contact patient
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
