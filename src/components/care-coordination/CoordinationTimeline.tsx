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
      <CardHeader className="border-b border-[var(--border)] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-[color:var(--primary)]" aria-hidden="true" /> {title}</CardTitle></CardHeader>
      <CardContent className="px-5 py-5">
        {events.length === 0 ? <p className="text-sm text-[color:var(--muted-foreground)]">{emptyText}</p> : (
          <ol className="relative space-y-4 border-l border-[var(--input)] pl-5">
            {events.slice(0, 10).map(item => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-[var(--primary)]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.title}</p>
                {item.detail && <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">{item.detail}</p>}
                <time className="mt-1 block text-xs text-[color:var(--muted-foreground)]" dateTime={item.timestamp}>{dateTime(item.timestamp)}</time>
                {showResourceLinks && item.resourceReference && (
                  <a className="mt-1 inline-block text-xs font-semibold text-[color:var(--brand)] underline decoration-[var(--sky-blue)] underline-offset-2 hover:text-[color:var(--link)]" href={`/fhir/${item.resourceReference}`} target="_blank" rel="noreferrer">
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
