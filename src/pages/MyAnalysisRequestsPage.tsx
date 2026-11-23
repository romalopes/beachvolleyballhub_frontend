import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, PlusCircle } from "lucide-react";
import { api, type AnalysisRequestRecord, type AnalysisRequestListMeta } from "../api";
import PageHeader from "../components/PageHeader";
import {
  WORKFLOW_OPTIONS,
  formatDate,
  paymentLabel,
  statusTone,
  workflowLabel,
} from "../utils/analysisRequest";

/**
 * "My analysis requests" (IDENTITY-265): the signed-in submitter's own list.
 * The API scopes the collection through Pundit, so this page never filters by
 * account itself.
 */
export default function MyAnalysisRequestsPage() {
  const [records, setRecords] = useState<AnalysisRequestRecord[]>([]);
  const [meta, setMeta] = useState<AnalysisRequestListMeta | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.analysisRequests({ status: status || undefined, page });
      setRecords(response.data);
      setMeta(response.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your requests.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="page analysis-requests-page">
      <PageHeader
        title="My analysis requests"
        description="Follow every video analysis you have hired, from review through delivery."
      >
        <Link className="auth-submit" to="/hire-analysis">
          <PlusCircle size={16} aria-hidden="true" /> Hire an analysis
        </Link>
      </PageHeader>

      <div className="analysis-requests-toolbar">
        <div className="analysis-requests-filter">
          <label htmlFor="my-requests-status">Status</label>
          <select
            id="my-requests-status"
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

        {meta && (
          <span className="analysis-requests-count" aria-live="polite">
            {meta.total_count} request{meta.total_count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {loading ? (
        <div className="loading-state" role="status">
          <Loader2 size={20} className="spin" aria-hidden="true" />
          <span>Loading your requests…</span>
        </div>
      ) : records.length === 0 ? (
        <div className="success-content">
          <h2>No requests yet</h2>
          <p>Hire an analysis and your request will appear here.</p>
          <Link className="auth-submit" to="/hire-analysis">
            Choose a package
          </Link>
        </div>
      ) : (
        <ul className="analysis-request-list">
          {records.map((record) => (
            <li key={record.id} className="review-content analysis-request-row">
              <div className="analysis-request-row-header">
                <div>
                  <h3>
                    <Link to={`/analysis-requests/${record.id}`}>{record.title}</Link>
                  </h3>
                  <p className="hint">
                    {record.reference} · submitted {formatDate(record.submitted_at)}
                  </p>
                </div>
                <div className="analysis-request-badges">
                  <span className={`contact-status-badge ${statusTone(record.workflow_status)}`}>
                    {workflowLabel(record.workflow_status)}
                  </span>
                  <span className={`contact-status-badge ${statusTone(record.payment_status)}`}>
                    {paymentLabel(record.payment_status)}
                  </span>
                </div>
              </div>
              <p className="hint">
                {record.price_aud}
                {record.assigned_coach?.display_name
                  ? ` · Coach: ${record.assigned_coach.display_name}`
                  : ""}
              </p>
              <Link to={`/analysis-requests/${record.id}`}>Open request →</Link>
            </li>
          ))}
        </ul>
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