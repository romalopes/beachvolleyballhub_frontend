import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, FileWarning, ExternalLink, Download } from "lucide-react";
import { api, type GuestAnalysisRequest } from "../api";
import PageHeader from "../components/PageHeader";
import AnalysisProgress from "../components/analysisRequest/AnalysisProgress";
import AssessmentSessionInlineDetail from "../components/analysisRequest/AssessmentSessionInlineDetail";

/**
 * Secure guest view of an analysis request (IDENTITY-265).
 *
 * The URL token is the only credential — there is no session. Internal notes
 * are excluded by the API, so this page can safely show messages, videos and
 * deliverables.
 */
export default function GuestAnalysisRequestPage() {
  const { token } = useParams<{ token: string }>();
  const [request, setRequest] = useState<GuestAnalysisRequest | null>(null);
  // Derive the initial state: a missing token can never load anything, so the
  // effect below does not need to "correct" it after mount.
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">(
    token ? "loading" : "invalid",
  );
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [expandedAssessmentSlug, setExpandedAssessmentSlug] = useState<string | null>(null);

  const handleExpandAssessment = (sessionPublicSlug: string) => {
    setExpandedAssessmentSlug(sessionPublicSlug);
  };

  const handleCloseAssessment = () => {
    setExpandedAssessmentSlug(null);
  };

  useEffect(() => {
    if (!token) return;

    let active = true;
    api
      .guestAnalysisRequest(token)
      .then(({ analysis_request }) => {
        if (!active) return;
        setRequest(analysis_request);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("invalid");
      });

    return () => {
      active = false;
    };
  }, [token]);

  /** Guest replies through the token; the API notifies and emails the team. */
  const sendMessage = async () => {
    const body = messageBody.trim();
    if (!token || !request || !body) return;

    setSendingMessage(true);
    setMessageError(null);
    try {
      const { message } = await api.createGuestAnalysisRequestMessage(token, body);
      setRequest({ ...request, messages: [...request.messages, message] });
      setMessageBody("");
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : "The message could not be sent.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="page">
        <div className="loading-state" role="status">
          <Loader2 size={20} className="spin" aria-hidden="true" />
          <span>Loading your request…</span>
        </div>
      </div>
    );
  }

  if (status === "invalid" || !request) {
    return (
      <div className="page">
        <PageHeader title="Request link not valid" />
        <div className="success-content">
          <FileWarning size={56} className="success-icon" aria-hidden="true" />
          <h2>This link is invalid or has expired</h2>
          <p>
            Check the confirmation email for the most recent link. If you created
            an account, sign in and open <strong>My analysis requests</strong>.
          </p>
          <Link className="auth-submit" to="/hire-analysis">
            Hire an analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={`Analysis request ${request.reference}`}
        description={request.title}
      />

      <section className="review-content" aria-labelledby="request-summary">
        <h3 id="request-summary">Summary</h3>
        <dl className="review-summary">
          <div>
            <dt>Status</dt>
            <dd>{request.workflow_status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{request.payment_status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Package</dt>
            <dd>{request.package_key ?? "Custom scope"}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{request.price_aud}</dd>
          </div>
          {request.submitted_at && (
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(request.submitted_at).toLocaleString()}</dd>
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

      <AnalysisProgress analysis={request.analysis} />

      <section className="review-content" aria-label="Request details">
        <h3 id="request-videos">Videos</h3>
        {request.videos.length === 0 ? (
          <p className="hint">No videos on file.</p>
        ) : (
          <ul className="selected-videos">
            {request.videos.map((video) => (
              <li key={video.id} className="video-item">
                {video.source_type === "external" && video.external_url ? (
                  <a href={video.external_url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" /> {video.external_url}
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

        <h3>Deliverables</h3>
        {request.deliverables.length === 0 &&
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
                  <span className="hint">Presented in the analysis section above.</span>
                </span>
                <a href="#analysis-progress">
                  <ExternalLink size={14} aria-hidden="true" /> View
                </a>
              </li>
            )}
            {(request.assessment_sessions ?? []).map((session) => (
              <li key={`assessment-${session.id}`} className="video-item">
                <span
                  onClick={() => handleExpandAssessment(session.public_slug ?? session.id.toString())}
                  style={{ cursor: 'pointer' }}
                >
                  {session.title}
                  <br />
                  <span className="hint">
                    Assessment · {session.status.replace(/_/g, " ")}
                    {session.date ? ` · ${session.date.slice(0, 10)}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="hint"
                  onClick={(e) => { e.stopPropagation(); handleExpandAssessment(session.public_slug ?? session.id.toString()); }}
                >
                  <ExternalLink size={14} aria-hidden="true" /> View
                </button>

              </li>
            ))}
            {request.deliverables.map((document) => (
              <li key={document.id} className="video-item">
                <span>{document.title}</span>
                {document.file_url && (
                  <a href={document.file_url} target="_blank" rel="noreferrer">
                    <Download size={14} aria-hidden="true" /> Download
                  </a>
                )}
              </li>
            ))}
            {expandedAssessmentSlug && request.assessment_sessions?.some(s => s.public_slug === expandedAssessmentSlug) && (
              <AssessmentSessionInlineDetail
                sessionPublicSlug={expandedAssessmentSlug}
                onClose={handleCloseAssessment}
              />
            )}
          </ul>
        )}

        <h3>Messages</h3>
        {request.messages.length === 0 ? (
          <p className="hint">No messages yet.</p>
        ) : (
          <ul className="selected-videos">
            {request.messages.map((message) => (
              <li key={message.id} className="video-item">
                <span>
                  <strong>{message.from_submitter ? "You" : "BVB team"}:</strong>{" "}
                  {message.body}
                </span>
              </li>
            ))}
          </ul>
        )}

        {messageError && (
          <p className="error-banner" role="alert">
            {messageError}
          </p>
        )}

        <div className="form-group">
          <label htmlFor="guest-message-body">Send a message</label>
          <textarea
            id="guest-message-body"
            rows={3}
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Ask the team a question about your analysis…"
          />
          <button
            type="button"
            className="auth-submit"
            disabled={sendingMessage || !messageBody.trim()}
            onClick={() => void sendMessage()}
          >
            {sendingMessage ? "Sending…" : "Send message"}
          </button>
        </div>
      </section>

      <p className="pricing-footnote">
        Keep this page private — the link gives access to your request. Questions?{" "}
        <Link to="/contact">Contact us</Link> or reply to your confirmation email.
      </p>
    </div>
  );
}