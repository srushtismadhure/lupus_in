import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Copy, ExternalLink, FileJson, MapPin, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createReferralPreview } from "@/lib/kidney-services/to-fhir-directory-bundle";
import type {
  DialysisFacility,
  FhirDirectoryBundle,
  KidneyServiceApiResponse,
  KidneyServiceRecord,
  KidneyServiceSearchResult,
  KidneyTransplantProgram,
  ReferralPreview,
} from "@/lib/kidney-services/types";

type TransplantResult = KidneyTransplantProgram & { distanceMiles?: number };
type DialysisResult = DialysisFacility & { distanceMiles?: number };
type ActiveTab = "transplant" | "dialysis";
type ModalityFilter = "all" | "in-center" | "peritoneal" | "home-hemodialysis";

interface DirectoryFilters {
  search: string;
  state: string;
  city: string;
  latitude: string;
  longitude: string;
  radiusMiles: string;
  limit: string;
  modality: ModalityFilter;
}

const INITIAL_FILTERS: DirectoryFilters = {
  search: "",
  state: "",
  city: "",
  latitude: "",
  longitude: "",
  radiusMiles: "",
  limit: "10",
  modality: "all",
};

function isDialysisRecord(record: KidneyServiceRecord): record is DialysisFacility {
  return record.source === "CMS";
}

function isTransplantRecord(record: KidneyServiceRecord): record is KidneyTransplantProgram {
  return record.source === "SRTR";
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not reported";
  return String(value);
}

function locationText(record: KidneyTransplantProgram | DialysisFacility): string {
  return [record.city, record.state].filter(Boolean).join(", ") || "Location not reported";
}

function addressText(facility: DialysisFacility): string {
  return [facility.address, facility.city, facility.state, facility.zipCode].filter(Boolean).join(", ") || "Not reported";
}

function supportedModalities(facility: DialysisFacility): string {
  const modalities = [
    facility.offersInCenterHemodialysis ? "In-center hemodialysis" : null,
    facility.offersPeritonealDialysis ? "Peritoneal dialysis" : null,
    facility.offersHomeHemodialysisTraining ? "Home hemodialysis training" : null,
  ].filter(Boolean);
  return modalities.length > 0 ? modalities.join(", ") : "Not reported";
}

function appendFilter(params: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) params.set(key, trimmed);
}

function buildQuery(filters: DirectoryFilters, tab: ActiveTab): string {
  const params = new URLSearchParams();
  appendFilter(params, "search", filters.search);
  appendFilter(params, "state", filters.state);
  appendFilter(params, "city", filters.city);
  appendFilter(params, "latitude", filters.latitude);
  appendFilter(params, "longitude", filters.longitude);
  appendFilter(params, "radiusMiles", filters.radiusMiles);
  appendFilter(params, "limit", filters.limit);
  if (tab === "dialysis" && filters.modality !== "all") params.set("modality", filters.modality);
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    let error = "Unable to load kidney services data.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) error = body.error;
    } catch {
      // keep default message
    }
    throw new Error(error);
  }
  return (await response.json()) as T;
}

function Metric({ label, value, title }: { label: string; value: string | number | null | undefined; title?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2" title={title}>
      <p className="text-xs font-semibold uppercase tracking-[0.02em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{displayValue(value)}</p>
    </div>
  );
}

