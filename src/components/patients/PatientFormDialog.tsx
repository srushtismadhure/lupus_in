import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createPatient, updatePatient, type PatientApiResult } from "@/lib/patients-api";
import type { PatientFormInput } from "@/lib/patient-input";
import { getTodayDateString, validateBirthDate, validateNamePart } from "@/lib/validation";

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  patient?: fhir4.Patient;
  onSaved: (patient: fhir4.Patient) => void;
}

function extractFormDefaults(patient?: fhir4.Patient): PatientFormInput {
  const officialName = patient?.name?.find(name => name.use === "official") ?? patient?.name?.[0];
  const phone = patient?.telecom?.find(t => t.system === "phone")?.value ?? "";
  const email = patient?.telecom?.find(t => t.system === "email")?.value ?? "";
  const address = patient?.address?.[0];

  return {
    givenName: officialName?.given?.[0] ?? "",
    familyName: officialName?.family ?? "",
    middleName: officialName?.given?.[1] ?? "",
    displayName: officialName?.text ?? "",
    birthDate: patient?.birthDate ?? "",
    gender: patient?.gender ?? "",
    identifier: patient?.identifier?.[0]?.value ?? "",
    phone,
    email,
    addressLine: address?.line?.[0] ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
  };
}

export function PatientFormDialog({ open, onOpenChange, mode, patient, onSaved }: PatientFormDialogProps) {
  const [form, setForm] = useState<PatientFormInput>(() => extractFormDefaults(patient));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(extractFormDefaults(patient));
      setFieldErrors({});
      setFormError(null);
      setAgeConfirmed(false);
    }
  }, [open, patient]);

  const birthDateCheck = form.birthDate ? validateBirthDate(form.birthDate) : undefined;

  function updateField<K extends keyof PatientFormInput>(field: K, value: PatientFormInput[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validateClientSide(): boolean {
    const errors: Record<string, string> = {};

    const given = validateNamePart(form.givenName);
    if (!given.valid) errors.givenName = "Enter a valid first name.";

    const family = validateNamePart(form.familyName);
    if (!family.valid) errors.familyName = "Enter a valid last name.";

    const dob = validateBirthDate(form.birthDate || "");
    if (!dob.valid) {
      errors.birthDate =
        dob.error === "future-date" ? "Date of birth cannot be in the future." : "Enter a valid date of birth.";
    } else if (dob.requiresAgeConfirmation && !ageConfirmed) {
      errors.birthDate = "This age is over 120 years — confirm this is correct.";
    }

    if (!form.gender) errors.gender = "Select a gender.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validateClientSide()) return;

    setSubmitting(true);
    setFormError(null);

    let result: PatientApiResult;
    if (mode === "create") {
      result = await createPatient(form);
    } else {
      result = await updatePatient(patient!.id!, form);
    }

    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 409) {
        setFormError(result.errorMessage ?? "A conflict occurred. Refresh and try again.");
      } else if (result.operationOutcome) {
        const nextFieldErrors: Record<string, string> = {};
        for (const issue of result.operationOutcome.issue) {
          const field = issue.expression?.[0];
          if (field && issue.diagnostics) nextFieldErrors[field] = issue.diagnostics;
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
        } else {
          setFormError(result.errorMessage ?? "Unable to save patient.");
        }
      } else {
        setFormError(result.errorMessage ?? "Unable to save patient.");
      }
      return;
    }

    toast.success(mode === "create" ? "Patient created successfully." : "Patient updated successfully.");
    onSaved(result.patient!);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Patient" : "Edit Patient"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Creates a real Patient resource on the connected FHIR server."
              : "Updates the existing Patient resource on the connected FHIR server."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="givenName">First name *</Label>
              <Input
                id="givenName"
                value={form.givenName}
                onChange={e => updateField("givenName", e.target.value)}
                aria-invalid={!!fieldErrors.givenName}
                disabled={submitting}
              />
              {fieldErrors.givenName && <p className="text-xs text-destructive">{fieldErrors.givenName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="familyName">Last name *</Label>
              <Input
                id="familyName"
                value={form.familyName}
                onChange={e => updateField("familyName", e.target.value)}
                aria-invalid={!!fieldErrors.familyName}
                disabled={submitting}
              />
              {fieldErrors.familyName && <p className="text-xs text-destructive">{fieldErrors.familyName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="middleName">Middle name</Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={e => updateField("middleName", e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Preferred display name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={e => updateField("displayName", e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">Date of birth *</Label>
              <Input
                id="birthDate"
                type="date"
                max={getTodayDateString()}
                value={form.birthDate}
                onChange={e => {
                  updateField("birthDate", e.target.value);
                  setAgeConfirmed(false);
                }}
                aria-invalid={!!fieldErrors.birthDate}
                disabled={submitting}
              />
              {fieldErrors.birthDate && <p className="text-xs text-destructive">{fieldErrors.birthDate}</p>}
              {birthDateCheck?.valid && birthDateCheck.requiresAgeConfirmation && !ageConfirmed && (
                <label className="mt-1 flex items-start gap-2 text-xs text-[color:var(--warning-text)]">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={e => setAgeConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  Age is over 120 years — confirm this date is correct.
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={form.gender} onValueChange={value => updateField("gender", value)} disabled={submitting}>
                <SelectTrigger id="gender" className="w-full" aria-invalid={!!fieldErrors.gender}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.gender && <p className="text-xs text-destructive">{fieldErrors.gender}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identifier">Patient identifier</Label>
            <Input
              id="identifier"
              placeholder="Leave blank to auto-generate a demo identifier"
              value={form.identifier}
              onChange={e => updateField("identifier", e.target.value)}
              disabled={submitting || mode === "edit"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={e => updateField("phone", e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => updateField("email", e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addressLine">Address line</Label>
            <Input id="addressLine" value={form.addressLine} onChange={e => updateField("addressLine", e.target.value)} disabled={submitting} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={e => updateField("city", e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={e => updateField("state", e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                value={form.postalCode}
                onChange={e => updateField("postalCode", e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : mode === "create" ? "Create Patient" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
