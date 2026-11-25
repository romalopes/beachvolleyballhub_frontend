import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisPackage } from "../api";
import HireAnalysisPage from "./HireAnalysisPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getAnalysisPackages: vi.fn(),
      postFormData: vi.fn(),
      checkEmail: vi.fn(),
    },
  };
});

// The page pulls login/register from the AuthContext; these tests render it
// without a provider, so the hook is replaced with controllable mocks.
const { loginMock, registerMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    register: registerMock,
    resetPassword: vi.fn(),
    logout: vi.fn(),
    impersonation: { active: false, realAdmin: null },
    startImpersonating: vi.fn(),
    stopImpersonating: vi.fn(),
  }),
}));

const mockedApi = vi.mocked(api, true);

const packages: AnalysisPackage[] = [
  {
    key: "complimentary",
    name: "Complimentary Review",
    description: "Free introductory analysis",
    price_cents: 0,
    price_aud: "Complimentary",
    max_videos: 1,
    max_duration_minutes: 30,
    includes_annotated_video: false,
    includes_written_report: true,
    includes_assessment: true,
    includes_consultation: false,
    turnaround_days: 14,
  },
  {
    key: "single_match",
    name: "Single Match Analysis",
    description: "One match with written feedback",
    price_cents: 4900,
    price_aud: "$49.00 AUD",
    max_videos: 1,
    max_duration_minutes: 60,
    includes_annotated_video: false,
    includes_written_report: true,
    includes_assessment: true,
    includes_consultation: false,
    turnaround_days: 7,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockedApi.getAnalysisPackages.mockResolvedValue({ data: packages });
  // Default: the probed email is not registered, so the flow offers the
  // signup card; individual tests override this.
  mockedApi.checkEmail.mockResolvedValue({
    email_address: "jane@example.com",
    registered: false,
  });
});

