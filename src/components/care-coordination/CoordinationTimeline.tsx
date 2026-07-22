import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoordinationEvent } from "@/lib/care-coordination/types";

type TimelineItem = Pick<CoordinationEvent, "id" | "timestamp" | "title" | "detail" | "resourceReference">;

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CoordinationTimeline({
  events,
  title = "Coordination timeline",
  emptyText = "No coordination events have been documented yet.",
  showResourceLinks = false,
}: {
  events: TimelineItem[];
  title?: string;
  emptyText?: string;
  showResourceLinks?: boolean;
}) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-[#65408A]" aria-hidden="true" /> {title}</CardTitle></CardHeader>
      <CardContent className="px-5 py-5">
        {events.length === 0 ? <p className="text-sm text-[#4F5E70]">{emptyText}</p> : (
          <ol className="relative space-y-4 border-l border-[#CCDCE9] pl-5">
            {events.slice(0, 10).map(item => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-[#65408A]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#1F2430]">{item.title}</p>
                {item.detail && <p className="mt-0.5 text-sm text-[#4F5E70]">{item.detail}</p>}
                <time className="mt-1 block text-xs text-[#697586]" dateTime={item.timestamp}>{dateTime(item.timestamp)}</time>
                {showResourceLinks && item.resourceReference && (
                  <a className="mt-1 inline-block text-xs font-semibold text-[#3F1D63] underline decoration-[#78B7E3] underline-offset-2 hover:text-[#245D86]" href={`/fhir/${item.resourceReference}`} target="_blank" rel="noreferrer">
                    Review FHIR evidence
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
