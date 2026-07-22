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
      <h2 className="mb-3 text-base font-semibold text-[#1F2430]">Medication history</h2>

      {!hasAnyHistory ? (
        <Card className="border-dashed bg-[#F8FBFD]">
          <CardContent className="text-center text-sm text-[#4F5E70]">No medication history is available.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Prior orders (MedicationRequest)</CardTitle>
            </CardHeader>
            <CardContent>
              {inactiveOrders.length === 0 ? (
                <p className="text-xs text-[#4F5E70]">No prior orders.</p>
              ) : (
                <ul className="space-y-2">
                  {inactiveOrders.map(item => (
                    <li key={item.id} className="border-b border-[#E3EAF2] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1F2430]">{item.medicationText}</span>
                        <Badge variant="neutral">{item.status}</Badge>
                      </div>
                      <p className="text-[#4F5E70]">{item.startDate ?? "Not available"}</p>
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
                <p className="text-xs text-[#4F5E70]">No patient-reported medication history is available.</p>
              ) : (
                <ul className="space-y-2">
                  {statements.map(s => (
                    <li key={s.id} className="border-b border-[#E3EAF2] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1F2430]">{s.medicationText}</span>
                        <Badge variant="neutral">{s.status}</Badge>
                      </div>
                      <p className="text-[#4F5E70]">
                        {s.dose ? `${s.dose} · ` : ""}
                        {s.dateAsserted ?? "Not available"}
                      </p>
                      {s.note && <p className="text-[#4F5E70]">{s.note}</p>}
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
                <p className="text-xs text-[#4F5E70]">No administration records are available.</p>
              ) : (
                <ul className="space-y-2">
                  {administrations.map(a => (
                    <li key={a.id} className="border-b border-[#E3EAF2] pb-2 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1F2430]">{a.medicationText}</span>
                        <Badge variant="neutral">{a.status}</Badge>
                      </div>
                      <p className="text-[#4F5E70]">
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
