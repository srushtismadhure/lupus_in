import { useCallback, useState } from "react";
import { MessageCircle, Send, TriangleAlert } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPortalMessages, sendPortalMessage } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

const RECIPIENTS = ["Nephrology team", "Renal nurse", "Care coordinator", "Dietitian", "Transplant coordinator", "Medication questions", "Appointment questions"];

function dateTime(value?: string): string { if (!value) return "Date not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date); }

export function PortalMessagesPage() {
  const loader = useCallback(() => getPortalMessages(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  const [view, setView] = useState<"inbox" | "sent">("inbox");
  const [category, setCategory] = useState(RECIPIENTS[0]!);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const messages = data.messages.filter(item => item.direction === view);
  async function send() {
    if (!category || !subject.trim() || !message.trim()) { setFormError("Choose a recipient category and enter both a subject and message."); return; }
    setSending(true); setFormError(null); setSent(false);
    try { await sendPortalMessage(category, subject, message); setSubject(""); setMessage(""); setSent(true); setView("sent"); await retry(); }
    catch (err) { setFormError(err instanceof Error ? err.message : "Your message could not be sent."); }
    finally { setSending(false); }
  }
  return <div><PortalPageHeader title="Messages" subtitle="Send secure, non-emergency questions to your care team." icon={MessageCircle} /><PortalIncompleteData status={data.dataStatus} /><aside className="mb-5 rounded-lg border border-[#F0D49C] bg-[#FFF9EC] p-4"><p className="flex items-start gap-2 text-sm font-semibold text-[#6F4A13]"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />Messages are not monitored for emergencies.</p><p className="mt-1 pl-7 text-sm text-[#755723]">Response timing depends on your organization’s care-team workflow. This demo does not promise an exact response time.</p></aside>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]"><section aria-labelledby="message-list-heading"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="message-list-heading" className="text-lg font-semibold">Your messages</h2><div className="inline-flex rounded-lg border border-[#CCDCE9] bg-white p-1" role="group" aria-label="Message view"><button type="button" onClick={() => setView("inbox")} aria-pressed={view === "inbox"} className={`min-h-10 rounded-md px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40 ${view === "inbox" ? "bg-[#43205F] text-white" : "text-[#526172]"}`}>Inbox</button><button type="button" onClick={() => setView("sent")} aria-pressed={view === "sent"} className={`min-h-10 rounded-md px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40 ${view === "sent" ? "bg-[#43205F] text-white" : "text-[#526172]"}`}>Sent</button></div></div><div className="mt-3 space-y-3">{messages.length === 0 ? <PortalEmptyState title={`No ${view} messages are available yet.`} /> : messages.map(item => <article key={item.id} className="rounded-lg border border-[#DCE6F0] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold text-[#1F2430]">{item.subject}</h3><time className="text-xs text-[#697586]" dateTime={item.sent}>{dateTime(item.sent)}</time></div><p className="mt-1 text-xs font-semibold text-[#526172]">{item.sender}</p><p className="mt-3 text-sm leading-6 text-[#344253]">{item.preview}</p></article>)}</div></section>
      <section className="rounded-lg border border-[#DCE6F0] bg-white p-5" aria-labelledby="new-message-heading"><h2 id="new-message-heading" className="text-lg font-semibold">New message</h2><p className="mt-1 text-sm text-[#526172]">Do not include an emergency request here.</p><div className="mt-4 space-y-4"><div><Label htmlFor="message-recipient">Care-team recipient</Label><select id="message-recipient" value={category} onChange={event => setCategory(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#BFCFDC] bg-white px-3 text-sm">{RECIPIENTS.map(item => <option key={item}>{item}</option>)}</select></div><div><Label htmlFor="message-subject">Subject</Label><input id="message-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} className="mt-1 min-h-11 w-full rounded-lg border border-[#BFCFDC] px-3 text-sm" required /></div><div><Label htmlFor="message-body">Message</Label><Textarea id="message-body" value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} rows={8} className="mt-1" required /></div>{formError && <p role="alert" className="text-sm font-semibold text-[#983344]">{formError}</p>}{sent && <p role="status" className="text-sm font-semibold text-[#2F6F47]">Your secure message was recorded.</p>}<Button type="button" className="min-h-11" onClick={send} disabled={sending}><Send aria-hidden="true" />{sending ? "Sending..." : "Send secure message"}</Button></div></section></div><div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}

