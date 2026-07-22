import { createHash } from "node:crypto";
import { CARE_COORDINATION_SYSTEMS } from "../../terminology/care-coordination-codes.js";
import type { CarePathwayType } from "../types.js";

export function workflowHash(patientId: string, pathwayType: CarePathwayType): string {
  return createHash("sha256").update(`${patientId}:${pathwayType}`).digest("hex").slice(0, 20);
}

export function workflowIdentifier(patientId: string, pathwayType: CarePathwayType, suffix: string): fhir4.Identifier {
  return {
    system: CARE_COORDINATION_SYSTEMS.identifier,
    value: `cc-${workflowHash(patientId, pathwayType)}-${suffix}`,
  };
}

export function identifierSearch(identifier: fhir4.Identifier): string {
  return `identifier=${encodeURIComponent(`${identifier.system}|${identifier.value}`)}`;
}

export function stableUuid(patientId: string, pathwayType: CarePathwayType, suffix: string): string {
  const hex = createHash("sha256").update(`${patientId}:${pathwayType}:${suffix}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function transactionFullUrl(patientId: string, pathwayType: CarePathwayType, suffix: string): string {
  return `urn:uuid:${stableUuid(patientId, pathwayType, suffix)}`;
}

