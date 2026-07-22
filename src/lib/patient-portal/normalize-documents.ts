import type { PatientDocument } from "./types.js";

function categoryOf(document: fhir4.DocumentReference): string {
  return document.category?.[0]?.text ?? document.type?.text ?? document.type?.coding?.[0]?.display ?? "Clinical document";
}

export function normalizeDocuments(documents: fhir4.DocumentReference[]): PatientDocument[] {
  return documents
    .filter(document => document.status === "current" && document.docStatus !== "entered-in-error")
    .map(document => {
      const attachment = document.content?.[0]?.attachment;
      return {
        id: document.id ?? `document-${document.date ?? "undated"}`,
        title: document.description ?? attachment?.title ?? document.type?.text ?? "Health record document",
        category: categoryOf(document),
        date: document.date ?? document.context?.period?.start,
        source: document.author?.map(item => item.display).filter(Boolean).join(", ") || "Medical record",
        description: document.content?.[0]?.format?.display,
        url: attachment?.url?.startsWith("/api/portal/") ? attachment.url : undefined,
      } satisfies PatientDocument;
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

