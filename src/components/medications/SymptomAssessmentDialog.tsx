import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMedicationAssessment, type SymptomAnswerInput } from "@/lib/medication-client";

const SYMPTOM_QUESTIONS = [
  { linkId: "nausea", text: "Nausea" },
  { linkId: "vomiting", text: "Vomiting" },
  { linkId: "diarrhea", text: "Diarrhea" },
  { linkId: "headache", text: "Headache" },
  { linkId: "dizziness", text: "Dizziness" },
  { linkId: "vision-changes", text: "Vision changes" },
  { linkId: "fever-infection", text: "Fever or infection symptoms" },
  { linkId: "edema", text: "Swelling or edema" },
  { linkId: "weight-change", text: "Weight change" },
  { linkId: "mood-sleep", text: "Mood or sleep change" },
  { linkId: "access-difficulty", text: "Medication access difficulty" },
  { linkId: "refill-delay", text: "Refill delay" },
  { linkId: "missed-doses", text: "Missed doses" },
  { linkId: "concern", text: "Patient concern about medication" },
] as const;

type Severity = SymptomAnswerInput["severity"];

interface SymptomAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSaved: () => void;
}

export function SymptomAssessmentDialog({ open, onOpenChange, patientId, onSaved }: SymptomAssessmentDialogProps) {
  const [severities, setSeverities] = useState<Record<string, Severity>>({});
  const [submitting, setSubmitting] = useState(false);

  function setSeverity(linkId: string, value: Severity) {
    setSeverities(prev => ({ ...prev, [linkId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const answers: SymptomAnswerInput[] = SYMPTOM_QUESTIONS.map(q => ({
        linkId: q.linkId,
        text: q.text,
        severity: severities[q.linkId] ?? "none",
      }));
      await createMedicationAssessment(patientId, answers);
      toast.success("Medication experience assessment saved.");
      setSeverities({});
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save the assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Medication experience assessment</DialogTitle>
          <DialogDescription>Structured, patient-reported symptom and medication-experience check.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {SYMPTOM_QUESTIONS.map(q => (
              <div key={q.linkId} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0">
                <label htmlFor={`symptom-${q.linkId}`} className="text-sm text-[color:var(--foreground)]">
                  {q.text}
                </label>
                <Select value={severities[q.linkId] ?? "none"} onValueChange={value => setSeverity(q.linkId, value as Severity)} disabled={submitting}>
                  <SelectTrigger id={`symptom-${q.linkId}`} className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            This assessment does not automatically label any symptom as a medication side effect. A clinician must review and confirm
            before an adverse-event relationship is documented.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save assessment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
