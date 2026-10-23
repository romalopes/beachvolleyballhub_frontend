import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AdminUser } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AdminUserDetail from "./AdminUserDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, adminUser: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);

const auth = (user: AuthContextValue["user"] = null): AuthContextValue => ({
  user,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
});

const adminUser: AdminUser = {
  id: 12,
  name: "Ada Lovelace",
  email_address: "ada@example.com",
  first_name: "Ada",
  last_name: "Lovelace",
  account_id: null,
  account: null,
  roles: [],
};

function renderPage() {
  return render(
    <AuthContext.Provider value={auth()}>
      <MemoryRouter initialEntries={["/admin/users/12"]}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/users" element={<div>Users list</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminUser.mockResolvedValue(adminUser);
});

describe("AdminUserDetail", () => {
  it("renders the shared library hero with the user name and a back action", async () => {
    renderPage();

    const heading = await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("header")?.className).toContain("library-hero");
    expect(
      screen.getByText("User, role, account and linked volleyball profile details."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });
});
