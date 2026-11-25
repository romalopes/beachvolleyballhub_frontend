import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, User, BookOpen, ExternalLink, Loader2, X } from "lucide-react";
import { api, type AssessmentSession } from "../../api";
import { formatDate } from "../../utils/analysisRequest";

interface AssessmentSessionInlineDetailProps {
  sessionPublicSlug: string;
  onClose: () => void;
}

export default function AssessmentSessionInlineDetail({
  sessionPublicSlug,
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
      .assessmentSessionBySlug(sessionPublicSlug)
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
  }, [sessionPublicSlug]);

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

  // Disciplines of the rubric, in rubric order - one score column each.
  const disciplines =
    session.assessment_definition?.assessment_categories ?? [];

  // Every rated row across the three inclusion buckets. This is what the
  // submitter sees: results, not attendance.
  const scoreRows = [
    ...(session.ranking?.ranking ?? []),
    ...(session.ranking?.incomplete ?? []),
    ...(session.ranking?.excluded ?? []),
  ];

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

      {/* Scores: per-discipline values and totals for every rated player.
          The roster itself is never shown here - the submitter sees results,
          not attendance lists (the full session page is the management view). */}
      {scoreRows.length > 0 && disciplines.length > 0 && (
        <div className="assessment-inline-scores">
          <h4>Scores</h4>
          <div className="assessment-inline-score-table-wrapper">
            <table className="assessment-inline-score-table">
              <thead>
                <tr>
                  <th className="inline-score-col-player">Player</th>
                  {disciplines.map((d) => (
                    <th key={d.id} className="inline-score-col-discipline">
                      <div className="inline-score-discipline-title">{d.label}</div>
                      <div className="inline-score-discipline-weight">{d.weight}%</div>
                    </th>
                  ))}
                  <th className="inline-score-col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((row) => (
                  <tr key={row.player_profile_id} className="assessment-inline-score-row">
                    <td className="inline-score-cell-player">
                      <span className="roster-player-name">{row.player_name}</span>
                      {row.status === "excluded" && <span className="tag tag-slate">Excluded</span>}
                    </td>
                    {disciplines.map((d) => {
                      const ds = row.discipline_scores?.find(
                        (s) => s.assessment_category_id === d.id,
                      );
                      return (
                        <td key={d.id} className="inline-score-cell">
                          {ds?.score != null ? ds.score : String.fromCharCode(8212)}
                        </td>
                      );
                    })}
                    <td className="inline-score-cell-total">
                      {row.overall_score != null ? (
                        <span className="preview-score-badge saved">{row.overall_score}</span>
                      ) : (
                        String.fromCharCode(8212)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
