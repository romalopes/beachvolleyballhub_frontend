import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import ProfileManagementDashboard from "./ProfileManagementDashboard";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return { ...actual, api: { ...actual.api,
    managementPlayerClaims: vi.fn(), managementClaimInvitations: vi.fn(), managementClaimables: vi.fn(),
    approvePlayerClaim: vi.fn(), rejectPlayerClaim: vi.fn(), createClaimInvitation: vi.fn(), revokeClaimInvitation: vi.fn(),
  } };
});

const mocked = vi.mocked(api, true);
const meta = { page: 1, per_page: 20, total: 1, total_pages: 1 };
const pendingClaim = { id: 4, player_profile_id: 9, claimable_type: "PlayerProfile" as const, claimable_id: 9, claimant_account_id: 20, claimant_account_name: "Taylor Claimant", person_id: 18, status: "pending" as const, created_at: "2026-10-01T14:30:00Z", reviewed_at: null };
const profile = { claimable_type: "PlayerProfile" as const, claimable_id: 9, display_name: "Alex Example", status: "active" as const, linked_to_account: false, can_invite: true };
const renderDashboard = () => render(<MemoryRouter><ProfileManagementDashboard /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.managementPlayerClaims.mockResolvedValue({ data: [], meta: { ...meta, total: 0, total_pages: 0 } });
  mocked.managementClaimInvitations.mockResolvedValue({ data: [], meta: { ...meta, total: 0, total_pages: 0 } });
  mocked.managementClaimables.mockResolvedValue({ data: [], meta: { ...meta, total: 0, total_pages: 0 } });
});

describe("ProfileManagementDashboard", () => {
  it("shows approval controls only when the server grants review permission", async () => {
    mocked.managementPlayerClaims.mockResolvedValueOnce({ data: [{ ...pendingClaim, can_review: false }], meta });
    renderDashboard();
    expect(await screen.findByText(/Claim #4/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("shows the claimant account link and claim date", async () => {
    mocked.managementPlayerClaims.mockResolvedValueOnce({ data: [{ ...pendingClaim, can_review: false }], meta });

    renderDashboard();

    expect(await screen.findByRole("link", { name: "Taylor Claimant" })).toHaveAttribute("href", "/accounts/20");
    expect(screen.getByText("Claimed:")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", "2026-10-01T14:30:00Z");
  });

  it("allows a permitted reviewer to approve after choosing verification evidence", async () => {
    mocked.managementPlayerClaims.mockResolvedValue({ data: [{ ...pendingClaim, can_review: true }], meta });
    mocked.approvePlayerClaim.mockResolvedValue({ ...pendingClaim, status: "approved", reviewed_at: "2026-10-02" });
    renderDashboard();
    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Verification method for claim 4"), "in_person");
    await userEvent.click(approve);
    await waitFor(() => expect(mocked.approvePlayerClaim).toHaveBeenCalledWith(4, "in_person"));
  });

  it("keeps review fields and actions isolated to each claim", async () => {
    const secondClaim = {
      ...pendingClaim,
      id: 5,
      player_profile_id: 10,
      claimable_id: 10,
      claimant_account_id: 21,
      claimant_account_name: "Morgan Claimant",
    };
    mocked.managementPlayerClaims.mockResolvedValue({
      data: [{ ...pendingClaim, can_review: true }, { ...secondClaim, can_review: true }],
      meta: { ...meta, total: 2 },
    });
    mocked.approvePlayerClaim.mockResolvedValue({ ...pendingClaim, status: "approved", reviewed_at: "2026-10-02" });
    mocked.rejectPlayerClaim.mockResolvedValue({ ...secondClaim, status: "rejected", reviewed_at: "2026-10-02" });
    renderDashboard();

    const firstVerification = await screen.findByLabelText("Verification method for claim 4");
    const secondVerification = screen.getByLabelText("Verification method for claim 5");
    const firstReason = screen.getByLabelText("Rejection reason for claim 4");
    const secondReason = screen.getByLabelText("Rejection reason for claim 5");

    await userEvent.selectOptions(firstVerification, "government_id");
    await userEvent.selectOptions(secondVerification, "in_person");
    await userEvent.type(firstReason, "First claim note");
    await userEvent.type(secondReason, "Second claim note");

    expect(firstVerification).toHaveValue("government_id");
    expect(secondVerification).toHaveValue("in_person");
    expect(firstReason).toHaveValue("First claim note");
    expect(secondReason).toHaveValue("Second claim note");

    const firstRow = firstVerification.closest("li");
    const secondRow = secondVerification.closest("li");
    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();

    await userEvent.click(within(firstRow!).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocked.approvePlayerClaim).toHaveBeenCalledWith(4, "government_id"));
    expect(mocked.rejectPlayerClaim).not.toHaveBeenCalled();

    await userEvent.click(within(secondRow!).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(mocked.rejectPlayerClaim).toHaveBeenCalledWith(5, "Second claim note"));
  });

  it("creates and displays a one-time invitation link from an eligible profile", async () => {
    mocked.managementClaimables.mockResolvedValue({ data: [profile], meta });
    mocked.createClaimInvitation.mockResolvedValue({ invitation: { id: 12, claimable_type: "PlayerProfile", claimable_id: 9 } as never, token: "one-time-token", email_delivered: false });
    renderDashboard();
    await userEvent.click(screen.getByRole("tab", { name: "Invitations" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create invite link" }));
    expect(await screen.findByLabelText("New invitation link for Alex Example")).toHaveValue("http://localhost:3000/identity#claim_token=one-time-token");
    expect(mocked.createClaimInvitation).toHaveBeenCalledWith("PlayerProfile", 9, undefined);
  });
});
