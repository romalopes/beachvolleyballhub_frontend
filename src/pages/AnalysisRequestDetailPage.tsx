import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  ExternalLink,
  Loader2,
  Link2,
  Unlink,
} from "lucide-react";
import {
  api,
  type AnalysisRequestRecord,
  type AssessmentSession,
  type Coach,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import AnalysisProgress from "../components/analysisRequest/AnalysisProgress";
import AssessmentSessionInlineDetail from "../components/analysisRequest/AssessmentSessionInlineDetail";

import {
  formatDate,
  paymentLabel,
  statusTone,
  workflowLabel,
} from "../utils/analysisRequest";

/**
 * One analysis request (IDENTITY-265).
 *
 * Visible to the submitter, the assigned coach and platform staff. The staff
 * action panel (accept/reject/quote/assign/invoice/payment/workflow notes) is
 * rendered only for admin/curator; the API authorises every action regardless.
 */
export default function AnalysisRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStaff = Boolean(
    user?.roles?.some((role) => role === "admin" || role === "curator"),
  );
  // Coaches can be assigned to the request; the API still checks that this coach
  // is the assigned one before creating the analysis.
  const isManager = Boolean(
    user?.roles?.some(
      (role) => role === "coach" || role === "curator" || role === "admin",
    ),
  );

  const [request, setRequest] = useState<AnalysisRequestRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Feedback is scoped to the area that produced it, so it renders next to the
  // control the staff member just used instead of at the top of the page.
  const [notice, setNotice] = useState<{
    text: string;
    area: "staff" | "message" | "analysis";
  } | null>(null);

  const [priceInput, setPriceInput] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [coachId, setCoachId] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  // Assessment session inline detail expansion
  const [expandedAssessmentSlug, setExpandedAssessmentSlug] = useState<string | null>(null);

  const handleExpandAssessment = (sessionPublicSlug: string) => {
    setExpandedAssessmentSlug(sessionPublicSlug);
  };

  const handleCloseAssessment = () => {
    setExpandedAssessmentSlug(null);
  };
  // Assessment sessions offered as deliverables; the picker lists sessions the
  // team can attach (staff only), the request itself carries the linked ones.
  const [assessmentOptions, setAssessmentOptions] = useState<
    AssessmentSession[]
  >([]);
  const [assessmentChoice, setAssessmentChoice] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setStatus("missing");
      return;
    }
    try {
      const { analysis_request } = await api.analysisRequest(Number(id));
      setRequest(analysis_request);
      setStatus("ready");
      // Initialize coachId from the request's assigned coach
      if (analysis_request.assigned_coach?.id) {
        setCoachId(String(analysis_request.assigned_coach.id));
      }
    } catch {
      setStatus("missing");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!isStaff) return;
    let active = true;
    api
      .coaches({ per_page: 100 })
      .then(({ data }) => {
        if (active) setCoaches(data);
      })
      .catch(() => {
        // The coach picker degrades to unavailable rather than blocking triage.
      });
    return () => {
      active = false;
    };
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    let active = true;
    api
      .assessmentSessions({ per_page: 50 })
      .then(({ assessment_sessions }) => {
        if (active) setAssessmentOptions(assessment_sessions);
      })
      .catch(() => {
        // The assessment picker degrades to empty rather than blocking triage.
      });
    return () => {
      active = false;
    };
  }, [isStaff]);

  // Helper to extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Helper to get YouTube thumbnail URL
  const getYouTubeThumbnail = (url: string): string | null => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : null;
  };

  // Render thumbnail for video items
  const renderVideoThumbnail = (item: { file_url?: string; title?: string; video_url?: string }) => {
    const url = item.file_url || item.video_url;
    if (!url) return null;
    
    const thumbnail = getYouTubeThumbnail(url);
    if (thumbnail) {
      return (
        <img
          src={thumbnail}
          alt={`${item.title || "Video"} thumbnail`}
          className="video-thumbnail"
          loading="lazy"
        />
      );
    }
    return (
      <div className="video-thumbnail video-thumbnail--placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      </div>
    );
  };

  const run = async (
    action: () => Promise<{ analysis_request: AnalysisRequestRecord }>,
    successMessage: string,
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { analysis_request } = await action();
      setRequest(analysis_request);
      setNotice({ text: successMessage, area: "staff" });
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "That action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };

  /** Emails the latest invoice (created if none exists) with a PDF attached. */
  const emailInvoice = async (requestId: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { invoice } = await api.emailAnalysisRequestInvoice(requestId);
      setNotice({
        text: `${invoice.number} queued for email — the submitter receives it with the PDF attached.`,
        area: "staff",
      });
      await load();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "The invoice could not be emailed.",
      );
    } finally {
      setBusy(false);
    }
  };

  /** Posts a conversation message; the API notifies and emails the other side. */
  const sendMessage = async (requestId: number) => {
    const body = messageBody.trim();
    if (!body) return;

    setSendingMessage(true);
    setError(null);
    setNotice(null);
    try {
      await api.createAnalysisRequestMessage(requestId, body);
      setMessageBody("");
      setNotice({
        text: "Message sent — the other side has been notified and emailed.",
        area: "message",
      });
      await load();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "The message could not be sent.",
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /** Links an assessment session; the submitter sees it as a deliverable. */
  const linkAssessment = (requestId: number) =>
    run(
      () =>
        api.linkRequestAssessmentSession(requestId, Number(assessmentChoice)),
      "Assessment session linked — the submitter now receives it as a deliverable.",
    );

  const unlinkAssessment = (requestId: number, sessionId: number) =>
    run(
      () => api.unlinkRequestAssessmentSession(requestId, sessionId),
      "Assessment session removed from the deliverables.",
    );

  /** Creates the linked Analysis and opens the request for production. */
  const startAnalysis = async (requestId: number) => {
    setStartingAnalysis(true);
    setError(null);
    setNotice(null);
    try {
      const { analysis_request } = await api.startAnalysisRequest(requestId);
      setRequest(analysis_request);
      setNotice({
        text: "Analysis created — the team can now work on it.",
        area: "analysis",
      });
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "The analysis could not be started.",
      );
    } finally {
      setStartingAnalysis(false);
    }
  };

  const noticeFor = (area: "staff" | "message" | "analysis") =>
    notice?.area === area ? (
      <p className="action-notice" role="status">
        {notice.text}
      </p>
    ) : null;

  if (status === "loading") {
    return (
      <div className="page">
        <div className="loading-state" role="status">
          <Loader2 size={20} className="spin" aria-hidden="true" />
          <span>Loading request…</span>
        </div>
      </div>
    );
  }

  if (status === "missing" || !request) {
    return (
      <div className="page">
        <PageHeader title="Request not found" />
        <div className="success-content">
          <h2>This request is not available</h2>
          <p>It may not exist, or you may not have access to it.</p>
          <Link className="auth-submit" to="/my/analysis-requests">
            My analysis requests
          </Link>
        </div>
      </div>
    );
  }

  const acceptPriceCents = priceInput.trim() ? Number(priceInput) : undefined;

  return (
    <div className="page">
      <PageHeader
        title={`${request.reference} — ${request.title}`}
        description={
          request.submitter_email
            ? `Submitter: ${request.guest_name || "account"} <${request.submitter_email}>`
            : undefined
        }
      >
        <div className="analysis-request-badges">
          <span
            className={`contact-status-badge ${statusTone(request.workflow_status)}`}
          >
            {workflowLabel(request.workflow_status)}
          </span>
          <span
            className={`contact-status-badge ${statusTone(request.payment_status)}`}
          >
            {paymentLabel(request.payment_status)}
          </span>
        </div>
      </PageHeader>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="review-content" aria-labelledby="request-summary">
        <h3 id="request-summary">Summary</h3>
        <dl className="review-summary">
          <div>
            <dt>Package</dt>
            <dd>{request.package_key ?? "Custom scope"}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{request.price_aud}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{formatDate(request.submitted_at)}</dd>
          </div>
          <div>
            <dt>Coach</dt>
            <dd>{request.assigned_coach?.display_name ?? "Unassigned"}</dd>
          </div>
          {request.completed_at && (
            <div>
              <dt>Completed</dt>
              <dd>{formatDate(request.completed_at)}</dd>
            </div>
          )}
        </dl>

        {request.description && (
          <>
            <h3>Analysis goals</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{request.description}</p>
          </>
        )}
      </section>

      <section className="review-content" aria-labelledby="request-videos">
        <h3 id="request-videos">Videos</h3>
        {(request.videos ?? []).length === 0 ? (
          <p className="hint">No videos on file.</p>
        ) : (
          <ul className="selected-videos">
            {(request.videos ?? []).map((video) => (
              <li key={video.id} className="video-item">
                {video.source_type === "external" && video.external_url ? (
                  <a href={video.external_url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />{" "}
                    {video.external_url}
                  </a>
                ) : (
                  <span>{video.video?.title || "Uploaded video"}</span>
                )}
                {video.file_url && (
                  <a href={video.file_url} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="review-content"
        aria-labelledby="request-deliverables"
      >
        <h3 id="request-deliverables">Deliverables</h3>
        {(request.deliverables ?? []).length === 0 &&
        (request.assessment_sessions ?? []).length === 0 &&
        !request.analysis?.available ? (
          <p className="hint">Nothing delivered yet.</p>
        ) : (
          <ul className="selected-videos">
            {request.analysis?.available && (
              <li className="video-item">
                <span>
                  Video analysis — {request.analysis.title}
                  <br />
                  <span className="hint">
                    Presented in the analysis section above.
                  </span>
                </span>
                <a href="#analysis-progress">
                  <ExternalLink size={14} aria-hidden="true" /> View
                </a>
              </li>
            )}
            {(request.assessment_sessions ?? []).map((session) => (
              <li key={`assessment-${session.id}`} className="video-item">
                <span>
                  <Link to={"/assessment-sessions/" + (session.public_slug || session.id)}>
                    <span className="video-item__thumbnail">
                      {renderVideoThumbnail({ title: session.title })}
                    </span>
                    {session.title}
                  </Link>
                  <br />
                  <span className="hint">
                    Assessment · {session.status.replace(/_/g, " ")}
                    {session.date ? ` · ${formatDate(session.date)}` : ""}
                  </span>
                </span>
                <Link to={"/assessment-sessions/" + (session.public_slug || session.id)} className="hint">
                  <ExternalLink size={14} aria-hidden="true" /> View
                </Link>
              </li>
            ))}
            {(request.deliverables ?? []).map((document) => (
              <li key={document.id} className="video-item">
                <span>{document.title}</span>
                {document.file_url && (
                  <a href={document.file_url} target="_blank" rel="noreferrer">
                    <Download size={14} aria-hidden="true" /> Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="review-content" aria-labelledby="request-messages">
        <h3 id="request-messages">Conversation</h3>
        {(request.messages ?? []).length === 0 ? (
          <p className="hint">No messages yet.</p>
        ) : (
          <ul className="selected-videos">
            {(request.messages ?? []).map((message) => (
              <li key={message.id} className="video-item">
                <span>
                  <strong>
                    {message.from_submitter ? "Submitter" : "Team"}:
                  </strong>{" "}
                  {message.body}
                  <br />
                  <span className="hint">{formatDate(message.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="form-group">
          <label htmlFor="reply-body">Reply</label>
          <textarea
            id="reply-body"
            rows={3}
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Write a message to the other side…"
          />
          <button
            type="button"
            className="auth-submit"
            disabled={sendingMessage || !messageBody.trim()}
            onClick={() => void sendMessage(request.id)}
          >
            {sendingMessage ? "Sending…" : "Send message"}
          </button>
        </div>
        {noticeFor("message")}
      </section>

      <AnalysisProgress
        analysis={request.analysis}
        canStart={
          isManager &&
          !request.analysis &&
          ["accepted", "awaiting_payment", "in_progress"].includes(
            request.workflow_status,
          )
        }
        starting={startingAnalysis}
        onStart={() => void startAnalysis(request.id)}
        editorHref={
          isManager && request.analysis
            ? `/analyses/${request.analysis.id}/edit`
            : undefined
        }
      />
      {noticeFor("analysis")}

      {isStaff && (
        <>
          <section className="review-content" aria-labelledby="staff-actions">
            <h3 id="staff-actions">Staff actions</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="accept-price">Accept with price (cents)</label>
                <input
                  id="accept-price"
                  type="number"
                  min={0}
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder={String(request.price_cents)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="assign-coach">Assign coach</label>
                <select
                  id="assign-coach"
                  value={coachId}
                  onChange={(event) => setCoachId(event.target.value)}
                >
                  <option value="">Choose a coach…</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.display_name ??
                        coach.full_name ??
                        `Coach #${coach.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="contact-detail-actions">
              <button
                type="button"
                className="auth-submit"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.acceptAnalysisRequest(request.id, acceptPriceCents),
                    "Request accepted — the submitter has been notified.",
                  )
                }
              >
                Accept
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !coachId}
                onClick={() =>
                  run(
                    () =>
                      api.assignAnalysisRequestCoach(
                        request.id,
                        Number(coachId),
                      ),
                    "Coach assigned to this request.",
                  )
                }
              >
                Assign coach
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !priceInput}
                onClick={() =>
                  run(
                    () =>
                      api.quoteAnalysisRequest(request.id, Number(priceInput)),
                    "Quote sent to the submitter.",
                  )
                }
              >
                Send quote
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.markAnalysisRequestInvoiceSent(
                        request.id,
                        invoiceReference || undefined,
                      ),
                    "Invoice marked as sent.",
                  )
                }
              >
                Mark invoice sent
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void emailInvoice(request.id)}
              >
                Email invoice (PDF)
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.markAnalysisRequestPaid(request.id),
                    "Payment recorded — the request is ready for production.",
                  )
                }
              >
                Mark paid
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.startAnalysisRequestWork(request.id),
                    "Work started on this request.",
                  )
                }
              >
                Start work
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.completeAnalysisRequest(request.id),
                    "Request completed — the submitter can now see the analysis.",
                  )
                }
              >
                Complete
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Cancel this request?")) {
                    void run(
                      () => api.cancelAnalysisRequest(request.id),
                      "Request cancelled.",
                    );
                  }
                }}
              >
                Cancel
              </button>
            </div>
            {noticeFor("staff")}

            <div className="form-group">
              <label htmlFor="invoice-reference">
                Invoice reference (optional)
              </label>
              <input
                id="invoice-reference"
                type="text"
                value={invoiceReference}
                onChange={(event) => setInvoiceReference(event.target.value)}
                placeholder="e.g. INV-1042"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reject-reason">Rejection reason</label>
              <input
                id="reject-reason"
                type="text"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Why is this request being rejected?"
              />
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !rejectReason.trim()}
                onClick={() =>
                  run(
                    () =>
                      api.rejectAnalysisRequest(
                        request.id,
                        rejectReason.trim(),
                      ),
                    "Request rejected — the submitter has been notified.",
                  )
                }
              >
                Reject request
              </button>
            </div>
          </section>

          <section
            className="review-content"
            aria-labelledby="assessment-deliverables"
          >
            <h3 id="assessment-deliverables">
              <Link2 size={16} aria-hidden="true" /> Assessment deliverables
            </h3>
            <p className="hint">
              Linked assessment sessions are delivered to the submitter
              alongside the analysis.
            </p>

            {(request.assessment_sessions ?? []).length === 0 ? (
              <p className="hint">No assessment sessions linked yet.</p>
            ) : (
              <ul className="selected-videos">
                {(request.assessment_sessions ?? []).map((session) => (
                  <li key={session.id} className="video-item">
                    <span
                      onClick={() => handleExpandAssessment(session.public_slug ?? session.id.toString())}
                      style={{ cursor: 'pointer' }}
                    >
                      {session.title}
                      <br />
                      <span className="hint">
                        {session.status.replace(/_/g, " ")}
                        {session.date ? ` · ${formatDate(session.date)}` : ""}
                      </span>
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="hint"
                        onClick={(e) => { e.stopPropagation(); handleExpandAssessment(session.public_slug ?? session.id.toString()); }}
                      >
                        <ExternalLink size={14} aria-hidden="true" /> View
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); void unlinkAssessment(request.id, session.id); }}
                      >
                        <Unlink size={14} aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {expandedAssessmentSlug && request.assessment_sessions?.some(s => s.public_slug === expandedAssessmentSlug) && (
              <AssessmentSessionInlineDetail
                sessionPublicSlug={expandedAssessmentSlug}
                onClose={handleCloseAssessment}
              />
            )}

            <div className="form-group">
              <label htmlFor="assessment-session">Add assessment session</label>
              <div className="contact-detail-actions">
                <select
                  id="assessment-session"
                  value={assessmentChoice}
                  onChange={(event) => setAssessmentChoice(event.target.value)}
                >
                  <option value="">Choose a session…</option>
                  {assessmentOptions
                    .filter(
                      (session) =>
                        !(request.assessment_sessions ?? []).some(
                          (linked) => linked.id === session.id,
                        ),
                    )
                    .map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                        {session.scheduled_on
                          ? ` · ${session.scheduled_on}`
                          : ""}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="auth-submit"
                  disabled={busy || !assessmentChoice}
                  onClick={() => void linkAssessment(request.id)}
                >
                  <Link2 size={14} aria-hidden="true" /> Add as deliverable
                </button>
              </div>
            </div>
          </section>

          <section className="review-content" aria-labelledby="internal-notes">
            <h3 id="internal-notes">Internal notes (staff only)</h3>
            {(request.internal_notes ?? []).length === 0 ? (
              <p className="hint">No internal notes yet.</p>
            ) : (
              <ul className="selected-videos">
                {(request.internal_notes ?? []).map((note) => (
                  <li key={note.id} className="video-item">
                    <span>
                      {note.body}
                      <br />
                      <span className="hint">
                        {note.author.name} · {formatDate(note.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="form-group">
              <label htmlFor="internal-note-body">Add a note</label>
              <textarea
                id="internal-note-body"
                rows={3}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Context for the team…"
              />
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !noteBody.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api.addAnalysisRequestInternalNote(
                      request.id,
                      noteBody.trim(),
                    );
                    setNoteBody("");
                    await load();
                  } catch (e: unknown) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "The note could not be saved.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save note
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
