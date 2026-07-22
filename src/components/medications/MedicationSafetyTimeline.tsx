import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { filterObservationsByLoinc, getObservationEffectiveDate, LOINC_CODES, sortObservationsByDate } from "@/lib/fhir-observations";

type RangeOption = "3M" | "6M" | "12M" | "ALL";

const RANGE_DAYS: Record<Exclude<RangeOption, "ALL">, number> = { "3M": 90, "6M": 180, "12M": 365 };

interface TimelineEvent {
  date: string;
  type: "medication-start" | "medication-stop" | "task" | "assessment" | "reconciliation";
  label: string;
  source: string;
}

interface ChartPoint {
  date: string;
  upcr?: number;
  egfr?: number;
}

function buildChartData(observations: fhir4.Observation[]): ChartPoint[] {
  const upcrObservations = sortObservationsByDate(filterObservationsByLoinc(observations, LOINC_CODES.upcr));
  const egfrObservations = sortObservationsByDate(filterObservationsByLoinc(observations, LOINC_CODES.egfr));
  const pointsByDate = new Map<string, ChartPoint>();

  for (const observation of upcrObservations) {
    const date = getObservationEffectiveDate(observation);
    if (!date || observation.valueQuantity?.value === undefined) continue;
    const point = pointsByDate.get(date) ?? { date };
    point.upcr = observation.valueQuantity.value;
    pointsByDate.set(date, point);
  }
  for (const observation of egfrObservations) {
    const date = getObservationEffectiveDate(observation);
    if (!date || observation.valueQuantity?.value === undefined) continue;
    const point = pointsByDate.get(date) ?? { date };
    point.egfr = observation.valueQuantity.value;
    pointsByDate.set(date, point);
  }

  return Array.from(pointsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function withinRange(dateIso: string, range: RangeOption): boolean {
  if (range === "ALL") return true;
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return Date.parse(dateIso) >= cutoff;
}

const EVENT_LABELS: Record<TimelineEvent["type"], string> = {
  "medication-start": "Medication started",
  "medication-stop": "Medication stopped",
  task: "Task",
  assessment: "Symptom assessment",
  reconciliation: "Reconciliation",
};

export function MedicationSafetyTimeline({ observations, events }: { observations: fhir4.Observation[]; events: TimelineEvent[] }) {
  const [range, setRange] = useState<RangeOption>("ALL");

  const chartData = useMemo(() => buildChartData(observations).filter(p => withinRange(p.date, range)), [observations, range]);
  const visibleEvents = useMemo(
    () => events.filter(e => withinRange(e.date, range)).sort((a, b) => b.date.localeCompare(a.date)),
    [events, range],
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#1F2430]">Medication safety timeline</h2>
        <div className="flex gap-1">
          {(["3M", "6M", "12M", "ALL"] as RangeOption[]).map(option => (
            <Button
              key={option}
              size="sm"
              variant={range === option ? "default" : "outline"}
              aria-pressed={range === option}
              onClick={() => setRange(option)}
            >
              {option === "ALL" ? "All" : option}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">UPCR and eGFR over time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 && <p className="text-sm text-[#4F5E70]">No UPCR or eGFR results available in this range.</p>}
          {chartData.length === 1 && <p className="text-sm text-[#4F5E70]">More longitudinal results are needed to calculate a trend.</p>}
          {chartData.length > 1 && (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E8EDF2" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4F5E70" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#4F5E70" }} />
                  <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #D2E9F7", fontSize: 12 }} />
                  <Line type="monotone" dataKey="upcr" name="UPCR" stroke="#3F1D63" strokeWidth={2} dot connectNulls={false} />
                  <Line type="monotone" dataKey="egfr" name="eGFR" stroke="#78B7E3" strokeWidth={2} dot connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Medication and care events</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleEvents.length === 0 ? (
            <p className="text-sm text-[#4F5E70]">No dated medication or care events in this range.</p>
          ) : (
            <ul className="space-y-2">
              {visibleEvents.map((event, index) => (
                <li key={`${event.source}-${index}`} className="flex items-center gap-3 border-b border-[#E3EAF2] pb-2 text-sm last:border-0">
                  <Badge variant="info">{EVENT_LABELS[event.type]}</Badge>
                  <span className="text-[#1F2430]">{event.label}</span>
                  <span className="ml-auto text-xs text-[#4F5E70]">{event.date}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-2 text-xs text-[#4F5E70]">
        Symptom reported after medication start reflects temporal proximity only. Temporal relationship requires clinician review; medication
        causality is not established by this timeline.
      </p>
    </section>
  );
}

export type { TimelineEvent };
