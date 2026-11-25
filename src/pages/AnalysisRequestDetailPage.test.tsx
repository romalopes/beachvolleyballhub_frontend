import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api, type AnalysisRequestRecord } from "../api";
import AnalysisRequestDetailPage from "./AnalysisRequestDetailPage";

const mockUseAuth = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      analysisRequest: vi.fn(),
      coaches: vi.fn(),
      assessmentSessions: vi.fn(),
      linkRequestAssessmentSession: vi.fn(),
      unlinkRequestAssessmentSession: vi.fn(),
      markAnalysisRequestPaid: vi.fn(),
      emailAnalysisRequestInvoice: vi.fn(),
      createAnalysisRequestMessage: vi.fn(),
      startAnalysisRequest: vi.fn(),
      addAnalysisRequestInternalNote: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const detail: AnalysisRequestRecord = {
  id: 3,
  reference: "ANL-2026-0003",
  title: "Serve consistency review",
  description: "Toss and contact point",
  package_key: "single_match",
  price_cents: 4900,
  price_aud: "$49.00 AUD",
  workflow_status: "accepted",
  payment_status: "invoice_sent",
  submitted_at: "2026-11-20T10:00:00Z",
  accepted_at: "2026-11-20T12:00:00Z",
  completed_at: null,
  assigned_coach: { id: 3, display_name: "Coach Ana" },
  videos: [
    {
      id: 1,
      source_type: "external",
      position: 0,
      external_url: "https://youtu.be/example",
      file_url: null,
    },
  ],
  messages: [
    {
      id: 5,
      body: "Thanks, reviewing this week.",
      from_submitter: false,
      internal: false,
      created_at: "2026-11-21T09:00:00Z",
    },
  ],
  deliverables: [],
  internal_notes: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/analysis-requests/3"]}>
      <Routes>
        <Route
          path="/analysis-requests/:id"
          element={<AnalysisRequestDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, roles: ["player"] },
    loading: false,
  });
  mockedApi.analysisRequest.mockResolvedValue({ analysis_request: detail });
  mockedApi.coaches.mockResolvedValue({ data: [], meta: {} } as never);
  mockedApi.assessmentSessions.mockResolvedValue({
    assessment_sessions: [
      {
        id: 7,
        name: "Thursday serve screen",
        status: "draft",
        status_label: "Draft",
        scheduled_on: "2026-12-01",
      },
    ],
    meta: {},
  } as never);
});

