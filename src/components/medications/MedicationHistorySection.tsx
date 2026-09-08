import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MedicationAdministrationView, MedicationRegimenItem, MedicationStatementView } from "@/lib/medication-types";

interface MedicationHistorySectionProps {
  inactiveOrders: MedicationRegimenItem[];
  statements: MedicationStatementView[];
  administrations: MedicationAdministrationView[];
}

export function MedicationHistorySection({ inactiveOrders, statements, administrations }: MedicationHistorySectionProps) {
  const hasAnyHistory = inactiveOrders.length > 0 || statements.length > 0 || administrations.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-[color:var(--foreground)]">Medication history</h2>

      {!hasAnyHistory ? (
        <Card className="border-dashed bg-[var(--background)]">
          <CardContent className="text-center text-sm text-[color:var(--muted-foreground)]">No medication history is available.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Prior orders (MedicationRequest)</CardTitle>
            </CardHeader>
            <CardContent>
              {inactiveOrders.length === 0 ? (
                <p className="text-xs text-[color:var(--muted-foreground)]">No prior orders.</p>
              ) : (
                <ul className="space-y-2">
                  {inactiveOrders.map(item => (
                    <li key={item.id} className="border-b border-[var(--border)] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[color:var(--foreground)]">{item.medicationText}</span>
                        <Badge variant="neutral">{item.status}</Badge>
                      </div>
                      <p className="text-[color:var(--muted-foreground)]">{item.startDate ?? "Not available"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Patient-reported use (MedicationStatement)</CardTitle>
            </CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <p className="text-xs text-[color:var(--muted-foreground)]">No patient-reported medication history is available.</p>
              ) : (
                <ul className="space-y-2">
                  {statements.map(s => (
                    <li key={s.id} className="border-b border-[var(--border)] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[color:var(--foreground)]">{s.medicationText}</span>
                        <Badge variant="neutral">{s.status}</Badge>
                      </div>
                      <p className="text-[color:var(--muted-foreground)]">
                        {s.dose ? `${s.dose} · ` : ""}
                        {s.dateAsserted ?? "Not available"}
                      </p>
                      {s.note && <p className="text-[color:var(--muted-foreground)]">{s.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Administered (MedicationAdministration)</CardTitle>
            </CardHeader>
            <CardContent>
              {administrations.length === 0 ? (
                <p className="text-xs text-[color:var(--muted-foreground)]">No administration records are available.</p>
              ) : (
                <ul className="space-y-2">
                  {administrations.map(a => (
                    <li key={a.id} className="border-b border-[var(--border)] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[color:var(--foreground)]">{a.medicationText}</span>
                        <Badge variant="neutral">{a.status}</Badge>
                      </div>
                      <p className="text-[color:var(--muted-foreground)]">
                        {a.dose ? `${a.dose} · ` : ""}
                        {a.effectiveDate ?? "Not available"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
