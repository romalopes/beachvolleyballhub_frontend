import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingSession } from "../../api";
import SeriesOccurrenceTable from "./SeriesOccurrenceTable";

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession =>
  ({
    id: 1,
    title: "Session",
    description: null,
    starts_at: "2026-11-02T07:00:00+11:00",
    ends_at: "2026-11-02T08:30:00+11:00",
    location: "Coogee Beach",
    status: "scheduled",
    visibility: "shared",
    created_by_id: null,
    recurrence_key: "2026-11-02T07:00",
    status_label: "Scheduled",
    cancellable: true,
    deletable: false,
    ...overrides,
  });

describe("SeriesOccurrenceTable", () => {
  it("selects every cancellable occurrence from the header checkbox", async () => {
    const onChange = vi.fn();
    const sessions = [
      session({ id: 1 }),
      session({ id: 2, recurrence_key: "2026-11-09T07:00" }),
      session({ id: 3, status: "completed", status_label: "Completed",
                recurrence_key: "2026-11-16T07:00", cancellable: false }),
    ];
    const user = userEvent.setup();

    render(
      <SeriesOccurrenceTable
        sessions={sessions}
        selected={new Set()}
        onSelectionChange={onChange}
        timeZone="Australia/Sydney"
      />,
    );

    const header = screen.getByLabelText("Select all cancellable occurrences");
    expect(header).toBeEnabled();

    await user.click(header);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0][0]].sort()).toEqual([1, 2]);
  });

  it("disables rows that cannot be acted on", () => {
    render(
      <SeriesOccurrenceTable
        sessions={[
          session({ id: 1, status: "completed", cancellable: false }),
        ]}
        selected={new Set()}
        onSelectionChange={vi.fn()}
        timeZone="Australia/Sydney"
      />,
    );

    expect(
      screen.getByLabelText("Select occurrence 2026-11-02T07:00"),
    ).toBeDisabled();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows location, coach and overridden flags", () => {
    render(
      <SeriesOccurrenceTable
        sessions={[
          session({
            id: 1,
            overridden: true,
            location_detail: "Court 1",
            coach_profile: { id: 9, display_name: "Maria Silva" },
          }),
        ]}
        selected={new Set()}
        onSelectionChange={vi.fn()}
        timeZone="Australia/Sydney"
      />,
    );

    expect(screen.getByText("Coogee Beach · Court 1")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });
});
