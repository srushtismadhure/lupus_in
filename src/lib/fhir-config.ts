export interface FhirConfig {
  baseUrl: string;
  bearerToken: string;
}

let cachedConfig: FhirConfig | null = null;

function readFhirConfig(): FhirConfig {
  const rawBaseUrl = process.env.FHIR_BASE_URL;
  const bearerToken = process.env.FHIR_BEARER_TOKEN;

  if (!rawBaseUrl) {
    throw new Error("Missing required environment variable: FHIR_BASE_URL");
  }
  if (!bearerToken) {
    throw new Error("Missing required environment variable: FHIR_BEARER_TOKEN");
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  return { baseUrl, bearerToken };
}

export function getFhirConfig(): FhirConfig {
  cachedConfig ??= readFhirConfig();
  return cachedConfig;
}
