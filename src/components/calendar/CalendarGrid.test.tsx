import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarEvent from "./CalendarEvent";
import CalendarGrid from "./CalendarGrid";

describe("CalendarGrid", () => {
  it("renders shared weekday and day-cell structure with interactive events", () => {
    const onSelect = vi.fn();
    const day = new Date(2026, 10, 2);
    const items = new Map([["2026-11-02", [{ id: 1, title: "Beach event" }]]]);

    render(
      <CalendarGrid
        days={[day]}
        itemsByDay={items}
        cursor={day}
        ariaLabel="November calendar"
        renderItem={(item) => (
          <CalendarEvent
            key={item.id}
            onClick={() => onSelect(item.id)}
            eyebrow="Training"
            title={item.title}
            details="Scheduled"
          />
        )}
      />,
    );

    expect(screen.getByLabelText("November calendar")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
    const cell = screen.getByRole("region", { name: day.toLocaleDateString() });
    expect(within(cell).getByText("2")).toBeInTheDocument();
    within(cell).getByRole("button", { name: /beach event/i }).click();
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});