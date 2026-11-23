/** Display helpers shared by the analysis-request pages (IDENTITY-265). */

const WORKFLOW_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  quoted: "Quoted",
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  awaiting_submitter: "Awaiting submitter",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  invoice_sent: "Invoice sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  refunded: "Refunded",
  complimentary: "Complimentary",
};

export const WORKFLOW_OPTIONS = Object.entries(WORKFLOW_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const PAYMENT_OPTIONS = Object.entries(PAYMENT_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function workflowLabel(status: string): string {
  return WORKFLOW_LABELS[status] ?? status.replace(/_/g, " ");
}

export function paymentLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status.replace(/_/g, " ");
}

/** Badge modifier for `.contact-status-badge`: done / waiting / problem. */
export function statusTone(status: string): string {
  if (["completed", "paid"].includes(status)) return "read";
  if (["rejected", "cancelled", "overdue", "refunded"].includes(status)) return "archived";
  if (["in_progress", "accepted", "invoice_sent"].includes(status)) return "unread";
  return "";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
