import { importKidneyServices } from "../src/lib/kidney-services/importer.js";

const result = await importKidneyServices(process.cwd());

console.log("Kidney services import complete");
console.log(`Transplant source: ${result.report.transplant.sourceFile}`);
console.log(`Transplant rows: ${result.report.transplant.inputRows} input, ${result.report.transplant.outputRows} output`);
console.log(`Transplant duplicates removed: ${result.report.transplant.duplicatesRemoved}`);
console.log(`Dialysis source: ${result.report.dialysis.sourceFile}`);
console.log(`Dialysis rows: ${result.report.dialysis.inputRows} input, ${result.report.dialysis.outputRows} output`);
console.log(`Dialysis duplicates removed: ${result.report.dialysis.duplicatesRemoved}`);
console.log("Generated files written to data/generated/");
