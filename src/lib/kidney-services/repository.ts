// Server-only: this module reads generated JSON from disk and must not be imported by browser code.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DialysisFacility, KidneyTransplantProgram } from "./types.js";

const GENERATED_DIR = path.join("data", "generated");

let transplantProgramsCache: KidneyTransplantProgram[] | null = null;
let dialysisFacilitiesCache: DialysisFacility[] | null = null;

async function readGeneratedJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), GENERATED_DIR, fileName);
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function getKidneyTransplantPrograms(): Promise<KidneyTransplantProgram[]> {
  transplantProgramsCache ??= await readGeneratedJson<KidneyTransplantProgram[]>("kidney-transplant-programs.json");
  return transplantProgramsCache;
}

export async function getDialysisFacilities(): Promise<DialysisFacility[]> {
  dialysisFacilitiesCache ??= await readGeneratedJson<DialysisFacility[]>("dialysis-facilities.json");
  return dialysisFacilitiesCache;
}

export async function getKidneyTransplantProgram(centerCode: string): Promise<KidneyTransplantProgram | null> {
  const programs = await getKidneyTransplantPrograms();
  return programs.find(program => program.centerCode.toLowerCase() === centerCode.toLowerCase()) ?? null;
}

export async function getDialysisFacility(facilityId: string): Promise<DialysisFacility | null> {
  const facilities = await getDialysisFacilities();
  return facilities.find(facility => facility.facilityId === facilityId) ?? null;
}

export function resetKidneyServiceRepositoryCache(): void {
  transplantProgramsCache = null;
  dialysisFacilitiesCache = null;
}
