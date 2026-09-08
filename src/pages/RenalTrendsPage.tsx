import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, CalendarDays, ChevronRight, Microscope, Pill, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConditionsCard } from "@/components/clinical/ConditionsCard";
import { ImmunologicActivityCard } from "@/components/clinical/ImmunologicActivityCard";
import { KidneyTrendChart } from "@/components/clinical/KidneyTrendChart";
import { RenalProvenance } from "@/components/clinical/RenalProvenance";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientSubNav } from "@/components/patients/PatientSubNav";
import {
  getPatient,
  getPatientConditions,
  getPatientDiagnosticReports,
  getPatientMedicationAdministrations,
  getPatientMedicationRequests,
  getPatientObservations,
} from "@/lib/fhir";
import { PATHOLOGY_FINDINGS, RENAL_DATES } from "@/lib/madison-class-iv-data";
import { resolvePathologyImage } from "@/lib/renal-pathology-images";
import {
  buildRenalResponseModel,
  type InflammationComparison,
  type MedicationExposure,
  type RenalMetricSeries,
  type RenalResponseModel,
  type RenalResponseResources,
  type RenalSeriesPoint,
} from "@/lib/renal-response";

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function fullDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function valueAt(series: RenalMetricSeries | undefined, date: string): RenalSeriesPoint | undefined {
  return series?.points.find(point => point.date === date);
}

function formatValue(point: RenalSeriesPoint | undefined): string {
  if (!point) return "—";
  return `${point.value}${point.unit ? ` ${point.unit}` : ""}`;
}

const TIMELINE_EVENTS: Partial<Record<(typeof RENAL_DATES)[number], string[]>> = {
  "2025-07-15": ["Renal flare", "Kidney biopsy", "Class IV diagnosis", "Induction treatment"],
  "2025-10-15": ["Belimumab escalation"],
  "2026-01-15": ["Partial renal response"],
  "2026-07-15": ["Approaching complete response"],
};

