import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "./App";
import { APP_VERSION } from "./constants/versions";
import { setTestAccessToken } from "./api";

vi.mock("./pages/Home", () => ({
  default: () => <div>Home</div>,
}));

// The app bootstraps auth + data over fetch; answer every request with an
// empty JSON array so Home/Auth render without network noise.
function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, "fetch").mockImplementation((input) => {
    const url = String(input);
    // The test-access gate verifies its token on boot.
    if (url.includes("/test_access")) {
      return Promise.resolve(okJson({ authenticated: true }));
    }
    return Promise.resolve(okJson([]));
  });
  // Simulate a visitor who already has private test access.
  setTestAccessToken("test-token");
});

describe("App", () => {
  it("renders the global footer with the app version", async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.querySelector("footer.app-footer")).toBeInTheDocument();
    });
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText("Version 0.0.21")).toBeInTheDocument();
  });

  it("opens and closes the mobile sidebar without changing the desktop collapse preference", async () => {
    const user = userEvent.setup();
    render(<App />);

    const openButton = await screen.findByRole("button", { name: "Open menu" });
    const sidebar = document.getElementById("sidebar");

    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).not.toHaveClass("open");

    await user.click(openButton);

    expect(openButton).toHaveAccessibleName("Close menu");
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveClass("open");

    const closeButtons = screen.getAllByRole("button", {
      name: "Close menu",
      hidden: true,
    });
    const drawerCloseButton = closeButtons.find((button) =>
      button.classList.contains("sidebar-close-btn--mobile"),
    );
    expect(drawerCloseButton).toBeDefined();
    await user.click(drawerCloseButton!);

    expect(sidebar).not.toHaveClass("open");
    expect(window.localStorage.getItem("bvb.sidebar.collapsed")).toBeNull();
  });

  it("closes the mobile sidebar through its overlay", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(await screen.findByRole("button", { name: "Open menu" }));
    const sidebar = document.getElementById("sidebar");
    const overlay = container.querySelector(".sidebar-overlay");

    expect(sidebar).toHaveClass("open");
    expect(overlay).toBeInTheDocument();
    await user.click(overlay as HTMLElement);

    expect(sidebar).not.toHaveClass("open");
    expect(container.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });

  it("keeps mobile navigation groups expanded without clearing a saved desktop preference", async () => {
    window.localStorage.setItem("bvb.sidebar.collapsed", "true");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Open menu" }));

    expect(document.getElementById("sidebar-group-development")).not.toHaveAttribute(
      "hidden",
    );
    expect(window.localStorage.getItem("bvb.sidebar.collapsed")).toBe("true");
  });

  it("keeps the desktop collapse control and persists its preference", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const collapseButton = await screen.findByRole("button", {
      name: "Collapse menu",
      hidden: true,
    });
    await user.click(collapseButton);

    expect(container.querySelector(".app")).toHaveClass("sidebar-collapsed");
    expect(window.localStorage.getItem("bvb.sidebar.collapsed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Expand menu", hidden: true }),
    ).toBeInTheDocument();
  });

  it("shows the organisations page to a signed-out visitor", async () => {
    // The route is public read-only discovery: a visitor who types the URL sees
    // the tree instead of being bounced to Home by a role guard.
    window.history.pushState({}, "", "/organisations");
    vi.spyOn(window, "fetch").mockImplementation((input) => {
      const url = String(input);
      // The test-access gate verifies its token on boot.
      if (url.includes("/test_access")) {
        return Promise.resolve(okJson({ authenticated: true }));
      }
      if (url.includes("/organisations")) {
        return Promise.resolve(
          okJson({
            data: [],
            meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
          }),
        );
      }
      return Promise.resolve(okJson([]));
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Organisations" }),
    ).toBeInTheDocument();
  });

  it("shows an organisation detail page to a signed-out visitor", async () => {
    window.history.pushState({}, "", "/organisations/fivb");
    const orgDetail = {
      id: 1,
      name: "FIVB",
      slug: "fivb",
      description: null,
      acronym: "FIVB",
      organisation_type: "international_federation",
      status: "active",
      status_label: "Active",
      parent_organisation_id: null,
      parent_organisation: null,
      child_count: 0,
      depth: 0,
      logo_url: null,
      logo_attached: false,
      can_edit: false,
      can_delete: false,
      can_manage_members: false,
      can_approve_members: false,
      requires_approval: false,
      approval_required: false,
      default_location: null,
      created_by_account: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    vi.spyOn(window, "fetch").mockImplementation((input) => {
      const url = String(input);
      // The test-access gate verifies its token on boot.
      if (url.includes("/test_access")) {
        return Promise.resolve(okJson({ authenticated: true }));
      }
      if (url.includes("/members")) {
        return Promise.resolve(
          okJson({ organisation: { id: 1, name: "FIVB", slug: "fivb" }, data: [] }),
        );
      }
      if (url.includes("/organisations/") && url.includes("/locations")) {
        return Promise.resolve(okJson({ locations: [] }));
      }
      if (url.includes("/organisations?")) {
        return Promise.resolve(
          okJson({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } }),
        );
      }
      if (url.includes("/organisations/")) {
        return Promise.resolve(okJson(orgDetail));
      }
      if (url.includes("/locations")) {
        // The venue-candidates picker asks for a page of locations.
        return Promise.resolve(
          okJson({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } }),
        );
      }
      return Promise.resolve(okJson([]));
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "FIVB" })).toBeInTheDocument();
  });

  it("shows a training session detail page to a signed-out visitor", async () => {
    window.history.pushState({}, "", "/training/7");
    const sessionDetail = {
      id: 7,
      title: "Morning Session",
      description: null,
      starts_at: "2026-10-01T09:00:00Z",
      ends_at: "2026-10-01T11:00:00Z",
      location: "Coogee Beach",
      location_id: null,
      court_id: null,
      location_detail: null,
      status: "scheduled",
      status_label: "Scheduled",
      visibility: "shared",
      capacity: null,
      level: null,
      organisation_id: null,
      created_by_id: null,
      created_by: null,
      organisation: null,
      duration_minutes: 120,
      training_focuses: [],
      training_session_drills: [],
      canonical_location: null,
      court: null,
    };
    vi.spyOn(window, "fetch").mockImplementation((input) => {
      const url = String(input);
      // The test-access gate verifies its token on boot.
      if (url.includes("/test_access")) {
        return Promise.resolve(okJson({ authenticated: true }));
      }
      if (url.includes("/training_sessions/")) {
        return Promise.resolve(okJson(sessionDetail));
      }
      return Promise.resolve(okJson([]));
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Morning Session" }),
    ).toBeInTheDocument();
  });
});
