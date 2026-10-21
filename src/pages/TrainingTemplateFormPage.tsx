import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  ApiValidationError,
  type Coach,
  type Group as GroupRecord,
  type Organisation,
  type TrainingSessionVisibility,
  type TrainingTemplateInput,
} from "../api";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import {
  DEFAULT_TRAINING_DURATION_MINUTES,
  TRAINING_DURATION_OPTIONS,
  TRAINING_VISIBILITIES,
  durationChoices,
} from "../utils/training";

export default function TrainingTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const invalidId = !isNew && (id === "new" || Number.isNaN(Number(id)));
  const templateId = isNew || invalidId ? null : Number(id);
  const navigate = useNavigate();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organisationId, setOrganisationId] = useState<number | "">("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [coachProfileId, setCoachProfileId] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [level, setLevel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_TRAINING_DURATION_MINUTES);
  const [visibility, setVisibility] =
    useState<TrainingSessionVisibility>("shared");
  const [status, setStatus] = useState<"active" | "archived">("active");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const references = Promise.all([
      api.organisations("active"),
      api.groups({ include_private: true, status: "active" }),
      api.coaches({ status: "active", include_private: true, per_page: 100 }),
    ]);

    references
      .then(([organisationPage, groupPage, coachPage]) => {
        if (!active) return;
        setOrganisations(organisationPage.data);
        setGroups(groupPage.data);
        setCoaches(coachPage.data);
      })
      .catch((err: Error) => setErrors([err.message]));

    if (templateId != null) {
      api
        .trainingTemplate(templateId)
        .then((template) => {
          if (!active) return;
          setName(template.name);
          setDescription(template.description ?? "");
          setOrganisationId(template.organisation_id ?? "");
          setGroupId(template.group_id ?? "");
          setCoachProfileId(template.coach_profile_id ?? "");
          setLocation(template.location ?? "");
          setLocationDetail(template.location_detail ?? "");
          setLevel(template.level ?? "");
          setCapacity(template.capacity ? String(template.capacity) : "");
          setDurationMinutes(template.duration_minutes);
          setVisibility(template.visibility);
          setStatus(template.status);
        })
        .catch((err: Error) => setErrors([err.message]));
    }

    references.finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [templateId]);

  const groupChoices = useMemo(() => {
    if (organisationId === "") return groups;
    return groups.filter(
      (group) =>
        group.organisation == null || group.organisation.id === organisationId,
    );
  }, [groups, organisationId]);

  const durations = durationChoices(
    TRAINING_DURATION_OPTIONS.map((option) => option.value),
    durationMinutes,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    const payload: TrainingTemplateInput = {
      name,
      description: description.trim() || null,
      organisation_id: organisationId === "" ? null : organisationId,
      group_id: groupId === "" ? null : groupId,
      coach_profile_id: coachProfileId === "" ? null : coachProfileId,
      location: location.trim() || null,
      location_detail: locationDetail.trim() || null,
      level: level.trim() || null,
      capacity: capacity.trim() ? Number(capacity) : null,
      duration_minutes: durationMinutes,
      visibility,
    };
    if (!isNew) payload.status = status;

    try {
      if (isNew) {
        await api.createTrainingTemplate(payload);
      } else if (templateId != null) {
        await api.updateTrainingTemplate(templateId, payload);
      }
      navigate("/training/templates");
    } catch (err) {
      if (err instanceof ApiValidationError) setErrors(err.errors);
      else setErrors([(err as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  if (invalidId) {
    return (
      <div className="page">
        <p className="admin-error">That training template id is not valid.</p>
      </div>
    );
  }

  if (loading) return <LoadingState />;

  return (
    <div className="page">
      <PageHeader
        title={isNew ? "New training template" : "Edit training template"}
        description="A template stores the defaults used when scheduling a series or a one-off session."
      />

      <form onSubmit={submit} className="training-form">
        <div className="admin-field">
          <label htmlFor="template-name">Name</label>
          <input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="admin-field">
          <label htmlFor="template-description">Description</label>
          <textarea
            id="template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label htmlFor="template-organisation">Organisation (optional)</label>
            <select
              id="template-organisation"
              value={organisationId}
              onChange={(event) => {
                const value = event.target.value;
                setOrganisationId(value === "" ? "" : Number(value));
                setGroupId("");
              }}
            >
              <option value="">No organisation</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="template-group">Group (optional)</label>
            <select
              id="template-group"
              value={groupId}
              onChange={(event) =>
                setGroupId(event.target.value === "" ? "" : Number(event.target.value))
              }
            >
              <option value="">No group</option>
              {groupChoices.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="template-coach">Coach (optional)</label>
          <select
            id="template-coach"
            value={coachProfileId}
            onChange={(event) =>
              setCoachProfileId(event.target.value === "" ? "" : Number(event.target.value))
            }
          >
            <option value="">No coach selected</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.display_name || coach.full_name || `Coach #${coach.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label htmlFor="template-location">Location</label>
            <input
              id="template-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Coogee Beach"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="template-location-detail">Location detail</label>
            <input
              id="template-location-detail"
              value={locationDetail}
              onChange={(event) => setLocationDetail(event.target.value)}
              placeholder="Court 1"
            />
          </div>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label htmlFor="template-level">Level</label>
            <input
              id="template-level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder="Intermediate"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="template-capacity">Capacity</label>
            <input
              id="template-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label htmlFor="template-duration">Default duration</label>
            <select
              id="template-duration"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {TRAINING_DURATION_OPTIONS.find((option) => option.value === minutes)?.label ??
                    `${minutes} min`}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="template-visibility">Visibility</label>
            <select
              id="template-visibility"
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as TrainingSessionVisibility)
              }
            >
              {TRAINING_VISIBILITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isNew && (
          <div className="admin-field">
            <label htmlFor="template-status">Status</label>
            <select
              id="template-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "active" | "archived")}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        )}

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
          <button type="button" className="admin-btn" onClick={() => navigate("/training/templates")}>
            Cancel
          </button>
          <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
