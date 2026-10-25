import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Category } from "../../../../api";
import CategoryForm from "./CategoryForm";

vi.mock("../../../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminCreateCategory: vi.fn(),
      adminUpdateCategory: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const category: Category = { id: 4, name: "Serving", slug: "serving" };

describe("CategoryForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates a required name without calling the API", async () => {
    render(<CategoryForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Create Category" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(mockedApi.adminCreateCategory).not.toHaveBeenCalled();
  });

  it("trims and creates a category", async () => {
    const onSuccess = vi.fn();
    mockedApi.adminCreateCategory.mockResolvedValue(category);
    render(<CategoryForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Name *"), "  Serving  ");
    await userEvent.click(screen.getByRole("button", { name: "Create Category" }));

    await waitFor(() =>
      expect(mockedApi.adminCreateCategory).toHaveBeenCalledWith({ name: "Serving" }),
    );
    expect(onSuccess).toHaveBeenCalledWith(category);
  });

  it("updates seeded data and delegates cancellation", async () => {
    const onCancel = vi.fn();
    mockedApi.adminUpdateCategory.mockResolvedValue({ ...category, name: "Passing" });
    render(
      <CategoryForm initial={category} onSuccess={vi.fn()} onCancel={onCancel} />,
    );

    const name = screen.getByLabelText("Name *");
    expect(name).toHaveValue("Serving");
    await userEvent.clear(name);
    await userEvent.type(name, " Passing ");
    await userEvent.click(screen.getByRole("button", { name: "Update Category" }));
    await waitFor(() =>
      expect(mockedApi.adminUpdateCategory).toHaveBeenCalledWith(4, { name: "Passing" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows API errors and restores the form controls", async () => {
    mockedApi.adminCreateCategory.mockRejectedValue(new Error("Name has already been taken"));
    render(<CategoryForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Name *"), "Serving");
    await userEvent.click(screen.getByRole("button", { name: "Create Category" }));

    expect(await screen.findByText("Name has already been taken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Category" })).toBeEnabled();
  });
});