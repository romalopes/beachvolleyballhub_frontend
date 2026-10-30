import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AdminUser } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AdminUserDetail from "./AdminUserDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminUser: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  };
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

const pendingUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  ...adminUser,
  account_id: 24,
  email_verified: false,
  invitation_accepted: false,
  account: {
    id: 24,
    first_name: "Ada",
    last_name: "Lovelace",
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    date_of_birth: null,
    address: {
      street_address: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
    },
    player_profiles: [],
    coach_profiles: [],
    organisation_memberships: [],
    group_memberships: [],
  },
  ...overrides,
});

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
  mockedApi.requestPasswordReset.mockResolvedValue(undefined);
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

  it("shows a prefilled invitation control for an unverified user without an accepted invitation", async () => {
    mockedApi.adminUser.mockResolvedValue(pendingUser());

    renderPage();

    expect(await screen.findByRole("heading", { name: "Invitation" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue(
      "ada@example.com",
    );
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeEnabled();
  });

  it("hides the invitation section when the email is verified", async () => {
    mockedApi.adminUser.mockResolvedValue(pendingUser({ email_verified: true }));

    renderPage();

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(screen.queryByRole("heading", { name: "Invitation" })).not.toBeInTheDocument();
  });

  it("hides the invitation section when an invitation has already been accepted", async () => {
    mockedApi.adminUser.mockResolvedValue(pendingUser({ invitation_accepted: true }));

    renderPage();

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(screen.queryByRole("heading", { name: "Invitation" })).not.toBeInTheDocument();
  });

  it("sends an invitation to the controlled email address", async () => {
    const user = userEvent.setup();
    mockedApi.adminUser.mockResolvedValue(pendingUser());

    renderPage();

    const email = await screen.findByRole("textbox", { name: "Email address" });
    await user.clear(email);
    await user.type(email, " New.Address@Example.com ");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(mockedApi.requestPasswordReset).toHaveBeenCalledWith(
      "new.address@example.com",
    );
    expect(
      await screen.findByText(
        "Invitation email sent to new.address@example.com. The user can now set their password.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error when invitation delivery fails", async () => {
    const user = userEvent.setup();
    mockedApi.adminUser.mockResolvedValue(pendingUser());
    mockedApi.requestPasswordReset.mockRejectedValue(new Error("Delivery unavailable"));

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Send invitation" }),
    );

    expect(await screen.findByText("Delivery unavailable")).toHaveClass(
      "invitation-status",
      "error",
    );
  });

  it("disables the invitation controls while sending", async () => {
    const user = userEvent.setup();
    let resolveRequest!: () => void;
    mockedApi.adminUser.mockResolvedValue(pendingUser());
    mockedApi.requestPasswordReset.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRequest = resolve; }),
    );

    renderPage();

    const email = await screen.findByRole("textbox", { name: "Email address" });
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(email).toBeDisabled();

    resolveRequest();
    expect(
      await screen.findByRole("button", { name: "Send invitation" }),
    ).toBeEnabled();
  });
});
