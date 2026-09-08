import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { getPortalLab } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

function dateOnly(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function PortalLabDetailPage() {
  const { resultId = "" } = useParams<{ resultId: string }>();
  const loader = useCallback(() => getPortalLab(resultId), [resultId]);
  const { data, loading, error, retry } = usePortalData(loader);
  const chartData = useMemo(() => data?.result.history.filter(item => typeof item.value === "number" && item.date).map(item => ({ date: item.date!.slice(0, 10), value: item.value as number })) ?? [], [data]);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const result = data.result;
  return (
    <div>
      <Link to="/portal/labs" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--brand)] underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Back to lab results</Link>
      <PortalPageHeader title={result.plainLanguageName} subtitle={result.name} icon={FlaskConical} />
      <PortalIncompleteData status={data.dataStatus} />
      <section className="rounded-lg border border-[var(--border)] bg-white p-5" aria-labelledby="latest-result-heading"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="latest-result-heading" className="text-sm font-semibold text-[color:var(--muted-foreground)]">Latest result</h2><p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">{result.value ?? "Not available"} <span className="text-base font-medium text-[color:var(--muted-foreground)]">{result.unit ?? ""}</span></p><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{dateOnly(result.date)}</p></div><div className="flex flex-col items-start gap-2"><PatientStatusBadge label={result.statusLabel} /><PatientStatusBadge label={result.reviewStatusLabel} /></div></div></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {[
          ["What this test checks", result.whatItChecks],
          ["What your result may mean", result.whatItMayMean],
          ["How it has changed", result.trendLabel],
          ["What may affect this result", "Medicines, hydration, recent illness, and laboratory methods may affect some results. Ask your care team which factors apply to you."],
          ["Your next step", result.nextStep],
          ["Questions for your care team", `Ask what this result means together with your other tests, whether follow-up is planned, and whether your care team has a separate target for you.`],
        ].map(([title, text]) => <section key={title} className="border-b border-[var(--border)] pb-5"><h2 className="font-semibold text-[color:var(--foreground)]">{title}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{text}</p></section>)}
      </div>
      <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5" aria-labelledby="trend-heading"><h2 id="trend-heading" className="text-lg font-semibold text-[color:var(--foreground)]">Result history</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{result.trendLabel}. Values are shown only when dates and comparable numeric units are available.</p>
        {chartData.length >= 2 ? <div className="mt-5"><div role="img" aria-label={`${result.plainLanguageName} trend chart. ${result.trendLabel}.`} className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 24, left: 4, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis unit={result.unit ? ` ${result.unit}` : undefined} tick={{ fontSize: 11 }} width={72} /><Tooltip /><Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--sky-blue)", stroke: "var(--link)", strokeWidth: 2, r: 4 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></div> : <p className="mt-4 rounded-lg bg-[var(--background)] p-4 text-sm text-[color:var(--muted-foreground)]">Not enough comparable results are available to draw a trend chart.</p>}
        <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)]"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">Accessible table of {result.plainLanguageName} result history</caption><thead className="bg-[var(--background)]"><tr><th scope="col" className="px-4 py-3 font-semibold">Date</th><th scope="col" className="px-4 py-3 font-semibold">Value</th><th scope="col" className="px-4 py-3 font-semibold">Unit</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{result.history.map(item => <tr key={item.id}><td className="px-4 py-3">{dateOnly(item.date)}</td><td className="px-4 py-3 font-semibold">{item.value ?? "Not available"}</td><td className="px-4 py-3">{item.unit ?? "Not provided"}</td></tr>)}</tbody></table></div>
      </section>
      <details className="mt-5 rounded-lg border border-[var(--border)] bg-white p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-[color:var(--brand)]">Medical details</summary><dl className="grid gap-3 pt-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Laboratory reference range</dt><dd className="mt-1 text-[color:var(--muted-foreground)]">{result.referenceRange?.text ?? ([result.referenceRange?.low, result.referenceRange?.high].filter(value => value !== undefined).join(" to ") || "Not provided")}</dd></div><div><dt className="font-semibold">Your care-team target</dt><dd className="mt-1 text-[color:var(--muted-foreground)]">{result.patientTarget?.text ?? "No separate target is documented"}</dd></div><div><dt className="font-semibold">Source</dt><dd className="mt-1 text-[color:var(--muted-foreground)]">{result.source}</dd></div><div><dt className="font-semibold">Result status</dt><dd className="mt-1 text-[color:var(--muted-foreground)]">{result.preliminary ? "Preliminary" : "Final or available"}</dd></div></dl></details>
      <div className="mt-5"><SourceAndDate source={result.source} date={result.date ?? undefined} /></div>
    </div>
  );
}
