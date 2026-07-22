import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildSessionCookie, createDemoSessionToken } from "../auth.js";
import { handleRequest } from "../../server/router.js";
import { calculateDistanceMiles } from "./distance.js";
import {
  discoverRawKidneyServiceFiles,
  importKidneyServices,
  normalizeCell,
  normalizeDialysisFacilities,
  normalizeTransplantPrograms,
  parseBooleanCell,
  parseCityState,
  parseNumberCell,
} from "./importer.js";
import { resetKidneyServiceRepositoryCache } from "./repository.js";
import { searchDialysisFacilities } from "./search.js";
import { createFhirDirectoryBundle, createReferralPreview } from "./to-fhir-directory-bundle.js";
import type { DialysisFacility, KidneyTransplantProgram } from "./types.js";

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  resetKidneyServiceRepositoryCache();
});

async function makeFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "kidney-services-"));
  const rawDir = path.join(root, "data", "raw");
  await mkdir(rawDir, { recursive: true });

  await writeFile(
    path.join(rawDir, "transplant.csv"),
    [
      "Center Code,ENTIRE_NAME,Location,ORG,Deceased Donor Transplants In A Year,Living Donor Transplants In A Year,Get A Deceased Donor Transplant Faster,One Year Kidney Survival,Extra Column",
      '001,Alpha Transplant,"Los Angeles, CA",KI,0,-,0,0.85,ignored',
      '001,Alpha Transplant Duplicate,"Los Angeles, CA",KI,1,2,0.25,0.9,ignored',
      '002,Beta Transplant,"Sacramento, CA",KI,,3,-,0,ignored',
      '003,Heart Program,"San Francisco, CA",HE,9,9,0.4,0.4,ignored',
    ].join("\n"),
  );

  await writeFile(
    path.join(rawDir, "dialysis.csv"),
    [
      "DFC_FACILITY,,,,,,,,,,,,,,,",
      "CMS Certification Number (CCN),Facility Name,Address Line 1,Address Line 2,City/Town,State,ZIP Code,Telephone Number,# of Dialysis Stations,Offers in-center hemodialysis,Offers peritoneal dialysis,Offers home hemodialysis training,Five Star,Five Star Date,Latitude,Longitude,Extra Column",
      "00010,Alpha Dialysis,1 Main St,,Los Angeles,CA,09001,(555) 111-2222,0,Yes,N,true,-,2024-01-01,34.0522,-118.2437,ignored",
      "00010,Alpha Dialysis Updated,1 Main St,Suite 2,Los Angeles,CA,09001,(555) 111-2222,8,Y,No,false,4,2024-01-01,34.0522,-118.2437,ignored",
      "00011,Beta Dialysis,2 Oak St,,Las Vegas,NV,89101,,12,No,Y,false,3,2024-01-01,36.1699,-115.1398,ignored",
    ].join("\n"),
  );

  return root;
}

function sampleProgram(): KidneyTransplantProgram {
  return {
    centerCode: "001",
    name: "Alpha Transplant",
    city: "Los Angeles",
    state: "CA",
    organ: "kidney",
    deceasedDonorTransplants: 0,
    livingDonorTransplants: null,
    srtrAccessScore: 0,
    srtrOneYearOutcomeScore: 0.85,
    releaseDate: null,
    source: "SRTR",
    sourceFile: "data/raw/transplant.csv",
    srtrReportUrl: "https://srtr.hrsa.gov/interactive-report?center=001&type=TX1&organ=KI",
  };
}

function sampleFacility(): DialysisFacility {
  return {
    facilityId: "00010",
    name: "Alpha Dialysis",
    address: "1 Main St",
    city: "Los Angeles",
    state: "CA",
    zipCode: "09001",
    phone: "(555) 111-2222",
    latitude: 34.0522,
    longitude: -118.2437,
    dialysisStations: 0,
    offersInCenterHemodialysis: true,
    offersPeritonealDialysis: false,
    offersHomeHemodialysisTraining: true,
    qualityRating: null,
    sourceDate: "2024-01-01",
    facilityType: "dialysis-facility",
    source: "CMS",
    sourceFile: "data/raw/dialysis.csv",
  };
}

