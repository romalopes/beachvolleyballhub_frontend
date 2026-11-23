import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type AnalysisRequestRecord } from "../api";
import AdminAnalysisRequestsPage from "./AdminAnalysisRequestsPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminAnalysisRequests: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const record: AnalysisRequestRecord = {
  id: 7,
  reference: "ANL-2026-0007",
  title: "Block timing review",
  description: null,
  package_key: "complimentary",
  price_cents: 0,
  price_aud: "Complimentary",
  workflow_status: "submitted",
  payment_status: "unpaid",
  submitted_at: "2026-11-22T09:30:00Z",
  accepted_at: null,
  completed_at: null,
  assigned_coach: null,
  account_id: null,
  guest_name: "Sam Guest",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAnalysisRequestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminAnalysisRequests.mockResolvedValue({
    data: [record],
    meta: { current_page: 1, per_page: 20, total_pages: 1, total_count: 1 },
  });
});

describe("AdminAnalysisRequestsPage", () => {
  it("lists submissions with submitter and statuses", async () => {
    renderPage();

    expect(await screen.findByText("Block timing review")).toBeInTheDocument();
    expect(screen.getByText(/Sam Guest/)).toBeInTheDocument();
    // `{ selector: "span" }` skips the identically named filter options.
    expect(screen.getByText("Submitted", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Unpaid", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("· Unassigned", { exact: false })).toBeInTheDocument();
  });

  it("links rows to the shared request detail page", async () => {
    renderPage();

    const link = await screen.findByRole("link", { name: "Block timing review" });
    expect(link).toHaveAttribute("href", "/analysis-requests/7");
  });

  it("sends the chosen status filter to the API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Block timing review");

    await user.selectOptions(screen.getByLabelText("Filter by workflow status"), "rejected");

    expect(mockedApi.adminAnalysisRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
  });
});
