import type { ContactMessageStatus, ContactTypeOption } from "../api";

/**
 * Fallback contact categories for the public Contact form (IDENTITY-259).
 *
 * The API is the single source of truth and publishes this list through
 * `GET /api/v1/contact_messages/options`; the page prefers that response. This
 * copy exists so the form still renders (and is still submittable) when the
 * options request fails — the server validates the submitted value either way,
 * so a stale entry can never widen what is accepted.
 */
export const CONTACT_TYPE_OPTIONS: ContactTypeOption[] = [
  { value: "general", label: "General enquiry" },
  { value: "account_access", label: "Account or login support" },
  { value: "coaching", label: "Coaching enquiry" },
  { value: "organisation", label: "Organisation or club enquiry" },
  { value: "training_tournament", label: "Training or tournament enquiry" },
  { value: "location", label: "Court or location information" },
  { value: "technical_support", label: "Technical support" },
  { value: "partnership", label: "Business or partnership" },
  { value: "feedback", label: "Feedback or suggestion" },
  { value: "other", label: "Other" },
];

export function contactTypeLabel(value: string): string {
  return (
    CONTACT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

/** Display label for an inbox status (unread / read / archived). */
export function contactStatusLabel(status: ContactMessageStatus): string {
  switch (status) {
    case "unread":
      return "Unread";
    case "read":
      return "Read";
    default:
      return "Archived";
  }
}
