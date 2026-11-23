import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type AnalysisRequestRecord } from "../api";
import MyAnalysisRequestsPage from "./MyAnalysisRequestsPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      analysisRequests: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const record: AnalysisRequestRecord = {
  id: 12,
  reference: "ANL-2026-0012",
  title: "Serve consistency review",
  description: "Please review my serve",
  package_key: "single_match",
  price_cents: 4900,
  price_aud: "$49.00 AUD",
  workflow_status: "in_progress",
  payment_status: "paid",
  submitted_at: "2026-11-20T10:00:00Z",
  accepted_at: "2026-11-20T12:00:00Z",
  completed_at: null,
  assigned_coach: { id: 3, display_name: "Coach Ana" },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <MyAnalysisRequestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.analysisRequests.mockResolvedValue({
    data: [record],
    meta: { current_page: 1, per_page: 20, total_pages: 1, total_count: 1 },
  });
});

describe("MyAnalysisRequestsPage", () => {
  it("lists the submitter's requests with status badges", async () => {
    renderPage();

    expect(await screen.findByText("Serve consistency review")).toBeInTheDocument();
    expect(screen.getByText(/ANL-2026-0012/)).toBeInTheDocument();
    expect(screen.getByText("In progress", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Paid", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Coach: Coach Ana/)).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByText("1 request")).toBeInTheDocument();
  });

  it("links each row to the request detail page", async () => {
    renderPage();

    const link = await screen.findByRole("link", { name: "Serve consistency review" });
    expect(link).toHaveAttribute("href", "/analysis-requests/12");
  });

  it("shows an empty state with a link to the hiring wizard", async () => {
    mockedApi.analysisRequests.mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 20, total_pages: 1, total_count: 0 },
    });
    renderPage();

    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose a package" })).toHaveAttribute(
      "href",
      "/hire-analysis",
    );
  });
});
