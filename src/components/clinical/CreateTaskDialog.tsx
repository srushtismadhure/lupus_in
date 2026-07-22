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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createTask } from "@/lib/fhir";
import { getTodayDateString, isFutureDateString } from "@/lib/validation";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, patientId, onCreated }: CreateTaskDialogProps) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("routine");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overdueWarning = dueDate && !isFutureDateString(dueDate) && dueDate !== getTodayDateString();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!description.trim()) {
      setError("Enter a task description.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createTask({
        resourceType: "Task",
        status: "requested",
        intent: "order",
        description: description.trim(),
        priority: priority as fhir4.Task["priority"],
        for: { reference: `Patient/${patientId}` },
        authoredOn: new Date().toISOString(),
        ...(dueDate ? { restriction: { period: { end: dueDate } } } : {}),
      });

      toast.success("Task created.");
      setDescription("");
      setDueDate("");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Creates a FHIR Task referencing this patient.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} disabled={submitting} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={submitting}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="asap">ASAP</SelectItem>
                  <SelectItem value="stat">Stat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={submitting} />
              {overdueWarning && <p className="text-xs text-[#9A6418]">This due date is already overdue.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
