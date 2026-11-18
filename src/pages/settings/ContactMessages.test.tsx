import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type ContactMessageInbox } from "../../api";
import ContactMessages from "./ContactMessages";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      adminContactMessages: vi.fn(),
    },
  };
});

const mockUseAuth = vi.fn();
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockedApi = vi.mocked(api, true);

const inbox: ContactMessageInbox = {
  data: [
    {
      id: 1,
      name: "Jordan Smith",
      email: "jordan@example.com",
      contact_type: "general",
      contact_type_label: "General enquiry",
      subject: "Question about coaching sessions",
      status: "unread",
      created_at: "2026-11-14T10:00:00Z",
      read_at: null,
      archived_at: null,
      emailed_at: null,
      notified_at: null,
    },
    {
      id: 2,
      name: "Sam Lee",
      email: "sam@example.com",
      contact_type: "feedback",
      contact_type_label: "Feedback or suggestion",
      subject: "Suggestion for the calendar",
      status: "archived",
      created_at: "2026-11-13T09:00:00Z",
      read_at: "2026-11-13T10:00:00Z",
      archived_at: "2026-11-13T11:00:00Z",
      emailed_at: null,
      notified_at: null,
    },
  ],
  meta: { page: 1, per_page: 20, total: 2, total_pages: 1 },
  counts: { all: 2, unread: 1, read: 0, archived: 1 },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContactMessages />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: "Admin", email_address: "admin@example.com", roles: ["admin"] },
  });
  mockedApi.adminContactMessages.mockResolvedValue(inbox);
});

describe("Contact Messages inbox", () => {
  it("lists messages with status, sender, category and subject", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Question about coaching sessions"),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    expect(screen.getByText("jordan@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("General enquiry").length).toBeGreaterThan(0);
    expect(document.querySelector(".contact-status-badge.unread")).toHaveTextContent(
      "Unread",
    );
    expect(document.querySelector(".contact-status-badge.archived")).toHaveTextContent(
      "Archived",
    );
  });

  it("shows the unread count from the server without counting archived messages", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("1 unread")).toBeInTheDocument());
  });

  it("filters by status and resets paging", async () => {
    renderPage();
    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenCalledTimes(1),
    );

    await userEvent.click(screen.getByRole("tab", { name: /Unread/ }));

    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "unread", page: 1 }),
      ),
    );
  });

  it("filters by category", async () => {
    renderPage();
    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenCalledTimes(1),
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Filter by category"),
      "feedback",
    );

    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ contact_type: "feedback" }),
      ),
    );
  });

  it("searches by sender, email or subject on submit", async () => {
    renderPage();
    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenCalledTimes(1),
    );

    await userEvent.type(screen.getByLabelText("Search messages"), "jordan");
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));

    await waitFor(() =>
      expect(mockedApi.adminContactMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "jordan" }),
      ),
    );
  });

  it("shows an empty state when no message matches", async () => {
    mockedApi.adminContactMessages.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
      counts: { all: 0, unread: 0, read: 0, archived: 0 },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No contact messages")).toBeInTheDocument(),
    );
  });

  it("shows an error with a retry action", async () => {
    mockedApi.adminContactMessages
      .mockRejectedValueOnce(new Error("Forbidden"))
      .mockResolvedValueOnce(inbox);

    renderPage();

    await waitFor(() => expect(screen.getByText("Forbidden")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() =>
      expect(
        screen.getByText("Question about coaching sessions"),
      ).toBeInTheDocument(),
    );
  });

  it("denies access to users who are not platform staff", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "Coach", email_address: "coach@example.com", roles: ["coach"] },
    });

    renderPage();

    expect(screen.getByText("Not authorized.")).toBeInTheDocument();
    expect(mockedApi.adminContactMessages).not.toHaveBeenCalled();
  });

  it("allows a platform curator", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 3,
        name: "Curator",
        email_address: "curator@example.com",
        roles: ["curator"],
      },
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Question about coaching sessions"),
      ).toBeInTheDocument(),
    );
  });
});
