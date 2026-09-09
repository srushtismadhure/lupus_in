import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getClinicianWorklist } from "@/lib/worklist-client";
import { getPatientMedicationState } from "@/lib/medication-client";
import { useEffect, useState } from "react";
import type { ClinicianWorklistResponse } from "@/lib/worklist-types";

export function NurseMedicationReconciliationPage() {
  const [data, setData] = useState<ClinicianWorklistResponse | null>(null);
  useEffect(() => { getClinicianWorklist().then(setData).catch(() => setData(null)); }, []);
  const patients = data?.allPatients.filter(view => view.hasCopd) ?? [];
  return <AppShell title="Medication Reconciliation" subtitle="Review COPD medication use reported during home-health care."><Card className="gap-0 overflow-hidden py-0 shadow-none"><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[color:var(--brand)]"><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Open tasks</th><th className="px-4 py-3">Medication state</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{patients.map(view => <tr key={view.patient.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-4 font-semibold text-[color:var(--brand)]">{view.name}</td><td className="px-4 py-4">{view.openTaskCount}</td><td className="px-4 py-4"><Badge variant={view.openTaskCount > 0 ? "warning" : "neutral"}>{view.openTaskCount > 0 ? "Needs review" : "Review patient record"}</Badge></td><td className="px-4 py-4"><Button asChild size="sm"><Link to={`/patients/${view.patient.id}/medications`}>Open Reconciliation</Link></Button></td></tr>)}</tbody></table></div></CardContent></Card><p className="mt-3 text-xs text-[color:var(--muted-foreground)]">Medication details are loaded from the existing MedicationRequest, MedicationStatement, and DetectedIssue architecture.</p></AppShell>;
}
