import { STATUS_LABELS, type ApplicationStatus } from "@/lib/admin/queue";

/** Status is always spelled out; colour is only a second cue. */
export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}
