import { Activity, ArrowRight, Microscope, Pill, ShieldCheck, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RenalProvenance } from "@/components/clinical/RenalProvenance";
import { resolvePathologyImage } from "@/lib/renal-pathology-images";
import type { MedicationExposure, RenalMetricSeries, RenalResponseModel } from "@/lib/renal-response";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function latestNumeric(series: RenalMetricSeries | undefined): number | undefined {
  const value = series?.points.at(-1)?.value;
  return typeof value === "number" ? value : undefined;
}

function MiniTrend({ series, color, label }: { series: RenalMetricSeries; color: string; label: string }) {
  const data = series.points.filter(point => typeof point.value === "number").map(point => ({ date: point.date, value: point.value }));
  return (
    <div className="grid grid-cols-[82px_1fr] items-center gap-3">
      <div>
        <p className="text-sm font-semibold text-[#344054]">{label}</p>
        <p className="text-xs text-[#667085]">{series.unit}</p>
      </div>
      <div className="h-16 min-w-0" role="img" aria-label={`${label} trend from ${data[0]?.value} to ${data.at(-1)?.value}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 6, bottom: 4, left: 6 }}>
            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip
              formatter={value => [String(value ?? ""), label]}
              labelFormatter={date => formatDate(String(date))}
              contentStyle={{ border: "1px solid #DCE6F0", borderRadius: 6, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const REGIMEN_ORDER = ["Mycophenolate mofetil", "Belimumab", "Hydroxychloroquine", "Prednisone", "Losartan"];

function currentRegimen(medications: MedicationExposure[]): MedicationExposure[] {
  return medications
    .filter(medication => medication.status === "active" && REGIMEN_ORDER.includes(medication.name))
    .sort((a, b) => REGIMEN_ORDER.indexOf(a.name) - REGIMEN_ORDER.indexOf(b.name));
}

function HeroMetric({
  icon: Icon,
  title,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  title: string;
  value: string;
  detail: string;
  accent: "purple" | "blue" | "green" | "rose";
}) {
  const colors = {
    purple: "border-t-[#5B2A7D] bg-[#FBF9FC] text-[#5B2A7D]",
    blue: "border-t-[#4D94C5] bg-[#F7FBFE] text-[#245D86]",
    green: "border-t-[#4F9468] bg-[#F8FCF9] text-[#356A4A]",
    rose: "border-t-[#B45B70] bg-[#FFF9FA] text-[#874255]",
  };
  return (
    <Card className={`border-t-2 ${colors[accent]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </div>
        <p className="mt-3 text-xl font-semibold text-[#1F2937]">{value}</p>
        <p className="mt-1 text-xs leading-5 text-[#5D6878]">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function RenalResponseOverview({ model }: { model: RenalResponseModel }) {
  if (model.mode !== "renal-response" || !model.diagnosis || !model.kidneyReserve) return null;
  const pathologyImage = resolvePathologyImage(model.diagnosis.lupusNephritisClass);
  const upcr = latestNumeric(model.series.upcr);
  const egfr = latestNumeric(model.series.egfr);
  const regimen = currentRegimen(model.medications);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-[#D8CDE2]">
        <div className="grid lg:grid-cols-[1fr_300px]">
          <div className="p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">
                <Microscope className="size-3" aria-hidden="true" />
                Biopsy confirmed
              </Badge>
              <Badge variant="neutral">Synthetic demo patient</Badge>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[#1F2430]">{model.diagnosis.title}</h2>
            <p className="mt-1 text-lg font-medium text-[#4B2468]">{model.diagnosis.classification}</p>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-[#667085]">Activity index</dt>
                <dd className="mt-1 text-base font-semibold text-[#1F2937]">{model.activityIndex}/24</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-[#667085]">Chronicity index</dt>
                <dd className="mt-1 text-base font-semibold text-[#1F2937]">{model.chronicityIndex}/12</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-[#667085]">Biopsy date</dt>
                <dd className="mt-1 text-base font-semibold text-[#1F2937]">{formatDate(model.diagnosis.biopsyDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-[#667085]">Treatment phase</dt>
                <dd className="mt-1 text-base font-semibold text-[#1F2937]">{model.diagnosis.treatmentPhase}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-[#667085]">Renal response</dt>
                <dd className="mt-1 text-base font-semibold text-[#1F2937]">{model.diagnosis.renalResponse}</dd>
              </div>
            </dl>
            <RenalProvenance items={[model.diagnosis.provenance, model.pathologyReport?.provenance]} />
          </div>

          {pathologyImage && (
            <figure className="border-t border-[#E4DAEC] bg-[#F7F1F8] p-4 lg:border-t-0 lg:border-l">
              <img
                src={pathologyImage}
                alt="Synthetic Class IV pathology illustration; not actual patient tissue"
                className="aspect-square w-full rounded-md border border-[#D8CDE2] object-cover"
              />
              <figcaption className="mt-2 text-xs leading-5 text-[#5D5266]">
                Synthetic Class IV pathology illustration — not actual patient tissue
              </figcaption>
            </figure>
          )}
        </div>
      </Card>

      <section aria-labelledby="primary-metrics-heading">
        <h2 id="primary-metrics-heading" className="sr-only">Primary renal metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric
            icon={TrendingDown}
            title="Protein leakage"
            value={upcr !== undefined ? `UPCR ${upcr} g/g` : "Not reported"}
            detail={`Down ${model.proteinuriaReductionPercentage ?? 0}% from flare baseline`}
            accent="purple"
          />
          <HeroMetric
            icon={Activity}
            title="Kidney function"
            value={egfr !== undefined ? `eGFR ${egfr}` : "Not reported"}
            detail={`Residual loss: ${model.kidneyReserve.residualLoss} mL/min/1.73 m²`}
            accent="blue"
          />
          <HeroMetric icon={ShieldCheck} title="Renal inflammation" value="Improving" detail="C3/C4 recovering" accent="green" />
          <HeroMetric icon={Pill} title="Current treatment" value="MMF + belimumab" detail="Prednisone 5 mg/day" accent="rose" />
        </div>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Renal response snapshot</CardTitle>
            <p className="mt-1 text-xs text-[#667085]">Aligned preview of renal recovery and key treatment changes</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/patients/${model.patientId}/renal-timeline`}>
              Open Renal Trends <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {model.series.egfr && <MiniTrend series={model.series.egfr} color="#4D94C5" label="eGFR" />}
          {model.series.upcr && <MiniTrend series={model.series.upcr} color="#5B2A7D" label="UPCR" />}
          <div className="grid grid-cols-[82px_1fr] items-start gap-3 border-t border-[#E4EAF0] pt-3">
            <p className="text-sm font-semibold text-[#344054]">Markers</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="warning">Jul 2025 · Flare + biopsy</Badge>
              <Badge variant="purple">Jul 2025 · MMF</Badge>
              <Badge variant="info">Oct 2025 · Belimumab</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current regimen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[#E4EAF0]">
              {regimen.map(medication => (
                <li key={medication.name} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-[#1F2937]">{medication.name}</p>
                    <p className="mt-0.5 text-xs text-[#667085]">Started {medication.startDate ? formatDate(medication.startDate) : "date not reported"}</p>
                  </div>
                  <p className="max-w-[52%] text-right text-sm text-[#475467]">{medication.currentDose ?? "Dose not reported"}</p>
                </li>
              ))}
            </ul>
            <RenalProvenance items={regimen.map(medication => medication.provenance)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actionable clinical summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {model.clinicalSummary.map(statement => (
                <li key={statement} className="flex gap-3 text-sm leading-5 text-[#344054]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#5B2A7D]" aria-hidden="true" />
                  {statement}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
