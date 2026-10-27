import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Account } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AccountPage from "./Account";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { ...actual.api, account: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const savedAccount: Account = {
  id: 9,
  first_name: "Alex",
  last_name: "Player",
  full_name: "Alex Player",
  email: "alex@example.com",
  phone: null,
  date_of_birth: null,
  address: {
    street_address: "100 Ocean Drive",
    city: "Miami Beach",
    state: "FL",
    postal_code: "33139",
    country: "USA",
  },
};
const auth: AuthContextValue = {
  user: { id: 7, name: "Alex Player", email_address: "alex@example.com", roles: ["player"] },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_GOOGLE_MAPS_EMBED_API_KEY", "embed-key");
  mockedApi.account.mockResolvedValue(savedAccount);
});

afterEach(() => vi.unstubAllEnvs());

describe("AccountPage location", () => {
  it("shows the logged-in person's address in a Google Maps frame", async () => {
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/account"]}>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByRole("heading", { name: "Your location" })).toBeInTheDocument();
    expect(screen.getByText("100 Ocean Drive, Miami Beach, FL, 33139, USA")).toBeInTheDocument();

    const source = new URL(screen.getByTitle("Map of Alex Player").getAttribute("src") ?? "");
    expect(source.origin + source.pathname).toBe("https://www.google.com/maps/embed/v1/place");
    expect(source.searchParams.get("q")).toBe("100 Ocean Drive, Miami Beach, FL, 33139, USA");

    const link = new URL(
      screen.getByRole("link", { name: /open in google maps/i }).getAttribute("href") ?? "",
    );
    expect(link.searchParams.get("query")).toBe("100 Ocean Drive, Miami Beach, FL, 33139, USA");
  });

  it("explains how to enable the map when the account has no address", async () => {
    mockedApi.account.mockResolvedValue({
      ...savedAccount,
      address: {
        street_address: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
      },
    });

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/account"]}>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByRole("heading", { name: "Your location" })).toBeInTheDocument();
    expect(
      screen.getByText("Add your address above to show your location on Google Maps."),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
