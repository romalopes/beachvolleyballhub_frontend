import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type InvoiceLedger } from "../../api";
import Invoices from "./Invoices";

const mockUseAuth = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      adminInvoices: vi.fn(),
      emailAdminInvoice: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const ledger: InvoiceLedger = {
  data: [
    {
      id: 5,
      number: "INV-0005",
      amount_cents: 4900,
      amount_aud: "$49.00 AUD",
      currency: "AUD",
      status: "sent",
      external_reference: "BT-1001",
      sent_at: "2026-11-20T10:00:00Z",
      paid_at: null,
      emailed_at: null,
      created_at: "2026-11-20T09:00:00Z",
      analysis_request: {
        id: 12,
        reference: "ANL-2026-0012",
        title: "Serve consistency review",
        workflow_status: "accepted",
        payment_status: "invoice_sent",
      },
      submitter: { name: "Jane Guest", email: "jane@example.com" },
    },
  ],
  meta: { current_page: 1, per_page: 20, total_pages: 1, total_count: 1 },
  totals: { count: 1, amount_cents: 4900, amount_aud: "AUD 49.00" },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Invoices />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, roles: ["admin"] },
    loading: false,
  });
  mockedApi.adminInvoices.mockResolvedValue(ledger);
});

describe("Invoices settings page", () => {
  it("renders the ledger with totals, submitter and request link", async () => {
    renderPage();

    expect(await screen.findByText("INV-0005")).toBeInTheDocument();
    expect(screen.getByText("Jane Guest")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("$49.00 AUD")).toBeInTheDocument();
    expect(screen.getByText(/1 invoice · AUD 49.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ANL-2026-0012" })).toHaveAttribute(
      "href",
      "/analysis-requests/12",
    );
  });

  it("refetches when the status tab changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("INV-0005");

    await user.click(screen.getByRole("tab", { name: "Paid" }));

    expect(mockedApi.adminInvoices).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "paid", page: 1 }),
    );
  });

  it("sends the search term to the API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("INV-0005");

    await user.type(screen.getByLabelText("Search invoices"), "jane");
    await user.click(screen.getByRole("button", { name: /Search/ }));

    expect(mockedApi.adminInvoices).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "jane" }),
    );
  });

  it("emails an invoice PDF and confirms to staff", async () => {
    mockedApi.emailAdminInvoice.mockResolvedValue({
      queued: true,
      invoice: ledger.data[0],
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Email PDF/ }));

    expect(mockedApi.emailAdminInvoice).toHaveBeenCalledWith(5);
    expect(
      await screen.findByText(/queued for delivery to jane@example.com/),
    ).toBeInTheDocument();
  });

  it("says when the ledger is empty", async () => {
    mockedApi.adminInvoices.mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 20, total_pages: 0, total_count: 0 },
      totals: { count: 0, amount_cents: 0, amount_aud: "AUD 0.00" },
    });
    renderPage();

    expect(await screen.findByText("No invoices")).toBeInTheDocument();
  });
});
