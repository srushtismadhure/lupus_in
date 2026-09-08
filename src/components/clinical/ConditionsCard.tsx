import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatConditionText, isLupusNephritisCondition } from "@/lib/formatters";

function conditionCode(condition: fhir4.Condition): string | undefined {
  return condition.code?.coding?.[0]?.code;
}

export function ConditionsCard({ conditions }: { conditions: fhir4.Condition[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conditions</CardTitle>
      </CardHeader>
      <CardContent>
        {conditions.length === 0 && <p className="text-sm text-muted-foreground">No conditions available.</p>}
        <ul className="space-y-2">
          {conditions.map(condition => (
            <li key={condition.id} className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{formatConditionText(condition)}</span>
                  {isLupusNephritisCondition(condition) && <Badge variant="purple">Lupus nephritis</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {condition.clinicalStatus?.coding?.[0]?.code ?? "unknown status"}
                  {condition.verificationStatus?.coding?.[0]?.code ? ` · ${condition.verificationStatus.coding[0].code}` : ""}
                  {condition.onsetDateTime ? ` · onset ${condition.onsetDateTime}` : ""}
                  {conditionCode(condition) ? ` · ${conditionCode(condition)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
