import { useNavigate } from "react-router-dom";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MedicationManagementCard({ patientId }: { patientId: string }) {
  const navigate = useNavigate();

  return (
    <Card className="border-t-2 border-t-[var(--brand)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="size-4 text-[color:var(--brand)]" />
          Medication Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Review the active regimen, medication safety conflicts, reconciliation issues, and monitoring gaps for this patient.
        </p>
        <Button size="sm" onClick={() => navigate(`/patients/${patientId}/medications`)}>
          Open Medication Management
        </Button>
      </CardContent>
    </Card>
  );
}
