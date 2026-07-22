export type KidneyServiceSource = "SRTR" | "CMS";

export interface KidneyTransplantProgram {
  centerCode: string;
  name: string;
  city: string | null;
  state: string | null;
  organ: "kidney";
  deceasedDonorTransplants: number | null;
  livingDonorTransplants: number | null;
  srtrAccessScore: number | null;
  srtrOneYearOutcomeScore: number | null;
  releaseDate: string | null;
  source: "SRTR";
  sourceFile: string;
  srtrReportUrl: string;
}

export interface DialysisFacility {
  facilityId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  dialysisStations: number | null;
  offersInCenterHemodialysis: boolean | null;
  offersPeritonealDialysis: boolean | null;
  offersHomeHemodialysisTraining: boolean | null;
  qualityRating: number | null;
  sourceDate: string | null;
  facilityType: "dialysis-facility";
  source: "CMS";
  sourceFile: string;
}

export type KidneyServiceRecord = KidneyTransplantProgram | DialysisFacility;

export type KidneyServiceSearchResult =
  | (KidneyTransplantProgram & { distanceMiles?: number })
  | (DialysisFacility & { distanceMiles?: number });

export interface KidneyServiceInvalidRow {
  rowNumber: number;
  reason: string;
  sourceId: string | null;
}

export interface KidneyServiceImportDatasetReport {
  sourceFile: string;
  inputRows: number;
  outputRows: number;
  duplicatesRemoved: number;
  invalidRows: KidneyServiceInvalidRow[];
  unrecognizedHeaders: string[];
}

export interface KidneyServiceImportReport {
  generatedAt: string;
  transplant: KidneyServiceImportDatasetReport;
  dialysis: KidneyServiceImportDatasetReport;
}

export interface FhirDirectoryBundle extends fhir4.Bundle {
  type: "collection";
  entry: Array<{
    fullUrl: string;
    resource: fhir4.Organization | fhir4.Location | fhir4.HealthcareService;
  }>;
}

export interface KidneyServiceApiResponse<T extends KidneyServiceSearchResult> {
  source: KidneyServiceSource;
  count: number;
  totalMatched: number;
  results: T[];
}

export interface ReferralPreview {
  serviceRequest: fhir4.ServiceRequest;
  task: fhir4.Task;
  note: string | null;
}
