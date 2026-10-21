import { CalendarPlus } from "lucide-react";
import type { TrainingSeries } from "../../api";
import Tag from "../Tag";
import {
  seriesScheduleLabel,
  seriesStatusLabel,
  weekdaysLabel,
} from "../../utils/recurringTraining";

interface TrainingSeriesCardProps {
  series: TrainingSeries;
  onClick?: () => void;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A recurring series as a tournament-style card: same anatomy as the session
 * and template cards.
 */
export default function TrainingSeriesCard({
  series,
  onClick,
}: TrainingSeriesCardProps) {
  return (
    <div
      className={`card training-card training-card--series${
        series.status === "stopped" ? " training-card--archived" : ""
      }`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-header">
        <h3 className="card-title">
          {series.training_template?.name ?? `Series #${series.id}`}
        </h3>
        <div className="training-card-badges">
          <Tag>{seriesStatusLabel(series.status)}</Tag>
          {series.completed && <Tag>Finished</Tag>}
          {series.organisation && <Tag variant="teal">{series.organisation.name}</Tag>}
        </div>
      </div>

      <div className="card-body training-card-facts">
        <p>{seriesScheduleLabel(series)}</p>
        <p>
          <strong>Dates:</strong> {formatDate(series.starts_on)} →{" "}
          {formatDate(series.ends_on)}
        </p>
        <p>
          <strong>Weekdays:</strong> {weekdaysLabel(series.weekdays)}
        </p>
      </div>

      <div className="card-footer training-card-stats">
        {series.occurrence_count != null && (
          <span className="stat-item">
            <strong>Occurrences:</strong> {series.occurrence_count}
          </span>
        )}
        <span className="stat-item">
          <CalendarPlus size={14} aria-hidden="true" />{" "}
          {series.next_occurrence_at
            ? `Next ${new Date(series.next_occurrence_at).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
              })}`
            : "No upcoming occurrence"}
        </span>
      </div>
    </div>
  );
}
