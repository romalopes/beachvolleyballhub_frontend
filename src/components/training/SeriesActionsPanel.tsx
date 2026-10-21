import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  api,
  ApiValidationError,
  type TrainingSeries,
} from "../../api";
import RecurrenceFields, { type RecurrenceValues } from "./RecurrenceFields";
import { seriesOverrides, todayIso } from "../../utils/recurringTraining";

interface Props {
  series: TrainingSeries;
  selectedIds: number[];
  onChanged: (message: string) => void;
}

function defaultBoundary(series: TrainingSeries): string {
  const today = todayIso();
  if (today > series.starts_on && today <= series.ends_on) return today;
  return series.starts_on;
}

function describeSkips(count: number): string {
  return count > 0 ? `, ${count} skipped` : "";
}

/**
 * Destructive and bulk series actions. Every form is explicit about what it
 * touches; the server re-validates ids and returns per-item results.
 */
export default function SeriesActionsPanel({ series, selectedIds, onChanged }: Props) {
  const navigate = useNavigate();
  const boundary = defaultBoundary(series);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState("");
  const [notify, setNotify] = useState(true);

  const [stopReason, setStopReason] = useState("");

  const [futureFrom, setFutureFrom] = useState(boundary);
  const [futureReason, setFutureReason] = useState("");

  const [editFrom, setEditFrom] = useState(boundary);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [overwriteOverrides, setOverwriteOverrides] = useState(false);

  const [splitReason, setSplitReason] = useState("");
  const [discardOverrides, setDiscardOverrides] = useState(false);
  const [split, setSplit] = useState<RecurrenceValues>({
    startsOn: boundary,
    endsOn: series.ends_on,
    weekdays: series.weekdays,
    localStartTime: series.local_start_time,
    durationMinutes: series.duration_minutes,
    interval: series.interval,
    timeZone: series.time_zone,
  });

  const run = async (label: string, action: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(result);
      onChanged(result);
    } catch (err) {
      if (err instanceof ApiValidationError) setError(err.errors.join(". "));
      else setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancelSelected = () =>
    run("cancel", async () => {
      if (selectedIds.length === 0) throw new Error("Select at least one occurrence.");
      if (!cancelReason.trim()) throw new Error("A cancellation reason is required.");
      const result = await api.bulkCancelTrainingSeries(series.id, {
        session_ids: selectedIds,
        reason: cancelReason.trim(),
        notify_participants: notify,
      });
      return `Cancelled ${result.affected_ids.length} occurrence${
        result.affected_ids.length === 1 ? "" : "s"
      }${describeSkips(result.skipped.length)}.`;
    });

  const deleteSelected = () =>
    run("delete", async () => {
      if (selectedIds.length === 0) throw new Error("Select at least one occurrence.");
      const result = await api.bulkDeleteTrainingSeries(series.id, selectedIds);
      return `Deleted ${result.deleted_ids.length} draft${
        result.deleted_ids.length === 1 ? "" : "s"
      }${describeSkips(result.skipped.length)}.`;
    });

  const stopSeries = () =>
    run("stop", async () => {
      const result = await api.stopTrainingSeries(series.id, stopReason.trim() || undefined);
      return result.changed
        ? "Recurrence stopped. Existing occurrences were not changed."
        : "Recurrence was already stopped.";
    });

  const cancelFuture = () =>
    run("cancel_future", async () => {
      if (!futureReason.trim()) throw new Error("A cancellation reason is required.");
      const result = await api.cancelFutureTrainingSeries(series.id, {
        from: futureFrom,
        reason: futureReason.trim(),
        notify_participants: notify,
      });
      return `Cancelled ${result.affected_ids.length} future occurrence${
        result.affected_ids.length === 1 ? "" : "s"
      }${describeSkips(result.skipped.length)}.`;
    });

  const updateFuture = () =>
    run("update_future", async () => {
      const changes = seriesOverrides({
        title: editTitle,
        location: editLocation,
        level: editLevel,
        capacity: editCapacity,
      });
      if (Object.keys(changes).length === 0) {
        throw new Error("Enter at least one field to change.");
      }
      const result = await api.updateFutureTrainingSeries(series.id, {
        effective_from: editFrom,
        changes,
        overwrite_overrides: overwriteOverrides,
      });
      return `Updated ${result.updated_ids.length} occurrence${
        result.updated_ids.length === 1 ? "" : "s"
      }${describeSkips(result.skipped.length)}.`;
    });

  const splitSeries = () =>
    run("split", async () => {
      if (!splitReason.trim()) throw new Error("A split reason is required.");
      const result = await api.splitTrainingSeries(series.id, {
        effective_from: split.startsOn,
        reason: splitReason.trim(),
        discard_overrides: discardOverrides,
        recurrence: {
          weekdays: split.weekdays,
          local_start_time: split.localStartTime,
          duration_minutes: split.durationMinutes,
          time_zone: split.timeZone,
          interval: split.interval,
          ends_on: split.endsOn,
        },
      });
      navigate(`/training/series/${result.new_series.id}`);
      return "Series split.";
    });

  return (
    <section className="detail-section series-actions">
      <h2>Series actions</h2>
      {message && <div className="admin-info">{message}</div>}
      {error && (
        <div className="admin-error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="series-action-grid">
        <details className="series-action">
          <summary>Cancel selected occurrences</summary>
          <p className="field-hint">
            {selectedIds.length} selected. Cancelling keeps each row as a tombstone and
            can never be undone by regeneration.
          </p>
          <div className="admin-field">
            <label htmlFor="cancel-reason">Reason</label>
            <input
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Weather, venue closure…"
            />
          </div>
          <label className="recurrence-toggle">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
            />
            Email participants with an account
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={cancelSelected}
            disabled={busy !== null || selectedIds.length === 0}
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel selected"}
          </button>
        </details>

        <details className="series-action">
          <summary>Delete selected drafts</summary>
          <p className="field-hint">
            Only drafts with no participants and no assessments can be deleted.
            Everything else is kept as history.
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={deleteSelected}
            disabled={busy !== null || selectedIds.length === 0}
          >
            {busy === "delete" ? "Deleting…" : "Delete selected"}
          </button>
        </details>

        <details className="series-action">
          <summary>Stop recurrence</summary>
          <p className="field-hint">
            Stops generating new occurrences. Existing occurrences stay exactly as
            they are.
          </p>
          <div className="admin-field">
            <label htmlFor="stop-reason">Reason (optional)</label>
            <input
              id="stop-reason"
              value={stopReason}
              onChange={(event) => setStopReason(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={stopSeries}
            disabled={busy !== null || series.status === "stopped"}
          >
            {busy === "stop" ? "Stopping…" : "Stop recurrence"}
          </button>
        </details>

        <details className="series-action">
          <summary>Cancel future occurrences</summary>
          <div className="admin-field">
            <label htmlFor="cancel-future-from">From (local date)</label>
            <input
              id="cancel-future-from"
              type="date"
              value={futureFrom}
              onChange={(event) => setFutureFrom(event.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cancel-future-reason">Reason</label>
            <input
              id="cancel-future-reason"
              value={futureReason}
              onChange={(event) => setFutureReason(event.target.value)}
            />
          </div>
          <label className="recurrence-toggle">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
            />
            Email participants
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={cancelFuture}
            disabled={busy !== null}
          >
            {busy === "cancel_future" ? "Cancelling…" : "Cancel future"}
          </button>
        </details>

        <details className="series-action">
          <summary>Edit future occurrences</summary>
          <div className="admin-field">
            <label htmlFor="edit-future-from">Effective from (local date)</label>
            <input
              id="edit-future-from"
              type="date"
              value={editFrom}
              onChange={(event) => setEditFrom(event.target.value)}
            />
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="edit-future-title">Title</label>
              <input
                id="edit-future-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-future-location">Location</label>
              <input
                id="edit-future-location"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="edit-future-level">Level</label>
              <input
                id="edit-future-level"
                value={editLevel}
                onChange={(event) => setEditLevel(event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-future-capacity">Capacity</label>
              <input
                id="edit-future-capacity"
                type="number"
                min={1}
                value={editCapacity}
                onChange={(event) => setEditCapacity(event.target.value)}
              />
            </div>
          </div>
          <label className="recurrence-toggle">
            <input
              type="checkbox"
              checked={overwriteOverrides}
              onChange={(event) => setOverwriteOverrides(event.target.checked)}
            />
            Overwrite existing per-occurrence overrides
          </label>
          <button
            type="button"
            className="admin-btn"
            onClick={updateFuture}
            disabled={busy !== null}
          >
            {busy === "update_future" ? "Updating…" : "Update future occurrences"}
          </button>
        </details>

        <details className="series-action">
          <summary>Split series at a new rule</summary>
          <p className="field-hint">
            The old series ends the day before the boundary and a new series starts on
            it. Future occurrences with participants, assessments or overrides block the
            split.
          </p>
          <RecurrenceFields
            values={split}
            onChange={(patch) => setSplit((current) => ({ ...current, ...patch }))}
          />
          <div className="admin-field">
            <label htmlFor="split-reason">Reason</label>
            <input
              id="split-reason"
              value={splitReason}
              onChange={(event) => setSplitReason(event.target.value)}
            />
          </div>
          <label className="recurrence-toggle">
            <input
              type="checkbox"
              checked={discardOverrides}
              onChange={(event) => setDiscardOverrides(event.target.checked)}
            />
            Allow splitting even when future occurrences have overrides
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={splitSeries}
            disabled={busy !== null || series.status === "stopped"}
          >
            {busy === "split" ? "Splitting…" : "Split series"}
          </button>
        </details>
      </div>
    </section>
  );
}
