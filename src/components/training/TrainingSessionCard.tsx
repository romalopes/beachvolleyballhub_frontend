import { CalendarDays, Clock, MapPin, Repeat } from "lucide-react";
import type { TrainingSession } from "../../api";
import Tag from "../Tag";
import {
  formatTrainingTime,
  isPrivateSession,
  statusLabel,
  trainingDurationLabel,
} from "../../utils/training";

interface TrainingSessionCardProps {
  session: TrainingSession;
  onClick?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * A training session as a tournament-style card: the same card/badge anatomy as
 * TournamentCard so the two directories read the same way.
 */
export default function TrainingSessionCard({
  session,
  onClick,
}: TrainingSessionCardProps) {
  const duration = session.duration_minutes;

  return (
    <div
      className={`card training-card${session.status === "cancelled" ? " training-card--cancelled" : ""}${
        session.training_series_id ? " training-card--series" : ""
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
        <h3 className="card-title">{session.title}</h3>
        <div className="training-card-badges">
          <Tag>{statusLabel(session.status)}</Tag>
          {isPrivateSession(session) && <Tag variant="primary">Private</Tag>}
          {session.training_series_id && <Tag variant="teal">Recurring</Tag>}
        </div>
      </div>

      <div className="card-body training-card-facts">
        <p>
          <CalendarDays size={14} aria-hidden="true" /> {formatDate(session.starts_at)}
        </p>
        <p>
          <Clock size={14} aria-hidden="true" />{" "}
          {formatTrainingTime(session.starts_at, session.ends_at)}
        </p>
        {(session.location || session.location_detail) && (
          <p>
            <MapPin size={14} aria-hidden="true" />{" "}
            {[session.location, session.location_detail].filter(Boolean).join(" · ")}
          </p>
        )}
        {session.training_series_id && session.recurrence_key && (
          <p>
            <Repeat size={14} aria-hidden="true" /> Series slot{" "}
            {session.recurrence_key.replace("T", " ")}
          </p>
        )}
      </div>

      <div className="card-footer training-card-stats">
        <span className="stat-item">
          <strong>Duration:</strong>{" "}
          {duration ? trainingDurationLabel(duration) : "—"}
        </span>
        <span className="stat-item">
          <strong>Visibility:</strong> {session.visibility}
        </span>
      </div>
    </div>
  );
}
