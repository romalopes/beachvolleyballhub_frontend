import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsDashboard from "./SettingsDashboard";

const mockUseAuth = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsDashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsDashboard", () => {
  it("links admins to the analysis-request inbox", () => {
    mockUseAuth.mockReturnValue({ user: { roles: ["admin"] }, loading: false });
    renderPage();

    expect(
      screen.getByRole("link", { name: /Manage Analysis Requests/ }),
    ).toHaveAttribute("href", "/admin/analysis-requests");
  });

  it("keeps the invoice ledger one click away", () => {
    mockUseAuth.mockReturnValue({ user: { roles: ["admin"] }, loading: false });
    renderPage();

    expect(screen.getByRole("link", { name: /Invoices/ })).toHaveAttribute(
      "href",
      "/settings/invoices",
    );
  });

  it("refuses non-admins", () => {
    mockUseAuth.mockReturnValue({ user: { roles: ["player"] }, loading: false });
    renderPage();

    expect(screen.getByText("Not authorized.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Manage Analysis Requests/ }),
    ).not.toBeInTheDocument();
  });
});
