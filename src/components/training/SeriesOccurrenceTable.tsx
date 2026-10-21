import type { TrainingSession } from "../../api";
import { statusLabel } from "../../utils/training";

interface Props {
  sessions: TrainingSession[];
  selected: Set<number>;
  onSelectionChange: (next: Set<number>) => void;
  timeZone: string;
}

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isSelectable(session: TrainingSession): boolean {
  return (
    session.cancellable ??
    ["draft", "scheduled"].includes(session.status)
  );
}

/**
 * Occurrence table for the series dashboard. Selection is presentation only;
 * the server re-validates every id and reports per-item results.
 */
export default function SeriesOccurrenceTable({
  sessions,
  selected,
  onSelectionChange,
  timeZone,
}: Props) {
  const selectable = sessions.filter(isSelectable);
  const allSelected =
    selectable.length > 0 && selectable.every((session) => selected.has(session.id));

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    selectable.forEach((session) => {
      if (checked) next.add(session.id);
      else next.delete(session.id);
    });
    onSelectionChange(next);
  };

  const toggleOne = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  return (
    <div className="occurrence-table-wrapper">
      <table className="occurrence-table">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="checkbox"
                aria-label="Select all cancellable occurrences"
                checked={allSelected}
                disabled={selectable.length === 0}
                onChange={(event) => toggleAll(event.target.checked)}
              />
            </th>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Status</th>
            <th scope="col">Coach</th>
            <th scope="col">Location</th>
            <th scope="col">Flags</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const selectableRow = isSelectable(session);
            return (
              <tr
                key={session.id}
                className={session.status === "cancelled" ? "occurrence-cancelled" : ""}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select occurrence ${session.recurrence_key ?? session.id}`}
                    checked={selected.has(session.id)}
                    disabled={!selectableRow}
                    onChange={(event) => toggleOne(session.id, event.target.checked)}
                  />
                </td>
                <td>{formatDate(session.starts_at, timeZone)}</td>
                <td>
                  {formatTime(session.starts_at, timeZone)} –{" "}
                  {formatTime(session.ends_at, timeZone)}
                </td>
                <td>
                  <span className={`occurrence-status occurrence-status-${session.status}`}>
                    {session.status_label ?? statusLabel(session.status)}
                  </span>
                </td>
                <td>{session.coach_profile?.display_name ?? "—"}</td>
                <td>
                  {[session.location, session.location_detail]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td>
                  {session.overridden && <span className="occurrence-flag">Edited</span>}
                  {session.status === "cancelled" && session.cancellation_reason && (
                    <span className="occurrence-flag" title={session.cancellation_reason}>
                      Cancelled
                    </span>
                  )}
                  {!selectableRow && <span className="occurrence-flag">Locked</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sessions.length === 0 && (
        <p className="field-hint occurrence-empty">No occurrences in this series yet.</p>
      )}
    </div>
  );
}
