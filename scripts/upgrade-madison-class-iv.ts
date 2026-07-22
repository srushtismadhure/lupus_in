import { upgradeMadisonClassIv, type FhirUpgradeClient } from "../src/lib/madison-class-iv-upgrade.js";

interface FhirConfig {
  baseUrl: string;
  accessToken: string;
}

function getConfig(): FhirConfig {
  const baseUrl = process.env.FHIR_BASE_URL?.replace(/\/+$/, "");
  const accessToken = process.env.FHIR_ACCESS_TOKEN;
  if (!baseUrl) throw new Error("Missing required environment variable: FHIR_BASE_URL");
  if (!accessToken) throw new Error("Missing required environment variable: FHIR_ACCESS_TOKEN");
  return { baseUrl, accessToken };
}

function operationOutcomeMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || (body as { resourceType?: string }).resourceType !== "OperationOutcome") return undefined;
  return (body as fhir4.OperationOutcome).issue?.map(issue => issue.diagnostics ?? issue.details?.text).filter(Boolean).join("; ");
}

export class HttpFhirUpgradeClient implements FhirUpgradeClient {
  constructor(private readonly config: FhirConfig) {}

  private async request<T>(url: string, init?: RequestInit): Promise<{ body: T; response: Response }> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.config.accessToken}`);
    headers.set("Accept", "application/fhir+json");
    headers.set("Content-Type", "application/fhir+json");
    const response = await fetch(url, { ...init, headers });
    const body = (await response.json().catch(() => null)) as T;
    if (!response.ok) {
      const detail = operationOutcomeMessage(body) ?? `HTTP ${response.status}`;
      throw new Error(`FHIR request failed: ${init?.method ?? "GET"} ${new URL(url).pathname}: ${detail}`);
    }
    return { body, response };
  }

  async search<T extends fhir4.Resource>(resourceType: T["resourceType"], query: string): Promise<T[]> {
    const resources: T[] = [];
    let url: string | null = `${this.config.baseUrl}/${resourceType}?${query}`;
    let page = 0;
    while (url && page < 25) {
      page++;
      const result: { body: fhir4.Bundle; response: Response } = await this.request<fhir4.Bundle>(url);
      for (const entry of result.body.entry ?? []) {
        if (entry.resource?.resourceType === resourceType) resources.push(entry.resource as T);
      }
      const next: string | undefined = result.body.link?.find((link: fhir4.BundleLink) => link.relation === "next")?.url;
      if (!next) {
        url = null;
      } else {
        const nextUrl: URL = new URL(next);
        nextUrl.protocol = new URL(this.config.baseUrl).protocol;
        url = nextUrl.toString();
      }
    }
    return resources;
  }

  async create<T extends fhir4.Resource>(resourceType: T["resourceType"], resource: T): Promise<T> {
    const result = await this.request<T>(`${this.config.baseUrl}/${resourceType}`, { method: "POST", body: JSON.stringify(resource) });
    return result.body;
  }

  async update<T extends fhir4.Resource>(resourceType: T["resourceType"], id: string, resource: T, versionId?: string): Promise<T> {
    const headers = new Headers();
    if (versionId) headers.set("If-Match", `W/\"${versionId}\"`);
    const result = await this.request<T>(`${this.config.baseUrl}/${resourceType}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(resource),
    });
    return result.body;
  }
}

export async function runMadisonUpgradeCli(args = process.argv.slice(2)): Promise<void> {
  const unknown = args.filter(arg => arg !== "--dry-run");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  const dryRun = args.includes("--dry-run");
  const client = new HttpFhirUpgradeClient(getConfig());
  const result = await upgradeMadisonClassIv(client, { dryRun, logger: message => console.log(message) });
  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        patientId: result.patientId,
        patientCountBefore: result.patientCountBefore,
        patientCountAfter: result.patientCountAfter,
        lupusNephritisConditionId: result.lupusNephritisConditionId,
        writes: result.writes,
        created: result.created,
        updated: result.updated,
        skippedAsCurrent: result.skippedAsCurrent,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  runMadisonUpgradeCli().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
