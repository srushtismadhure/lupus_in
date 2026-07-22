import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { holdMedicationRequest, stopMedicationRequest } from "@/lib/medication-client";

interface MedicationReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "hold" | "stop";
  medicationRequestId: string;
  medicationText: string;
  onSaved: () => void;
}

const COPY = {
  hold: { title: "Pause medication order", label: "Reason for pause", action: holdMedicationRequest, success: "Medication order paused." },
  stop: { title: "Stop medication order", label: "Reason for stopping", action: stopMedicationRequest, success: "Medication order stopped." },
};

export function MedicationReasonDialog({ open, onOpenChange, mode, medicationRequestId, medicationText, onSaved }: MedicationReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await copy.action(medicationRequestId, reason.trim());
      toast.success(copy.success);
      setReason("");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to complete this action.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{medicationText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reason">{copy.label} *</Label>
            <Textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !reason.trim()}>
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
