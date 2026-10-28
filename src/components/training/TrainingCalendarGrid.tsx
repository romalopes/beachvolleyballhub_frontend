import type { TrainingSession } from "../../api";
import Tag from "../Tag";
import CalendarEvent from "../calendar/CalendarEvent";
import CalendarGrid from "../calendar/CalendarGrid";
import { formatTrainingTime, sessionsByDay, statusLabel } from "../../utils/training";

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
    <CalendarGrid
      days={days}
      itemsByDay={grouped}
      cursor={cursor}
      range={range}
      className={`training-calendar training-calendar-${range}`}
      renderItem={(session) => (
        <CalendarEvent
          key={session.id}
          className={`training-calendar-event status-${session.status}`}
          onClick={() => onSelect(session)}
          eyebrow={formatTrainingTime(session.starts_at, session.ends_at)}
          title={session.title}
          details={<Tag>{statusLabel(session.status)}</Tag>}
        />
      )}
    />
  );
}
