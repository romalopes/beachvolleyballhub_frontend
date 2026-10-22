import { useMemo, useState } from "react";
import { FileText, MessageCircle, Reply, Send, Trash2, X } from "lucide-react";
import { api, ApiValidationError, type AnalysisComment } from "../../api";

interface AnalysisDiscussionSectionProps {
  analysisId: number;
  comments: AnalysisComment[];
  canComment: boolean;
  onChanged: () => Promise<void> | void;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiValidationError
    ? error.errors.join(". ")
    : error instanceof Error ? error.message : fallback;
}

export default function AnalysisDiscussionSection({ analysisId, comments, canComment, onChanged }: AnalysisDiscussionSectionProps) {
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<AnalysisComment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const result = new Map<number, AnalysisComment[]>();
    comments.forEach((comment) => {
      if (comment.parent_id == null) return;
      result.set(comment.parent_id, [...(result.get(comment.parent_id) ?? []), comment]);
    });
    return result;
  }, [comments]);
  const roots = comments.filter((comment) => comment.parent_id == null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write a comment before posting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createAnalysisComment(analysisId, {
        body: body.trim(),
        parent_id: replyingTo?.id,
      });
      setBody("");
      setReplyingTo(null);
      await onChanged();
    } catch (reason) {
      setError(errorMessage(reason, "Failed to post the comment."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (comment: AnalysisComment) => {
    if (!window.confirm("Delete this comment?")) return;
    setError(null);
    try {
      await api.deleteAnalysisComment(analysisId, comment.id);
      if (replyingTo?.id === comment.id) setReplyingTo(null);
      await onChanged();
    } catch (reason) {
      setError(errorMessage(reason, "Failed to delete the comment."));
    }
  };

  const renderComment = (comment: AnalysisComment, depth = 0): React.ReactNode => (
    <article key={comment.id} className={`analysis-comment ${depth > 0 ? "analysis-comment-reply" : ""}`}>
      <span className="analysis-avatar analysis-avatar-small" aria-hidden="true">{comment.author.name.charAt(0).toUpperCase()}</span>
      <div>
        <div className="analysis-comment-header"><div><strong>{comment.author.name}</strong><time dateTime={comment.created_at}>{formatDateTime(comment.created_at)}</time></div><div className="analysis-comment-actions">{canComment && <button type="button" onClick={() => { setReplyingTo(comment); setError(null); }}><Reply size={13} /> Reply</button>}{comment.can_delete && <button type="button" className="danger" aria-label={`Delete comment by ${comment.author.name}`} onClick={() => remove(comment)}><Trash2 size={13} /></button>}</div></div>
        <p>{comment.body}</p>
        {(childrenByParent.get(comment.id) ?? []).map((reply) => renderComment(reply, depth + 1))}
      </div>
    </article>
  );

  return (
    <section className="analysis-panel">
      <div className="analysis-panel-heading">
        <div className="analysis-panel-title"><span className="analysis-section-icon"><FileText size={19} /></span><div><h2>Discussion</h2><p>Feedback shared by coaches and players</p></div></div>
        <span className="analysis-count">{comments.length}</span>
      </div>

      {canComment && (
        <form className="analysis-comment-composer" onSubmit={submit}>
          {replyingTo && <div className="analysis-replying-to"><span><Reply size={13} /> Replying to <strong>{replyingTo.author.name}</strong></span><button type="button" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}><X size={15} /></button></div>}
          <label htmlFor="analysis-comment-body"><MessageCircle size={16} /> {replyingTo ? "Write a reply" : "Add to the discussion"}</label>
          <textarea id="analysis-comment-body" rows={3} maxLength={5000} value={body} placeholder={replyingTo ? "Write your reply…" : "Share feedback, observations, or next steps…"} onChange={(event) => setBody(event.target.value)} />
          <div className="analysis-composer-footer"><span>{body.length}/5000</span><button type="submit" className="btn-primary" disabled={saving || !body.trim()}><Send size={14} /> {saving ? "Posting…" : replyingTo ? "Post reply" : "Post comment"}</button></div>
        </form>
      )}

      {error && <div className="admin-error analysis-section-error" role="alert">{error}</div>}
      {comments.length === 0 ? <div className="analysis-empty-row">{canComment ? "Start the discussion with the first comment." : "No comments yet."}</div> : <div className="analysis-comment-list">{roots.map((comment) => renderComment(comment))}</div>}
    </section>
  );
}