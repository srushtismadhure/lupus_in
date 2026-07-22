import { CalendarClock, Check, Circle, CircleSlash, ExternalLink, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CarePathway } from "@/lib/care-coordination/types";
import { PathwayEvidence } from "./PathwayEvidence";
import { PathwayStatusBadge } from "./PathwayStatusBadge";

function displayDate(value?: string): string {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function ChecklistIcon({ state }: { state: CarePathway["checklist"][number]["state"] }) {
  if (state === "completed") return <Check className="size-4 text-[#2F7A4C]" aria-hidden="true" />;
  if (state === "not-applicable") return <CircleSlash className="size-4 text-[#718096]" aria-hidden="true" />;
  return <Circle className={`size-4 ${state === "blocked" ? "text-[#B63D4F]" : "text-[#8A641F]"}`} aria-hidden="true" />;
}

export function PathwayCard({ pathway, onReview }: { pathway: CarePathway; onReview: (pathway: CarePathway) => void }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base leading-6 text-[#1F2430]">{pathway.title}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PathwayStatusBadge status={pathway.status} />
              <span className="rounded-full bg-[#EEF2F6] px-2.5 py-1 text-xs font-semibold capitalize text-[#445160]">{pathway.urgency} priority</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-[#4F5E70]">
            <UserRound className="size-4" aria-hidden="true" />
            {pathway.owner}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 py-5">
        <section aria-labelledby={`${pathway.id}-reason`}>
          <h3 id={`${pathway.id}-reason`} className="text-sm font-semibold text-[#1F2430]">Why this is here</h3>
          <p className="mt-1.5 text-sm leading-6 text-[#4F5E70]">{pathway.reason}</p>
          <div className="mt-3"><PathwayEvidence evidence={pathway.evidence} ruleId={pathway.sourceRuleId} ruleVersion={pathway.ruleVersion} /></div>
        </section>

        <div className="grid gap-4 rounded-lg bg-[#F8FAFD] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#697586]">Referral</p>
            <p className="mt-1 text-sm font-semibold text-[#1F2430]">{pathway.destination ?? "Destination not selected"}</p>
            <p className="mt-1 text-xs text-[#4F5E70]">Ordering clinician: {pathway.orderingClinician ?? "Awaiting review"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#697586]">Coordination</p>
            <p className="mt-1 text-sm font-semibold text-[#1F2430]">Owner: {pathway.owner}</p>
            <p className={`mt-1 text-xs ${pathway.overdue ? "font-semibold text-[#8B2D3B]" : "text-[#4F5E70]"}`}>Due: {displayDate(pathway.dueDate)}{pathway.overdue ? " · Overdue" : ""}</p>
          </div>
        </div>

        {pathway.missingRequirements.length > 0 && (
          <div className="rounded-lg border border-[#E6C784] bg-[#FFF9EB] px-3 py-2.5 text-sm text-[#6F4A13]">
            <strong>Missing:</strong> {pathway.missingRequirements.join(", ")}
          </div>
        )}

        <section aria-labelledby={`${pathway.id}-progress`}>
          <h3 id={`${pathway.id}-progress`} className="text-sm font-semibold text-[#1F2430]">Pathway progress</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {pathway.checklist.map(item => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-[#4F5E70]">
                <ChecklistIcon state={item.state} />
                <span>{item.label}</span>
                <span className="sr-only">Status: {item.state}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6ECF2] pt-4">
          <div className="flex items-center gap-2 text-sm text-[#4F5E70]">
            <CalendarClock className="size-4" aria-hidden="true" />
            <span><strong className="text-[#1F2430]">Next:</strong> {pathway.nextAction}</span>
          </div>
          {pathway.requiresClinicianApproval ? (
            <Button type="button" onClick={() => onReview(pathway)} className="min-h-11">Review and refer</Button>
          ) : pathway.pathwayType === "kidney-transplant-evaluation" || pathway.pathwayType === "dialysis-planning" ? (
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/kidney-services?tab=${pathway.pathwayType === "kidney-transplant-evaluation" ? "transplant" : "dialysis"}`}>
                <ExternalLink className="size-4" aria-hidden="true" />
                Compare services
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

