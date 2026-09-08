import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SleSystemReview } from "@/lib/sle-systems-review/types";

export function SleAssessmentDialog({
  open,
  onOpenChange,
  system,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  system: SleSystemReview;
  onSubmit: (itemIds: string[], note?: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = system.checklist.filter(item => item.state !== "reviewed");

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setNote("");
    setError(null);
  }, [open, system.id]);

  async function submit() {
    if (selected.length === 0) {
      setError("Select at least one item that you reviewed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(selected, note.trim() || undefined);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assessment could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="sle-assessment-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-[color:var(--primary)]" aria-hidden="true" />Complete {system.title} assessment</DialogTitle>
          <DialogDescription id="sle-assessment-description">Mark only the items reviewed during this assessment. Unanswered items remain visible for a later visit.</DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="rounded-lg border border-[var(--mint)] bg-[var(--success-bg)] p-4 text-sm text-[color:var(--success)]">All structured items for this system are already marked as reviewed.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[color:var(--foreground)]">Items reviewed today</legend>
            {available.map(item => (
              <Label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--blue-panel)]">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={selected.includes(item.id)}
                  onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}
                />
                <span>{item.label}</span>
                <span className="ml-auto text-xs font-normal text-[color:var(--muted-foreground)]">{item.state === "documented" ? "Evidence documented" : "Evidence missing"}</span>
              </Label>
            ))}
          </fieldset>
        )}
        <div className="space-y-2">
          <Label htmlFor="sle-assessment-note">Optional clinician note</Label>
          <Textarea id="sle-assessment-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Document assessment context without copying unnecessary record content." />
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-[#983344]">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || available.length === 0}>{busy ? "Saving..." : "Save reviewed items"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

