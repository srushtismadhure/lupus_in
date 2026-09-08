import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.png";
import { PORTAL_NAVIGATION } from "./portal-navigation";

export function PortalSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--brand)] text-white lg:flex" aria-label="Patient portal navigation">
      <div className="flex items-center gap-3 px-6 py-6">
        <img src={logo} alt="" className="size-8" aria-hidden="true" />
        <div><p className="font-semibold text-[color:var(--card)]">LoopedIn</p><p className="text-xs text-[color:var(--sky-blue)]">Patient portal</p></div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {PORTAL_NAVIGATION.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--sidebar-foreground)] outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-[3px] focus-visible:ring-[var(--sky-blue)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand)]",
                  isActive && "bg-white/[0.16] text-white",
                )}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/10 px-6 py-5 text-xs leading-5 text-[color:var(--sidebar-foreground)]">
        <p className="flex items-center gap-2 font-semibold text-white"><ShieldCheck className="size-4 text-[color:var(--sky-blue)]" aria-hidden="true" />Private demo session</p>
        <p className="mt-1">Synthetic health information only.</p>
      </div>
    </aside>
  );
}

