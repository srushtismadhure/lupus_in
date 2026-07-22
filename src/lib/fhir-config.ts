function readFhirConfig() {
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

export const fhirConfig = readFhirConfig();
