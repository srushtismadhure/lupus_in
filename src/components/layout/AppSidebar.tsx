import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Activity, LineChart, Pill, ClipboardList, FlaskConical, Database } from "lucide-react";
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
    { to: "/overview", label: "Overview", icon: Activity, enabled: true, end: true },
    { to: "#", label: "Renal Trends", icon: LineChart, enabled: false },
    { to: "#", label: "Medications", icon: Pill, enabled: false },
    { to: "#", label: "Care Tasks", icon: ClipboardList, enabled: false },
    { to: "#", label: "Clinical Trials", icon: FlaskConical, enabled: false },
    { to: "#", label: "FHIR Data", icon: Database, enabled: false },
  ];

  return (
    <aside className="w-60 shrink-0 self-stretch bg-[#2D123F] text-[#B9DCF4]">
      <div className="sticky top-0 flex h-screen flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 px-5 py-5 text-[#F4FAFF]">
            <img src={logo} alt="LuppedIn" className="size-6" />
            <span className="text-lg font-semibold tracking-tight">LuppedIn</span>
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
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/[0.07]",
                      isActive ? "bg-[rgba(185,220,244,0.16)] text-[#F4FAFF]" : "bg-transparent text-[#B9DCF4]",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ) : (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center justify-between rounded-md bg-transparent px-3 py-2 text-sm text-[#B9DCF4]/45"
                  title="Coming later"
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="size-4" />
                    {item.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide">Soon</span>
                </div>
              ),
            )}
          </nav>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          {user && (
            <p className="mb-2 text-xs text-[#B9DCF4]">
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
            <span className="text-[#B9DCF4]">SMART on FHIR</span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-[#F4FAFF]">
            {connectionStatus === "connected" && "Connected"}
            {connectionStatus === "error" && "Disconnected"}
            {connectionStatus === "checking" && "Checking..."}
          </p>
        </div>
      </div>
    </aside>
  );
}
