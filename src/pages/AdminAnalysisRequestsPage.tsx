import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, type AnalysisRequestRecord, type AnalysisRequestListMeta } from "../api";
import PageHeader from "../components/PageHeader";
import {
  PAYMENT_OPTIONS,
  WORKFLOW_OPTIONS,
  formatDate,
  paymentLabel,
  statusTone,
  workflowLabel,
} from "../utils/analysisRequest";

/**
 * Staff triage list (IDENTITY-265). Admin/Curator only — the API enforces the
 * same rule, and the router guards the page with PlatformStaffRoute.
 */
export default function AdminAnalysisRequestsPage() {
  const [records, setRecords] = useState<AnalysisRequestRecord[]>([]);
  const [meta, setMeta] = useState<AnalysisRequestListMeta | null>(null);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.adminAnalysisRequests({
        status: status || undefined,
        payment_status: paymentStatus || undefined,
        q: search.trim() || undefined,
        page,
      });
      setRecords(response.data);
      setMeta(response.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, [status, paymentStatus, search, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="Analysis requests"
        description="Review submissions, confirm scope and price, assign coaches and track payment."
      />

      <form className="filter-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label className="visually-hidden" htmlFor="admin-requests-search">
            Search by reference
          </label>
          <input
            id="admin-requests-search"
            type="search"
            placeholder="Search reference (ANL-…)"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="form-group">
          <label className="visually-hidden" htmlFor="admin-requests-status">
            Filter by workflow status
          </label>
          <select
            id="admin-requests-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {WORKFLOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="visually-hidden" htmlFor="admin-requests-payment">
            Filter by payment status
          </label>
          <select
            id="admin-requests-payment"
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All payments</option>
            {PAYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {loading ? (
        <div className="loading-state" role="status">
          <Loader2 size={20} className="spin" aria-hidden="true" />
          <span>Loading requests…</span>
        </div>
      ) : records.length === 0 ? (
        <p className="hint">No requests match these filters.</p>
      ) : (
        <div className="detail-card-grid">
          {records.map((record) => (
            <article key={record.id} className="analysis-request-card">
              <header>
                <h3>
                  <Link to={`/analysis-requests/${record.id}`}>{record.title}</Link>
                </h3>
                <p className="hint">
                  {record.reference} ·{" "}
                  {record.guest_name || record.submitter_email || `Account #${record.account_id}`} ·
                  submitted {formatDate(record.submitted_at)}
                </p>
              </header>
              <div className="analysis-request-badges">
                <span className={`contact-status-badge ${statusTone(record.workflow_status)}`}>
                  {workflowLabel(record.workflow_status)}
                </span>
                <span className={`contact-status-badge ${statusTone(record.payment_status)}`}>
                  {paymentLabel(record.payment_status)}
                </span>
              </div>
              <p className="hint">
                {record.price_aud}
                {record.assigned_coach?.display_name
                  ? ` · Coach: ${record.assigned_coach.display_name}`
                  : " · Unassigned"}
              </p>
              <Link to={`/analysis-requests/${record.id}`} className="card-link">Review request →</Link>
            </article>
          ))}
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span className="hint">
            Page {meta.current_page} of {meta.total_pages}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={page >= meta.total_pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
