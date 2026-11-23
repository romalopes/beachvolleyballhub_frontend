import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, FileWarning, ExternalLink, Download } from "lucide-react";
import { api, type GuestAnalysisRequest } from "../api";
import PageHeader from "../components/PageHeader";

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

        <h3>Videos</h3>
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
        {request.deliverables.length === 0 ? (
          <p className="hint">Nothing delivered yet.</p>
        ) : (
          <ul className="selected-videos">
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
      </section>

      <p className="pricing-footnote">
        Keep this page private — the link gives access to your request. Questions?{" "}
        <Link to="/contact">Contact us</Link> or reply to your confirmation email.
      </p>
    </div>
  );
}