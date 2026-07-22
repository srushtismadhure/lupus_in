import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deactivatePatient } from "@/lib/patients-api";

interface DeactivatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onDeactivated: (patient: fhir4.Patient) => void;
}

export function DeactivatePatientDialog({ open, onOpenChange, patientId, onDeactivated }: DeactivatePatientDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    const result = await deactivatePatient(patientId);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.errorMessage ?? "Unable to deactivate patient.");
      return;
    }

    toast.success("Patient marked inactive.");
    onDeactivated(result.patient!);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate patient record?</DialogTitle>
          <DialogDescription>This record will remain in the FHIR server but will be marked inactive.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Deactivating..." : "Deactivate Patient"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