describe("kidney services import", () => {
  test("discovers the correct raw files by headers", async () => {
    const root = await makeFixtureRoot();
    const discovered = await discoverRawKidneyServiceFiles(root);

    expect(discovered.transplant?.sourceFile).toBe("data/raw/transplant.csv");
    expect(discovered.dialysis?.sourceFile).toBe("data/raw/dialysis.csv");
  });

  test("normalizes transplant aliases, nulls, zeroes, location, organ filtering, and center-code deduplication", async () => {
    const root = await makeFixtureRoot();
    const discovered = await discoverRawKidneyServiceFiles(root);
    if (!discovered.transplant) throw new Error("Missing transplant fixture");

    const { records, report } = normalizeTransplantPrograms(discovered.transplant);
    const alpha = records.find(record => record.centerCode === "001");
    const beta = records.find(record => record.centerCode === "002");

    expect(records).toHaveLength(2);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.unrecognizedHeaders).toContain("Extra Column");
    expect(alpha?.name).toBe("Alpha Transplant Duplicate");
    expect(alpha?.centerCode).toBe("001");
    expect(beta?.deceasedDonorTransplants).toBeNull();
    expect(beta?.srtrAccessScore).toBeNull();
    expect(beta?.srtrOneYearOutcomeScore).toBe(0);
    expect(beta?.city).toBe("Sacramento");
    expect(beta?.state).toBe("CA");
  });

  test("normalizes dialysis aliases, ZIP strings, booleans, null quality ratings, zero stations, and facility-ID deduplication", async () => {
    const root = await makeFixtureRoot();
    const discovered = await discoverRawKidneyServiceFiles(root);
    if (!discovered.dialysis) throw new Error("Missing dialysis fixture");

    const { records, report } = normalizeDialysisFacilities(discovered.dialysis);
    const alpha = records.find(record => record.facilityId === "00010");

    expect(records).toHaveLength(2);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.unrecognizedHeaders).toContain("Extra Column");
    expect(alpha?.facilityId).toBe("00010");
    expect(alpha?.zipCode).toBe("09001");
    expect(alpha?.dialysisStations).toBe(8);
    expect(alpha?.offersInCenterHemodialysis).toBe(true);
    expect(alpha?.offersPeritonealDialysis).toBe(false);
    expect(alpha?.offersHomeHemodialysisTraining).toBe(false);
    expect(parseNumberCell("0")).toBe(0);
    expect(parseNumberCell("-")).toBeNull();
    expect(normalizeCell("")).toBeNull();
    expect(parseBooleanCell("Y")).toBe(true);
    expect(parseBooleanCell("No")).toBe(false);
  });

  test("writes generated JSON and import report", async () => {
    const root = await makeFixtureRoot();
    const imported = await importKidneyServices(root);

    expect(imported.report.transplant.inputRows).toBe(4);
    expect(imported.report.transplant.outputRows).toBe(2);
    expect(imported.report.dialysis.inputRows).toBe(3);
    expect(imported.report.dialysis.outputRows).toBe(2);
    expect(imported.transplantPrograms).toHaveLength(2);
    expect(imported.dialysisFacilities).toHaveLength(2);
  });

  test("parses City, ST location values", () => {
    expect(parseCityState("San Diego, CA", null, null)).toEqual({ city: "San Diego", state: "CA" });
  });
});

