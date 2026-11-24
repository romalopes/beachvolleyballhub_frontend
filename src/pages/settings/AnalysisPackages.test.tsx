import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisPackage } from "../../api";
import AnalysisPackagesSettings from "./AnalysisPackages";

const mockUseAuth = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../api", () => ({
  ApiValidationError: class ApiValidationError extends Error {
    errors: string[];
    constructor(errors: string[]) {
      super(errors.join(" "));
      this.errors = errors;
    }
  },
  api: {
    getAdminAnalysisPackages: vi.fn(),
    createAnalysisPackage: vi.fn(),
    updateAnalysisPackage: vi.fn(),
    deleteAnalysisPackage: vi.fn(),
  },
}));

const packages: AnalysisPackage[] = [
  {
    id: 1,
    key: "complimentary",
    name: "Complimentary Review",
    description: "Free introductory analysis",
    price_cents: 0,
    price_aud: "Complimentary",
    max_videos: 1,
    max_duration_minutes: 30,
    includes_annotated_video: false,
    includes_written_report: true,
    includes_consultation: false,
    turnaround_days: 14,
    active: true,
    position: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: 2,
    key: "single_match",
    name: "Single Match Analysis",
    description: "One match with written feedback",
    price_cents: 4900,
    price_aud: "$49.00 AUD",
    max_videos: 1,
    max_duration_minutes: 60,
    includes_annotated_video: false,
    includes_written_report: true,
    includes_consultation: false,
    turnaround_days: 7,
    active: false,
    position: 1,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalysisPackagesSettings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { roles: ["admin"] }, loading: false });
  vi.mocked(api.getAdminAnalysisPackages).mockResolvedValue({ data: packages });
});

describe("AnalysisPackagesSettings", () => {
  it("refuses non-admins", async () => {
    mockUseAuth.mockReturnValue({ user: { roles: ["player"] }, loading: false });
    renderPage();

    expect(screen.getByText("Not authorized.")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getAdminAnalysisPackages).not.toHaveBeenCalled();
    });
  });

  it("lists every package, including hidden ones", async () => {
    renderPage();

    expect(await screen.findByText("Complimentary Review")).toBeInTheDocument();
    expect(screen.getByText("Single Match Analysis")).toBeInTheDocument();
    // Inactive packages are visible but read as hidden.
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("$49.00 AUD")).toBeInTheDocument();
  });

  it("creates a package from the form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createAnalysisPackage).mockResolvedValue({
      package: { ...packages[0], key: "double_match" },
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /New Package/ }));
    await user.type(screen.getByLabelText("Key *"), "double_match");
    await user.type(screen.getByLabelText("Name *"), "Double Match Analysis");
    await user.type(screen.getByLabelText("Description *"), "Two matches reviewed");
    await user.click(screen.getByRole("button", { name: "Create Package" }));

    await waitFor(() => {
      expect(api.createAnalysisPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "double_match",
          name: "Double Match Analysis",
          price_cents: 0,
          max_videos: 1,
          active: true,
        }),
      );
    });
  });

  it("blocks an invalid key before calling the API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /New Package/ }));
    await user.type(screen.getByLabelText("Key *"), "Bad Key!");
    await user.type(screen.getByLabelText("Name *"), "Broken");
    await user.type(screen.getByLabelText("Description *"), "Invalid key");
    await user.click(screen.getByRole("button", { name: "Create Package" }));

    expect(await screen.findByText(/Key must use lowercase/)).toBeInTheDocument();
    expect(api.createAnalysisPackage).not.toHaveBeenCalled();
  });

  it("edits a package and disables the immutable key", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateAnalysisPackage).mockResolvedValue({ package: packages[0] });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit Complimentary Review" }));
    const keyInput = screen.getByLabelText("Key *") as HTMLInputElement;
    expect(keyInput).toBeDisabled();
    expect(keyInput).toHaveValue("complimentary");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => {
      expect(api.updateAnalysisPackage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ key: "complimentary" }),
      );
    });
  });

  it("deletes a package after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteAnalysisPackage).mockResolvedValue(undefined);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Single Match Analysis" }));
    const dialog = screen.getByText(/cannot be undone/i).closest("div") as HTMLElement;
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteAnalysisPackage).toHaveBeenCalledWith(2);
    });
  });

  it("reorders a package with the arrow buttons", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateAnalysisPackage).mockResolvedValue({ package: packages[0] });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Move Single Match Analysis up" }));

    await waitFor(() => {
      // A swap persists both rows' new positions.
      expect(api.updateAnalysisPackage).toHaveBeenCalledTimes(2);
    });
  });
});