import type { LucideIcon } from "lucide-react";

export function PortalPageHeader({ title, subtitle, icon: Icon, action }: { title: string; subtitle: string; icon: LucideIcon; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[color:var(--link)]"><Icon className="size-5" aria-hidden="true" /></span>
        <div><h1 className="text-2xl font-semibold leading-tight text-[color:var(--foreground)]">{title}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">{subtitle}</p></div>
      </div>
      {action}
    </header>
  );
}

