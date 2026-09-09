import { CircleHelp } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";

const TOPICS = ["Understanding COPD", "Using inhalers correctly", "Managing oxygen safely", "Recognizing worsening symptoms", "Energy conservation", "Smoking cessation", "Pulmonary rehabilitation", "When to contact your care team"];

export function PortalEducationPage() {
  return <div><PortalPageHeader title="Education" subtitle="Short topics to review with your care team." icon={CircleHelp} /><div className="grid gap-4 md:grid-cols-2">{TOPICS.map(topic => <article key={topic} className="rounded-lg border border-[var(--border)] bg-white p-5"><h2 className="font-semibold">{topic}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">Ask your care team for the instructions that apply to you. Your record does not include a patient-specific handout for this topic yet.</p></article>)}</div></div>;
}
