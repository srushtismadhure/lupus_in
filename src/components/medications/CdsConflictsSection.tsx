import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { resolveDetectedIssue } from "@/lib/medication-client";
import type { DetectedIssueView } from "@/lib/medication-types";
import { toast } from "sonner";

function severityBadge(severity: string) {
  if (severity === "high") return <Badge variant="destructive">High priority</Badge>;
  if (severity === "moderate") return <Badge variant="warning">Warning</Badge>;
  return <Badge variant="info">Low priority</Badge>;
}

interface ResolveState {
  issue: DetectedIssueView;
  action: "modify" | "cancel" | "continue" | "create-task";
}

export function CdsConflictsSection({ issues, canResolve, onResolved }: { issues: DetectedIssueView[]; canResolve: boolean; onResolved: () => void }) {
  const [resolveState, setResolveState] = useState<ResolveState | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openIssues = issues.filter(i => !i.mitigationAction);

  async function handleResolve() {
    if (!resolveState || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await resolveDetectedIssue(resolveState.issue.id, resolveState.action, reason.trim());
      toast.success("Medication safety conflict resolved.");
      setResolveState(null);
      setReason("");
      onResolved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to resolve the conflict.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-[#1F2430]">CDS conflicts</h2>

      {openIssues.length === 0 ? (
        <Card className="border-dashed bg-[#F8FBFD]">
          <CardContent className="text-center text-sm text-[#4F5E70]">No conflicts detected from available data.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {openIssues.map(issue => (
            <Card key={issue.id} className={issue.severity === "high" ? "border-[#F2CBD1]" : "border-[#F5DAA7]"}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {severityBadge(issue.severity)}
                  <span className="text-sm font-medium text-[#1F2430]">{issue.summary ?? "Medication safety conflict requires review"}</span>
                </div>
                {issue.implicatedMedicationRequestIds.length > 0 && (
                  <p className="text-xs text-[#4F5E70]">Evidence: {issue.implicatedMedicationRequestIds.map(id => `MedicationRequest/${id}`).join(", ")}</p>
                )}
                {canResolve && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => setResolveState({ issue, action: "modify" })}>
                      Modify draft
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResolveState({ issue, action: "continue" })}>
                      Continue with reason
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResolveState({ issue, action: "cancel" })}>
                      Cancel draft
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResolveState({ issue, action: "create-task" })}>
                      Create monitoring task
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resolveState} onOpenChange={open => !open && setResolveState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document clinician review</DialogTitle>
            <DialogDescription>An override reason is required before this conflict can be resolved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resolve-reason">Reason</Label>
            <Textarea id="resolve-reason" value={reason} onChange={e => setReason(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveState(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={submitting || !reason.trim()}>
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
