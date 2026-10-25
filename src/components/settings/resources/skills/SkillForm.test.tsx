import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Category, type Skill } from "../../../../api";
import SkillForm from "./SkillForm";

vi.mock("../../../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      categories: vi.fn(),
      adminCreateSkill: vi.fn(),
      adminUpdateSkill: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const categories: Category[] = [
  { id: 2, name: "Passing", slug: "passing" },
  { id: 3, name: "Serving", slug: "serving" },
];
const skill: Skill = {
  id: 7,
  title: "Float Serve",
  slug: "float-serve",
  description: "Controlled float serve",
  category_id: 3,
};

describe("SkillForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.categories.mockResolvedValue(categories);
  });

  it("loads categories and validates title and category", async () => {
    render(<SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole("option", { name: "Serving" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create Skill" }));
    expect(screen.getByText("Title is required.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Title *"), "Float Serve");
    await userEvent.click(screen.getByRole("button", { name: "Create Skill" }));
    expect(screen.getByText("Category is required.")).toBeInTheDocument();
    expect(mockedApi.adminCreateSkill).not.toHaveBeenCalled();
  });

  it("creates a skill with trimmed values and a null blank description", async () => {
    const onSuccess = vi.fn();
    mockedApi.adminCreateSkill.mockResolvedValue(skill);
    render(<SkillForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await screen.findByRole("option", { name: "Serving" });
    await userEvent.type(screen.getByLabelText("Title *"), "  Float Serve  ");
    await userEvent.selectOptions(screen.getByLabelText("Category *"), "3");
    await userEvent.type(screen.getByLabelText("Description"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create Skill" }));

    await waitFor(() =>
      expect(mockedApi.adminCreateSkill).toHaveBeenCalledWith({
        title: "Float Serve",
        category_id: 3,
        description: null,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(skill);
  });

  it("updates seeded values and reports API failures", async () => {
    mockedApi.adminUpdateSkill.mockRejectedValue(new Error("Skill could not be saved"));
    render(<SkillForm initial={skill} onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByLabelText("Title *")).toHaveValue("Float Serve");
    expect(screen.getByLabelText("Category *")).toHaveValue("3");
    expect(screen.getByLabelText("Description")).toHaveValue("Controlled float serve");

    await userEvent.click(screen.getByRole("button", { name: "Update Skill" }));
    expect(await screen.findByText("Skill could not be saved")).toBeInTheDocument();
    expect(mockedApi.adminUpdateSkill).toHaveBeenCalledWith(7, {
      title: "Float Serve",
      category_id: 3,
      description: "Controlled float serve",
    });
  });
});