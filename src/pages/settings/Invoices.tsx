import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Receipt, Search } from "lucide-react";
import {
  api,
  type AnalysisRequestInvoiceRecord,
  type InvoiceLedger,
} from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import Pagination from "../../components/settings/Pagination";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import { formatApiDate } from "../../utils/dateFormatter";

const PER_PAGE = 20;

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_TONES: Record<string, string> = {
  paid: "read",
  sent: "unread",
  pending: "",
  overdue: "archived",
  cancelled: "archived",
  refunded: "archived",
};

/**
 * Settings → Invoices: the analysis-request invoice ledger (IDENTITY-265).
 *
 * Visibility is a convenience; the API restricts every request to admin/curator
 * and only `email` writes anything (a PDF resend).
 */
export default function Invoices() {
  const { user } = useAuth();
  const isPlatformStaff = Boolean(
    user?.roles?.some((role) => role === "admin" || role === "curator"),
  );

  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [ledger, setLedger] = useState<InvoiceLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isPlatformStaff) return;

    let cancelled = false;
    // Loading is switched on where the request is triggered (requestChange),
    // never synchronously inside the effect.
    api
      .adminInvoices({ status, q: search, from, to, overdueOnly, page, per_page: PER_PAGE })
      .then((response) => {
        if (cancelled) return;
        setLedger(response);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Failed to load invoices.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlatformStaff, status, search, from, to, overdueOnly, page, reloadKey]);

  if (!isPlatformStaff) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const requestChange = (change: () => void) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    change();
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestChange(() => {
      setPage(1);
      setSearch(searchInput.trim());
    });
  };

  const clearFilters = () => {
    requestChange(() => {
      setStatus("all");
      setSearchInput("");
      setSearch("");
      setFrom("");
      setTo("");
      setOverdueOnly(false);
      setPage(1);
    });
  };

  const emailInvoice = async (invoice: AnalysisRequestInvoiceRecord) => {
    setEmailingId(invoice.id);
    setError(null);
    setNotice(null);
    try {
      await api.emailAdminInvoice(invoice.id);
      setNotice(
        `${invoice.number} queued for delivery to ${invoice.submitter?.email ?? "the submitter"} — the PDF is attached.`,
      );
      setReloadKey((key) => key + 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The invoice could not be emailed.");
    } finally {
      setEmailingId(null);
    }
  };

  const invoices = ledger?.data ?? [];
  const totals = ledger?.totals;


  return (
    <SettingsLayout
      title="Invoices"
      description="Every analysis-request invoice: filter by status, period or submitter, and email the PDF copy."
      backTo="/settings"
      backLabel="Settings"
      backFallback="/settings"
      actions={
        <span className="contact-unread-pill" aria-live="polite">
          <Receipt aria-hidden="true" size={16} />
          {totals?.count ?? 0} invoice{(totals?.count ?? 0) === 1 ? "" : "s"} ·{" "}
          {totals?.amount_aud ?? "AUD 0.00"}
        </span>
      }
    >
      <div className="contact-inbox-toolbar">
        <div className="contact-status-tabs" role="tablist" aria-label="Invoice status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={`contact-status-tab${status === tab.value ? " active" : ""}`}
              onClick={() =>
                requestChange(() => {
                  setStatus(tab.value);
                  setPage(1);
                })
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form className="contact-inbox-filters" onSubmit={applySearch} role="search">
          <label className="visually-hidden" htmlFor="invoice-search">
            Search invoices
          </label>
          <input
            id="invoice-search"
            type="search"
            placeholder="Reference, submitter or INV-…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="admin-btn">
            <Search aria-hidden="true" size={15} /> Search
          </button>

          <input
            type="date"
            aria-label="Issued from"
            value={from}
            onChange={(event) =>
              requestChange(() => {
                setFrom(event.target.value);
                setPage(1);
              })
            }
          />
          <input
            type="date"
            aria-label="Issued to"
            value={to}
            onChange={(event) =>
              requestChange(() => {
                setTo(event.target.value);
                setPage(1);
              })
            }
          />

          <label className="invoice-overdue-toggle">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) =>
                requestChange(() => {
                  setOverdueOnly(event.target.checked);
                  setPage(1);
                })
              }
            />
            Over 30 days
          </label>

          <button type="button" className="admin-btn" onClick={clearFilters}>
            Clear
          </button>
        </form>
      </div>

      {notice && (
        <p className="invoice-notice" role="status">
          {notice}
        </p>
      )}

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => requestChange(() => setReloadKey((key) => key + 1))}
        />
      ) : loading ? (
        <div className="loading">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description={
            search || from || to || overdueOnly || status !== "all"
              ? "No invoices match these filters."
              : "Invoices raised from analysis requests appear here."
          }
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table contact-inbox-table">
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Submitter</th>
                <th scope="col">Request</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Issued</th>
                <th scope="col">Emailed</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <span className="contact-sender">{invoice.number}</span>
                    {invoice.external_reference && (
                      <span className="contact-sender-email">{invoice.external_reference}</span>
                    )}
                  </td>
                  <td>
                    <span className="contact-sender">
                      {invoice.submitter?.name || "Guest"}
                    </span>
                    <span className="contact-sender-email">
                      {invoice.submitter?.email || "No email"}
                    </span>
                  </td>
                  <td>
                    {invoice.analysis_request ? (
                      <Link to={`/analysis-requests/${invoice.analysis_request.id}`}>
                        {invoice.analysis_request.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <span className="contact-sender-email">
                      {invoice.analysis_request?.title}
                    </span>
                  </td>
                  <td>{invoice.amount_aud}</td>
                  <td>
                    <span
                      className={`contact-status-badge ${STATUS_TONES[invoice.status] ?? ""}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td>{formatApiDate(invoice.created_at)}</td>
                  <td>{invoice.emailed_at ? formatApiDate(invoice.emailed_at) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={emailingId === invoice.id || !invoice.submitter?.email}
                      onClick={() => void emailInvoice(invoice)}
                    >
                      <Mail aria-hidden="true" size={14} />{" "}
                      {emailingId === invoice.id ? "Sending…" : "Email PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={ledger?.meta.current_page ?? 1}
            totalPages={ledger?.meta.total_pages ?? 1}
            totalItems={ledger?.meta.total_count ?? invoices.length}
            itemsPerPage={ledger?.meta.per_page ?? PER_PAGE}
            onPageChange={(next) => requestChange(() => setPage(next))}
          />
        </div>
      )}
    </SettingsLayout>
  );
}
