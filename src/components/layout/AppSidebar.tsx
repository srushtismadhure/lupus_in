import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Building2, LayoutDashboard, Users, LineChart, Pill, ClipboardList, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import logo from "@/assets/images/logo.png";

type ConnectionStatus = "checking" | "connected" | "error";

function useFhirConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/fhir/Patient?_count=1")
      .then(response => {
        if (!cancelled) setStatus(response.ok ? "connected" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export function AppSidebar() {
  const connectionStatus = useFhirConnectionStatus();
  const { user } = useAuth();

  const dashboardHome = user?.role === "nurse" ? "/nurse" : "/clinician";

  const navItems = [
    { to: dashboardHome, label: "Dashboard", icon: LayoutDashboard, enabled: true, end: true },
    { to: "/patients", label: "Patients", icon: Users, enabled: true, end: false },
    { to: "#", label: "Renal Trends", icon: LineChart, enabled: false },
    { to: "/medications", label: "Medications", icon: Pill, enabled: true, end: false },
    { to: "/kidney-services", label: "Kidney Services", icon: Building2, enabled: true, end: false },
    { to: "#", label: "Care Coordination", icon: ClipboardList, enabled: false },
    { to: "#", label: "Clinical Trials", icon: FlaskConical, enabled: false },
  ];

  return (
    <aside className="min-h-screen w-60 shrink-0 self-stretch bg-[#2B123E] text-[#D7ECFA]">
      <div className="sticky top-0 flex h-screen flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 px-5 py-5 text-[#F7FBFF]">
            <img src={logo} alt="LoopedIn" className="size-6" />
            <span className="text-lg font-semibold">LoopedIn</span>
          </div>

          <nav className="mt-2 flex flex-col gap-0.5 px-3">
            {navItems.map(item =>
              item.enabled ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-white/[0.07] focus-visible:ring-[3px] focus-visible:ring-[#78B7E3]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2B123E]",
                      isActive ? "bg-[rgba(215,236,250,0.15)] text-[#F7FBFF]" : "bg-transparent text-[#D7ECFA]",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ) : (
                <div
                  key={item.label}
                  className="flex min-h-9 cursor-not-allowed items-center justify-between rounded-lg bg-transparent px-3 py-2 text-sm text-[#D7ECFA]/60"
                  title="Coming later"
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="size-4" />
                    {item.label}
                  </span>
                  <span className="text-[10px] uppercase">Soon</span>
                </div>
              ),
            )}
          </nav>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          {user && (
            <p className="mb-2 text-xs text-[#D7ECFA]">
              {user.role === "nurse" ? "RN Care Coordinator" : "Clinician"} · {user.displayName}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "size-2 rounded-full",
                connectionStatus === "connected" && "bg-[#4F9468]",
                connectionStatus === "error" && "bg-[#C84F5C]",
                connectionStatus === "checking" && "bg-white/30",
              )}
            />
            <span className="text-[#D7ECFA]">SMART on FHIR</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-[#F7FBFF]">
            {connectionStatus === "connected" && "Connected"}
            {connectionStatus === "error" && "Disconnected"}
            {connectionStatus === "checking" && "Checking..."}
          </p>
        </div>
      </div>
    </aside>
  );
}
