import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterObservationsByLoinc, getObservationEffectiveDate, LOINC_CODES, sortObservationsByDate } from "@/lib/fhir-observations";

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

export function KidneyTrendChart({ observations }: { observations: fhir4.Observation[] }) {
  const data = buildChartData(observations);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kidney Response Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 && <p className="text-sm text-muted-foreground">No UPCR or eGFR results available yet.</p>}
        {data.length === 1 && (
          <p className="text-sm text-muted-foreground">More longitudinal results are needed to calculate a trend.</p>
        )}
        {data.length > 1 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--info-border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="upcr" name="UPCR" stroke="var(--chart-1)" strokeWidth={2} dot connectNulls={false} />
                <Line type="monotone" dataKey="egfr" name="eGFR" stroke="var(--chart-2)" strokeWidth={2} dot connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
