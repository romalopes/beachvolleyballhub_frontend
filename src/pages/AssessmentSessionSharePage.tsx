import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2, ArrowLeft, Share2, Copy, Check, Calendar, User, Trophy } from "lucide-react";
import { api } from "../api";
import type { AssessmentSession } from "../api";
import { useAuth } from "../auth/AuthContext";
import { formatApiDate } from "../utils/dateFormatter";
import { Helmet } from "react-helmet-async";

export default function AssessmentSessionSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const returnTo = searchParams.get("returnTo") || `/assessments/share/${shareToken}`;

  const [state, setState] = useState<{
    status: "loading" | "success" | "error";
    data?: AssessmentSession;
    error?: string;
  }>({ status: "loading" });
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!shareToken) {
      setState({ status: "error", error: "Invalid share link" });
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const data = await api.assessmentSessionByShareToken(shareToken);
        if (!cancelled) {
          setState({ status: "success", data: data.assessment_session });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", error: error instanceof Error ? error.message : "Failed to load share" });
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [shareToken]);

  if (state.status === "loading") {
    return (
      <div className="assessment-share-report loading">
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </Helmet>
        <div className="assessment-share-report__spinner">
          <Loader2 size={48} className="assessment-share-report__loader" />
          <p>Loading assessment session...</p>
        </div>
      </div>
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <div className="assessment-share-report error">
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </Helmet>
        <div className="assessment-share-report__error">
          <AlertCircle size={64} className="assessment-share-report__error-icon" />
          <h1>Session Unavailable</h1>
          <p>{state.error || "This assessment session could not be loaded. The link may have expired or been revoked."}</p>
          <Link to="/" className="assessment-share-report__home-link">
            <ArrowLeft size={18} />
            Go to BeachVolleyballHub
          </Link>
        </div>
      </div>
    );
  }

  const session = state.data;
  const canonicalUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      console.error("Copy failed");
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: session.name,
          text: `Beach volleyball assessment: ${session.name}`,
          url: canonicalUrl,
        });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Share failed:", error);
      }
    } finally {
      setSharing(false);
    }
  };

  const handleLogin = () => {
    navigate(`/identity?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const getInclusionLabel = (inclusion: string) => {
    switch (inclusion) {
      case "included": return "Included";
      case "incomplete": return "Incomplete";
      case "excluded": return "Excluded";
      default: return inclusion;
    }
  };

  const getInclusionColor = (inclusion: string) => {
    switch (inclusion) {
      case "included": return "text-green-700 bg-green-100";
      case "incomplete": return "text-amber-700 bg-amber-100";
      case "excluded": return "text-red-700 bg-red-100";
      default: return "text-gray-700 bg-gray-100";
    }
  };

  return (
    <div className="assessment-share-report">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Helmet>
      <header className="assessment-share-report__header">
        <Link to="/" className="assessment-share-report__back">
          <ArrowLeft size={20} />
          <span>Back to Hub</span>
        </Link>
        <div className="assessment-share-report__actions">
          <button
            className="assessment-share-report__action-btn"
            onClick={handleShare}
            disabled={sharing}
          >
            <Share2 size={18} />
            {sharing ? "Sharing..." : "Share"}
          </button>
          <button
            className="assessment-share-report__action-btn"
            onClick={handleCopyLink}
            disabled={copiedUrl}
          >
            {copiedUrl ? (
              <> <Check size={18} /> Copied! </>
            ) : (
              <> <Copy size={18} /> Copy Link </>
            )}
          </button>
          {user ? (
            <Link
              to={`/assessment-sessions/${session.public_slug}`}
              className="assessment-share-report__action-btn assessment-share-report__action-btn--primary"
            >
              View in App
            </Link>
          ) : (
            <button
              className="assessment-share-report__action-btn assessment-share-report__action-btn--primary"
              onClick={handleLogin}
              disabled={authLoading}
            >
              {authLoading ? "Loading..." : "Sign in to View Full Session"}
            </button>
          )}
        </div>
      </header>

      <main className="assessment-share-report__main">
        <div className="assessment-share-report__session-header">
          <div className="assessment-share-report__session-meta">
            <h1 className="assessment-share-report__session-title">{session.name}</h1>
            <div className="assessment-share-report__session-details">
              <span className="assessment-share-report__detail">
                <Calendar size={16} />
                {formatApiDate(session.scheduled_on)}
              </span>
              <span className="assessment-share-report__detail">
                <User size={16} />
                {session.coach_profile?.display_name || session.coach_profile?.full_name || "Coach"}
              </span>
              <span className="assessment-share-report__detail">
                <Trophy size={16} />
                {session.assessment_definition?.name}
              </span>
            </div>
            <p className="assessment-share-report__status-badge">
              Status: {session.status_label || session.status}
            </p>
          </div>
        </div>

        <section className="assessment-share-report__participants">
          <h2 className="assessment-share-report__section-title">Participants</h2>
          <div className="assessment-share-report__participants-grid">
            {session.participants.map((participant) => (
              <div key={participant.id} className="assessment-share-report__participant-card">
                <div className="assessment-share-report__participant-name">
                  {participant.player_name}
                </div>
                <div className="assessment-share-report__participant-result">
                  {participant.result && (
                    <>
                      <span className="assessment-share-report__score">{participant.result.overall_score}%</span>
                      <span className={`assessment-share-report__inclusion ${getInclusionColor(participant.inclusion)}`}>
                        {getInclusionLabel(participant.inclusion)}
                      </span>
                    </>
                  )}
                  {!participant.result && (
                    <span className="assessment-share-report__no-score">No scores submitted</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="assessment-share-report__disciplines">
          <h2 className="assessment-share-report__section-title">Assessment Categories</h2>
          <div className="assessment-share-report__disciplines-list">
            {session.assessment_definition?.assessment_categories?.map((cat) => (
              <div key={cat.id} className="assessment-share-report__discipline-item">
                <span className="assessment-share-report__discipline-label">{cat.label}</span>
                <span className="assessment-share-report__discipline-weight">Weight: {cat.weight}%</span>
              </div>
            ))}
          </div>
        </section>

        <div className="assessment-share-report__extra">
          <p className="assessment-share-report__disclaimer">
            This is a shared view of an unlisted assessment session. Anyone with this link can view it without logging in.
            The link can be regenerated by the session owner at any time, which will invalidate this link.
          </p>
        </div>
      </main>
    </div>
  );
}