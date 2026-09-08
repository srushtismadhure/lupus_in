import { ChevronRight, FileSearch } from "lucide-react";
import type { CareEvidence } from "@/lib/care-coordination/types";

function displayDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function PathwayEvidence({ evidence, ruleId, ruleVersion }: { evidence: CareEvidence[]; ruleId?: string; ruleVersion?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {evidence.length === 0 ? (
          <p className="text-sm text-[color:var(--muted-foreground)]">Supporting evidence was not available.</p>
        ) : (
          evidence.slice(0, 5).map((item, index) => (
            <span key={`${item.resourceReference ?? item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--info-border)] bg-[var(--blue-panel)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--link)]">
              <FileSearch className="size-3.5" aria-hidden="true" />
              {item.label}{item.value ? `: ${item.value}` : ""}{displayDate(item.date) ? ` · ${displayDate(item.date)}` : ""}
            </span>
          ))
        )}
      </div>
      <details className="group border-t border-[var(--border)] pt-3 text-sm">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 font-semibold text-[color:var(--brand)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary)]/35">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
          Technical evidence
        </summary>
        <div className="mt-2 space-y-2 rounded-md bg-[var(--background)] p-3 text-xs text-[color:var(--muted-foreground)]">
          {ruleId && <p><strong>Rule:</strong> {ruleId} {ruleVersion ? `v${ruleVersion}` : ""}</p>}
          {evidence.map((item, index) => (
            <p key={`${item.resourceReference ?? item.label}-technical-${index}`}>
              <strong>{item.resourceReference ?? "Unreferenced evidence"}</strong>
              {item.code ? ` · ${item.codeSystem ?? "coding system not supplied"}|${item.code}` : ""}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