describe("HireAnalysisPage", () => {
  it("lists the packages from the API with their prices", async () => {
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Single Match Analysis")).toBeInTheDocument();
    expect(screen.getByText("Complimentary Review")).toBeInTheDocument();
    expect(screen.getByText("$49.00 AUD")).toBeInTheDocument();
    // The free package shows "Complimentary" both as its price and its badge.
    expect(screen.getAllByText("Complimentary").length).toBeGreaterThan(0);
  });

  it("moves to the submission form when a package is selected", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );

    expect(
      screen.getByRole("heading", { name: "Submit Analysis Request" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title *")).toBeInTheDocument();

    // Step 1 is completed, step 2 is the active step.
    const stepOne = screen.getByRole("button", { name: "Step 1: Choose Package" });
    const stepTwo = screen.getByRole("button", { name: "Step 2: Submit Request" });
    expect(stepOne).toHaveClass("completed");
    expect(stepTwo).toHaveClass("active");
    expect(stepTwo).toBeDisabled();
  });

  it("returns to package selection when step one is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    await user.click(screen.getByRole("button", { name: "Step 1: Choose Package" }));

    expect(
      screen.getByRole("heading", { name: "Hire Analysis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose Your Package" }),
    ).toBeInTheDocument();
  });

  it("validates the form before opening the review step", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    // Exact name: the step button reads "Step 2: Submit Request".
    await user.click(screen.getByRole("button", { name: "Submit Request" }));

    // Title is empty: the review step must not open, and the error is shown.
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Review Your Request" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the form open when a video URL is added", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );

    await user.type(
      screen.getByLabelText("Video URL"),
      "https://www.youtube.com/watch?v=abc123",
    );
    await user.click(screen.getByRole("button", { name: "Add URL" }));

    // "Add URL" must not submit the outer form: we stay on the form step and
    // the URL appears in the selected-videos list.
    expect(
      screen.getByRole("heading", { name: "Submit Analysis Request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/youtube\.com\/watch\?v=abc123/),
    ).toBeInTheDocument();
    expect(mockedApi.postFormData).not.toHaveBeenCalled();
  });

  it("submits from the review step and shows the success screen", async () => {
    const user = userEvent.setup();
    mockedApi.postFormData.mockResolvedValue({
      analysis_request: { id: 9, reference: "ANL-2026-0009" },
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    await user.type(screen.getByLabelText("Title *"), "Jump serve review");
    await user.type(
      screen.getByLabelText("Description / Analysis Goals *"),
      "Focus on toss height.",
    );
    await user.type(screen.getByLabelText("Name *"), "Jane Smith");
    await user.type(screen.getByLabelText("Email *"), "jane@example.com");
    await user.type(
      screen.getByLabelText("Video URL"),
      "https://www.youtube.com/watch?v=abc123",
    );
    await user.click(screen.getByRole("button", { name: "Add URL" }));
    await user.click(screen.getByRole("button", { name: "Submit Request" }));

    // Review first — nothing sent yet.
    expect(
      screen.getByRole("heading", { name: "Review Your Request" }),
    ).toBeInTheDocument();
    expect(mockedApi.postFormData).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    // Unknown email: the signup card appears first; nothing is sent yet.
    expect(
      await screen.findByRole("heading", { name: "Create your Beach Volleyball Hub account" }),
    ).toBeInTheDocument();
    expect(mockedApi.postFormData).not.toHaveBeenCalled();

    // The guest escape hatch submits without an account.
    await user.click(screen.getByRole("button", { name: "Continue as guest" }));

    expect(
      await screen.findByRole("heading", { name: "Request Submitted!" }),
    ).toBeInTheDocument();
    expect(mockedApi.postFormData).toHaveBeenCalledTimes(1);
    expect(screen.getByText("ANL-2026-0009")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View request" })).toHaveAttribute(
      "href",
      "/analysis-requests/9",
    );

    const [endpoint, body] = mockedApi.postFormData.mock.calls[0];
    expect(endpoint).toBe("/analysis_requests");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("analysis_request[package_key]")).toBe(
      "single_match",
    );
    expect((body as FormData).get("analysis_request[title]")).toBe(
      "Jump serve review",
    );
    // External videos travel as external_url; video_id is an integer FK and is
    // never sent from this form.
    expect(
      (body as FormData).get(
        "analysis_request[analysis_request_videos_attributes][0][external_url]",
      ),
    ).toBe("https://www.youtube.com/watch?v=abc123");
    expect(
      (body as FormData).get(
        "analysis_request[analysis_request_videos_attributes][0][video_id]",
      ),
    ).toBeNull();
    // A guest submission still carries the guest contact fields.
    expect((body as FormData).get("analysis_request[guest_name]")).toBe("Jane Smith");
    expect((body as FormData).get("analysis_request[guest_email]")).toBe("jane@example.com");
  });

  it("asks a returning submitter to log in when the email is registered", async () => {
    const user = userEvent.setup();
    mockedApi.checkEmail.mockResolvedValue({
      email_address: "jane@example.com",
      registered: true,
    });
    mockedApi.postFormData.mockResolvedValue({
      analysis_request: { id: 9, reference: "ANL-2026-0009" },
    });
    loginMock.mockImplementation(async () => {
      // The real AuthContext.login stores the API token as a side effect.
      localStorage.setItem("bvb_api_token", "api-token");
      return { id: 7, name: "Jane Smith", email_address: "jane@example.com", roles: [] };
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    await user.type(screen.getByLabelText("Title *"), "Jump serve review");
    await user.type(screen.getByLabelText("Description / Analysis Goals *"), "Focus on toss height.");
    await user.type(screen.getByLabelText("Name *"), "Jane Smith");
    await user.type(screen.getByLabelText("Email *"), "jane@example.com");
    await user.type(screen.getByLabelText("Video URL"), "https://www.youtube.com/watch?v=abc123");
    await user.click(screen.getByRole("button", { name: "Add URL" }));
    await user.click(screen.getByRole("button", { name: "Submit Request" }));
    await user.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    // Registered email: the inline login card is offered, not the signup one.
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0);
    expect(mockedApi.postFormData).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Log in & submit request" }));

    expect(
      await screen.findByRole("heading", { name: "Request Submitted!" }),
    ).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith("jane@example.com", "secret-password", null);
    // Signed-in submissions carry no guest fields — the backend links the
    // account (and its player profile) itself.
    const body = mockedApi.postFormData.mock.calls[0][1] as FormData;
    expect(body.get("analysis_request[guest_name]")).toBeNull();
    expect(body.get("analysis_request[guest_email]")).toBeNull();
  });

  it("creates the account from the signup card and submits the request", async () => {
    const user = userEvent.setup();
    mockedApi.postFormData.mockResolvedValue({
      analysis_request: { id: 9, reference: "ANL-2026-0009" },
    });
    registerMock.mockImplementation(async () => {
      localStorage.setItem("bvb_api_token", "api-token");
      return { id: 8, name: "Jane Smith", email_address: "jane@example.com", roles: [] };
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    await user.type(screen.getByLabelText("Title *"), "Jump serve review");
    await user.type(screen.getByLabelText("Description / Analysis Goals *"), "Focus on toss height.");
    await user.type(screen.getByLabelText("Name *"), "Jane Smith");
    await user.type(screen.getByLabelText("Email *"), "jane@example.com");
    await user.type(screen.getByLabelText("Video URL"), "https://www.youtube.com/watch?v=abc123");
    await user.click(screen.getByRole("button", { name: "Add URL" }));
    await user.click(screen.getByRole("button", { name: "Submit Request" }));
    await user.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    // The Wine Words-style benefits panel accompanies the signup fields.
    expect(
      await screen.findByRole("heading", { name: "Why create an account?" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("First name"), "Jane");
    await user.type(screen.getByLabelText("Last name"), "Smith");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account & submit" }));

    expect(
      await screen.findByRole("heading", { name: "Request Submitted!" }),
    ).toBeInTheDocument();
    expect(registerMock).toHaveBeenCalledWith(
      "Jane",
      "Smith",
      "jane@example.com",
      "secret-password",
      "secret-password",
      null,
    );
    const body = mockedApi.postFormData.mock.calls[0][1] as FormData;
    expect(body.get("analysis_request[guest_name]")).toBeNull();
  });

  it("falls back to a plain guest submission when the email probe fails", async () => {
    const user = userEvent.setup();
    mockedApi.checkEmail.mockRejectedValue(new Error("network down"));
    mockedApi.postFormData.mockResolvedValue({
      analysis_request: { id: 9, reference: "ANL-2026-0009" },
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );
    await user.type(screen.getByLabelText("Title *"), "Jump serve review");
    await user.type(screen.getByLabelText("Description / Analysis Goals *"), "Focus on toss height.");
    await user.type(screen.getByLabelText("Name *"), "Jane Smith");
    await user.type(screen.getByLabelText("Email *"), "jane@example.com");
    await user.type(screen.getByLabelText("Video URL"), "https://www.youtube.com/watch?v=abc123");
    await user.click(screen.getByRole("button", { name: "Add URL" }));
    await user.click(screen.getByRole("button", { name: "Submit Request" }));
    await user.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

    // No auth card is shown; the submission proceeds as a guest.
    expect(
      await screen.findByRole("heading", { name: "Request Submitted!" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
    expect(mockedApi.postFormData).toHaveBeenCalledTimes(1);
  });
});

  it("opens the review step once the required fields are filled", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HireAnalysisPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Select Single Match Analysis" }),
    );

    await user.type(screen.getByLabelText("Title *"), "Jump serve review");
    await user.type(
      screen.getByLabelText("Description / Analysis Goals *"),
      "Focus on toss height and contact point.",
    );
    await user.type(screen.getByLabelText("Name *"), "Jane Smith");
    await user.type(screen.getByLabelText("Email *"), "jane@example.com");

    await user.type(
      screen.getByLabelText("Video URL"),
      "https://www.youtube.com/watch?v=abc123",
    );
    await user.click(screen.getByRole("button", { name: "Add URL" }));

    // Exact name: the step button reads "Step 2: Submit Request".
    await user.click(screen.getByRole("button", { name: "Submit Request" }));

    expect(
      screen.getByRole("heading", { name: "Review Your Request" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jump serve review")).toBeInTheDocument();
    expect(mockedApi.postFormData).not.toHaveBeenCalled();
  });
