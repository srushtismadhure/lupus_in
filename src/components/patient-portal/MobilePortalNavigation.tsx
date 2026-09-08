import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PORTAL_NAVIGATION } from "./portal-navigation";

const PRIMARY_PATHS = new Set(["/portal", "/portal/labs", "/portal/care-plan", "/portal/messages"]);

export function MobilePortalNavigation() {
  const [open, setOpen] = useState(false);
  const primary = PORTAL_NAVIGATION.filter(item => PRIMARY_PATHS.has(item.to));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--input)] bg-white px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_22px_rgba(31,36,48,0.08)] lg:hidden" aria-label="Primary patient portal navigation">
        {primary.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold text-[color:var(--muted-foreground)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary)]/40", isActive && "bg-[var(--info-bg)] text-[color:var(--link)]")}>
            <item.icon className="size-5" aria-hidden="true" /><span>{item.label === "My Care Plan" ? "Care Plan" : item.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold text-[color:var(--muted-foreground)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary)]/40" aria-label="Open all portal navigation">
          <Menu className="size-5" aria-hidden="true" /><span>More</span>
        </button>
      </nav>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Patient portal menu</DialogTitle><DialogDescription>Choose a section of your portal.</DialogDescription></DialogHeader>
          <nav aria-label="All patient portal navigation">
            <ul className="grid grid-cols-2 gap-2">
              {PORTAL_NAVIGATION.map(item => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => cn("flex min-h-12 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[color:var(--foreground)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary)]/40", isActive && "border-[var(--sky-blue)] bg-[var(--info-bg)] text-[color:var(--link)]")}>
                    <item.icon className="size-5" aria-hidden="true" /><span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}

