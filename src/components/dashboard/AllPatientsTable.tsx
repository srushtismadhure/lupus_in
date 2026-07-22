import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { WorklistPatientView } from "@/lib/worklist-types";

function monitoringBadge(status: WorklistPatientView["monitoringStatus"]) {
  if (status === "overdue") return <Badge variant="warning">Overdue</Badge>;
  if (status === "insufficient-data") return <Badge variant="neutral">Insufficient data</Badge>;
  return <Badge variant="info">Current</Badge>;
}

function formatObservationCell(value: WorklistPatientView["latestUpcr"]): string {
  if (!value) return "Not available";
  return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
}

interface AllPatientsTableProps {
  patients: WorklistPatientView[];
  onEdit: (patient: fhir4.Patient) => void;
  onDeactivate: (patient: fhir4.Patient) => void;
}

export function AllPatientsTable({ patients, onEdit, onDeactivate }: AllPatientsTableProps) {
  const navigate = useNavigate();

  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E4E7EC] text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Age</th>
            <th className="px-4 py-3 font-medium">Primary condition</th>
            <th className="px-4 py-3 font-medium">Latest UPCR</th>
            <th className="px-4 py-3 font-medium">Latest eGFR</th>
            <th className="px-4 py-3 font-medium">Monitoring</th>
            <th className="px-4 py-3 font-medium">Open tasks</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map(view => (
            <tr
              key={view.patient.id}
              tabIndex={0}
              role="button"
              aria-label={`Open patient ${view.name}`}
              className="cursor-pointer border-b border-[#E4E7EC] outline-none transition-colors last:border-0 hover:bg-[#EAF5FC] focus-visible:bg-[#EAF5FC] focus-visible:ring-2 focus-visible:ring-[#78B7E3] focus-visible:ring-inset"
              onClick={() => navigate(`/patients/${view.patient.id}`)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/patients/${view.patient.id}`);
                }
              }}
            >
              <td className="px-4 py-3 font-medium text-foreground">{view.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{view.age ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{view.primaryConditionText ?? "Not available"}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatObservationCell(view.latestUpcr)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatObservationCell(view.latestEgfr)}</td>
              <td className="px-4 py-3">{monitoringBadge(view.monitoringStatus)}</td>
              <td className="px-4 py-3 text-muted-foreground">{view.openTaskCount}</td>
              <td className="px-4 py-3">
                {view.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
              </td>
              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/patients/${view.patient.id}`)}>Open patient</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(view.patient)}>Edit patient</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDeactivate(view.patient)} disabled={!view.active}>
                      Deactivate patient
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