function SharedTimeline({ model }: { model: RenalResponseModel }) {
  const rows = [model.series.egfr, model.series.upcr, model.series.albumin].filter((series): series is RenalMetricSeries => Boolean(series));
  const medications = model.medications;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Renal response timeline</CardTitle>
        <p className="text-xs text-[color:var(--muted-foreground)]">Independent clinical lanes aligned to one shared date axis</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[980px]" role="table" aria-label="Renal response and treatment timeline">
            <div className="grid grid-cols-[170px_repeat(6,minmax(120px,1fr))] border-b border-[var(--border)] text-xs font-semibold text-[color:var(--muted-foreground)]" role="row">
              <div className="px-3 py-2" role="columnheader">Lane</div>
              {RENAL_DATES.map(date => (
                <div key={date} className="border-l border-[var(--muted)] px-2 py-2 text-center" role="columnheader">{displayDate(date)}</div>
              ))}
            </div>

            {rows.map(series => (
              <div key={series.key} className="grid grid-cols-[170px_repeat(6,minmax(120px,1fr))] border-b border-[var(--border)]" role="row">
                <div className="px-3 py-3" role="rowheader">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{series.key === "albumin" ? "Serum albumin" : series.key === "egfr" ? "eGFR" : "UPCR"}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">{series.unit}</p>
                </div>
                {RENAL_DATES.map(date => {
                  const point = valueAt(series, date);
                  return (
                    <div key={date} className="relative flex min-h-16 items-center justify-center border-l border-[var(--muted)] px-2 text-center" role="cell" title={point ? `${series.display}, ${fullDate(date)}. FHIR Observation, final, synthetic.` : undefined}>
                      {point && <span className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border)]" aria-hidden="true" />}
                      <span className="relative z-10 rounded-full border border-[var(--info-border)] bg-white px-2 py-1 text-xs font-semibold text-[color:var(--foreground)] shadow-sm">
                        {point ? point.value : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="grid grid-cols-[170px_repeat(6,minmax(120px,1fr))] border-b border-[var(--border)] bg-[var(--warning-bg)]" role="row">
              <div className="px-3 py-3" role="rowheader">
                <p className="text-sm font-semibold text-[color:var(--warning-text)]">Clinical events</p>
              </div>
              {RENAL_DATES.map(date => (
                <div key={date} className="min-h-20 border-l border-[var(--yellow)] px-2 py-2" role="cell">
                  <div className="space-y-1">
                    {(TIMELINE_EVENTS[date] ?? []).map(event => (
                      <div key={event} className="flex items-start gap-1.5 text-[11px] leading-4 text-[color:var(--warning-text)]">
                        <span className="mt-1 size-1.5 shrink-0 rotate-45 bg-[var(--yellow)]" aria-hidden="true" />
                        {event}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {medications.map(medication => (
              <MedicationLane key={`${medication.name}-${medication.startDate}`} medication={medication} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function nearestDateIndex(date: string | undefined, fallback: number): number {
  if (!date) return fallback;
  const exact = RENAL_DATES.findIndex(item => item === date.slice(0, 10));
  if (exact >= 0) return exact;
  const target = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return RENAL_DATES.reduce(
    (best, item, index) =>
      Math.abs(Date.parse(`${item}T00:00:00Z`) - target) < Math.abs(Date.parse(`${RENAL_DATES[best]}T00:00:00Z`) - target) ? index : best,
    fallback,
  );
}

function MedicationLane({ medication }: { medication: MedicationExposure }) {
  const start = nearestDateIndex(medication.startDate, 0);
  const end = nearestDateIndex(medication.endDate, RENAL_DATES.length - 1);
  const isPulse = medication.administrationDates.length > 0;
  const isPrednisone = medication.name.toLowerCase() === "prednisone";
  const isRecurring = medication.name.toLowerCase() === "belimumab";

  return (
    <div className="grid grid-cols-[170px_repeat(6,minmax(120px,1fr))] border-b border-[var(--border)] last:border-0" role="row">
      <div className="px-3 py-3" role="rowheader">
        <p className="text-xs font-semibold text-[color:var(--foreground)]">{medication.name}</p>
        <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">{medication.status}</p>
      </div>
      {RENAL_DATES.map((date, index) => {
        const period = medication.dosePeriods.find(item => nearestDateIndex(item.start, 0) === index);
        const active = index >= start && index <= end;
        return (
          <div key={date} className="flex min-h-14 items-center justify-center border-l border-[var(--muted)] px-1" role="cell">
            {isPulse ? (
              index === start ? (
                <div className="flex gap-1" title="Three IV methylprednisolone pulses">
                  {medication.administrationDates.map(pulse => <span key={pulse} className="size-2.5 rotate-45 bg-[#B45B70]" aria-hidden="true" />)}
                </div>
              ) : null
            ) : isPrednisone && period ? (
              <span className="w-full rounded bg-[#F5E9ED] px-1.5 py-1 text-center text-[10px] font-medium text-[#874255]" title={period.doseText}>
                {period.doseText.match(/[\d,.]+ mg/)?.[0] ?? "taper"}
              </span>
            ) : active ? (
              <span
                className={`h-2.5 w-full ${isRecurring ? "border-y-2 border-dotted border-[var(--clinical-blue)]" : "rounded-full bg-[var(--primary)]"}`}
                title={`${medication.name} treatment period`}
                aria-label={`${medication.name} active`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function KidneyReserveCard({ model }: { model: RenalResponseModel }) {
  const reserve = model.kidneyReserve;
  if (!reserve) return null;
  const marker = (value: number) => `${Math.max(0, Math.min(100, (value / 120) * 100))}%`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kidney reserve</CardTitle>
        <p className="text-xs text-[color:var(--muted-foreground)]">Recovery from flare-associated eGFR loss</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Pre-flare eGFR", reserve.preFlare],
            ["Flare nadir", reserve.nadir],
            ["Current eGFR", reserve.current],
            ["Recovered loss", `${reserve.recoveredLoss} of ${reserve.totalLoss}`],
            ["Recovery", `${reserve.recoveryPercentage ?? "—"}%`],
            ["Residual loss", `${reserve.residualLoss}`],
          ].map(([label, value]) => (
            <div key={label} className="border-l-2 border-[var(--info-border)] pl-3 first:border-[var(--brand)]">
              <p className="text-[11px] font-medium uppercase text-[color:var(--muted-foreground)]">{label}</p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="relative h-8 overflow-hidden rounded-md border border-[var(--border)]" aria-label={`eGFR reserve: pre-flare ${reserve.preFlare}, nadir ${reserve.nadir}, current ${reserve.current}`}>
            <div className="absolute inset-y-0 left-0 w-[25%] bg-[#FCEBEC]" />
            <div className="absolute inset-y-0 left-[25%] w-[25%] bg-[var(--warning-bg)]" />
            <div className="absolute inset-y-0 left-[50%] right-0 bg-[var(--success-bg)]" />
            {[
              [reserve.preFlare, "Pre-flare", "var(--brand)"],
              [reserve.nadir, "Nadir", "#C84F5C"],
              [reserve.current, "Current", "var(--success)"],
            ].map(([value, label, color]) => (
              <span key={label} className="absolute inset-y-0 w-0.5" style={{ left: marker(Number(value)), backgroundColor: String(color) }} title={`${label}: ${value}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-3 text-xs text-[color:var(--muted-foreground)]">
            <span>Recent slope: <strong className="text-[color:var(--foreground)]">{reserve.recentSlope}</strong></span>
            <span>Residual loss: {reserve.residualLoss} mL/min/1.73 m²</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DumbbellRow({ row }: { row: InflammationComparison }) {
  const numeric = typeof row.flare.value === "number" && typeof row.latest.value === "number";
  const flare = Number(row.flare.value);
  const latest = Number(row.latest.value);
  const low = numeric ? Math.min(flare, latest) : 0;
  const high = numeric ? Math.max(flare, latest) : 1;
  const span = high - low || 1;
  const flarePosition = numeric ? 10 + ((flare - low) / span) * 80 : 10;
  const latestPosition = numeric ? 10 + ((latest - low) / span) * 80 : 90;

  return (
    <div className="grid gap-3 border-b border-[var(--border)] py-4 last:border-0 lg:grid-cols-[180px_150px_1fr_150px_140px] lg:items-center">
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{row.display}</p>
        <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">{row.referenceRange ?? "Reference range not supplied"}</p>
      </div>
      <div className="text-sm text-[color:var(--muted-foreground)]">
        <span className="font-semibold text-[#874255]">{formatValue(row.flare)}</span>
        <p className="text-[11px] text-[color:var(--muted-foreground)]">Flare · {fullDate(row.flare.date)}</p>
      </div>
      <div className="relative h-7" role="img" aria-label={`${row.display} changed from ${formatValue(row.flare)} to ${formatValue(row.latest)}`}>
        <span className="absolute left-[10%] right-[10%] top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--border)]" />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#B45B70] bg-white" style={{ left: `${flarePosition}%` }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--success)] bg-white" style={{ left: `${latestPosition}%` }} />
      </div>
      <div className="text-sm text-[color:var(--muted-foreground)]">
        <span className="font-semibold text-[color:var(--success)]">{formatValue(row.latest)}</span>
        <p className="text-[11px] text-[color:var(--muted-foreground)]">Current · {fullDate(row.latest.date)}</p>
      </div>
      <Badge variant={row.interpretation === "Resolved" || row.interpretation === "Recovered" ? "success" : "info"}>{row.interpretation}</Badge>
    </div>
  );
}

function InflammationProfile({ model }: { model: RenalResponseModel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Renal inflammation profile</CardTitle>
        <p className="text-xs text-[color:var(--muted-foreground)]">Each row uses an independent scale; values with different units are not combined.</p>
      </CardHeader>
      <CardContent>
        {model.inflammation.map(row => <DumbbellRow key={row.key} row={row} />)}
      </CardContent>
    </Card>
  );
}

function BiopsyDetail({ model }: { model: RenalResponseModel }) {
  if (!model.diagnosis) return null;
  const image = resolvePathologyImage(model.diagnosis.lupusNephritisClass);
  const lesionKeys = new Set(PATHOLOGY_FINDINGS.filter(item => !["class", "activity-index", "chronicity-index"].includes(item.key)).map(item => item.key));
  const lesions = model.pathologyFindings.filter(item => lesionKeys.has(item.key));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Biopsy detail</CardTitle>
        <p className="text-xs text-[color:var(--muted-foreground)]">Single documented renal biopsy · {fullDate(model.diagnosis.biopsyDate)}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <div>
            {image && (
              <figure>
                <img src={image} alt="Synthetic Class IV pathology illustration; not actual patient tissue" className="aspect-square w-full rounded-md border border-[var(--info-border)] object-cover" />
                <figcaption className="mt-2 text-xs text-[color:var(--muted-foreground)]">Synthetic Class IV pathology illustration — not actual patient tissue</figcaption>
              </figure>
            )}
            <Alert variant="warning" className="mt-4">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>No repeat biopsy documented.</AlertDescription>
            </Alert>
          </div>
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <IndexBar label="Activity index" value={model.activityIndex ?? 0} high={24} color="#B45B70" description="Activity represents potentially treatment-responsive inflammation." />
              <IndexBar label="Chronicity index" value={model.chronicityIndex ?? 0} high={12} color="var(--brand)" description="Chronicity represents established structural damage." />
            </div>
            <div className="mt-5 grid gap-x-5 sm:grid-cols-2">
              {lesions.map(lesion => (
                <div key={lesion.key} className="border-b border-[var(--border)] py-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[color:var(--foreground)]">{lesion.display}</span>
                    <span className="shrink-0 font-semibold text-[color:var(--foreground)]">
                      {lesion.value}/{lesion.high ?? 3}{lesion.weightingFactor ? ` ×${lesion.weightingFactor}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(Number(lesion.value) / Number(lesion.high ?? 3)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs font-semibold uppercase text-[color:var(--muted-foreground)]">Pathology conclusion</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{model.pathologyReport?.conclusion ?? "Conclusion not reported"}</p>
            </div>
            <RenalProvenance items={[model.pathologyReport?.provenance, ...model.pathologyFindings.map(item => item.provenance)]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IndexBar({ label, value, high, color, description }: { label: string; value: number; high: number; color: string; description: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
        <p className="text-xl font-semibold text-[color:var(--foreground)]">{value}/{high}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className="h-full rounded-full" style={{ width: `${(value / high) * 100}%`, backgroundColor: color }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function aroundStart(series: RenalMetricSeries | undefined, startDate: string | undefined): { at?: RenalSeriesPoint; current?: RenalSeriesPoint } {
  if (!series || !startDate) return {};
  const at = series.points.find(point => point.date === startDate.slice(0, 10)) ?? [...series.points].reverse().find(point => point.date <= startDate.slice(0, 10));
  return { at, current: series.points.at(-1) };
}

function MedicationTimeline({ model }: { model: RenalResponseModel }) {
  const [selected, setSelected] = useState<MedicationExposure | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Medication-response explorer</CardTitle>
        <p className="text-xs text-[color:var(--muted-foreground)]">Treatment exposure aligned with the same renal-response dates</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[220px_repeat(6,minmax(105px,1fr))] border-b border-[var(--border)] text-xs font-semibold text-[color:var(--muted-foreground)]">
              <div className="px-3 py-2">Medication</div>
              {RENAL_DATES.map(date => <div key={date} className="border-l border-[var(--muted)] px-2 py-2 text-center">{displayDate(date)}</div>)}
            </div>
            {model.medications.map(medication => (
              <button
                key={`${medication.name}-${medication.startDate}`}
                type="button"
                onClick={() => setSelected(medication)}
                className="grid w-full grid-cols-[220px_repeat(6,minmax(105px,1fr))] border-b border-[var(--border)] text-left outline-none last:border-0 hover:bg-[var(--background)] focus-visible:ring-[3px] focus-visible:ring-[var(--sky-blue)]/45"
                aria-label={`Open ${medication.name} treatment details`}
              >
                <span className="flex items-center justify-between gap-2 px-3 py-3 text-xs font-semibold text-[color:var(--foreground)]">
                  {medication.name}<ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
                {RENAL_DATES.map((date, index) => {
                  const startIndex = nearestDateIndex(medication.startDate, 0);
                  const endIndex = nearestDateIndex(medication.endDate, RENAL_DATES.length - 1);
                  const period = medication.dosePeriods.find(item => nearestDateIndex(item.start, 0) === index);
                  return (
                    <span key={date} className="flex min-h-14 items-center justify-center border-l border-[var(--muted)] px-1">
                      {medication.administrationDates.length > 0 ? (
                        index === startIndex ? <span className="flex gap-1">{medication.administrationDates.map(item => <span key={item} className="size-2.5 rotate-45 bg-[#B45B70]" />)}</span> : null
                      ) : period && medication.name === "Prednisone" ? (
                        <span className="w-full rounded bg-[#F5E9ED] px-1 py-1 text-center text-[10px] text-[#874255]">{period.doseText.match(/[\d,.]+ mg/)?.[0]}</span>
                      ) : index >= startIndex && index <= endIndex ? (
                        <span className={`h-2.5 w-full ${medication.name === "Belimumab" ? "border-y-2 border-dotted border-[var(--clinical-blue)]" : "rounded-full bg-[var(--primary)]"}`} />
                      ) : null}
                    </span>
                  );
                })}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--muted-foreground)]">
          <span className="flex items-center gap-2"><span className="h-2 w-8 rounded-full bg-[var(--primary)]" /> Continuous therapy</span>
          <span className="flex items-center gap-2"><span className="h-2 w-8 border-y-2 border-dotted border-[var(--clinical-blue)]" /> Recurring injection</span>
          <span className="flex items-center gap-2"><span className="size-2.5 rotate-45 bg-[#B45B70]" /> IV pulse</span>
          <span className="flex items-center gap-2"><span className="rounded bg-[#F5E9ED] px-2 text-[#874255]">dose</span> Stepped taper</span>
        </div>

        <MedicationDetailDialog model={model} medication={selected} onClose={() => setSelected(null)} />
      </CardContent>
    </Card>
  );
}

function MedicationDetailDialog({ model, medication, onClose }: { model: RenalResponseModel; medication: MedicationExposure | null; onClose: () => void }) {
  const comparisons = useMemo(() => {
    if (!medication) return [];
    return ["egfr", "upcr", "c3", "c4", "anti-dsdna"].map(key => ({ key, ...aroundStart(model.series[key], medication.startDate), label: model.series[key]?.display ?? key }));
  }, [medication, model.series]);
  return (
    <Dialog open={Boolean(medication)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {medication && (
          <>
            <DialogHeader>
              <DialogTitle>{medication.name}</DialogTitle>
              <DialogDescription>Observed renal measures around treatment initiation</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs uppercase text-[color:var(--muted-foreground)]">Start</p><p className="mt-1 text-sm font-semibold">{medication.startDate ? fullDate(medication.startDate) : "Not reported"}</p></div>
              <div><p className="text-xs uppercase text-[color:var(--muted-foreground)]">Current dose</p><p className="mt-1 text-sm font-semibold">{medication.currentDose ?? "Completed pulse therapy"}</p></div>
              <div><p className="text-xs uppercase text-[color:var(--muted-foreground)]">Status</p><p className="mt-1 text-sm font-semibold capitalize">{medication.status}</p></div>
            </div>
            <div className="rounded-md border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--background)] text-xs text-[color:var(--muted-foreground)]">
                  <tr><th className="px-3 py-2 font-medium">Measure</th><th className="px-3 py-2 font-medium">At or before initiation</th><th className="px-3 py-2 font-medium">Current</th></tr>
                </thead>
                <tbody>
                  {comparisons.map(item => (
                    <tr key={item.key} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-medium text-[color:var(--foreground)]">{item.label}</td>
                      <td className="px-3 py-2 text-[color:var(--muted-foreground)]">{formatValue(item.at)}</td>
                      <td className="px-3 py-2 text-[color:var(--muted-foreground)]">{formatValue(item.current)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-[var(--info-border)] bg-[var(--blue-panel)] p-3 text-sm text-[color:var(--link)]">
              <p className="font-semibold">Observed after medication initiation</p>
              <p className="mt-1 text-xs leading-5">Temporal association does not establish medication causality.</p>
            </div>
            <div className="text-sm text-[color:var(--muted-foreground)]"><strong>Reason:</strong> {medication.reason ?? "Not reported"}</div>
            <RenalProvenance items={[medication.provenance]} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SurveillanceView({ resources }: { resources: RenalResponseResources }) {
  return (
    <div className="space-y-5">
      <Alert variant="warning">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <AlertDescription>
          <strong>Renal Surveillance:</strong> Confirmed active systemic lupus erythematosus is documented, but no explicit lupus-nephritis diagnosis or ISN/RPS class is present. No pathology illustration is shown.
        </AlertDescription>
      </Alert>
      <div className="grid gap-5 xl:grid-cols-2">
        <KidneyTrendChart observations={resources.observations} />
        <ImmunologicActivityCard observations={resources.observations} />
      </div>
      <ConditionsCard conditions={resources.conditions} />
    </div>
  );
}

export function RenalTrendsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [resources, setResources] = useState<RenalResponseResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [patient, conditions, diagnosticReports, observations, medicationRequests, medicationAdministrations] = await Promise.all([
        getPatient(patientId),
        getPatientConditions(patientId),
        getPatientDiagnosticReports(patientId),
        getPatientObservations(patientId),
        getPatientMedicationRequests(patientId),
        getPatientMedicationAdministrations(patientId),
      ]);
      setResources({ patient, conditions, diagnosticReports, observations, medicationRequests, medicationAdministrations });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load renal trends.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (loading) return <AppShell title="Renal Trends"><p className="text-sm text-[color:var(--muted-foreground)]">Loading renal trends...</p></AppShell>;
  if (error || !resources) {
    return (
      <AppShell title="Renal Trends">
        <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3"><span>{error ?? "Unable to load renal trends."}</span><Button variant="outline" size="sm" onClick={() => setReloadKey(key => key + 1)}>Retry</Button></AlertDescription></Alert>
      </AppShell>
    );
  }

  const model = buildRenalResponseModel(resources);
  return (
    <AppShell title="Renal Trends" subtitle={model.mode === "renal-response" ? "Longitudinal renal response, pathology, inflammation and treatment exposure" : "Renal surveillance for systemic lupus erythematosus"}>
      <PatientHeader
        patient={resources.patient}
        conditions={resources.conditions}
        onCreateTask={() => navigate(`/patients/${patientId}`)}
        onAddClinicalNote={() => navigate(`/patients/${patientId}/notes-coding`)}
        onPatientUpdated={() => setReloadKey(key => key + 1)}
      />
      {patientId && <PatientSubNav patientId={patientId} />}
      {model.mode === "renal-surveillance" ? (
        <SurveillanceView resources={resources} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--info-border)] bg-[var(--background)] px-4 py-3 text-sm text-[color:var(--brand)]">
            <Microscope className="size-4" aria-hidden="true" />
            <strong>{model.diagnosis?.classification}</strong>
            <span className="text-[color:var(--muted-foreground)]">·</span>
            <span>Activity {model.activityIndex}/24</span>
            <span className="text-[color:var(--muted-foreground)]">·</span>
            <span>Chronicity {model.chronicityIndex}/12</span>
            <Badge variant="neutral" className="ml-auto">Synthetic demo data</Badge>
          </div>
          <SharedTimeline model={model} />
          <KidneyReserveCard model={model} />
          <InflammationProfile model={model} />
          <BiopsyDetail model={model} />
          <MedicationTimeline model={model} />
        </div>
      )}
    </AppShell>
  );
}
