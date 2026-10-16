import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Organisation } from "../api";
import FilterState from "./FilterState";

const organisation = (id: number, name: string): Organisation =>
  ({ id, name }) as Organisation;

describe("FilterState", () => {
  it("renders organisation names instead of raw IDs, falling back to the ID when unknown", () => {
    render(
      <FilterState
        filters={{ organisation_ids: ["12", "9"] }}
        organisations={[organisation(12, "Sydney Volleyball Club")]}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Organisations:")).toBeInTheDocument();
    expect(screen.getByText("Sydney Volleyball Club, 9")).toBeInTheDocument();
    expect(screen.queryByText(/Organisation IDs:/)).not.toBeInTheDocument();
  });

  it("maps the legacy single organisation filter to its name", () => {
    render(
      <FilterState
        filters={{ organisation_id: "12" }}
        organisations={[organisation(12, "Sydney Volleyball Club")]}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Organisation:")).toBeInTheDocument();
    expect(screen.getByText("Sydney Volleyball Club")).toBeInTheDocument();
  });
});
