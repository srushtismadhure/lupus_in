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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DEMO_MEDICATION_TERMINOLOGY } from "@/lib/medication-config";
import { createMedicationDraft, evaluateMedicationSafety, signMedicationRequest, type SafetyEvaluationResult } from "@/lib/medication-client";
import { getTodayDateString } from "@/lib/validation";

interface AddMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  conditions: fhir4.Condition[];
  onSaved: () => void;
}

export function AddMedicationDialog({ open, onOpenChange, patientId, conditions, onSaved }: AddMedicationDialogProps) {
  const [medicationText, setMedicationText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCode, setSelectedCode] = useState<{ system: string; code: string } | undefined>();
  const [indication, setIndication] = useState("");
  const [treatmentPhase, setTreatmentPhase] = useState("");
  const [doseValue, setDoseValue] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [conditionId, setConditionId] = useState("");
  const [patientInstruction, setPatientInstruction] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");

  const [draft, setDraft] = useState<fhir4.MedicationRequest | null>(null);
  const [evaluation, setEvaluation] = useState<SafetyEvaluationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = medicationText.trim()
    ? DEMO_MEDICATION_TERMINOLOGY.filter(t => t.display.toLowerCase().includes(medicationText.trim().toLowerCase())).slice(0, 6)
    : [];

  function reset() {
    setMedicationText("");
    setSelectedCode(undefined);
    setIndication("");
    setTreatmentPhase("");
    setDoseValue("");
    setDoseUnit("mg");
    setRoute("");
    setFrequency("");
    setStartDate(getTodayDateString());
    setExpectedEndDate("");
    setConditionId("");
    setPatientInstruction("");
    setClinicalNote("");
    setDraft(null);
    setEvaluation(null);
    setError(null);
  }

  async function handleSaveDraft() {
    if (!medicationText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMedicationDraft(patientId, {
        medicationText: medicationText.trim(),
        medicationSystem: selectedCode?.system,
        medicationCode: selectedCode?.code,
        indication: indication.trim() || undefined,
        treatmentPhase: treatmentPhase.trim() || undefined,
        doseValue: doseValue ? Number(doseValue) : undefined,
        doseUnit: doseUnit || undefined,
        route: route.trim() || undefined,
        frequency: frequency.trim() || undefined,
        startDate: startDate || undefined,
        expectedEndDate: expectedEndDate || undefined,
        conditionId: conditionId || undefined,
        patientInstruction: patientInstruction.trim() || undefined,
        clinicalNote: clinicalNote.trim() || undefined,
      });
      setDraft(created);
      toast.success("Draft medication order saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the draft.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRunSafetyReview() {
    if (!draft || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await evaluateMedicationSafety(patientId, draft);
      setEvaluation(result);
      if (result.cards.length === 0) toast.success("No conflicts detected from available data.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run the safety review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignNow() {
    if (!draft?.id || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signMedicationRequest(draft.id);
      toast.success("Medication order signed.");
      onSaved();
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign the order.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (draft) onSaved();
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={value => (value ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add medication</DialogTitle>
          <DialogDescription>Creates a draft order. It becomes active only after a clinician signs it.</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!draft ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSaveDraft();
            }}
            className="space-y-4"
            noValidate
          >
            <div className="relative space-y-1.5">
              <Label htmlFor="medication-search">Medication *</Label>
              <Input
                id="medication-search"
                value={medicationText}
                onChange={e => {
                  setMedicationText(e.target.value);
                  setSelectedCode(undefined);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search medication name..."
                autoComplete="off"
                disabled={submitting}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-[#DCE6F0] bg-white shadow-md">
                  {suggestions.map(s => (
                    <li key={s.code}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F2F8FC]"
                        onClick={() => {
                          setMedicationText(s.display);
                          setSelectedCode({ system: s.system, code: s.code });
                          setShowSuggestions(false);
                        }}
                      >
                        {s.display}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedCode && <p className="font-mono text-xs text-[#4F5E70]">Code: {selectedCode.code}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="indication">Indication</Label>
                <Input id="indication" value={indication} onChange={e => setIndication(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="treatment-phase">Treatment phase</Label>
                <Input id="treatment-phase" value={treatmentPhase} onChange={e => setTreatmentPhase(e.target.value)} placeholder="Induction, maintenance..." disabled={submitting} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dose-value">Dose</Label>
                <Input id="dose-value" type="number" value={doseValue} onChange={e => setDoseValue(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dose-unit">Unit</Label>
                <Input id="dose-unit" value={doseUnit} onChange={e => setDoseUnit(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="route">Route</Label>
                <Input id="route" value={route} onChange={e => setRoute(e.target.value)} placeholder="Oral" disabled={submitting} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="frequency">Frequency</Label>
                <Input id="frequency" value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="Twice daily" disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-date">Start date</Label>
                <Input id="start-date" type="date" max={getTodayDateString()} value={startDate} onChange={e => setStartDate(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">Expected end date</Label>
                <Input id="end-date" type="date" value={expectedEndDate} onChange={e => setExpectedEndDate(e.target.value)} disabled={submitting} />
              </div>
            </div>

            {conditions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="related-condition">Related condition</Label>
                <select
                  id="related-condition"
                  value={conditionId}
                  onChange={e => setConditionId(e.target.value)}
                  disabled={submitting}
                  className="h-9 w-full rounded-md border border-[#D2E9F7] bg-transparent px-3 text-sm"
                >
                  <option value="">Not specified</option>
                  {conditions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code?.text ?? c.code?.coding?.[0]?.display ?? c.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="patient-instruction">Patient instructions</Label>
              <Textarea id="patient-instruction" value={patientInstruction} onChange={e => setPatientInstruction(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinical-note">Clinical note</Label>
              <Textarea id="clinical-note" value={clinicalNote} onChange={e => setClinicalNote(e.target.value)} disabled={submitting} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !medicationText.trim()}>
                {submitting ? "Saving..." : "Save Draft"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-[#F8FAFD] px-3 py-2 text-sm">
              <p className="font-medium text-[#1F2430]">{draft.medicationCodeableConcept?.text}</p>
              <p className="text-xs text-[#4F5E70]">Draft saved. Run a safety review before signing.</p>
            </div>

            {!evaluation && (
              <Button onClick={handleRunSafetyReview} disabled={submitting}>
                {submitting ? "Reviewing..." : "Run Safety Review"}
              </Button>
            )}

            {evaluation && (
              <div className="space-y-2">
                {evaluation.cards.length === 0 ? (
                  <p className="text-sm text-[#2F7A4C]">No conflicts detected from available data.</p>
                ) : (
                  evaluation.cards.map((card, i) => (
                    <div key={i} className="rounded-md border border-[#F5DAA7] bg-[#FFF4DD] p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={card.indicator === "critical" ? "destructive" : "warning"}>
                          {card.indicator === "critical" ? "High priority" : "Warning"}
                        </Badge>
                        <span className="text-sm font-medium text-[#1F2430]">{card.summary}</span>
                      </div>
                      <p className="whitespace-pre-line text-xs text-[#4F5E70]">{card.detail}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Close
              </Button>
              <Button onClick={handleSignNow} disabled={submitting || !evaluation}>
                {submitting ? "Signing..." : "Sign order"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
