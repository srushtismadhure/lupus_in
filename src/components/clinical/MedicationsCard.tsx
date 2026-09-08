import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMedicationText } from "@/lib/formatters";

export function MedicationsCard({ medicationRequests }: { medicationRequests: fhir4.MedicationRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Medications</CardTitle>
      </CardHeader>
      <CardContent>
        {medicationRequests.length === 0 && (
          <p className="text-sm text-muted-foreground">No medication requests available</p>
        )}
        <ul className="space-y-2">
          {medicationRequests.map(medicationRequest => (
            <li key={medicationRequest.id} className="border-b border-[var(--border)] pb-2 last:border-0">
              <p className="text-sm font-medium text-foreground">{formatMedicationText(medicationRequest)}</p>
              <p className="text-xs text-muted-foreground">
                {medicationRequest.status} / {medicationRequest.intent}
                {medicationRequest.dosageInstruction?.[0]?.text ? ` · ${medicationRequest.dosageInstruction[0].text}` : ""}
                {medicationRequest.authoredOn ? ` · authored ${medicationRequest.authoredOn}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
