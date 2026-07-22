import type { ClinicianWorklistResponse } from "./worklist-types";

export async function getClinicianWorklist(): Promise<ClinicianWorklistResponse> {
  const response = await fetch("/api/clinician-worklist", { credentials: "include" });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error("The FHIR server is unavailable. Please try again.");
  }

  return (await response.json()) as ClinicianWorklistResponse;
}
