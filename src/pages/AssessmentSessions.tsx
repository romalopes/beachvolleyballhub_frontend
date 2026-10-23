import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar, ClipboardCheck, AlertCircle, Send, Users, X } from "lucide-react";
import {
  api,
  type AssessmentSession,
  type AssessmentDefinition,
  type Coach,
  type AssessmentSessionInput,
  type Group as GroupRecord,
  type Organisation,
  type PaginationMeta,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import LibraryHero from "../components/LibraryHero";
import Tag from "../components/Tag";
import Pagination from "../components/settings/Pagination";

/** Page size for assessment sessions list. */
const PER_PAGE = 20;

export default function AssessmentSessions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isCoach = user?.roles?.includes("coach") ?? false;
  const canPickCoach = user?.roles?.some((r) => r === "curator" || r === "admin") ?? false;
  const myCoachId = user?.coach_profile_id ?? user?.coach_profile_ids?.[0] ?? 0;

  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  // Organisation-first group picker: a searchable org list narrows the group
  // dropdown. `null` = no org filter, so every group stays visible (legacy
  // groups without an organisation remain schedulable from this state).
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgOpen, setOrgOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [orgGroupsLoading, setOrgGroupsLoading] = useState(false);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
  const orgSearchId = useId();
  const orgListboxId = `${orgSearchId}-options`;
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  // Load-once page: `loading` is derived from whether the first load finished,
  // rather than synced by the effect (which would cascade a render, see
  // AdminUsers.tsx).
  const [loaded, setLoaded] = useState(false);
  const loading = !loaded;
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AssessmentSessionInput>({
    name: "",
    assessment_definition_id: 0,
    coach_profile_id: 0,
    scheduled_on: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.assessmentSessions({ page, per_page: PER_PAGE }),
      api.assessmentDefinitions("active"),
      api.coaches(),
      // A group is optional and only seeds the roster, so a failure here must
      // not stop the wizard from opening: it falls back to no group.
      api.groups({ include_private: true }).catch(() => null),
    ])
      .then(([sessionsRes, definitionsRes, coachesRes, groupsRes]) => {
        if (cancelled) return;
        setSessions(sessionsRes.assessment_sessions || []);
        if (sessionsRes.meta) setMeta(sessionsRes.meta);
        setDefinitions(definitionsRes.data || []);
        const coachList = Array.isArray(coachesRes) ? coachesRes : coachesRes.data || [];
        setCoaches(coachList);
        setGroups(groupsRes?.data || []);

        if (definitionsRes.data?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            assessment_definition_id: definitionsRes.data[0].id,
          }));
        }
        // Choose default coach based on role
        if (canPickCoach) {
          // Curator / Admin – first coach in list is fine
          if (coachList.length > 0) {
            setFormData((prev) => ({
              ...prev,
              coach_profile_id: coachList[0].id,
            }));
          }
        } else if (isCoach) {
          // Coach – must be their own profile (may be 0 if not created yet)
          setFormData((prev) => ({
            ...prev,
            coach_profile_id: myCoachId,
          }));
        }
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load assessment sessions.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page, canPickCoach, isCoach, myCoachId]);

  const handleStartCreate = () => {
    setIsCreating(true);
    setWizardStep(1);
    setCreateError(null);
    setFormData((prev) => ({ ...prev, group_id: null }));
    // Fresh wizard = fresh picker: no stale org filter or query.
    setOrgSearch("");
    setOrgOpen(false);
    setSelectedOrgId(null);
    setOrgLoadError(null);
    // Organisations only seed the picker; a failure must not block session
    // creation, so the wizard falls back to the unfiltered group list.
    api
      .organisations("active", undefined, false, false)
      .then((res) => setOrganisations(res.data || []))
      .catch(() =>
        setOrgLoadError("Could not load organisations — showing all groups."),
      );
  };

  // Refetch groups whenever the selected organisation changes. Server-side
  // `organisation_id` filtering is the source of truth; the dropdown simply
  // renders what comes back. Clearing the org restores the full list, and the
  // picked group is always reset so a stale id can never be submitted.
  useEffect(() => {
    if (!isCreating) return;
    let cancelled = false;
    const loadGroups = async () => {
      setOrgGroupsLoading(true);
      try {
        const res = await api.groups(
          selectedOrgId === null
            ? { include_private: true }
            : { organisation_id: selectedOrgId, include_private: true },
        );
        if (cancelled) return;
        setGroups(res.data || []);
      } catch {
        if (cancelled) return;
        setGroups([]);
      }
      if (!cancelled) setOrgGroupsLoading(false);
    };
    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [isCreating, selectedOrgId]);

  const selectedOrg = organisations.find((o) => o.id === selectedOrgId) ?? null;

  // Client-side search over the loaded org page (the API has no `q` filter for
  // organisations): name + acronym, case-insensitive.
  const orgSuggestions = useMemo(() => {
    const needle = orgSearch.trim().toLocaleLowerCase();
    return organisations.filter((org) => {
      if (org.id === selectedOrgId) return false;
      return (
        !needle ||
        org.name.toLocaleLowerCase().includes(needle) ||
        org.acronym?.toLocaleLowerCase().includes(needle)
      );
    });
  }, [organisations, orgSearch, selectedOrgId]);

  const selectOrg = (id: number) => {
    setSelectedOrgId(id);
    setOrgSearch("");
    setOrgOpen(false);
    setFormData((prev) => ({ ...prev, group_id: null }));
  };

  const clearOrg = () => {
    setSelectedOrgId(null);
    setOrgSearch("");
    setOrgOpen(false);
    setFormData((prev) => ({ ...prev, group_id: null }));
  };

  const handleGoToStep2 = () => {
    setCreateError(null);
    if (!formData.assessment_definition_id) {
      setCreateError("Select an active assessment rubric first.");
      return;
    }
    if (canPickCoach && !formData.coach_profile_id) {
      setCreateError("Select a coach of record first.");
      return;
    }
    setWizardStep(2);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formData.name.trim()) {
      setCreateError("Session name is required.");
      return;
    }
    if (!formData.assessment_definition_id) {
      setCreateError("An active assessment definition must be selected.");
      return;
    }
    if (canPickCoach && !formData.coach_profile_id) {
      setCreateError("A coach of record must be selected.");
      return;
    }
    if (!formData.scheduled_on) {
      setCreateError("Scheduled date is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createAssessmentSession(formData);
      setIsCreating(false);
      navigate(`/assessment-sessions/${res.assessment_session.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create assessment session.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  const includedCount = (session: AssessmentSession) =>
    (session.participants || []).filter((p) => p.inclusion === "included").length;

  const selectedDef = definitions.find((d) => d.id === formData.assessment_definition_id);

  const myCoach = coaches.find((c) => c.id === myCoachId);

  const coachLabel = (coach: Coach) =>
    `${coach.full_name ||
      [coach.person?.first_name, coach.person?.last_name].filter(Boolean).join(" ") ||
      "Coach"} · profile #${coach.id}`;

  return (
    <div className="page assessment-sessions-page">
      <LibraryHero
        eyebrow="Assessment workspace"
        title="Assessment Sessions"
        description="Rostered player assessments scored against a defined rubric."
        highlights={[
          { icon: Users, label: "Roster the squad" },
          { icon: ClipboardCheck, label: "Score the rubric" },
          { icon: Send, label: "Publish results" },
        ]}
        highlightsLabel="Assessment session features"
        theme="library-hero--assessments"
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={handleStartCreate}
          >
            <Plus size={17} />
            New Session
          </button>
        }
      />

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="loading">Loading assessment sessions...</p>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No assessment sessions yet"
          description="Create a session to roster players and score them against an active rubric."
        />
      ) : (
        <>
          <div className="session-list">
            <div className="session-list-header">
              <span>Session</span>
              <span>Rubric</span>
              <span>Coach</span>
              <span>Scheduled</span>
              <span>Roster</span>
              <span>Status</span>
            </div>
            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/assessment-sessions/${session.id}`}
                className="session-row"
              >
                <span className="session-name">{session.name}</span>
                <span className="session-def">{session.assessment_definition?.name}</span>
                <span className="session-coach">{session.coach_profile?.full_name}</span>
                <span className="session-date">
                  <Calendar size={14} />
                  {formatDate(session.scheduled_on)}
                </span>
                <span className="session-roster-count">{includedCount(session)} players</span>
                <Tag
                  variant={
                    session.status === "published"
                      ? "teal"
                      : session.status === "withdrawn"
                        ? "primary"
                        : "default"
                  }
                >
                  {session.status_label || session.status}
                </Tag>
              </Link>
            ))}
          </div>
          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              itemsPerPage={meta.per_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {isCreating && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!submitting) setIsCreating(false);
          }}
        >
          <div
            className="modal-content session-wizard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>New Assessment Session</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsCreating(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="wizard-steps">
                <span className={wizardStep === 1 ? "wizard-step active" : "wizard-step done"}>
                  1. Rubric &amp; coach
                </span>
                <span className={wizardStep === 2 ? "wizard-step active" : "wizard-step"}>
                  2. Session details
                </span>
              </div>
              {createError && (
                <div className="admin-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}
              <form onSubmit={(e) => void handleCreateSubmit(e)}>
                {wizardStep === 1 ? (
                  <div className="wizard-step-body">
                    <div className="admin-field">
                      <label htmlFor="session-definition">Assessment rubric *</label>
                      <select
                        id="session-definition"
                        value={formData.assessment_definition_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assessment_definition_id: Number(e.target.value),
                          })
                        }
                      >
                        {definitions.length === 0 && (
                          <option value={0}>No active rubrics available</option>
                        )}
                        {definitions.map((def) => (
                          <option key={def.id} value={def.id}>
                            {def.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedDef && (
                      <div className="wizard-rubric-preview">
                        <p className="wizard-hint">
                          Categories in &ldquo;{selectedDef.name}&rdquo; (
                          {selectedDef.assessment_categories.length}):
                        </p>
                        <ul>
                          {selectedDef.assessment_categories.map((cat) => (
                            <li key={cat.id}>
                              {cat.label} <span className="wizard-weight">{cat.weight}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Coach of record field – only curator/admin may pick; coach sees own profile */}
                    <div className="admin-field">
                      <label htmlFor="session-coach">Coach of record *</label>
                      {canPickCoach ? (
                        <select
                          id="session-coach"
                          value={formData.coach_profile_id}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              coach_profile_id: Number(e.target.value),
                            })
                          }
                        >
                          {coaches.length === 0 && (
                            <option value={0}>No coaches available</option>
                          )}
                          {coaches.map((coach) => (
                            <option key={coach.id} value={coach.id}>
                              {coachLabel(coach)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="admin-field-readonly">
                          {myCoach ? (
                            <strong>{coachLabel(myCoach)}</strong>
                          ) : (
                            <em>No coach profile yet – one will be created on submit</em>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="wizard-step-body">
                    <div className="admin-field">
                      <label htmlFor="session-name">Session name *</label>
                      <input
                        id="session-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. September Combine"
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-date">Scheduled date *</label>
                      <input
                        id="session-date"
                        type="date"
                        value={formData.scheduled_on}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduled_on: e.target.value })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor={orgSearchId}>Organisation (optional)</label>
                      {selectedOrg ? (
                        <div className="organisation-multi-select-selected">
                          <span className="organisation-multi-select-chip">
                            <span>{selectedOrg.name}</span>
                            <button
                              type="button"
                              onClick={clearOrg}
                              aria-label={`Clear ${selectedOrg.name}`}
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="organisation-multi-select-input-wrap">
                          <input
                            id={orgSearchId}
                            type="search"
                            value={orgSearch}
                            placeholder="Search organisations to filter groups…"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={orgOpen}
                            aria-controls={orgListboxId}
                            onChange={(e) => {
                              setOrgSearch(e.target.value);
                              setOrgOpen(true);
                            }}
                            onFocus={() => setOrgOpen(true)}
                            onBlur={() =>
                              window.setTimeout(() => setOrgOpen(false), 100)
                            }
                          />
                          {orgOpen && (
                            <ul
                              className="organisation-multi-select-options"
                              id={orgListboxId}
                              role="listbox"
                              aria-label="Organisation search results"
                            >
                              {orgSuggestions.length > 0 ? (
                                orgSuggestions.map((org) => (
                                  <li key={org.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={false}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => selectOrg(org.id)}
                                    >
                                      <span>{org.name}</span>
                                      {org.acronym && <small>{org.acronym}</small>}
                                    </button>
                                  </li>
                                ))
                              ) : (
                                <li className="organisation-multi-select-empty">
                                  No organisations found.
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      )}
                      {orgLoadError && (
                        <p className="field-hint">{orgLoadError}</p>
                      )}
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-group">Group (optional)</label>
                      <select
                        id="session-group"
                        value={formData.group_id ?? 0}
                        disabled={orgGroupsLoading}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            group_id: Number(e.target.value) || null,
                          })
                        }
                      >
                        <option value={0}>
                          {orgGroupsLoading
                            ? "Loading groups…"
                            : "No group — add players one by one"}
                        </option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ({group.player_count})
                          </option>
                        ))}
                      </select>
                      <p className="field-hint">
                        {selectedOrg
                          ? `Showing groups from ${selectedOrg.name}. Clear the organisation above to see every group. `
                          : "Search an organisation above to narrow the groups. "}
                        Picking a group adds its players to the roster when the session
                        is created. Membership is not attendance — you can still remove
                        anyone who did not show up.
                      </p>
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-notes">Notes</label>
                      <textarea
                        id="session-notes"
                        rows={3}
                        value={formData.notes ?? ""}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional context for this session"
                      />
                    </div>
                    <p className="wizard-hint">
                      You will add the player roster and scores on the next screen.
                    </p>
                  </div>
                )}
                <div className="admin-form-actions">
                  {wizardStep === 2 && (
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setWizardStep(1)}
                      disabled={submitting}
                    >
                      Back
                    </button>
                  )}
                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-add"
                      onClick={handleGoToStep2}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="admin-btn admin-btn-add"
                      disabled={submitting}
                    >
                      {submitting ? "Creating..." : "Create Session"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
