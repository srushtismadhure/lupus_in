import type { LucideIcon } from "lucide-react";
import { Activity, CalendarDays, CircleHelp, ClipboardList, House, Pill, Wind } from "lucide-react";

export interface PortalNavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const PORTAL_NAVIGATION: PortalNavigationItem[] = [
  { to: "/portal", label: "Home", icon: House, end: true },
  { to: "/portal/symptoms-breathing", label: "Symptoms & Breathing", icon: Wind },
  { to: "/portal/care-plan", label: "My Care Plan", icon: ClipboardList },
  { to: "/portal/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/portal/medications", label: "Medications", icon: Pill },
  { to: "/portal/home-health", label: "Home Health", icon: House },
  { to: "/portal/pulmonary-rehab", label: "Pulmonary Rehab", icon: Activity },
  { to: "/portal/education", label: "Education", icon: CircleHelp },
];

