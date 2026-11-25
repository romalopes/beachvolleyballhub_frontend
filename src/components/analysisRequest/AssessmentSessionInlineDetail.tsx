import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, User, BookOpen, ExternalLink, Loader2, X } from "lucide-react";
import { api, type AssessmentSession } from "../../api";
import { formatDate } from "../../utils/analysisRequest";

interface AssessmentSessionInlineDetailProps {
  sessionId: number;
  onClose: () => void;
}

export default function AssessmentSessionInlineDetail({
  sessionId,
  onClose,
}: AssessmentSessionInlineDetailProps) {
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .assessmentSession(sessionId)
      .then((res) => {
        if (active) {
          setSession(res.assessment_session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("Failed to load assessment session.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="assessment-inline-detail loading">
        <Loader2 size={20} className="spin" aria-hidden="true" />
        <span>Loading assessment session...</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="assessment-inline-detail error">
        <span>{error ?? "Assessment session not found."}</span>
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  const isPublished = session.status === "published";
  const isDraft = session.status === "draft";

  return (
    <div className="assessment-inline-detail">
      <div className="assessment-inline-header">
        <h3>{session.name}</h3>
        <div className="assessment-inline-actions">
          <Link
            to={`/assessment-sessions/${session.public_slug}`}
            className="secondary-button"
            onClick={onClose}
          >
            <ExternalLink size={14} aria-hidden="true" /> View full session
          </Link>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close assessment session details"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="assessment-inline-meta">
        <span className={`tag ${isPublished ? "tag-teal" : isDraft ? "tag-amber" : "tag-slate"}`}>
          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </span>
        <span className="assessment-inline-meta-item">
          <Calendar size={14} aria-hidden="true" />
          {session.scheduled_on
            ? formatDate(session.scheduled_on)
            : "No date set"}
        </span>
        {session.coach_profile && (
          <span className="assessment-inline-meta-item">
            <User size={14} aria-hidden="true" />
            {session.coach_profile.full_name}
            {session.coach_profile.account_name
              ? ` (${session.coach_profile.account_name})`
              : ""}
          </span>
        )}
        {session.assessment_definition && (
          <span className="assessment-inline-meta-item">
            <BookOpen size={14} aria-hidden="true" />
            Rubric: {session.assessment_definition.name}
          </span>
        )}
      </div>

      {session.notes && (
        <div className="assessment-inline-description">
          <h4>Notes</h4>
          <p>{session.notes}</p>
        </div>
      )}

      {session.participants && session.participants.length > 0 && (
        <div className="assessment-inline-roster">
          <h4>Roster ({session.participants.length})</h4>
          <ul className="assessment-inline-roster-list">
            {session.participants.map((p) => (
              <li key={p.id} className="assessment-inline-roster-item">
                <span className="roster-player-name">{p.player_name}</span>
                {p.inclusion === "excluded" && (
                  <span className="tag tag-slate">Excluded</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
