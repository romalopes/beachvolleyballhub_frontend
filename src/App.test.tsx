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
});
