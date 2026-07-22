import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <AppShell title="Overview" subtitle="Patient-specific clinical overview">
      <Card className="border-dashed bg-[#F3F9FD]">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
          <p>Select a patient from Patients to view their clinical overview.</p>
          <Button size="sm" onClick={() => navigate("/patients")}>
            Go to Patients
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
