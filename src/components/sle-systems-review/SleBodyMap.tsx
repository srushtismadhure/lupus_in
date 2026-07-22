import { cn } from "@/lib/utils";
import type { SleBodyRegionId, SleSystemId, SleSystemReview } from "@/lib/sle-systems-review/types";

const REGIONS: Array<{ id: SleBodyRegionId; label: string; systemId: SleSystemId; side: "left" | "right" }> = [
  { id: "brain", label: "Brain", systemId: "neuropsychiatric", side: "left" },
  { id: "eyes", label: "Eyes", systemId: "ophthalmic", side: "left" },
  { id: "oral-cavity", label: "Oral cavity", systemId: "mucocutaneous", side: "left" },
  { id: "skin", label: "Skin", systemId: "mucocutaneous", side: "left" },
  { id: "heart", label: "Heart", systemId: "cardiorespiratory", side: "left" },
  { id: "lungs", label: "Lungs", systemId: "cardiorespiratory", side: "left" },
  { id: "kidneys", label: "Kidneys", systemId: "renal", side: "right" },
  { id: "gi-tract", label: "GI tract", systemId: "gastrointestinal", side: "right" },
  { id: "joints", label: "Joints", systemId: "musculoskeletal", side: "right" },
  { id: "muscles", label: "Muscles", systemId: "musculoskeletal", side: "right" },
  { id: "blood", label: "Blood / hematologic", systemId: "hematologic", side: "right" },
  { id: "whole-body", label: "Whole body", systemId: "constitutional", side: "right" },
];

const STATUS_MARKER: Record<SleSystemReview["status"], string> = {
  "current-activity": "bg-[#65408A]",
  "possible-activity": "bg-[#65408A]",
  "historical-involvement": "bg-[#78B7E3]",
  "no-current-evidence": "bg-[#2F7A4C]",
  "assessment-incomplete": "bg-[#D3932E]",
  "monitoring-due": "bg-[#D3932E]",
  "unable-to-determine": "bg-[#8A96A6]",
};

function RegionButton({
  region,
  system,
  selected,
  onSelect,
}: {
  region: (typeof REGIONS)[number];
  system: SleSystemReview;
  selected: boolean;
  onSelect: (systemId: SleSystemId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(region.systemId)}
      aria-pressed={selected}
      aria-label={`${region.label}. ${system.statusLabel}. ${system.completenessLabel}. ${system.lastUpdated ? `Last updated ${system.lastUpdated}.` : "No update date available."} Click to review.`}
      title={`${system.statusLabel} - ${system.completenessLabel}`}
      className={cn(
        "group relative flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/45 focus-visible:ring-offset-2",
        selected
          ? "border-[#65408A] bg-[#F3EFF7] text-[#3F1D63]"
          : "border-[#DCE6F0] bg-white text-[#344253] hover:border-[#AFCFE7] hover:bg-[#F3F9FD]",
      )}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full border border-white shadow-sm", STATUS_MARKER[system.status])} aria-hidden="true" />
      <span className="min-w-0 leading-4">{region.label}</span>
      <span className="sr-only">{system.statusLabel}</span>
    </button>
  );
}

