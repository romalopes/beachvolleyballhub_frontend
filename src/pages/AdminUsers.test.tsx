import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiValidationError } from "../api";
import AdminUsers from "./AdminUsers";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminUsers: vi.fn(),
      adminCreateUser: vi.fn(),
    },
  };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: "Admin",
      email_address: "admin@example.com",
      roles: ["admin"],
    },
  }),
}));

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminUsers.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
  });
});

describe("AdminUsers", () => {
  it("shows the API validation message when the email already exists", async () => {
    mockedApi.adminCreateUser.mockRejectedValue(
      new ApiValidationError(["Email address has already been taken"]),
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Create User" }));
    const dialog = screen.getByRole("dialog", { name: "Create New User" });
    await user.type(within(dialog).getByLabelText("Email address"), "existing@example.com");
    await user.type(within(dialog).getByLabelText("Password"), "password123");
    await user.click(within(dialog).getByRole("button", { name: "Create User" }));

    expect(mockedApi.adminCreateUser).toHaveBeenCalledWith({
      email_address: "existing@example.com",
      password: "password123",
      first_name: undefined,
      last_name: undefined,
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Email address has already been taken",
    );
    expect(dialog).toBeInTheDocument();
  });
});