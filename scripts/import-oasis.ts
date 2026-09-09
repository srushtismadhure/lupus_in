import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Reproducible import of the unmodified CMS release, not a handwritten item list.
const sourceUrl = "https://www.cms.gov/files/zip/oasis-e2-data-specs-v3-02-0-final-zip.zip";
const sha256 = "b848a1f33efb77406124f02bfd50dbb48c6efb841c4e4bf3c68719c1e8d9f6ca";
const archive = process.argv[2];
if (!archive) throw new Error(`Usage: bun scripts/import-oasis.ts <CMS zip from ${sourceUrl}>`);
const bytes = await Bun.file(archive).bytes();
if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("CMS source checksum mismatch; review the release before importing.");
const root = await mkdtemp(join(tmpdir(), "waypoint-oasis-import-"));
function unzip(file: string, destination: string) {
  const result = Bun.spawnSync(["unzip", "-q", file, "-d", destination]);
  if (result.exitCode) throw new Error(result.stderr.toString());
}
unzip(archive, root);
const files = await readdir(root);
for (const kind of ["CSV", "HTML"]) {
  const name = files.find(file => file.includes(`${kind} Files`) && file.endsWith(".zip"));
  if (!name) throw new Error(`Missing CMS ${kind} archive`);
  unzip(join(root, name), join(root, kind));
}
type Row = Record<string, string>;
async function csv(name: string): Promise<Row[]> {
  return parse(new TextDecoder("windows-1252").decode(await Bun.file(join(root, "CSV", name)).bytes()), { columns: true, skip_empty_lines: true });
}
function decode(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[entity.toLowerCase()] ?? match;
  }).replace(/\s+/g, " ").trim();
}
async function htmlRows(name: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  const html = new TextDecoder("windows-1252").decode(await Bun.file(join(root, "HTML", name)).bytes());
  await new HTMLRewriter().on("tr", { element() { row = []; rows.push(row); } })
    .on("td", { element(element) { cell = ""; element.onEndTag(() => { row.push(decode(cell)); }); }, text(chunk) { cell += chunk.text; } })
    .on("td br", { element() { cell += " "; } }).transform(new Response(html)).text();
  return rows;
}
const master = await csv("itm_mstr.csv");
const values = await csv("itm_val.csv");
const edits: Record<string, { id: string; type: string; severity: string; text: string; dependencies: string[]; sourceFile: string }> = {};
const ids = new Set(master.map(row => row.itm_id!));
const items = [];
for (const row of master) {
  const cmsItemId = row.itm_id!;
  const sourceFile = `oi_${cmsItemId.toLowerCase()}.html`;
  const rows = await htmlRows(sourceFile);
  const editIds: string[] = [];
  for (const cells of rows) {
    if (cells.length !== 4 || !/^-\d+$/.test(cells[0]!)) continue;
    const [id, type, severity, text] = cells as [string, string, string, string];
    editIds.push(id);
    edits[id] = { id, type, severity, text, dependencies: [...new Set(text.match(/[A-Z][A-Z0-9_]+/g) ?? [])].filter(id => ids.has(id)), sourceFile: `oe_${id.slice(1)}.html` };
  }
  items.push({ cmsItemId, section: row.itm_sect_label!, text: row.itm_shrt_label!, textKind: "CMS data-specification short label", type: row.itm_type_cd!, group: row.itm_grp_cd!,
    cardinality: { min: 0, max: 1, requiredness: "See official conditional edit rules; not inferred from applicability" },
    applicableTimepoints: row.isc_active!.split(",").filter(Boolean),
    answerOptions: values.filter(value => value.itm_id === cmsItemId).sort((a, b) => Number(a.val_srt_id) - Number(b.val_srt_id)).map(value => ({ code: value.val_id!, display: value.val_txt!, ...(value.val_loinc_id ? { loinc: value.val_loinc_id } : {}) })),
    editIds, sourceFile, source: row,
    fhir: { linkId: cmsItemId, ...(row.itm_loinc_id ? { loinc: row.itm_loinc_id } : {}) },
  });
}
if (items.length !== ids.size || items.length !== 733 || !Object.keys(edits).length) throw new Error("Unexpected CMS inventory; review importer.");
const registry = { instrument: "OASIS-E2", version: "2026-04-01", specificationVersion: "3.02.0", effectiveDate: "2026-04-01", canonicalUrl: "https://waypoint.example/fhir/Questionnaire/oasis-e2", sourceUrl, sha256,
  publisher: "Centers for Medicare & Medicaid Services", copyright: "CMS data specification reports: These materials are in the public domain and cannot be copyrighted. Instrument-specific attribution must be reviewed before reproducing full instrument wording.",
  limitations: ["Clinical labels are CMS data-specification short labels, not the full assessment instrument text.", "Official edit prose is preserved; only explicitly supported rules are executable. Completion and submission export remain blocked.", "Look-back periods and clinical instructions require the official instrument/manual; they are not inferred from short labels."],
  timepoints: (await csv("isc_mstr.csv")), timepointMappings: await csv("isc_val.csv"), items, edits };
await Bun.write(new URL("../src/lib/oasis/registry.generated.json", import.meta.url), JSON.stringify(registry, null, 2) + "\n");
console.log(`Imported ${items.length} CMS elements and ${Object.keys(edits).length} edit rules; source SHA-256 ${sha256}`);
