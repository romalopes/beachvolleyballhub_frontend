import { useRef, useState } from "react";
import { FileUp, Link2, MessageSquarePlus, Plus, Trash2, Upload, X } from "lucide-react";
import {
  api,
  ApiValidationError,
  type AnalysisParticipant,
  type AnalysisVideo,
} from "../../api";

interface AnalysisVideoSectionProps {
  analysisId: number;
  videos: AnalysisVideo[];
  participants: AnalysisParticipant[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}

type VideoSourceMode = "external" | "upload";

function errorMessages(error: unknown, fallback: string) {
  return error instanceof ApiValidationError
    ? error.errors
    : [error instanceof Error ? error.message : fallback];
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, "0")}`
    : `${remainder}s`;
}

function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export default function AnalysisVideoSection({
  analysisId,
  videos,
  participants,
  canManage,
  onChanged,
}: AnalysisVideoSectionProps) {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<VideoSourceMode>("external");
  const [sourceUrl, setSourceUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [annotationVideoId, setAnnotationVideoId] = useState<number | null>(null);
  const [annotationTimestamp, setAnnotationTimestamp] = useState("");
  const [annotationBody, setAnnotationBody] = useState("");
  const [annotationPlayerId, setAnnotationPlayerId] = useState("");
  const [annotationSaving, setAnnotationSaving] = useState(false);

  const resetVideoForm = () => {
    setAdding(false);
    setMode("external");
    setSourceUrl("");
    setTitle("");
    setDescription("");
    setErrors([]);
  };

  const resetAnnotationForm = () => {
    setAnnotationVideoId(null);
    setAnnotationTimestamp("");
    setAnnotationBody("");
    setAnnotationPlayerId("");
    setErrors([]);
  };

  const submitVideo = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    const selectedFile = fileInputRef.current?.files?.[0] ?? null;
    if (mode === "external") {
      try {
        const url = new URL(sourceUrl);
        if (!/^https?:$/.test(url.protocol)) nextErrors.push("Video URL must use HTTP or HTTPS.");
      } catch {
        nextErrors.push("Enter a valid video URL.");
      }
    } else if (!selectedFile) {
      nextErrors.push("Choose a video file to upload.");
    } else {
      if (!selectedFile.type.startsWith("video/")) nextErrors.push("The selected file must be a video.");
      if (selectedFile.size > 500 * 1024 * 1024) nextErrors.push("The selected video must be smaller than 500 MB.");
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await api.createAnalysisVideo(analysisId, {
        file: mode === "upload" ? selectedFile ?? undefined : undefined,
        source_url: mode === "external" ? sourceUrl.trim() : undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      resetVideoForm();
      await onChanged();
    } catch (error) {
      setErrors(errorMessages(error, "Failed to add the video."));
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (video: AnalysisVideo) => {
    if (!window.confirm(`Remove “${video.title || "this video"}” from the analysis?`)) return;
    setErrors([]);
    try {
      await api.deleteAnalysisVideo(analysisId, video.id);
      await onChanged();
    } catch (error) {
      setErrors(errorMessages(error, "Failed to remove the video."));
    }
  };

  const submitAnnotation = async (event: React.FormEvent, videoId: number) => {
    event.preventDefault();
    const timestamp = parseTimestamp(annotationTimestamp);
    const nextErrors: string[] = [];
    if (timestamp == null) nextErrors.push("Enter the timestamp as seconds or MM:SS.");
    if (!annotationBody.trim()) nextErrors.push("Annotation text is required.");
    if (nextErrors.length > 0 || timestamp == null) {
      setErrors(nextErrors);
      return;
    }

    setAnnotationSaving(true);
    setErrors([]);
    try {
      await api.createAnalysisAnnotation(videoId, {
        timestamp_seconds: timestamp,
        body: annotationBody.trim(),
        player_profile_id: annotationPlayerId ? Number(annotationPlayerId) : undefined,
      });
      resetAnnotationForm();
      await onChanged();
    } catch (error) {
      setErrors(errorMessages(error, "Failed to add the annotation."));
    } finally {
      setAnnotationSaving(false);
    }
  };

  const deleteAnnotation = async (videoId: number, annotationId: number) => {
    if (!window.confirm("Delete this timestamped note?")) return;
    setErrors([]);
    try {
      await api.deleteAnalysisAnnotation(videoId, annotationId);
      await onChanged();
    } catch (error) {
      setErrors(errorMessages(error, "Failed to delete the annotation."));
    }
  };

  return (
    <section className="analysis-panel">
      <div className="analysis-panel-heading">
        <div className="analysis-panel-title">
          <span className="analysis-section-icon"><FileUp size={19} /></span>
          <div><h2>Video review</h2><p>Footage and timestamped coaching notes</p></div>
        </div>
        <div className="analysis-section-actions">
          <span className="analysis-count">{videos.length}</span>
          {canManage && !adding && (
            <button type="button" className="analysis-inline-action" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add video
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form className="analysis-create-box" onSubmit={submitVideo}>
          <div className="analysis-create-heading">
            <div><h3>Add video</h3><p>Link existing footage or upload a video file.</p></div>
            <button type="button" aria-label="Cancel adding video" onClick={resetVideoForm}><X size={18} /></button>
          </div>
          <fieldset className="analysis-source-tabs">
            <legend>Video source</legend>
            <label className={mode === "external" ? "selected" : ""}>
              <input type="radio" name="analysis-video-source" value="external" checked={mode === "external"} onChange={() => { setMode("external"); setErrors([]); }} />
              <Link2 size={16} /> External URL
            </label>
            <label className={mode === "upload" ? "selected" : ""}>
              <input type="radio" name="analysis-video-source" value="upload" checked={mode === "upload"} onChange={() => { setMode("upload"); setSourceUrl(""); setErrors([]); }} />
              <Upload size={16} /> Upload file
            </label>
          </fieldset>
          <div className="analysis-create-fields">
            {mode === "external" ? (
              <label className="analysis-field analysis-field-full">Video URL<input type="url" value={sourceUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={(event) => setSourceUrl(event.target.value)} /></label>
            ) : (
              <label className="analysis-field analysis-field-full">Video file<input ref={fileInputRef} type="file" accept="video/*" /><small>Video files up to 500 MB.</small></label>
            )}
            <label className="analysis-field">Title <span className="analysis-optional">Optional</span><input value={title} maxLength={160} placeholder="e.g. Set two side-out" onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="analysis-field">Description <span className="analysis-optional">Optional</span><input value={description} placeholder="What should viewers notice?" onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <div className="analysis-create-actions">
            <button type="button" className="analysis-cancel-button compact" onClick={resetVideoForm} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}><Upload size={15} /> {saving ? "Adding…" : "Add video"}</button>
          </div>
        </form>
      )}

      {errors.length > 0 && <div className="admin-error analysis-section-error" role="alert"><ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}

      {videos.length === 0 ? <div className="analysis-empty-row">{canManage ? "Add the first video to begin the review." : "No videos have been added."}</div> : (
        <div className="analysis-video-list">{videos.map((video, index) => (
          <article key={video.id} className="analysis-video-card">
            <div className="analysis-video-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="analysis-video-body">
              <div className="analysis-video-header">
                <div><h3>{video.title || `Video ${video.position + 1}`}</h3><div className="analysis-video-meta"><span>{video.source_type === "upload" ? "Uploaded video" : "External video"}</span>{video.duration_seconds != null && <span>{formatDuration(video.duration_seconds)}</span>}<span>{video.annotations.length} notes</span></div></div>
                <div className="analysis-video-actions">
                  {video.playback_url && <a href={video.playback_url} target="_blank" rel="noreferrer noopener" className="analysis-play-button">Play video</a>}
                  {canManage && <button type="button" className="analysis-icon-button danger" aria-label={`Remove ${video.title || "video"}`} onClick={() => deleteVideo(video)}><Trash2 size={15} /></button>}
                </div>
              </div>
              {video.description && <p className="analysis-video-description">{video.description}</p>}
              {video.annotations.length > 0 && <div className="analysis-annotation-list">{video.annotations.map((annotation) => (
                <div key={annotation.id} className="analysis-annotation"><span className="analysis-timestamp">{formatDuration(annotation.timestamp_seconds)}</span><div><p>{annotation.body}</p><small>{annotation.author.name}{annotation.player_profile ? ` · ${annotation.player_profile.name}` : ""}</small></div>{canManage && <button type="button" className="analysis-icon-button danger" aria-label="Delete timestamped note" onClick={() => deleteAnnotation(video.id, annotation.id)}><Trash2 size={13} /></button>}</div>
              ))}</div>}
              {canManage && annotationVideoId !== video.id && <button type="button" className="analysis-text-action" onClick={() => { resetAnnotationForm(); setAnnotationVideoId(video.id); }}><MessageSquarePlus size={14} /> Add timestamped note</button>}
              {canManage && annotationVideoId === video.id && (
                <form className="analysis-annotation-form" onSubmit={(event) => submitAnnotation(event, video.id)}>
                  <label>Timestamp<input value={annotationTimestamp} placeholder="1:24 or 84" onChange={(event) => setAnnotationTimestamp(event.target.value)} /></label>
                  <label>Player<select value={annotationPlayerId} onChange={(event) => setAnnotationPlayerId(event.target.value)}><option value="">General note</option>{participants.map((participant) => <option key={participant.player_profile_id} value={participant.player_profile_id}>{participant.name}</option>)}</select></label>
                  <label className="analysis-annotation-body">Note<textarea rows={2} maxLength={2000} value={annotationBody} placeholder="Describe what happens at this moment…" onChange={(event) => setAnnotationBody(event.target.value)} /></label>
                  <div className="analysis-create-actions"><button type="button" className="analysis-cancel-button compact" onClick={resetAnnotationForm}>Cancel</button><button type="submit" className="btn-primary" disabled={annotationSaving}>{annotationSaving ? "Saving…" : "Save note"}</button></div>
                </form>
              )}
            </div>
          </article>
        ))}</div>
      )}
    </section>
  );
}