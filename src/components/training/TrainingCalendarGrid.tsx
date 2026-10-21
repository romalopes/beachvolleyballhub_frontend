import type { TrainingSession } from "../../api";
import Tag from "../Tag";
import { dayKey, formatTrainingTime, sessionsByDay, statusLabel } from "../../utils/training";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TrainingCalendarGridProps {
  days: Date[];
  sessions: TrainingSession[];
  range: "month" | "week";
  cursor: Date;
  onSelect: (session: TrainingSession) => void;
}

/**
 * Month/week calendar grid for the training schedule. Extracted from the former
 * standalone calendar page so the merged Training page can switch between the
 * list and this grid without duplicating the rendering.
 */
export default function TrainingCalendarGrid({
  days,
  sessions,
  range,
  cursor,
  onSelect,
}: TrainingCalendarGridProps) {
  const grouped = sessionsByDay(sessions);

  return (
    <div className={`training-calendar training-calendar-${range}`}>
      <div className="training-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="training-calendar-grid">
        {days.map((day) => {
          const key = dayKey(day);
          const daySessions = grouped.get(key) ?? [];
          const isToday = dayKey(new Date()) === key;
          const outsideMonth = range === "month" && day.getMonth() !== cursor.getMonth();
          return (
            <div
              key={key}
              className={`training-calendar-day${isToday ? " today" : ""}${outsideMonth ? " outside-month" : ""}`}
            >
              <span className="training-calendar-date">{day.getDate()}</span>
              {daySessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`training-calendar-event status-${session.status}`}
                  onClick={() => onSelect(session)}
                >
                  <span className="training-calendar-event-time">
                    {formatTrainingTime(session.starts_at, session.ends_at)}
                  </span>
                  <span className="training-calendar-event-title">{session.title}</span>
                  <Tag>{statusLabel(session.status)}</Tag>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