describe("AnalysisRequestDetailPage", () => {
  it("renders the reference, statuses, videos and conversation", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "ANL-2026-0003 — Serve consistency review",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Invoice sent")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /https:\/\/youtu.be\/example/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Thanks, reviewing this week./),
    ).toBeInTheDocument();
  });

  it("hides staff actions from submitters", async () => {
    renderPage();
    await screen.findByText("Accepted");

    expect(
      screen.queryByRole("heading", { name: "Staff actions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Internal notes (staff only)" }),
    ).not.toBeInTheDocument();
  });

  it("lets staff mark a request paid", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    mockedApi.markAnalysisRequestPaid.mockResolvedValue({
      analysis_request: {
        ...detail,
        payment_status: "paid",
        workflow_status: "in_progress",
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Mark paid" }));

    expect(mockedApi.markAnalysisRequestPaid).toHaveBeenCalledWith(3);
    expect(await screen.findByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Payment recorded — the request is ready for production/,
      ),
    ).toBeInTheDocument();
  });

  it("lets the submitter send a message to the team", async () => {
    mockedApi.createAnalysisRequestMessage.mockResolvedValue({
      message: {
        id: 11,
        body: "Any update?",
        from_submitter: true,
        internal: false,
        created_at: "2026-11-23T12:00:00Z",
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Reply"), "Any update?");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(mockedApi.createAnalysisRequestMessage).toHaveBeenCalledWith(
      3,
      "Any update?",
    );
    expect(
      await screen.findByText(
        /Message sent — the other side has been notified and emailed/,
      ),
    ).toBeInTheDocument();
  });

  it("lets staff start the analysis and then shows its progress", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    const analysis = {
      id: 44,
      title: "Serve consistency review",
      status: "draft" as const,
      available: false,
      percent: 25,
      steps: [
        {
          key: "started",
          label: "Analysis started",
          done: true,
          current: false,
        },
        { key: "review", label: "Coach review", done: false, current: true },
      ],
      video_count: 0,
      comment_count: 0,
      summary: null,
      videos: [],
      comments: [],
    };
    mockedApi.startAnalysisRequest.mockResolvedValue({
      analysis_request: { ...detail, workflow_status: "in_progress", analysis },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Start analysis" }),
    );

    expect(mockedApi.startAnalysisRequest).toHaveBeenCalledWith(3);
    expect(await screen.findByText(/Analysis created/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(screen.getByText("Coach review")).toBeInTheDocument();
    expect(
      screen.getByText(/It will appear here as soon as it is shared/),
    ).toBeInTheDocument();
  });

  it("shows the shared analysis to the submitter", async () => {
    mockedApi.analysisRequest.mockResolvedValue({
      analysis_request: {
        ...detail,
        workflow_status: "completed",
        analysis: {
          id: 44,
          title: "Serve consistency review",
          status: "published",
          available: true,
          percent: 100,
          steps: [],
          video_count: 1,
          comment_count: 1,
          summary: "Toss height improved.",
          videos: [
            {
              id: 1,
              title: "Serve clip",
              source_type: "external",
              external_url: "https://youtu.be/example",
              embed_url: null,
              playback_url: null,
            },
          ],
          comments: [
            {
              id: 2,
              body: "Keep the toss higher.",
              created_at: "2026-11-23T10:00:00Z",
              author: { id: 9, name: "Coach Ana" },
            },
          ],
        },
      },
    });
    renderPage();

    expect(
      await screen.findByText("Toss height improved."),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep the toss higher.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch" })).toHaveAttribute(
      "href",
      "https://youtu.be/example",
    );
    expect(
      screen.queryByRole("button", { name: "Start analysis" }),
    ).not.toBeInTheDocument();
  });

  it("emails the invoice as a PDF from the staff panel", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    mockedApi.emailAnalysisRequestInvoice.mockResolvedValue({
      queued: true,
      invoice: {
        id: 8,
        number: "INV-0008",
        amount_cents: 4900,
        amount_aud: "$49.00 AUD",
        currency: "AUD",
        status: "pending",
        external_reference: null,
        sent_at: null,
        paid_at: null,
        emailed_at: null,
        created_at: "2026-11-23T09:00:00Z",
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Email invoice (PDF)" }),
    );

    expect(mockedApi.emailAnalysisRequestInvoice).toHaveBeenCalledWith(3);
    const notice = await screen.findByText(/INV-0008 queued for email/);
    expect(notice).toBeInTheDocument();
    // The feedback belongs to the staff action that produced it, not the page top.
    expect(
      within(screen.getByRole("region", { name: "Staff actions" })).getByText(
        /INV-0008 queued for email/,
      ),
    ).toBe(notice);
  });

  it("shows internal notes to staff", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["curator"] },
      loading: false,
    });
    mockedApi.analysisRequest.mockResolvedValue({
      analysis_request: {
        ...detail,
        internal_notes: [
          {
            id: 1,
            body: "VIP submitter",
            created_at: "2026-11-21T10:00:00Z",
            author: { id: 9, name: "Curator Kim" },
          },
        ],
      },
    });
    renderPage();

    expect(
      await screen.findByText("Internal notes (staff only)"),
    ).toBeInTheDocument();
    expect(screen.getByText("VIP submitter")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Staff actions" }),
    ).toBeInTheDocument();
  });

  it("shows linked assessment sessions to staff and in the deliverables", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    mockedApi.analysisRequest.mockResolvedValue({
      analysis_request: {
        ...detail,
        assessment_sessions: [
          {
            id: 9,
            title: "Tuesday squad screening",
            status: "draft",
            date: "2026-11-30",
          },
        ],
      },
    });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Assessment deliverables" }),
    ).toBeInTheDocument();
    // The staff list and the public deliverables list both render the session.
    expect(screen.getAllByText("Tuesday squad screening").length).toBe(2);
    expect(screen.getByText(/Assessment · draft/)).toBeInTheDocument();
  });

  it("links an assessment session from the staff picker", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    vi.mocked(api.linkRequestAssessmentSession).mockResolvedValue({
      analysis_request: detail,
    });
    renderPage();
    await screen.findByRole("heading", { name: "Staff actions" });

    await user.selectOptions(
      screen.getByLabelText("Add assessment session"),
      "7",
    );
    await user.click(
      screen.getByRole("button", { name: /Add as deliverable/ }),
    );

    await waitFor(() => {
      expect(api.linkRequestAssessmentSession).toHaveBeenCalledWith(3, 7);
    });
  });

  it("removes an assessment session from the deliverables", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 2, roles: ["admin"] },
      loading: false,
    });
    mockedApi.analysisRequest.mockResolvedValue({
      analysis_request: {
        ...detail,
        assessment_sessions: [
          {
            id: 9,
            title: "Tuesday squad screening",
            status: "draft",
            date: "2026-11-30",
          },
        ],
      },
    });
    vi.mocked(api.unlinkRequestAssessmentSession).mockResolvedValue({
      analysis_request: detail,
    });
    renderPage();
    await screen.findByRole("heading", { name: "Assessment deliverables" });

    await user.click(screen.getByRole("button", { name: /Remove/ }));

    await waitFor(() => {
      expect(api.unlinkRequestAssessmentSession).toHaveBeenCalledWith(3, 9);
    });
  });
});
