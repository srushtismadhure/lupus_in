import { useNavigate } from "react-router-dom";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MedicationManagementCard({ patientId }: { patientId: string }) {
  const navigate = useNavigate();

  return (
    <Card className="border-t-2 border-t-[#3F1D63]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="size-4 text-[#3F1D63]" />
          Medication Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[#4F5E70]">
          Review the active regimen, medication safety conflicts, reconciliation issues, and monitoring gaps for this patient.
        </p>
        <Button size="sm" onClick={() => navigate(`/patients/${patientId}/medications`)}>
          Open Medication Management
        </Button>
      </CardContent>
    </Card>
  );
}
