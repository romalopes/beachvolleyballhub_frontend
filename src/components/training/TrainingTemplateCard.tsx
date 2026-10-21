import { Archive, CalendarPlus, Copy, Pencil, RotateCcw } from "lucide-react";
import type { TrainingTemplate } from "../../api";
import Tag from "../Tag";
import { templateStatusLabel } from "../../utils/recurringTraining";
import { trainingDurationLabel } from "../../utils/training";

interface TrainingTemplateCardProps {
  template: TrainingTemplate;
  busy?: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  onClone: () => void;
  onToggleArchive: () => void;
}

/**
 * A reusable training definition as a tournament-style card, so the templates
 * directory matches the tournaments directory.
 */
export default function TrainingTemplateCard({
  template,
  busy = false,
  onEdit,
  onSchedule,
  onClone,
  onToggleArchive,
}: TrainingTemplateCardProps) {
  const archived = template.status === "archived";

  return (
    <div
      className={`card training-card${archived ? " training-card--archived" : ""}`}
    >
      <div className="card-header">
        <h3 className="card-title">{template.name}</h3>
        <div className="training-card-badges">
          <Tag>{templateStatusLabel(template.status)}</Tag>
          {template.visibility === "private" && <Tag variant="primary">Private</Tag>}
        </div>
      </div>

      <div className="card-body training-card-facts">
        <p>{template.description || "No description"}</p>
        <p>
          <strong>Duration:</strong> {trainingDurationLabel(template.duration_minutes)}
          {template.capacity ? ` · capacity ${template.capacity}` : ""}
          {template.level ? ` · ${template.level}` : ""}
        </p>
        {template.location_summary && (
          <p>
            <strong>Location:</strong> {template.location_summary}
          </p>
        )}
        {(template.group || template.coach_profile || template.organisation) && (
          <p>
            <strong>Runs with:</strong>{" "}
            {[
              template.organisation?.name,
              template.group?.name,
              template.coach_profile?.display_name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="card-footer training-card-actions">
        <button type="button" className="admin-btn" onClick={onEdit} disabled={busy}>
          <Pencil size={14} /> Edit
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onSchedule}
          disabled={busy || archived}
        >
          <CalendarPlus size={14} /> Schedule
        </button>
        <button type="button" className="admin-btn" onClick={onClone} disabled={busy}>
          <Copy size={14} /> Clone
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onToggleArchive}
          disabled={busy}
        >
          {archived ? <RotateCcw size={14} /> : <Archive size={14} />}{" "}
          {archived ? "Restore" : "Archive"}
        </button>
      </div>
    </div>
  );
}
