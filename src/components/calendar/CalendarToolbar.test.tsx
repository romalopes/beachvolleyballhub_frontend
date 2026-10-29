import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarRange, List } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import CalendarToolbar, { CalendarToolbarTabs } from "./CalendarToolbar";

describe("CalendarToolbar", () => {
  it("renders navigation, icon tabs, and optional secondary controls", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onToday = vi.fn();
    const onNext = vi.fn();
    const onViewChange = vi.fn();
    const onRangeChange = vi.fn();

    render(
      <CalendarToolbar
        title="October 2026"
        options={[
          { value: "list", label: "List", icon: List },
          { value: "calendar", label: "Calendar", icon: CalendarRange },
        ]}
        value="list"
        onChange={onViewChange}
        tabsAriaLabel="Schedule view"
        onPrevious={onPrevious}
        onToday={onToday}
        onNext={onNext}
        previousLabel="Previous month"
        nextLabel="Next month"
      >
        <CalendarToolbarTabs
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
          ]}
          value="month"
          onChange={onRangeChange}
          ariaLabel="Calendar range"
        />
      </CalendarToolbar>,
    );

    const viewTabs = screen.getByRole("tablist", { name: "Schedule view" });
    expect(within(viewTabs).getByRole("tab", { name: "List" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(viewTabs).getAllByRole("tab")).toHaveLength(2);
    expect(viewTabs.querySelectorAll("svg")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(within(viewTabs).getByRole("tab", { name: "Calendar" }));
    await user.click(screen.getByRole("tab", { name: "Week" }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith("calendar");
    expect(onRangeChange).toHaveBeenCalledWith("week");
  });
});