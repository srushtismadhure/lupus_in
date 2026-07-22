import { Database, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FhirProvenance } from "@/lib/renal-response";

export function RenalProvenance({ items }: { items: Array<FhirProvenance | undefined> }) {
  const provenance = items.filter((item): item is FhirProvenance => Boolean(item));
  if (provenance.length === 0) return null;

  return (
    <details className="mt-4 rounded-md border border-[#DCE6F0] bg-[#F8FAFD] px-3 py-2 text-xs text-[#4F5E70]">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#344054] outline-none focus-visible:ring-[3px] focus-visible:ring-[#78B7E3]/45">
        <Database className="size-3.5" aria-hidden="true" />
        FHIR provenance
      </summary>
      <div className="mt-3 space-y-2">
        {provenance.map((item, index) => (
          <div key={`${item.resourceType}-${item.resourceId ?? index}`} className="grid gap-1 border-t border-[#E4EAF0] pt-2 first:border-0 first:pt-0 sm:grid-cols-[150px_1fr]">
            <span className="font-medium text-[#344054]">{item.resourceType}</span>
            <span>
              {item.display}
              {item.code ? ` · ${item.code}` : ""}
              {item.effectiveDate ? ` · ${item.effectiveDate.slice(0, 10)}` : ""}
              {item.status ? ` · ${item.status}` : ""}
            </span>
          </div>
        ))}
        <Badge variant="neutral" className="mt-1 gap-1">
          <ShieldCheck className="size-3" aria-hidden="true" />
          Synthetic data
        </Badge>
      </div>
    </details>
  );
}
