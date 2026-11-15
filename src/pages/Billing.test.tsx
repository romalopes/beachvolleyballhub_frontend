import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type BillingStatus } from "../api";
import Billing from "./Billing";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      billingStatus: vi.fn(),
      billingHistory: vi.fn(),
      changeSubscription: vi.fn(),
      createBillingPortal: vi.fn(),
    },
  };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 3, name: "Coach", email_address: "coach@example.com", roles: ["coach"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const paidStatus: BillingStatus = {
  owner: { type: "Account", id: 3, name: "Coach", can_manage: true },
  plan: {
    id: 2,
    name: "Coach",
    slug: "coach",
    description: null,
    active: true,
    visible: true,
    popular: false,
    default: false,
    position: 2,
    currency: "AUD",
    yearly_price_cents: 1000,
    yearly_price: "10.00",
    price_label: "A$10.00/year",
    owner_scope: "personal",
    included_users: 0,
    history_limit: 0,
    purchasable: true,
    stripe_price_configured: true,
    features: [
      {
        id: 11,
        name: "Advanced training planning",
        slug: "advanced_training_planning",
        description: null,
        active: true,
        position: 1,
      },
    ],
  },
  status: "active",
  entitled: true,
  free_fallback: false,
  features: [
    {
      id: 11,
      name: "Advanced training planning",
      slug: "advanced_training_planning",
      description: null,
      active: true,
      position: 1,
    },
  ],
  limits: {
    included_users: { value: 0, unlimited: false, label: "Owner access only" },
    history_limit: { value: 0, unlimited: false, label: "No extended history" },
  },
  usage: {
    included_users: { limit: 0, usage: 0, remaining: 0, unlimited: false, exceeded: false },
    history_limit: { limit: 0, usage: 0, remaining: 0, unlimited: false, exceeded: false },
  },
  subscription: {
    id: 9,
    status: "active",
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    current_period_start: "2026-01-01T00:00:00Z",
    current_period_end: "2027-01-01T00:00:00Z",
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    grace_period_ends_at: null,
    last_synced_at: "2026-01-01T00:00:00Z",
    pending_change: null,
  },
  billing_customer: { present: true, email: "coach@example.com" },
  can_checkout: false,
  can_open_portal: true,
  can_change_plan: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.billingStatus.mockResolvedValue(paidStatus);
  mockedApi.billingHistory.mockResolvedValue({
    owner: { type: "Account", id: 3 },
    data: [],
  });
});

describe("Billing", () => {
  it("shows the plan, renewal date, features and payment actions", async () => {
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Coach" })).toBeInTheDocument();
    expect(screen.getByText("A$10.00/year")).toBeInTheDocument();
    expect(screen.getByText("Advanced training planning")).toBeInTheDocument();
    expect(screen.getByText(/Renews/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Manage payment method & invoices/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("No subscription changes yet.")).toBeInTheDocument();
  });

  it("requests cancellation at period end and reloads the status", async () => {
    mockedApi.changeSubscription.mockResolvedValue({
      status: "cancellation_requested",
      message: "The subscription stays active until the end of the paid period.",
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Cancel at period end" }));

    expect(mockedApi.changeSubscription).toHaveBeenCalledWith({ action: "cancel" });
    expect(
      await screen.findByText("The subscription stays active until the end of the paid period."),
    ).toBeInTheDocument();
  });
});
