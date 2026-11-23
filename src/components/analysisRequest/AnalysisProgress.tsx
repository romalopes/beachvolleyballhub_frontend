import { Link } from "react-router-dom";
import type { AnalysisRequestAnalysis } from "../../api";

interface Props {
  analysis: AnalysisRequestAnalysis | null | undefined;
  /** Staff/assigned coach may create the analysis while the request is approved. */
  canStart?: boolean;
  starting?: boolean;
  onStart?: () => void;
  /** Staff shortcut into the full analysis editor. */
  editorHref?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "In analysis",
  published: "Shared",
  archived: "Archived",
};

/**
 * Progress of the Analysis created for an analysis request (IDENTITY-265).
 *
 * Shared by the submitter's request page, the guest page and the staff view so
 * all three tell the same story. The API only sends the summary, videos and
 * comments once the analysis is shared, so there is nothing extra to hide here.
 */
export default function AnalysisProgress({
  analysis,
  canStart = false,
  starting = false,
  onStart,
  editorHref,
}: Props) {
  if (!analysis) {
    if (!canStart) return null;

    return (
      <section className="review-content" aria-labelledby="analysis-start">
        <h3 id="analysis-start">Analysis</h3>
        <p className="hint">
          The request is approved. Start the analysis to create the working
          record the team will annotate and share.
        </p>
        <button
          type="button"
          className="auth-submit"
          disabled={starting}
          onClick={onStart}
        >
          {starting ? "Starting…" : "Start analysis"}
        </button>
      </section>
    );
  }

  return (
    <section className="review-content" aria-labelledby="analysis-progress">
      <h3 id="analysis-progress">Analysis</h3>

      <div className="analysis-progress-header">
        <strong>{analysis.title}</strong>
        <span className="contact-status-badge unread">
          {STATUS_LABELS[analysis.status] ?? analysis.status}
        </span>
      </div>

      <div
        className="analysis-progress-track"
        role="progressbar"
        aria-valuenow={analysis.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Analysis progress"
      >
        <span style={{ width: `${analysis.percent}%` }} />
      </div>
      <p className="hint">
        {analysis.percent}% · {analysis.video_count} video
        {analysis.video_count === 1 ? "" : "s"} · {analysis.comment_count} comment
        {analysis.comment_count === 1 ? "" : "s"}
      </p>

      <ol className="analysis-steps">
        {analysis.steps.map((step) => (
          <li
            key={step.key}
            className={step.done ? "done" : step.current ? "current" : undefined}
          >
            <span aria-hidden="true">{step.done ? "✓" : step.current ? "•" : "○"}</span>
            {step.label}
          </li>
        ))}
      </ol>

      {analysis.available ? (
        <div className="analysis-result">
          {analysis.summary && (
            <>
              <h4>Summary</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{analysis.summary}</p>
            </>
          )}

          {analysis.videos.length > 0 && (
            <>
              <h4>Videos</h4>
              <ul className="selected-videos">
                {analysis.videos.map((video) => {
                  const url = video.external_url ?? video.playback_url ?? video.embed_url;
                  return (
                    <li key={video.id} className="video-item">
                      <span>{video.title || "Analysis video"}</span>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer">
                          Watch
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {analysis.comments.length > 0 && (
            <>
              <h4>Coach notes</h4>
              <ul className="selected-videos">
                {analysis.comments.map((comment) => (
                  <li key={comment.id} className="video-item">
                    <span>
                      {comment.body}
                      <br />
                      <span className="hint">{comment.author.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <p className="hint">
          The team is working on your analysis. It will appear here as soon as it
          is shared.
        </p>
      )}

      {editorHref && (
        <p>
          <Link to={editorHref}>Open in analysis editor →</Link>
        </p>
      )}
    </section>
  );
}
