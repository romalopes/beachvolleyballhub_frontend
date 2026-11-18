import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api, type ContactMessageDetail as ContactMessage } from "../../api";
import ContactMessageDetail from "./ContactMessageDetail";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      adminContactMessage: vi.fn(),
      adminUpdateContactMessage: vi.fn(),
    },
  };
});

const mockUseAuth = vi.fn();
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockedApi = vi.mocked(api, true);

const message: ContactMessage = {
  id: 7,
  name: "Jordan Smith",
  email: "jordan@example.com",
  contact_type: "general",
  contact_type_label: "General enquiry",
  subject: "Question about coaching sessions",
  // Deliberately hostile content: it must be displayed as text, never parsed.
  message: "<img src=x onerror=alert(1)> Please send more details.",
  status: "unread",
  created_at: "2026-11-14T10:00:00Z",
  read_at: null,
  archived_at: null,
  emailed_at: null,
  notified_at: null,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/settings/contact-messages/7"]}>
      <Routes>
        <Route
          path="/settings/contact-messages/:id"
          element={<ContactMessageDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: "Admin", email_address: "admin@example.com", roles: ["admin"] },
  });
  mockedApi.adminContactMessage.mockResolvedValue({ data: message });
});

describe("Contact message detail", () => {
  it("shows the sender, category, subject and plain-text body", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Question about coaching sessions" }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jordan@example.com/ })).toHaveAttribute(
      "href",
      "mailto:jordan@example.com",
    );
    expect(screen.getByText("General enquiry")).toBeInTheDocument();
  });

  it("renders user content as text, never as HTML", async () => {
    const { container } = renderPage();

    await waitFor(() =>
      expect(container.querySelector(".contact-detail-body")).not.toBeNull(),
    );

    const body = container.querySelector(".contact-detail-body");
    expect(body?.textContent).toContain("<img src=x onerror=alert(1)>");
    // No element was created from the markup.
    expect(body?.querySelector("img")).toBeNull();
  });

  it("marks a message as read after the API confirms it", async () => {
    mockedApi.adminUpdateContactMessage.mockResolvedValue({
      data: { ...message, status: "read", read_at: "2026-11-14T11:00:00Z" },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Jordan Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Mark as read/ }));

    await waitFor(() =>
      expect(mockedApi.adminUpdateContactMessage).toHaveBeenCalledWith(7, "read"),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Mark as read/ })).toBeDisabled(),
    );
  });

  it("archives a message after the API confirms it", async () => {
    mockedApi.adminUpdateContactMessage.mockResolvedValue({
      data: { ...message, status: "archived", archived_at: "2026-11-14T11:00:00Z" },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Jordan Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    await waitFor(() =>
      expect(mockedApi.adminUpdateContactMessage).toHaveBeenCalledWith(7, "archived"),
    );
  });

  it("keeps the previous state and reports a failed status change", async () => {
    mockedApi.adminUpdateContactMessage.mockRejectedValue(new Error("Forbidden"));

    renderPage();
    await waitFor(() => expect(screen.getByText("Jordan Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    await waitFor(() => expect(screen.getByText("Forbidden")).toBeInTheDocument());
    // The unread badge is unchanged because the server did not confirm.
    expect(screen.getByRole("button", { name: /Archive/ })).toBeEnabled();
  });

  it("shows an error with a retry action when the message cannot be loaded", async () => {
    mockedApi.adminContactMessage
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce({ data: message });

    renderPage();

    await waitFor(() => expect(screen.getByText("Not found")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Question about coaching sessions" }),
      ).toBeInTheDocument(),
    );
  });

  it("denies access to users who are not platform staff", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "Coach", email_address: "coach@example.com", roles: ["coach"] },
    });

    renderPage();

    expect(screen.getByText("Not authorized.")).toBeInTheDocument();
    expect(mockedApi.adminContactMessage).not.toHaveBeenCalled();
  });
});
