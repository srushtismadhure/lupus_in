import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  filterObservationsByLoinc,
  getLatestObservation,
  getObservationEffectiveDate,
  getObservationInterpretation,
  LOINC_CODES,
} from "@/lib/fhir-observations";

function abnormalInterpretation(interpretation: string | undefined): boolean {
  if (!interpretation) return false;
  const normalized = interpretation.toLowerCase();
  return normalized.includes("high") || normalized.includes("low") || normalized.includes("abnormal");
}

function ImmunologyRow({ label, observation }: { label: string; observation?: fhir4.Observation }) {
  if (!observation || observation.valueQuantity?.value === undefined) {
    return (
      <div className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">Not available</span>
      </div>
    );
  }

  const interpretation = getObservationInterpretation(observation);
  const date = getObservationEffectiveDate(observation);

  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className="text-sm font-medium text-foreground">
          {observation.valueQuantity.value}
          {observation.valueQuantity.unit ? ` ${observation.valueQuantity.unit}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {date ?? "Unknown date"}
          {interpretation ? ` · ${interpretation}` : ""}
        </p>
      </div>
    </div>
  );
}

export function ImmunologicActivityCard({ observations }: { observations: fhir4.Observation[] }) {
  const c3 = getLatestObservation(filterObservationsByLoinc(observations, LOINC_CODES.complementC3));
  const c4 = getLatestObservation(filterObservationsByLoinc(observations, LOINC_CODES.complementC4));
  const dsDna = getLatestObservation(filterObservationsByLoinc(observations, LOINC_CODES.antiDsDna));

  const anyAbnormal = [c3, c4, dsDna].some(
    observation => observation !== undefined && abnormalInterpretation(getObservationInterpretation(observation)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Immunologic Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ImmunologyRow label="Complement C3" observation={c3} />
        <ImmunologyRow label="Complement C4" observation={c4} />
        <ImmunologyRow label="Anti-dsDNA" observation={dsDna} />

        {anyAbnormal && (
          <p className="mt-3 rounded-md bg-[var(--info-bg)] px-3 py-2 text-xs text-[color:var(--brand)]">
            Laboratory pattern requires clinician review.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
