import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientMedicationState } from "@/lib/medication-client";
import type { MedicationPatientState, MedicationRegimenItem } from "@/lib/medication-types";
import { getClinicianWorklist } from "@/lib/worklist-client";
import type { WorklistPatientView } from "@/lib/worklist-types";

interface MedicationWorklistRow {
  patient: WorklistPatientView;
  medicationState: MedicationPatientState;
  currentOrders: MedicationRegimenItem[];
  activeOrders: MedicationRegimenItem[];
  monitoringGapCount: number;
  monitoringCheckCount: number;
  detectedConflictCount: number;
  detectedConflictDenominator: number;
}

function CountCell({ value, denominator, suffix }: { value: number; denominator: number; suffix: string }) {
  return (
    <span className="inline-flex flex-col">
      <span className="font-semibold text-[#1F2430]">
        {value} / {denominator}
      </span>
      <span className="text-xs text-[#4F5E70]">{suffix}</span>
    </span>
  );
}

function flattenCurrentOrders(state: MedicationPatientState): MedicationRegimenItem[] {
  return Object.values(state.regimenByGroup).flat();
}

function buildRow(patient: WorklistPatientView, medicationState: MedicationPatientState): MedicationWorklistRow {
  const currentOrders = flattenCurrentOrders(medicationState);
  const activeOrders = currentOrders.filter(item => item.status === "active");
  const monitoringStatuses = currentOrders.flatMap(item => item.monitoring);
  const monitoringGapCount = monitoringStatuses.filter(status => status.status === "overdue").length;
  const detectedConflictDenominator = Math.max(medicationState.detectedIssues.length, medicationState.safetyCounts.conflicts);

  return {
    patient,
    medicationState,
    currentOrders,
    activeOrders,
    monitoringGapCount,
    monitoringCheckCount: monitoringStatuses.length,
    detectedConflictCount: medicationState.safetyCounts.conflicts,
    detectedConflictDenominator,
  };
}

export function MedicationsOverviewPage() {
  const [rows, setRows] = useState<MedicationWorklistRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const worklist = await getClinicianWorklist();
      const lupusNephritisPatients = worklist.allPatients.filter(patient => patient.active && patient.hasLupusNephritis && patient.patient.id);
      const medicationStates = await Promise.all(
        lupusNephritisPatients.map(patient => getPatientMedicationState(patient.patient.id ?? "")),
      );
      setRows(lupusNephritisPatients.map((patient, index) => buildRow(patient, medicationStates[index]!)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the medication worklist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <AppShell title="Medications" subtitle="Medication safety worklist for lupus-nephritis patients">
      {loading && (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E7F1F8]" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && rows && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="purple">{rows.length} lupus-nephritis patients</Badge>
              <span className="text-sm font-medium text-[#4F5E70]">Counts show numerator / denominator.</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>

          {rows.length === 0 ? (
            <Card className="border-dashed bg-[#F8FBFD]">
              <CardContent className="text-center text-sm font-medium text-[#4F5E70]">
                No active lupus-nephritis patients were found.
              </CardContent>
            </Card>
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#DCE6F0] bg-[#F8FAFD] text-xs uppercase text-[#4F5E70]">
                      <th className="px-5 py-3 font-semibold">Patient</th>
                      <th className="px-5 py-3 font-semibold">Active medication count</th>
                      <th className="px-5 py-3 font-semibold">Monitoring gaps</th>
                      <th className="px-5 py-3 font-semibold">Reconciliation issues</th>
                      <th className="px-5 py-3 font-semibold">Detected conflicts</th>
                      <th className="px-5 py-3 font-semibold">Open medication Tasks</th>
                      <th className="px-5 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.patient.patient.id} className="border-b border-[#E3EAF2] transition-colors last:border-0 hover:bg-[#F2F8FC]">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#1F2430]">{row.patient.name}</p>
                          <p className="mt-1 text-xs text-[#4F5E70]">{row.patient.primaryConditionText ?? "Lupus nephritis"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <CountCell value={row.activeOrders.length} denominator={row.currentOrders.length} suffix="current orders" />
                        </td>
                        <td className="px-5 py-4">
                          <CountCell value={row.monitoringGapCount} denominator={row.monitoringCheckCount} suffix="configured checks" />
                        </td>
                        <td className="px-5 py-4">
                          <CountCell
                            value={row.medicationState.safetyCounts.reconciliationIssues}
                            denominator={row.activeOrders.length}
                            suffix="active medications"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <CountCell value={row.detectedConflictCount} denominator={row.detectedConflictDenominator} suffix="detected issues" />
                        </td>
                        <td className="px-5 py-4">
                          <CountCell value={row.medicationState.safetyCounts.openTasks} denominator={row.activeOrders.length} suffix="active medications" />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/patients/${row.patient.patient.id}/medications`}>Open medications</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
