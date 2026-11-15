import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type BillingStatus, type SubscriptionPlan } from "../api";
import Subscribe from "./Subscribe";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      subscriptions: vi.fn(),
      billingStatus: vi.fn(),
      createCheckout: vi.fn(),
    },
  };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 3,
      name: "Coach",
      email_address: "coach@example.com",
      roles: ["coach"],
      organisation_memberships: [],
    },
  }),
}));

const mockedApi = vi.mocked(api, true);

const freePlan: SubscriptionPlan = {
  id: 1,
  name: "FREE",
  slug: "free",
  description: null,
  active: true,
  visible: true,
  popular: false,
  default: true,
  position: 0,
  currency: "AUD",
  yearly_price_cents: 0,
  yearly_price: "0.00",
  price_label: "Free",
  owner_scope: "both",
  included_users: 0,
  history_limit: 0,
  purchasable: false,
  stripe_price_configured: false,
  features: [],
};

const playerPlan: SubscriptionPlan = {
  id: 2,
  name: "Player",
  slug: "player",
  description: "Enhanced personal player profile.",
  active: true,
  visible: true,
  popular: true,
  default: false,
  position: 1,
  currency: "AUD",
  yearly_price_cents: 500,
  yearly_price: "5.00",
  price_label: "A$5.00/year",
  owner_scope: "personal",
  included_users: 0,
  history_limit: 0,
  purchasable: true,
  stripe_price_configured: true,
  features: [
    {
      id: 10,
      name: "Enhanced personal player profile",
      slug: "enhanced_player_profile",
      description: null,
      active: true,
      position: 0,
    },
  ],
};

const freeStatus: BillingStatus = {
  owner: { type: "Account", id: 3, name: "Coach", can_manage: true },
  plan: freePlan,
  status: "free",
  entitled: false,
  free_fallback: true,
  features: [],
  limits: {
    included_users: { value: 0, unlimited: false, label: "Owner access only" },
    history_limit: { value: 0, unlimited: false, label: "No extended history" },
  },
  usage: {
    included_users: { limit: 0, usage: 0, remaining: 0, unlimited: false, exceeded: false },
    history_limit: { limit: 0, usage: 0, remaining: 0, unlimited: false, exceeded: false },
  },
  subscription: null,
  billing_customer: { present: false, email: null },
  can_checkout: true,
  can_open_portal: false,
  can_change_plan: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.subscriptions.mockResolvedValue({
    data: [freePlan, playerPlan],
    meta: { currency: "AUD", billing_configured: true, enforcement_enabled: true },
  });
  mockedApi.billingStatus.mockResolvedValue(freeStatus);
});

describe("Subscribe", () => {
  it("renders plans, prices and features from the API catalogue", async () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Player")).toBeInTheDocument();
    expect(screen.getByText("A$5.00/year")).toBeInTheDocument();
    expect(screen.getByText("Enhanced personal player profile")).toBeInTheDocument();
    expect(screen.getByText("Included with every account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Player" })).toBeInTheDocument();
  });

  it("starts checkout with the plan slug and surfaces API errors", async () => {
    mockedApi.createCheckout.mockRejectedValue(new Error("Billing is not configured"));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Choose Player" }));

    expect(mockedApi.createCheckout).toHaveBeenCalledWith({ plan_slug: "player" });
    expect(await screen.findByText("Billing is not configured")).toBeInTheDocument();
  });
});
