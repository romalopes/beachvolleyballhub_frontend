import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResourceTable from "./ResourceTable";

describe("ResourceTable", () => {
  const columns = [
    { key: "name", label: "Name", className: "name-column", render: (row: { name: string; count: number }) => row.name },
    { key: "count", label: "Count", render: (row: { name: string; count: number }) => <strong>{row.count}</strong> },
  ];

  it("renders the configured columns and rows", () => {
    render(
      <ResourceTable
        data={[{ name: "Serving", count: 2 }, { name: "Passing", count: 4 }]}
        columns={columns}
        emptyTitle="No resources"
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Serving")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Name")).toHaveClass("name-column");
  });

  it("renders the shared empty state when there are no rows", () => {
    render(
      <ResourceTable
        data={[]}
        columns={columns}
        emptyTitle="No resources"
        emptyDescription="Create the first resource."
      />,
    );

    expect(screen.getByRole("heading", { name: "No resources" })).toBeInTheDocument();
    expect(screen.getByText("Create the first resource.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});