describe("kidney services search and distance", () => {
  test("calculates Haversine distance in miles", () => {
    const miles = calculateDistanceMiles(34.0522, -118.2437, 37.7749, -122.4194);
    expect(miles).toBeGreaterThan(345);
    expect(miles).toBeLessThan(350);
  });

  test("filters by state and radius using existing coordinates", () => {
    const losAngeles = sampleFacility();
    const lasVegas: DialysisFacility = {
      ...sampleFacility(),
      facilityId: "00011",
      name: "Beta Dialysis",
      city: "Las Vegas",
      state: "NV",
      zipCode: "89101",
      latitude: 36.1699,
      longitude: -115.1398,
    };

    const stateFiltered = searchDialysisFacilities([losAngeles, lasVegas], { limit: 10, state: "ca" });
    const radiusFiltered = searchDialysisFacilities([losAngeles, lasVegas], {
      limit: 10,
      latitude: 34.0522,
      longitude: -118.2437,
      radiusMiles: 20,
    });

    expect(stateFiltered.results.map(record => record.facilityId)).toEqual(["00010"]);
    expect(radiusFiltered.results.map(record => record.facilityId)).toEqual(["00010"]);
    expect(radiusFiltered.results[0]?.distanceMiles).toBe(0);
  });
});

describe("kidney services FHIR mapping", () => {
  test("creates deterministic Organization, Location, and HealthcareService resources", () => {
    const bundle = createFhirDirectoryBundle(sampleFacility());
    const resources = bundle.entry.map(entry => entry.resource);
    const organization = resources.find(resource => resource.resourceType === "Organization") as fhir4.Organization | undefined;
    const location = resources.find(resource => resource.resourceType === "Location") as fhir4.Location | undefined;
    const healthcareService = resources.find(resource => resource.resourceType === "HealthcareService") as fhir4.HealthcareService | undefined;

    expect(bundle.type).toBe("collection");
    expect(organization?.identifier?.[0]?.value).toBe("00010");
    expect(organization?.name).toBe("Alpha Dialysis");
    expect(location?.position?.latitude).toBe(34.0522);
    expect(location?.managingOrganization?.reference).toBe(`Organization/${organization?.id}`);
    expect(healthcareService?.providedBy?.reference).toBe(`Organization/${organization?.id}`);
    expect(healthcareService?.location?.[0]?.reference).toBe(`Location/${location?.id}`);
  });

  test("creates draft referral previews without posting to FHIR", () => {
    const patientPreview = createReferralPreview(sampleFacility(), "patient-1");
    const directoryPreview = createReferralPreview(sampleProgram());

    expect(patientPreview.serviceRequest.status).toBe("draft");
    expect(patientPreview.serviceRequest.intent).toBe("proposal");
    expect(patientPreview.serviceRequest.subject?.reference).toBe("Patient/patient-1");
    expect(patientPreview.task.focus?.reference).toBe(`ServiceRequest/${patientPreview.serviceRequest.id}`);
    expect(patientPreview.task.for?.reference).toBe("Patient/patient-1");
    expect(directoryPreview.note).toBe("Open this directory from a patient chart to prepare a patient-specific referral.");
    expect(directoryPreview.serviceRequest.subject.reference).toBeUndefined();
    expect(directoryPreview.serviceRequest.subject.display).toBe("Patient context required");
  });
});

describe("kidney services API", () => {
  test("returns JSON 404 responses for missing records", async () => {
    process.env.APP_SESSION_SECRET ||= "kidney-services-test-secret";
    const root = await makeFixtureRoot();
    await importKidneyServices(root);
    process.chdir(root);
    resetKidneyServiceRepositoryCache();

    const cookie = buildSessionCookie(createDemoSessionToken("clinician")).split(";")[0] ?? "";
    const transplantResponse = await handleRequest(
      new Request("http://localhost/api/kidney-services/transplant-programs/missing", { headers: { cookie } }),
    );
    const dialysisResponse = await handleRequest(
      new Request("http://localhost/api/kidney-services/dialysis-facilities/missing", { headers: { cookie } }),
    );

    expect(transplantResponse.status).toBe(404);
    expect(transplantResponse.headers.get("content-type")).toContain("application/json");
    expect(dialysisResponse.status).toBe(404);
    expect(dialysisResponse.headers.get("content-type")).toContain("application/json");
  });
});