function Silhouette({ selected }: { selected: SleSystemId }) {
  const active = (system: SleSystemId) => selected === system ? "#65408A" : "#B9DCF4";
  return (
    <svg viewBox="0 0 180 430" className="mx-auto h-full max-h-[500px] w-full max-w-[210px]" role="img" aria-label="Front-facing body illustration. Use the labeled organ buttons to select a system.">
      <circle cx="90" cy="42" r="29" fill={selected === "constitutional" ? "#DCCDE7" : "#E8EEF4"} stroke="#8796A7" strokeWidth="2" />
      <path d="M68 74 C52 84 45 108 43 150 L29 242 C27 253 35 258 42 250 L58 178 L62 270 L52 404 C51 417 66 419 70 407 L89 292 L110 407 C114 419 129 417 128 404 L118 270 L122 178 L138 250 C145 258 153 253 151 242 L137 150 C135 108 128 84 112 74 Z" fill={selected === "constitutional" ? "#E8DFF0" : "#F0F4F8"} stroke="#8796A7" strokeWidth="2" />
      <ellipse cx="90" cy="34" rx="15" ry="10" fill={active("neuropsychiatric")} opacity="0.86" />
      <circle cx="81" cy="45" r="3.5" fill={active("ophthalmic")} /><circle cx="99" cy="45" r="3.5" fill={active("ophthalmic")} />
      <path d="M82 57 Q90 62 98 57" fill="none" stroke={active("mucocutaneous")} strokeWidth="4" strokeLinecap="round" />
      <path d="M66 112 Q75 92 88 118 L88 160 Q68 148 66 112" fill={active("cardiorespiratory")} opacity="0.72" />
      <path d="M114 112 Q105 92 92 118 L92 160 Q112 148 114 112" fill={active("cardiorespiratory")} opacity="0.72" />
      <path d="M91 124 C82 112 73 125 78 139 C82 150 91 157 91 157 C91 157 103 146 104 134 C105 124 98 117 91 124" fill={active("cardiorespiratory")} stroke="#FFFFFF" strokeWidth="1.5" />
      <ellipse cx="74" cy="184" rx="10" ry="16" fill={active("renal")} /><ellipse cx="106" cy="184" rx="10" ry="16" fill={active("renal")} />
      <path d="M78 212 C62 226 70 262 91 260 C114 260 120 226 102 213 C95 207 85 207 78 212" fill={active("gastrointestinal")} opacity="0.8" />
      <circle cx="55" cy="167" r="5" fill={active("musculoskeletal")} /><circle cx="125" cy="167" r="5" fill={active("musculoskeletal")} /><circle cx="62" cy="276" r="5" fill={active("musculoskeletal")} /><circle cx="118" cy="276" r="5" fill={active("musculoskeletal")} />
      <path d="M64 109 L54 227 M116 109 L126 227 M72 282 L64 392 M108 282 L116 392" stroke={active("musculoskeletal")} strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <g fill={active("hematologic")} opacity="0.75"><circle cx="90" cy="90" r="3" /><circle cx="83" cy="174" r="3" /><circle cx="98" cy="276" r="3" /><circle cx="69" cy="332" r="3" /></g>
      {selected === "mucocutaneous" && <path d="M68 74 C52 84 45 108 43 150 L29 242 M112 74 C128 84 135 108 137 150 L151 242" fill="none" stroke="#65408A" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}

export function SleBodyMap({ systems, selectedSystemId, onSelect }: { systems: SleSystemReview[]; selectedSystemId: SleSystemId; onSelect: (systemId: SleSystemId) => void }) {
  const byId = new Map(systems.map(system => [system.id, system]));
  const renderSide = (side: "left" | "right") => (
    <div className="grid content-center gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {REGIONS.filter(region => region.side === side).map(region => {
        const system = byId.get(region.systemId);
        return system ? <RegionButton key={region.id} region={region} system={system} selected={selectedSystemId === region.systemId} onSelect={onSelect} /> : null;
      })}
    </div>
  );

  return (
    <section aria-labelledby="body-map-heading" className="rounded-lg border border-[#DCE6F0] bg-white p-4 shadow-[0_8px_24px_rgba(31,36,48,0.05)]">
      <div className="mb-3">
        <h2 id="body-map-heading" className="text-base font-semibold text-[#1F2430]">Interactive body map</h2>
        <p className="mt-1 text-xs text-[#5B6878]">Select a labeled region to review its documented evidence and assessment gaps.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(118px,0.8fr)_minmax(150px,1fr)_minmax(118px,0.8fr)]">
        <div className="order-2 lg:order-1">{renderSide("left")}</div>
        <div className="order-1 flex min-h-[340px] items-center justify-center rounded-lg bg-[#F7FAFC] lg:order-2 lg:min-h-[500px]"><Silhouette selected={selectedSystemId} /></div>
        <div className="order-3">{renderSide("right")}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#E6ECF2] pt-3 text-xs text-[#4F5E70]" aria-label="Body map status legend">
        {[
          ["bg-[#65408A]", "Current or possible activity"],
          ["bg-[#78B7E3]", "Historical involvement"],
          ["bg-[#D3932E]", "Incomplete or due"],
          ["bg-[#2F7A4C]", "Assessment complete"],
          ["bg-[#8A96A6]", "Unable to determine"],
        ].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", color)} aria-hidden="true" />{label}</span>)}
      </div>
    </section>
  );
}

