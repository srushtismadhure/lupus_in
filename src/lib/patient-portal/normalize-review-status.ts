export interface ExplicitReviewStatus {
  status: "new" | "awaiting-review" | "reviewed" | "discussed" | "follow-up-ordered";
  label: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export function normalizeReviewStatus(resource: fhir4.Observation): ExplicitReviewStatus {
  for (const note of resource.note ?? []) {
    const reviewed = note.text?.match(/^\[reviewed-by\]\s*(.+)$/i);
    if (reviewed?.[1]) {
      return {
        status: "reviewed",
        label: "Care team reviewed",
        reviewedAt: note.time,
        reviewedBy: reviewed[1],
      };
    }
    if (/^\[discussed-with-patient\]/i.test(note.text ?? "")) {
      return { status: "discussed", label: "Discussed with you", reviewedAt: note.time };
    }
    if (/^\[follow-up-ordered\]/i.test(note.text ?? "")) {
      return { status: "follow-up-ordered", label: "Follow-up ordered", reviewedAt: note.time };
    }
  }
  return { status: "awaiting-review", label: "Waiting for care-team review" };
}
