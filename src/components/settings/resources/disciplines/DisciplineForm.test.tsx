import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Discipline } from "../../../../api";
import DisciplineForm from "./DisciplineForm";

vi.mock("../../../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminCreateDiscipline: vi.fn(),
      adminUpdateDiscipline: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const discipline: Discipline = { id: 4, name: "Serving", slug: "serving" };

describe("DisciplineForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates a required name without calling the API", async () => {
    render(<DisciplineForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Create Discipline" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(mockedApi.adminCreateDiscipline).not.toHaveBeenCalled();
  });

  it("trims and creates a discipline", async () => {
    const onSuccess = vi.fn();
    mockedApi.adminCreateDiscipline.mockResolvedValue(discipline);
    render(<DisciplineForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Name *"), "  Serving  ");
    await userEvent.click(screen.getByRole("button", { name: "Create Discipline" }));

    await waitFor(() =>
      expect(mockedApi.adminCreateDiscipline).toHaveBeenCalledWith({ name: "Serving" }),
    );
    expect(onSuccess).toHaveBeenCalledWith(discipline);
  });

  it("updates seeded data and delegates cancellation", async () => {
    const onCancel = vi.fn();
    mockedApi.adminUpdateDiscipline.mockResolvedValue({ ...discipline, name: "Passing" });
    render(
      <DisciplineForm initial={discipline} onSuccess={vi.fn()} onCancel={onCancel} />,
    );

    const name = screen.getByLabelText("Name *");
    expect(name).toHaveValue("Serving");
    await userEvent.clear(name);
    await userEvent.type(name, " Passing ");
    await userEvent.click(screen.getByRole("button", { name: "Update Discipline" }));
    await waitFor(() =>
      expect(mockedApi.adminUpdateDiscipline).toHaveBeenCalledWith(4, { name: "Passing" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows API errors and restores the form controls", async () => {
    mockedApi.adminCreateDiscipline.mockRejectedValue(new Error("Name has already been taken"));
    render(<DisciplineForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Name *"), "Serving");
    await userEvent.click(screen.getByRole("button", { name: "Create Discipline" }));

    expect(await screen.findByText("Name has already been taken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Discipline" })).toBeEnabled();
  });
});