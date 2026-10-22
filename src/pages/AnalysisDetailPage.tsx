import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive, ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3,
  Edit2, FileText, Layers3, Send, Trash2, Trophy, UserRound, Users, Video,
} from "lucide-react";
import { api, type AnalysisDetail, type AnalysisStatus } from "../api";
import AnalysisDiscussionSection from "../components/analysis/AnalysisDiscussionSection";
import AnalysisVideoSection from "../components/analysis/AnalysisVideoSection";
import LoadingState from "../components/LoadingState";

function StatusBadge({ status }: { status: AnalysisStatus }) {
  return <span className={`analysis-status-badge status-${status}`}><span className="analysis-status-dot" aria-hidden="true" />{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const analysisId = Number(id);
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id || Number.isNaN(analysisId)) {
      setError("Invalid analysis id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.analysis(analysisId)
      .then((response) => setAnalysis(response.analysis))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load analysis."))
      .finally(() => setLoading(false));
  }, [analysisId, id]);

  // This effect intentionally starts a remote-data request whenever the route id changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

  const refresh = useCallback(async () => {
    const response = await api.analysis(analysisId);
    setAnalysis(response.analysis);
  }, [analysisId]);

  const updateStatus = async (action: "publish" | "archive") => {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const response = action === "publish" ? await api.publishAnalysis(analysis.id) : await api.archiveAnalysis(analysis.id);
      setAnalysis(response.analysis);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Failed to ${action} the analysis.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!analysis || !window.confirm("Delete this analysis? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAnalysis(analysis.id);
      navigate("/analyses");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to delete the analysis.");
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!analysis) {
    return <div className="page analysis-page"><div className="admin-error">{error ?? "Analysis not found."}</div><Link to="/analyses" className="btn-outline"><ArrowLeft size={14} /> Back to analyses</Link></div>;
  }

  const canPublish = analysis.video_count > 0 && analysis.participants.length > 0;

  return (
    <div className="page analysis-page analysis-detail-page">
      <Link to="/analyses" className="analysis-back-link"><ArrowLeft size={16} /> All analyses</Link>

      <header className="analysis-hero">
        <div className="analysis-hero-copy">
          <div className="analysis-hero-kicker"><StatusBadge status={analysis.status} /><span>Analysis #{analysis.id}</span></div>
          <h1>{analysis.title}</h1>
          <p>{analysis.summary || "No summary has been added to this analysis yet."}</p>
        </div>
        {analysis.can_manage && (
          <div className="analysis-hero-actions">
            <Link to={`/analyses/${analysis.id}/edit`} className="btn-primary"><Edit2 size={16} /> Edit analysis</Link>
            {analysis.status === "draft" && (
              <button type="button" className="btn-outline" disabled={busy || !canPublish} onClick={() => updateStatus("publish")} title={!canPublish ? "Add at least one video and participant to publish" : undefined}>
                <Send size={15} /> Publish
              </button>
            )}
            {analysis.status !== "archived" && <button type="button" className="btn-outline" disabled={busy} onClick={() => updateStatus("archive")}><Archive size={15} /> Archive</button>}
          </div>
        )}
      </header>

      {error && <div className="admin-error analysis-alert">{error}</div>}

      <section className="analysis-overview" aria-label="Analysis overview">
        <div className="analysis-overview-item"><span className="analysis-overview-icon"><Video size={18} /></span><div><strong>{analysis.video_count}</strong><span>Videos</span></div></div>
        <div className="analysis-overview-item"><span className="analysis-overview-icon"><Users size={18} /></span><div><strong>{analysis.participants.length}</strong><span>Participants</span></div></div>
        <div className="analysis-overview-item"><span className="analysis-overview-icon"><FileText size={18} /></span><div><strong>{analysis.comments.length}</strong><span>Comments</span></div></div>
        <div className="analysis-overview-item"><span className="analysis-overview-icon"><Clock3 size={18} /></span><div><strong>{formatDate(analysis.updated_at)}</strong><span>Last updated</span></div></div>
      </section>

      <div className="analysis-detail-layout">
        <main className="analysis-detail-content">
          <section className="analysis-panel">
            <div className="analysis-panel-heading">
              <div className="analysis-panel-title"><span className="analysis-section-icon"><Users size={19} /></span><div><h2>Participants</h2><p>Players included in this review</p></div></div>
              <span className="analysis-count">{analysis.participants.length}</span>
            </div>
            {analysis.participants.length === 0 ? <div className="analysis-empty-row">No participants have been added.</div> : (
              <div className="analysis-participant-grid">{analysis.participants.map((participant) => (
                <div key={participant.id} className="analysis-participant-card"><span className="analysis-avatar" aria-hidden="true">{participant.name.charAt(0).toUpperCase()}</span><div><strong>{participant.name}</strong><span>{participant.notes || "Player"}</span></div></div>
              ))}</div>
            )}
          </section>

          <AnalysisVideoSection
            analysisId={analysis.id}
            videos={analysis.videos}
            participants={analysis.participants}
            canManage={analysis.can_manage}
            onChanged={refresh}
          />

          <AnalysisDiscussionSection
            analysisId={analysis.id}
            comments={analysis.comments}
            canComment={analysis.can_comment}
            onChanged={refresh}
          />
        </main>

        <aside className="analysis-context-column">
          <section className="analysis-side-card">
            <h2>Analysis details</h2>
            <dl className="analysis-context-list">
              <div><dt><UserRound size={16} /> Created by</dt><dd>{analysis.created_by.name}</dd></div>
              {analysis.assigned_coach_profile && <div><dt><UserRound size={16} /> Assigned coach</dt><dd>{analysis.assigned_coach_profile.name}</dd></div>}
              {analysis.organisation && <div><dt><Building2 size={16} /> Organisation</dt><dd>{analysis.organisation.name}</dd></div>}
              {analysis.group && <div><dt><Layers3 size={16} /> Group</dt><dd>{analysis.group.name}</dd></div>}
              {analysis.training_session && <div><dt><CalendarDays size={16} /> Training</dt><dd>{analysis.training_session.title}</dd></div>}
              {analysis.tournament && <div><dt><Trophy size={16} /> Tournament</dt><dd>{analysis.tournament.name}</dd></div>}
              <div><dt><CalendarDays size={16} /> Created</dt><dd>{formatDate(analysis.created_at)}</dd></div>
            </dl>
          </section>

          {analysis.status === "draft" && <section className={`analysis-readiness ${canPublish ? "is-ready" : ""}`}><div className="analysis-readiness-title"><CheckCircle2 size={18} /><h2>{canPublish ? "Ready to publish" : "Draft checklist"}</h2></div><p>{canPublish ? "This analysis has everything required to be shared." : "Complete these items before publishing."}</p><ul><li className={analysis.video_count > 0 ? "complete" : ""}>At least one video</li><li className={analysis.participants.length > 0 ? "complete" : ""}>At least one participant</li></ul></section>}

          {analysis.assessment_sessions.length > 0 && <section className="analysis-side-card"><h2>Linked assessments</h2><div className="analysis-linked-list">{analysis.assessment_sessions.map((session) => <Link key={session.id} to={`/assessment-sessions/${session.id}`}><span><strong>{session.name}</strong><small>{session.assessment_definition.name}</small></span><span className="analysis-linked-status">{session.status}</span></Link>)}</div></section>}

          {analysis.can_delete && <button type="button" className="analysis-delete-button" disabled={busy} onClick={handleDelete}><Trash2 size={15} /> {busy ? "Working…" : "Delete analysis"}</button>}
        </aside>
      </div>
    </div>
  );
}