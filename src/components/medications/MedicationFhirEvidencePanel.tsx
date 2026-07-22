import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AllergyView, DetectedIssueView, MedicationAdministrationView, MedicationRegimenItem, MedicationStatementView } from "@/lib/medication-types";

interface EvidenceRow {
  resourceType: string;
  id?: string;
  code?: string;
  date?: string;
}

interface MedicationFhirEvidencePanelProps {
  medicationRequests: MedicationRegimenItem[];
  medicationStatements: MedicationStatementView[];
  medicationAdministrations: MedicationAdministrationView[];
  allergies: AllergyView[];
  detectedIssues: DetectedIssueView[];
}

export function MedicationFhirEvidencePanel({
  medicationRequests,
  medicationStatements,
  medicationAdministrations,
  allergies,
  detectedIssues,
}: MedicationFhirEvidencePanelProps) {
  const [open, setOpen] = useState(false);

  const rows: EvidenceRow[] = [
    ...medicationRequests.map(r => ({ resourceType: "MedicationRequest", id: r.id, code: r.medicationCode, date: r.startDate })),
    ...medicationStatements.map(r => ({ resourceType: "MedicationStatement", id: r.id, date: r.dateAsserted })),
    ...medicationAdministrations.map(r => ({ resourceType: "MedicationAdministration", id: r.id, date: r.effectiveDate })),
    ...allergies.map(r => ({ resourceType: "AllergyIntolerance", id: r.id })),
    ...detectedIssues.map(r => ({ resourceType: "DetectedIssue", id: r.id, code: r.ruleId, date: r.identifiedDateTime })),
  ];

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.resourceType] = (acc[row.resourceType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between text-left">
          <CardTitle className="text-base">FHIR evidence</CardTitle>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(counts).map(([resourceType, count]) => (
              <Badge key={resourceType} variant="info">
                {resourceType} · {count}
              </Badge>
            ))}
            {rows.length === 0 && <span className="text-sm text-[#4F5E70]">No medication-related resources found.</span>}
          </div>
          {rows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-[#E3EAF2]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E3EAF2] text-[#4F5E70]">
                    <th className="px-3 py-2 font-medium">Resource</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.resourceType}-${row.id ?? index}`} className="border-b border-[#E3EAF2] last:border-0">
                      <td className="px-3 py-1.5">{row.resourceType}</td>
                      <td className="px-3 py-1.5 font-mono">{row.id ?? "—"}</td>
                      <td className="px-3 py-1.5">{row.code ?? "—"}</td>
                      <td className="px-3 py-1.5">{row.date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
