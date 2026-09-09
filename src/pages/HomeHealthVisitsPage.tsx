import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getClinicianWorklist } from "@/lib/worklist-client";
import { useCallback, useEffect, useState } from "react";
import type { ClinicianWorklistResponse } from "@/lib/worklist-types";

export function HomeHealthVisitsPage() {
  const [data, setData] = useState<ClinicianWorklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setData(await getClinicianWorklist()); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load home-health visits."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const patients = data?.allPatients.filter(view => view.hasCopd) ?? [];
  return <AppShell title="Home Health Visits" subtitle="COPD home-health visits and assessments."><div className="mb-5 flex justify-end"><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="size-4" />Refresh</Button></div>{error && <p className="text-sm text-[color:var(--destructive)]">{error}</p>}{loading ? <p className="text-sm text-[color:var(--muted-foreground)]">Loading visits...</p> : <Card className="gap-0 overflow-hidden py-0 shadow-none"><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[color:var(--brand)]"><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Visit type</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Visit status</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{patients.map(view => <tr key={view.patient.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-4 font-semibold text-[color:var(--brand)]">{view.name}</td><td className="px-4 py-4">Routine skilled nursing visit</td><td className="px-4 py-4 text-[color:var(--muted-foreground)]">Not scheduled</td><td className="px-4 py-4">Needs review</td><td className="px-4 py-4">Not started</td><td className="px-4 py-4"><Button asChild size="sm"><Link to={`/nurse/visits/${view.patient.id}`}>Start Visit</Link></Button></td></tr>)}</tbody></table></div></CardContent></Card>}</AppShell>;
}
