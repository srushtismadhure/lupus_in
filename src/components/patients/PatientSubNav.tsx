import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function PatientSubNav({ patientId }: { patientId: string }) {
  const items = [
    { to: `/patients/${patientId}`, label: "Overview", end: true },
    { to: `/patients/${patientId}/renal-timeline`, label: "Renal Trends", end: true },
    { to: `/patients/${patientId}/medications`, label: "Medications", end: true },
    { to: `/patients/${patientId}/notes-coding`, label: "Notes & Coding", end: true },
    { to: `/patients/${patientId}/referrals`, label: "Referrals", end: true },
    { to: `/patients/${patientId}/tasks`, label: "Tasks", end: true },
    { to: `/patients/${patientId}/fhir-evidence`, label: "FHIR Evidence", end: true },
  ];

  return (
    <nav className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#DCE6F0] bg-[#F8FAFD] p-1">
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-8 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-white text-[#3F1D63] shadow-sm" : "text-[#4F5E70] hover:text-[#1F2430]",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
