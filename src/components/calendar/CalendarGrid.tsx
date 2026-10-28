import type { ReactNode } from "react";
import { toISODate } from "../../utils/calendar";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps<Item> {
  days: Date[];
  itemsByDay: Map<string, Item[]>;
  cursor: Date;
  range?: "month" | "week";
  className?: string;
  ariaLabel?: string;
  renderItem: (item: Item, dayKey: string) => ReactNode;
}

/** Shared month/week grid used by training and tournament calendars. */
export default function CalendarGrid<Item>({
  days,
  itemsByDay,
  cursor,
  range = "month",
  className = "",
  ariaLabel,
  renderItem,
}: CalendarGridProps<Item>) {
  const todayKey = toISODate(new Date());

  return (
    <div
      className={["calendar", `calendar--${range}`, className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
    >
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = toISODate(day);
          const outsideMonth =
            range === "month" && day.getMonth() !== cursor.getMonth();
          return (
            <section
              key={key}
              className={`calendar-day${key === todayKey ? " today" : ""}${outsideMonth ? " outside-month" : ""}`}
              aria-label={day.toLocaleDateString()}
            >
              <span className="calendar-date">{day.getDate()}</span>
              {(itemsByDay.get(key) ?? []).map((item) => renderItem(item, key))}
            </section>
          );
        })}
      </div>
    </div>
  );
}