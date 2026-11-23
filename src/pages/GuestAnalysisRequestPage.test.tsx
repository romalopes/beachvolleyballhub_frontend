import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type GuestAnalysisRequest } from "../api";
import GuestAnalysisRequestPage from "./GuestAnalysisRequestPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      guestAnalysisRequest: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const request: GuestAnalysisRequest = {
  id: 1,
  reference: "ANL-2026-0007",
  title: "Jump serve review",
  description: "Focus on toss height.",
  package_key: "single_match",
  price_cents: 4900,
  price_aud: "$49.00 AUD",
  workflow_status: "submitted",
  payment_status: "unpaid",
  submitted_at: "2026-11-23T01:00:00Z",
  accepted_at: null,
  completed_at: null,
  guest_name: "Jane Guest",
  guest_email: "jane@example.com",
  videos: [
    {
      id: 3,
      source_type: "external",
      external_url: "https://youtu.be/abc123",
      file_url: null,
      video: null,
    },
  ],
  deliverables: [],
  messages: [
    {
      id: 9,
      body: "Thanks, we are reviewing your footage.",
      from_submitter: false,
      internal: false,
      created_at: "2026-11-23T02:00:00Z",
    },
  ],
};

const renderPage = (token = "tok-123") =>
  render(
    <MemoryRouter initialEntries={[`/analysis/guest/${token}`]}>
      <Routes>
        <Route path="/analysis/guest/:token" element={<GuestAnalysisRequestPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GuestAnalysisRequestPage", () => {
  it("shows the request, videos, messages and price for a valid token", async () => {
    mockedApi.guestAnalysisRequest.mockResolvedValue({ analysis_request: request });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /ANL-2026-0007/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jump serve review")).toBeInTheDocument();
    expect(screen.getByText("$49.00 AUD")).toBeInTheDocument();
    expect(screen.getByText(/submitted/)).toBeInTheDocument();
    expect(screen.getByText("https://youtu.be/abc123")).toBeInTheDocument();
    expect(
      screen.getByText(/Thanks, we are reviewing your footage/),
    ).toBeInTheDocument();

    expect(mockedApi.guestAnalysisRequest).toHaveBeenCalledWith("tok-123");
  });

  it("explains the link is invalid when the token is unknown", async () => {
    mockedApi.guestAnalysisRequest.mockRejectedValue(new Error("Not found"));

    renderPage("bad-token");

    expect(
      await screen.findByRole("heading", { name: "Request link not valid" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This link is invalid or has expired/),
    ).toBeInTheDocument();
  });
});