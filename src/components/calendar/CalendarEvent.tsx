import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface CalendarEventProps {
  className?: string;
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  details?: ReactNode;
}

/** Shared event surface for calendar cells and the compact Home agenda. */
export default function CalendarEvent({
  className = "",
  to,
  onClick,
  icon,
  eyebrow,
  title,
  details,
}: CalendarEventProps) {
  const content = (
    <>
      {icon && (
        <span className="calendar-event-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="calendar-event-copy">
        {eyebrow && <span className="calendar-event-eyebrow">{eyebrow}</span>}
        <strong className="calendar-event-title">{title}</strong>
        {details && <span className="calendar-event-details">{details}</span>}
      </span>
    </>
  );
  const classes = ["calendar-event", className].filter(Boolean).join(" ");

  if (to) return <Link className={classes} to={to}>{content}</Link>;
  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
}