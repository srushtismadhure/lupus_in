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
    <Card className="gap-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#DCE6F0] bg-[#F8FAFD] text-xs uppercase text-[#4F5E70]">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Age</th>
              <th className="px-5 py-3 font-semibold">Primary condition</th>
              <th className="px-5 py-3 font-semibold">Latest UPCR</th>
              <th className="px-5 py-3 font-semibold">Latest eGFR</th>
              <th className="px-5 py-3 font-semibold">Monitoring</th>
              <th className="px-5 py-3 font-semibold">Open tasks</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.map(view => (
              <tr
                key={view.patient.id}
                tabIndex={0}
                role="button"
                aria-label={`Open patient ${view.name}`}
                className="cursor-pointer border-b border-[#E3EAF2] outline-none transition-colors last:border-0 hover:bg-[#F2F8FC] focus-visible:bg-[#F2F8FC] focus-visible:ring-2 focus-visible:ring-[#4F97C8] focus-visible:ring-inset"
                onClick={() => navigate(`/patients/${view.patient.id}`)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/patients/${view.patient.id}`);
                  }
                }}
              >
                <td className="px-5 py-4 font-semibold text-[#1F2430]">{view.name}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{view.age ?? "—"}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{view.primaryConditionText ?? "Not available"}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{formatObservationCell(view.latestUpcr)}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{formatObservationCell(view.latestEgfr)}</td>
                <td className="px-5 py-4">{monitoringBadge(view.monitoringStatus)}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{view.openTaskCount}</td>
                <td className="px-5 py-4">
                  {view.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                </td>
                <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
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
      </div>
    </Card>
  );
}
