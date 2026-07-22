import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { replaceMedicationRequest } from "@/lib/medication-client";
import type { MedicationRegimenItem } from "@/lib/medication-types";

interface ReplaceMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MedicationRegimenItem | null;
  onSaved: () => void;
}

export function ReplaceMedicationDialog({ open, onOpenChange, item, onSaved }: ReplaceMedicationDialogProps) {
  const [doseValue, setDoseValue] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || submitting) return;
    setSubmitting(true);
    try {
      await replaceMedicationRequest(item.id, {
        doseValue: doseValue ? Number(doseValue) : undefined,
        doseUnit: doseUnit || undefined,
        route: route.trim() || undefined,
        frequency: frequency.trim() || undefined,
      });
      toast.success("Replacement medication order created.");
      setDoseValue("");
      setRoute("");
      setFrequency("");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to replace the medication order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change dose, route, or frequency</DialogTitle>
          <DialogDescription>
            {item?.medicationText} — the current order will be stopped and a new order created, linked to the prior order.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="replace-dose">New dose</Label>
              <Input id="replace-dose" type="number" value={doseValue} onChange={e => setDoseValue(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="replace-unit">Unit</Label>
              <Input id="replace-unit" value={doseUnit} onChange={e => setDoseUnit(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="replace-route">Route</Label>
              <Input id="replace-route" value={route} onChange={e => setRoute(e.target.value)} disabled={submitting} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="replace-frequency">New frequency</Label>
            <Input id="replace-frequency" value={frequency} onChange={e => setFrequency(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Create replacement order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