function FilterControls({
  filters,
  tab,
  onChange,
  onRefresh,
}: {
  filters: DirectoryFilters;
  tab: ActiveTab;
  onChange: (next: DirectoryFilters) => void;
  onRefresh: () => void;
}) {
  const update = (key: keyof DirectoryFilters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <Card className="gap-4 p-0">
      <CardContent className="space-y-4 py-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_120px_160px_120px]">
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <Input
                value={filters.search}
                onChange={event => update("search", event.target.value)}
                placeholder={tab === "transplant" ? "Program, city, or center code" : "Facility, city, ZIP, or CCN"}
                className="pl-9"
              />
            </div>
          </label>
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>State</span>
            <Input value={filters.state} onChange={event => update("state", event.target.value)} placeholder="CA" maxLength={2} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>City</span>
            <Input value={filters.city} onChange={event => update("city", event.target.value)} placeholder="Los Angeles" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>Limit</span>
            <Select value={filters.limit} onValueChange={value => update("limit", value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[120px_120px_140px_minmax(180px,1fr)_auto]">
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>Latitude</span>
            <Input value={filters.latitude} onChange={event => update("latitude", event.target.value)} inputMode="decimal" placeholder="34.05" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>Longitude</span>
            <Input value={filters.longitude} onChange={event => update("longitude", event.target.value)} inputMode="decimal" placeholder="-118.24" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
            <span>Radius miles</span>
            <Input value={filters.radiusMiles} onChange={event => update("radiusMiles", event.target.value)} inputMode="decimal" placeholder="25" />
          </label>
          {tab === "dialysis" ? (
            <label className="space-y-1 text-sm font-semibold text-[color:var(--foreground)]">
              <span>Modality</span>
              <Select value={filters.modality} onValueChange={value => update("modality", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modalities</SelectItem>
                  <SelectItem value="in-center">In-center</SelectItem>
                  <SelectItem value="peritoneal">Peritoneal</SelectItem>
                  <SelectItem value="home-hemodialysis">Home hemodialysis</SelectItem>
                </SelectContent>
              </Select>
            </label>
          ) : (
            <div />
          )}
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={onRefresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="border-dashed bg-[var(--background)]">
      <CardContent className="py-8 text-center text-sm font-medium text-[color:var(--muted-foreground)]">
        No {label} matched the current filters.
      </CardContent>
    </Card>
  );
}

function TransplantCard({
  program,
  onViewFhir,
  onPrepareReferral,
}: {
  program: TransplantResult;
  onViewFhir: (record: KidneyServiceRecord) => void;
  onPrepareReferral: (record: KidneyServiceRecord) => void;
}) {
  return (
    <Card className="gap-4 p-0">
      <CardHeader className="gap-3 px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-[color:var(--foreground)]">{program.name}</CardTitle>
            <p className="mt-1 flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]">
              <MapPin className="size-4" />
              {locationText(program)}
              {program.distanceMiles !== undefined && <span>· {program.distanceMiles} miles</span>}
            </p>
          </div>
          <Badge variant="purple">SRTR kidney program data</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Deceased-donor kidney transplants" value={program.deceasedDonorTransplants} />
          <Metric label="Living-donor kidney transplants" value={program.livingDonorTransplants} />
          <Metric
            label="SRTR access score"
            value={program.srtrAccessScore}
            title="Relative SRTR display score. Review the full SRTR report for the official measure definition."
          />
          <Metric
            label="SRTR one-year outcome score"
            value={program.srtrOneYearOutcomeScore}
            title="Relative SRTR display score. Review the full SRTR report for the official measure definition."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[color:var(--muted-foreground)]">SRTR release date: {displayValue(program.releaseDate)}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={program.srtrReportUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                View full SRTR report
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onViewFhir(program)}>
              <FileJson className="size-4" />
              View FHIR representation
            </Button>
            <Button type="button" size="sm" onClick={() => onPrepareReferral(program)}>
              Prepare referral
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DialysisCard({
  facility,
  onViewFhir,
  onPrepareReferral,
}: {
  facility: DialysisResult;
  onViewFhir: (record: KidneyServiceRecord) => void;
  onPrepareReferral: (record: KidneyServiceRecord) => void;
}) {
  return (
    <Card className="gap-4 p-0">
      <CardHeader className="gap-3 px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-[color:var(--foreground)]">{facility.name}</CardTitle>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{addressText(facility)}</p>
          </div>
          <Badge variant="info">CMS dialysis facility data</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Phone" value={facility.phone} />
          <Metric label="Distance" value={facility.distanceMiles !== undefined ? `${facility.distanceMiles} miles` : null} />
          <Metric label="Number of stations" value={facility.dialysisStations} />
          <Metric label="Quality rating" value={facility.qualityRating} />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Metric label="Supported dialysis modalities" value={supportedModalities(facility)} />
          <Metric label="CMS source date" value={facility.sourceDate} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onViewFhir(facility)}>
            <FileJson className="size-4" />
            View FHIR representation
          </Button>
          <Button type="button" size="sm" onClick={() => onPrepareReferral(facility)}>
            Prepare referral
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FhirDialog({
  bundle,
  record,
  open,
  onOpenChange,
}: {
  bundle: FhirDirectoryBundle | null;
  record: KidneyServiceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const json = useMemo(() => (bundle ? JSON.stringify(bundle, null, 2) : ""), [bundle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>FHIR R4 Directory Representation</DialogTitle>
          <DialogDescription>
            This representation describes the provider directory entry. It is not a patient clinical record and has not been written to Medblocks.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Organization</Badge>
          <Badge variant="neutral">Location</Badge>
          <Badge variant="neutral">HealthcareService</Badge>
          {record && <Badge variant={isTransplantRecord(record) ? "purple" : "info"}>{record.name}</Badge>}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(json)} disabled={!json}>
            <Copy className="size-4" />
            Copy JSON
          </Button>
        </div>
        <pre className="max-h-[55vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-xs leading-relaxed text-[color:var(--foreground)]">
          {json || "Loading..."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function ReferralDialog({
  preview,
  record,
  open,
  onOpenChange,
}: {
  preview: ReferralPreview | null;
  record: KidneyServiceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const json = useMemo(
    () => (preview ? JSON.stringify({ ServiceRequest: preview.serviceRequest, Task: preview.task }, null, 2) : ""),
    [preview],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Prepare referral</DialogTitle>
          <DialogDescription>
            Local draft preview only. No FHIR resources are written until a future explicit confirmation workflow exists.
          </DialogDescription>
        </DialogHeader>
        {record && <Badge variant={isDialysisRecord(record) ? "info" : "purple"}>{record.name}</Badge>}
        {preview?.note && (
          <Alert>
            <AlertDescription>{preview.note}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(json)} disabled={!json}>
            <Copy className="size-4" />
            Copy JSON
          </Button>
        </div>
        <pre className="max-h-[55vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-xs leading-relaxed text-[color:var(--foreground)]">
          {json || "No preview selected."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

export function KidneyServicesPage() {
  const [tab, setTab] = useState<ActiveTab>("transplant");
  const [filters, setFilters] = useState<DirectoryFilters>(INITIAL_FILTERS);
  const [transplantData, setTransplantData] = useState<KidneyServiceApiResponse<TransplantResult> | null>(null);
  const [dialysisData, setDialysisData] = useState<KidneyServiceApiResponse<DialysisResult> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fhirRecord, setFhirRecord] = useState<KidneyServiceRecord | null>(null);
  const [fhirBundle, setFhirBundle] = useState<FhirDirectoryBundle | null>(null);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [referralRecord, setReferralRecord] = useState<KidneyServiceRecord | null>(null);
  const [referralPreview, setReferralPreview] = useState<ReferralPreview | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "transplant") {
        const data = await fetchJson<KidneyServiceApiResponse<TransplantResult>>(
          `/api/kidney-services/transplant-programs${buildQuery(filters, tab)}`,
        );
        setTransplantData(data);
      } else {
        const data = await fetchJson<KidneyServiceApiResponse<DialysisResult>>(
          `/api/kidney-services/dialysis-facilities${buildQuery(filters, tab)}`,
        );
        setDialysisData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load kidney services data.");
    } finally {
      setLoading(false);
    }
  }, [filters, tab]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openFhirPreview = async (record: KidneyServiceRecord) => {
    setFhirRecord(record);
    setFhirBundle(null);
    setFhirOpen(true);
    try {
      const url = isDialysisRecord(record)
        ? `/api/kidney-services/dialysis-facilities/${encodeURIComponent(record.facilityId)}/fhir`
        : `/api/kidney-services/transplant-programs/${encodeURIComponent(record.centerCode)}/fhir`;
      setFhirBundle(await fetchJson<FhirDirectoryBundle>(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the FHIR representation.");
      setFhirOpen(false);
    }
  };

  const openReferralPreview = (record: KidneyServiceRecord) => {
    setReferralRecord(record);
    setReferralPreview(createReferralPreview(record));
    setReferralOpen(true);
  };

  const activeResults: KidneyServiceSearchResult[] = tab === "transplant" ? transplantData?.results ?? [] : dialysisData?.results ?? [];
  const activeTotal = tab === "transplant" ? transplantData?.totalMatched : dialysisData?.totalMatched;

  return (
    <AppShell
      title="Kidney Services"
      subtitle="Find and compare kidney transplant programs and dialysis facilities using curated SRTR and CMS data."
    >
      <div className="space-y-5">
        <Alert className="border-[var(--info-border)] bg-[var(--blue-panel)]">
          <Building2 className="size-4" />
          <AlertDescription className="text-sm font-medium text-[color:var(--foreground)]">
            Directory and program metrics support referral discussions. They do not guarantee program acceptance, treatment availability,
            transplant eligibility, organ availability, transplantation, or dialysis placement.
          </AlertDescription>
        </Alert>

        <Tabs value={tab} onValueChange={value => setTab(value as ActiveTab)} className="gap-5">
          <TabsList>
            <TabsTrigger value="transplant">Transplant Centers</TabsTrigger>
            <TabsTrigger value="dialysis">Dialysis Centers</TabsTrigger>
          </TabsList>

          <FilterControls filters={filters} tab={tab} onChange={setFilters} onRefresh={() => setRefreshKey(key => key + 1)} />

          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--muted-foreground)]">
            <Badge variant={tab === "transplant" ? "purple" : "info"}>{displayValue(activeTotal)} matched</Badge>
            <span>Showing at most {filters.limit} records.</span>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map(index => (
                <div key={index} className="h-40 animate-pulse rounded-lg bg-[var(--info-bg)]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey(key => key + 1)}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="transplant" className="space-y-3">
            {!loading && !error && transplantData && transplantData.results.length === 0 && <EmptyState label="transplant centers" />}
            {!loading &&
              !error &&
              transplantData?.results.map(program => (
                <TransplantCard
                  key={program.centerCode}
                  program={program}
                  onViewFhir={openFhirPreview}
                  onPrepareReferral={openReferralPreview}
                />
              ))}
          </TabsContent>

          <TabsContent value="dialysis" className="space-y-3">
            {!loading && !error && dialysisData && dialysisData.results.length === 0 && <EmptyState label="dialysis centers" />}
            {!loading &&
              !error &&
              dialysisData?.results.map(facility => (
                <DialysisCard
                  key={facility.facilityId}
                  facility={facility}
                  onViewFhir={openFhirPreview}
                  onPrepareReferral={openReferralPreview}
                />
              ))}
          </TabsContent>
        </Tabs>
      </div>

      <FhirDialog bundle={fhirBundle} record={fhirRecord} open={fhirOpen} onOpenChange={setFhirOpen} />
      <ReferralDialog preview={referralPreview} record={referralRecord} open={referralOpen} onOpenChange={setReferralOpen} />
    </AppShell>
  );
}
