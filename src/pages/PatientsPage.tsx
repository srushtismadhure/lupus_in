import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { AllPatientsTable } from "@/components/dashboard/AllPatientsTable";
import { PatientFormDialog } from "@/components/patients/PatientFormDialog";
import { DeactivatePatientDialog } from "@/components/patients/DeactivatePatientDialog";
import { getClinicianWorklist } from "@/lib/worklist-client";
import type { ClinicianWorklistResponse } from "@/lib/worklist-types";

type PatientFilter = "all" | "lupus-nephritis" | "needs-review" | "monitoring-overdue" | "open-tasks" | "insufficient-data";

const FILTERS: { value: PatientFilter; label: string }[] = [
  { value: "all", label: "All patients" },
  { value: "lupus-nephritis", label: "Lupus nephritis" },
  { value: "needs-review", label: "Needs review" },
  { value: "monitoring-overdue", label: "Monitoring overdue" },
  { value: "open-tasks", label: "Open tasks" },
  { value: "insufficient-data", label: "Insufficient data" },
];

export function PatientsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ClinicianWorklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatientFilter>("all");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<fhir4.Patient | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<fhir4.Patient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const worklist = await getClinicianWorklist();
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filteredAllPatients = useMemo(() => {
    if (!data) return [];
    const trimmedQuery = query.trim().toLowerCase();

    return data.allPatients.filter(view => {
      if (!includeInactive && !view.active) return false;
      if (trimmedQuery && !view.name.toLowerCase().includes(trimmedQuery)) return false;

      switch (filter) {
        case "lupus-nephritis":
          return view.hasLupusNephritis;
        case "needs-review":
          return (
            view.primaryAttentionReason === "possible-worsening-renal-pattern" ||
            view.primaryAttentionReason === "requires-review" ||
            view.primaryAttentionReason === "serology-change"
          );
        case "monitoring-overdue":
          return view.monitoringStatus === "overdue";
        case "open-tasks":
          return view.openTaskCount > 0;
        case "insufficient-data":
          return view.monitoringStatus === "insufficient-data";
        default:
          return true;
      }
    });
  }, [data, query, filter, includeInactive]);

  return (
    <AppShell title="Patients" subtitle="FHIR-connected patient records">
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[#E7F1F8]" />
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

      {!loading && !error && data && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name..."
                className="h-10 w-full min-w-64 max-w-sm"
              />
              <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={filter === f.value ? "default" : "outline"}
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-medium text-[#4F5E70]">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={e => setIncludeInactive(e.target.checked)}
                  className="size-4 rounded border-[#AFCFE7] accent-[#43205F] outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/35 focus-visible:ring-offset-2"
                />
                Include inactive
              </label>
              <span className="text-sm font-medium text-[#4F5E70]">{filteredAllPatients.length} patients</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Create Patient
              </Button>
            </div>
          </div>

          {filteredAllPatients.length === 0 ? (
            <Card className="border-dashed bg-[#F8FBFD]">
              <CardContent className="text-center text-sm font-medium text-[#4F5E70]">No patients found.</CardContent>
            </Card>
          ) : (
            <AllPatientsTable patients={filteredAllPatients} onEdit={setEditPatient} onDeactivate={setDeactivateTarget} />
          )}
        </>
      )}

      <PatientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSaved={patient => {
          setRefreshKey(k => k + 1);
          if (patient.id) navigate(`/patients/${patient.id}`);
        }}
      />

      {editPatient && (
        <PatientFormDialog
          open={!!editPatient}
          onOpenChange={open => !open && setEditPatient(null)}
          mode="edit"
          patient={editPatient}
          onSaved={() => {
            setRefreshKey(k => k + 1);
            setEditPatient(null);
          }}
        />
      )}

      {deactivateTarget?.id && (
        <DeactivatePatientDialog
          open={!!deactivateTarget}
          onOpenChange={open => !open && setDeactivateTarget(null)}
          patientId={deactivateTarget.id}
          onDeactivated={() => {
            setRefreshKey(k => k + 1);
            setDeactivateTarget(null);
          }}
        />
      )}
    </AppShell>
  );
}
