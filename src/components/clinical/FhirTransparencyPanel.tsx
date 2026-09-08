import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResourceRow {
  resourceType: string;
  id?: string;
  system?: string;
  code?: string;
  effectiveDate?: string;
}

function rowsFor(resourceType: string, resources: { id?: string }[], extractor: (resource: any) => Partial<ResourceRow>): ResourceRow[] {
  return resources.map(resource => ({ resourceType, id: resource.id, ...extractor(resource) }));
}

interface FhirTransparencyPanelProps {
  patient?: fhir4.Patient;
  conditions: fhir4.Condition[];
  observations: fhir4.Observation[];
  medicationRequests: fhir4.MedicationRequest[];
  tasks: fhir4.Task[];
}

export function FhirTransparencyPanel({ patient, conditions, observations, medicationRequests, tasks }: FhirTransparencyPanelProps) {
  const [open, setOpen] = useState(false);

  const rows: ResourceRow[] = [
    ...(patient ? [{ resourceType: "Patient", id: patient.id }] : []),
    ...rowsFor("Condition", conditions, (c: fhir4.Condition) => ({
      system: c.code?.coding?.[0]?.system,
      code: c.code?.coding?.[0]?.code,
      effectiveDate: c.onsetDateTime,
    })),
    ...rowsFor("Observation", observations, (o: fhir4.Observation) => ({
      system: o.code.coding?.[0]?.system,
      code: o.code.coding?.[0]?.code,
      effectiveDate: o.effectiveDateTime,
    })),
    ...rowsFor("MedicationRequest", medicationRequests, (m: fhir4.MedicationRequest) => ({
      system: m.medicationCodeableConcept?.coding?.[0]?.system,
      code: m.medicationCodeableConcept?.coding?.[0]?.code,
      effectiveDate: m.authoredOn,
    })),
    ...rowsFor("Task", tasks, (t: fhir4.Task) => ({ effectiveDate: t.authoredOn })),
  ];

  const resourceTypeCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.resourceType] = (acc[row.resourceType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-base">Why am I seeing this?</CardTitle>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(resourceTypeCounts).map(([resourceType, count]) => (
              <Badge key={resourceType} variant="info">
                {resourceType} · {count}
              </Badge>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Resource</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Coding</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.resourceType}-${row.id ?? index}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-1.5">{row.resourceType}</td>
                    <td className="px-3 py-1.5 font-mono">{row.id ?? "—"}</td>
                    <td className="px-3 py-1.5">{row.system && row.code ? `${row.system} ${row.code}` : row.code ?? "—"}</td>
                    <td className="px-3 py-1.5">{row.effectiveDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
