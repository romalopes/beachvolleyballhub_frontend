import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  ApiValidationError,
  type TrainingSeriesInput,
  type TrainingSeriesPreview,
  type TrainingTemplate,
} from "../api";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import RecurrenceFields, {
  type RecurrenceValues,
} from "../components/training/RecurrenceFields";
import {
  addWeeksIso,
  browserTimeZone,
  seriesOverrides,
  templateSummary,
  todayIso,
  weekdaysLabel,
} from "../utils/recurringTraining";
import { DEFAULT_TRAINING_DURATION_MINUTES } from "../utils/training";

export default function TrainingSeriesFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<TrainingSeriesPreview | null>(null);

  const [recurrence, setRecurrence] = useState<RecurrenceValues>({
    startsOn: todayIso(),
    endsOn: addWeeksIso(todayIso(), 8),
    weekdays: ["mon", "wed"],
    localStartTime: "07:00",
    durationMinutes: DEFAULT_TRAINING_DURATION_MINUTES,
    interval: 1,
    timeZone: browserTimeZone(),
  });
  const [overrides, setOverrides] = useState({
    title: "",
    location: "",
    locationDetail: "",
    capacity: "",
    level: "",
  });

  useEffect(() => {
    api
      .trainingTemplates({ per_page: 100 })
      .then((response) => {
        setTemplates(response.data);
        const requested = Number(searchParams.get("template_id"));
        const initial = response.data.find((template) => template.id === requested);
        if (initial) applyTemplate(initial);
      })
      .catch((err: Error) => setErrors([err.message]))
      .finally(() => setLoading(false));
    // The template query parameter is only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templates, templateId],
  );

  function applyTemplate(template: TrainingTemplate) {
    setTemplateId(template.id);
    setRecurrence((current) => ({
      ...current,
      durationMinutes: template.duration_minutes || current.durationMinutes,
    }));
    setOverrides({
      title: "",
      location: template.location ?? "",
      locationDetail: template.location_detail ?? "",
      capacity: template.capacity ? String(template.capacity) : "",
      level: template.level ?? "",
    });
    setPreview(null);
  }

  const payload = (): TrainingSeriesInput | null => {
    if (templateId === "") return null;
    return {
      training_template_id: Number(templateId),
      starts_on: recurrence.startsOn,
      ends_on: recurrence.endsOn,
      weekdays: recurrence.weekdays,
      local_start_time: recurrence.localStartTime,
      duration_minutes: recurrence.durationMinutes,
      time_zone: recurrence.timeZone,
      frequency: "weekly",
      interval: recurrence.interval,
      overrides: seriesOverrides(overrides),
    };
  };

  const runPreview = async () => {
    const data = payload();
    if (!data) {
      setErrors(["Choose a template before previewing."]);
      return;
    }
    setPreviewing(true);
    setErrors([]);
    try {
      setPreview(await api.previewTrainingSeries(data));
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = payload();
    if (!data) {
      setErrors(["Choose a template before creating the series."]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const result = await api.createTrainingSeries(data);
      navigate(`/training/series/${result.training_series.id}`);
    } catch (err) {
      if (err instanceof ApiValidationError) setErrors(err.errors);
      else setErrors([(err as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="page">
      <PageHeader
        title="Schedule a recurring series"
        description="Choose a template and a weekly pattern. Preview the dates before anything is created."
      />

      <form onSubmit={submit} className="training-form">
        <div className="admin-field">
          <label htmlFor="series-template">Training template</label>
          <select
            id="series-template"
            value={templateId}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "") {
                setTemplateId("");
                setPreview(null);
                return;
              }
              const template = templates.find((row) => row.id === Number(value));
              if (template) applyTemplate(template);
            }}
            required
          >
            <option value="">Select a template…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <p className="field-hint">{templateSummary(selectedTemplate)}</p>
          )}
        </div>

        <RecurrenceFields
          values={recurrence}
          onChange={(patch) => {
            setRecurrence((current) => ({ ...current, ...patch }));
            setPreview(null);
          }}
        />

        <fieldset className="recurrence-fields">
          <legend>Series overrides (optional)</legend>
          <p className="field-hint">
            Leave a field blank to use the template's value. Every occurrence in this
            series stores the values below.
          </p>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="series-title">Title</label>
              <input
                id="series-title"
                value={overrides.title}
                placeholder={selectedTemplate?.name ?? "Template name"}
                onChange={(event) => {
                  setOverrides((current) => ({ ...current, title: event.target.value }));
                  setPreview(null);
                }}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="series-level">Level</label>
              <input
                id="series-level"
                value={overrides.level}
                onChange={(event) => {
                  setOverrides((current) => ({ ...current, level: event.target.value }));
                  setPreview(null);
                }}
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="series-location">Location</label>
              <input
                id="series-location"
                value={overrides.location}
                onChange={(event) => {
                  setOverrides((current) => ({ ...current, location: event.target.value }));
                  setPreview(null);
                }}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="series-location-detail">Location detail</label>
              <input
                id="series-location-detail"
                value={overrides.locationDetail}
                onChange={(event) => {
                  setOverrides((current) => ({
                    ...current,
                    locationDetail: event.target.value,
                  }));
                  setPreview(null);
                }}
              />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="series-capacity">Capacity</label>
            <input
              id="series-capacity"
              type="number"
              min={1}
              value={overrides.capacity}
              onChange={(event) => {
                setOverrides((current) => ({ ...current, capacity: event.target.value }));
                setPreview(null);
              }}
            />
          </div>
        </fieldset>

        {errors.length > 0 && (
          <div className="admin-error">
            <ul>
              {errors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="training-form-actions">
          <button type="button" className="admin-btn" onClick={() => navigate("/training/series")}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={runPreview}
            disabled={previewing || !selectedTemplate}
          >
            {previewing ? "Previewing…" : "Preview dates"}
          </button>
          <button
            type="submit"
            className="admin-btn admin-btn-add"
            disabled={saving || !selectedTemplate || preview?.valid === false}
          >
            {saving ? "Creating…" : "Create series"}
          </button>
        </div>
      </form>

      {preview && (
        <section className="detail-section" aria-label="Series preview">
          <h2>Preview</h2>
          {!preview.valid ? (
            <div className="admin-error">
              <ul>
                {preview.errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="related-item-meta">
                {preview.total} occurrence{preview.total === 1 ? "" : "s"} · weekly on{" "}
                {weekdaysLabel(recurrence.weekdays)} at {recurrence.localStartTime} (
                {preview.time_zone})
                {preview.truncated ? ` · showing the first ${preview.returned}` : ""}
              </p>
              {preview.warnings.length > 0 && (
                <div className="admin-warning">
                  <ul>
                    {preview.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="recurrence-preview-list">
                {preview.occurrences.slice(0, 10).map((occurrence) => (
                  <div key={occurrence.recurrence_key} className="recurrence-preview-row">
                    <span>
                      {new Intl.DateTimeFormat("en-AU", {
                        timeZone: preview.time_zone,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(occurrence.starts_at))}
                    </span>
                    <span className="related-item-meta">
                      {occurrence.duration_minutes} min
                      {occurrence.warnings.length > 0 ? " · DST warning" : ""}
                    </span>
                    {occurrence.conflicts.length > 0 && (
                      <span className="recurrence-conflict">
                        {occurrence.conflicts.length} conflict
                        {occurrence.conflicts.length === 1 ? "" : "s"} (
                        {occurrence.conflicts[0].reasons.join(", ")})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {preview.occurrences.length > 10 && (
                <p className="field-hint">
                  …and {preview.total - 10} more occurrence
                  {preview.total - 10 === 1 ? "" : "s"}.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
