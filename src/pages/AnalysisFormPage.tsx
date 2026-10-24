import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, CalendarDays, Check, ChevronLeft, ChevronRight,
  ClipboardCheck, ClipboardList, Layers3, Save, Trophy, UserRound, Users,
} from "lucide-react";
import {
  api, type AnalysisInput, type Coach, type Group as GroupRecord,
  type Organisation, type Player, type Tournament, type TrainingSession,
} from "../api";
import LoadingState from "../components/LoadingState";
import { accountDisplayName } from "../utils/profileName";

interface FormState {
  title: string;
  summary: string;
  assigned_coach_profile_id: number | null;
  organisation_id: number | null;
  group_id: number | null;
  training_session_id: number | null;
  tournament_id: number | null;
  player_profile_ids: number[];
}

type FormStep = 1 | 2 | 3;

const EMPTY_FORM: FormState = {
  title: "", summary: "", assigned_coach_profile_id: null,
  organisation_id: null, group_id: null, training_session_id: null,
  tournament_id: null, player_profile_ids: [],
};

const STEPS: { id: FormStep; label: string }[] = [
  { id: 1, label: "Details" },
  { id: 2, label: "Participants" },
  { id: 3, label: "Review" },
];

function playerName(player: Player) {
  return player.full_name || player.display_name || player.person?.first_name || `Player ${player.id}`;
}

function coachName(coach: Coach) {
  return accountDisplayName(
    coach.account?.full_name,
    coach.full_name || coach.display_name || coach.person?.first_name || `Coach ${coach.id}`,
  );
}

export default function AnalysisFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const analysisId = isNew ? null : Number(id);
  const navigate = useNavigate();
  const [step, setStep] = useState<FormStep>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const references = Promise.all([
      api.coaches({ status: "active", include_private: true, per_page: 100 }),
      api.organisations("active"),
      api.groups({ status: "active", include_private: true }),
      api.trainingSessions(),
      api.tournaments({ per_page: 100 }),
      api.players({ status: "active", include_private: true, per_page: 100 }),
    ]);
    const analysisRequest = analysisId != null && !Number.isNaN(analysisId)
      ? api.analysis(analysisId)
      : Promise.resolve(null);

    Promise.all([references, analysisRequest])
      .then(([[coachPage, organisationPage, groupPage, sessions, tournamentPage, playerPage], analysisResponse]) => {
        if (cancelled) return;
        setCoaches(coachPage.data);
        setOrganisations(organisationPage.data);
        setGroups(groupPage.data);
        setTrainingSessions(sessions);
        setTournaments(tournamentPage.data);
        setPlayers(playerPage.data);
        if (analysisResponse) {
          const analysis = analysisResponse.analysis;
          setForm({
            title: analysis.title,
            summary: analysis.summary ?? "",
            assigned_coach_profile_id: analysis.assigned_coach_profile?.id ?? null,
            organisation_id: analysis.organisation?.id ?? null,
            group_id: analysis.group?.id ?? null,
            training_session_id: analysis.training_session?.id ?? null,
            tournament_id: analysis.tournament?.id ?? null,
            player_profile_ids: analysis.participants.map((participant) => participant.player_profile_id),
          });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setErrors([reason instanceof Error ? reason.message : "Failed to load analysis form."]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [analysisId]);

  const filteredGroups = useMemo(
    () => groups.filter((group) => !form.organisation_id || group.organisation?.id === form.organisation_id),
    [form.organisation_id, groups],
  );
  const selectedPlayers = useMemo(
    () => players.filter((player) => form.player_profile_ids.includes(player.id)),
    [form.player_profile_ids, players],
  );
  const selectedCoach = coaches.find((coach) => coach.id === form.assigned_coach_profile_id);
  const selectedOrganisation = organisations.find((organisation) => organisation.id === form.organisation_id);
  const selectedGroup = groups.find((group) => group.id === form.group_id);
  const selectedTraining = trainingSessions.find((session) => session.id === form.training_session_id);
  const selectedTournament = tournaments.find((tournament) => tournament.id === form.tournament_id);

  const setNullableId = (
    key: "assigned_coach_profile_id" | "organisation_id" | "group_id" | "training_session_id" | "tournament_id",
    value: string,
  ) => setForm((current) => ({ ...current, [key]: value ? Number(value) : null }));

  const togglePlayer = (playerId: number, checked: boolean) => {
    setForm((current) => ({
      ...current,
      player_profile_ids: checked
        ? [...current.player_profile_ids, playerId]
        : current.player_profile_ids.filter((value) => value !== playerId),
    }));
  };

  const goToStep = (nextStep: FormStep) => {
    if (nextStep > 1 && !form.title.trim()) {
      setStep(1);
      setErrors(["Title is required before continuing."]);
      return;
    }
    setErrors([]);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);
    if (!form.title.trim()) {
      setStep(1);
      setErrors(["Title is required."]);
      return;
    }
    setSaving(true);
    const payload: AnalysisInput = { ...form, title: form.title.trim(), summary: form.summary.trim() || null };
    try {
      const response = analysisId == null
        ? await api.createAnalysis(payload)
        : await api.updateAnalysis(analysisId, payload);
      navigate(`/analyses/${response.analysis.id}`);
    } catch (reason) {
      setErrors([reason instanceof Error ? reason.message : "Failed to save the analysis."]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  const detailPath = isNew ? "/analyses" : `/analyses/${analysisId}`;

  return (
    <div className="page analysis-page analysis-form-page">
      <button type="button" className="analysis-back-link" onClick={() => navigate(detailPath)}><ArrowLeft size={16} /> {isNew ? "All analyses" : "Back to analysis"}</button>
      <header className="analysis-form-header">
        <div><span className="analysis-eyebrow">Video analysis</span><h1>{isNew ? "Create an analysis" : "Edit analysis"}</h1><p>Set the review context, select participants, and confirm everything before saving.</p></div>
        <nav className="analysis-form-progress" aria-label="Form sections">
          {STEPS.map((item) => <button key={item.id} type="button" className={`${step === item.id ? "active" : ""} ${step > item.id ? "complete" : ""}`.trim()} aria-current={step === item.id ? "step" : undefined} onClick={() => goToStep(item.id)}><b>{step > item.id ? <Check size={13} /> : item.id}</b>{item.label}</button>)}
        </nav>
      </header>

      {errors.length > 0 && <div className="admin-error analysis-alert" role="alert"><strong>Please review the following</strong><ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}

      <form className="analysis-editor" onSubmit={handleSave}>
        <div className="analysis-editor-main">
          {step === 1 && <>
            <section className="analysis-form-card">
              <div className="analysis-form-card-heading"><span className="analysis-section-icon"><ClipboardList size={19} /></span><div><h2>Analysis details</h2><p>Give this review a clear name and purpose.</p></div></div>
              <div className="analysis-form-fields">
                <div className="analysis-field analysis-field-full"><div className="analysis-label-row"><label htmlFor="analysis-title">Title</label><span>{form.title.length}/160</span></div><input id="analysis-title" required maxLength={160} placeholder="e.g. Side-out review — Round 3" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
                <div className="analysis-field analysis-field-full"><div className="analysis-label-row"><label htmlFor="analysis-summary">Summary</label><span>Optional</span></div><textarea id="analysis-summary" rows={4} placeholder="What should players focus on in this review?" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></div>
              </div>
            </section>
            <section className="analysis-form-card">
              <div className="analysis-form-card-heading"><span className="analysis-section-icon"><Layers3 size={19} /></span><div><h2>Review context</h2><p>Connect this analysis to the relevant coach, team, or event.</p></div></div>
              <div className="analysis-form-fields">
                <div className="analysis-field"><label htmlFor="analysis-coach"><UserRound size={15} /> Assigned coach</label><select id="analysis-coach" value={form.assigned_coach_profile_id ?? ""} onChange={(event) => setNullableId("assigned_coach_profile_id", event.target.value)}><option value="">No coach assigned</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coachName(coach)}</option>)}</select></div>
                <div className="analysis-field"><label htmlFor="analysis-organisation"><Building2 size={15} /> Organisation</label><select id="analysis-organisation" value={form.organisation_id ?? ""} onChange={(event) => { const nextId = event.target.value ? Number(event.target.value) : null; setForm((current) => ({ ...current, organisation_id: nextId, group_id: null })); }}><option value="">No organisation</option>{organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}</select></div>
                <div className="analysis-field"><label htmlFor="analysis-group"><Users size={15} /> Group</label><select id="analysis-group" value={form.group_id ?? ""} onChange={(event) => setNullableId("group_id", event.target.value)}><option value="">No group</option>{filteredGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
                <div className="analysis-field"><label htmlFor="analysis-training"><CalendarDays size={15} /> Training session</label><select id="analysis-training" value={form.training_session_id ?? ""} onChange={(event) => setNullableId("training_session_id", event.target.value)}><option value="">No training session</option>{trainingSessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></div>
                <div className="analysis-field analysis-field-full"><label htmlFor="analysis-tournament"><Trophy size={15} /> Tournament</label><select id="analysis-tournament" value={form.tournament_id ?? ""} onChange={(event) => setNullableId("tournament_id", event.target.value)}><option value="">No tournament</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></div>
              </div>
            </section>
          </>}

          {step === 2 && <section className="analysis-form-card">
            <div className="analysis-form-card-heading analysis-form-card-heading-spread"><div className="analysis-panel-title"><span className="analysis-section-icon"><Users size={19} /></span><div><h2>Participants</h2><p>Select every player featured in the analysis.</p></div></div><span className="analysis-selection-count">{form.player_profile_ids.length} selected</span></div>
            {players.length === 0 ? <div className="analysis-empty-row">No active players are available.</div> : <div className="analysis-player-picker">{players.map((player) => { const name = playerName(player); const selected = form.player_profile_ids.includes(player.id); return <label key={player.id} className={`analysis-player-option ${selected ? "selected" : ""}`}><input type="checkbox" checked={selected} onChange={(event) => togglePlayer(player.id, event.target.checked)} /><span className="analysis-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span><span className="analysis-player-copy"><strong>{name}</strong><small>{player.preferred_position || player.level || "Player profile"}</small></span><span className="analysis-check"><Check size={14} /></span></label>; })}</div>}
            <p className="analysis-step-note">You can continue without participants, but at least one participant is required before the analysis can be published.</p>
          </section>}

          {step === 3 && <section className="analysis-form-card analysis-review-card">
            <div className="analysis-form-card-heading"><span className="analysis-section-icon"><ClipboardCheck size={19} /></span><div><h2>Review your analysis</h2><p>Confirm the information below before {isNew ? "creating the draft" : "saving your changes"}.</p></div></div>
            <div className="analysis-review-title"><span>Title</span><h3>{form.title.trim()}</h3>{form.summary.trim() && <p>{form.summary.trim()}</p>}</div>
            <dl className="analysis-review-grid">
              <div><dt><UserRound size={15} /> Assigned coach</dt><dd>{selectedCoach ? coachName(selectedCoach) : "Not assigned"}</dd></div>
              <div><dt><Building2 size={15} /> Organisation</dt><dd>{selectedOrganisation?.name ?? "Not linked"}</dd></div>
              <div><dt><Users size={15} /> Group</dt><dd>{selectedGroup?.name ?? "Not linked"}</dd></div>
              <div><dt><CalendarDays size={15} /> Training session</dt><dd>{selectedTraining?.title ?? "Not linked"}</dd></div>
              <div><dt><Trophy size={15} /> Tournament</dt><dd>{selectedTournament?.name ?? "Not linked"}</dd></div>
              <div><dt><Users size={15} /> Participants</dt><dd>{selectedPlayers.length}</dd></div>
            </dl>
            <div className="analysis-review-participants"><h3>Selected participants</h3>{selectedPlayers.length === 0 ? <p>No participants selected yet.</p> : <div>{selectedPlayers.map((player) => <span key={player.id}><span className="analysis-avatar analysis-avatar-small" aria-hidden="true">{playerName(player).charAt(0).toUpperCase()}</span>{playerName(player)}</span>)}</div>}</div>
            {isNew && <div className="analysis-review-notice"><Check size={16} /><p>This analysis will be created as a draft. Add at least one video from the detail page before publishing it.</p></div>}
          </section>}

          <div className="analysis-step-actions">
            {step > 1 ? <button type="button" className="btn-outline" onClick={() => goToStep((step - 1) as FormStep)}><ChevronLeft size={15} /> Back</button> : <span />}
            {step < 3 ? <button type="button" className="btn-primary" onClick={() => goToStep((step + 1) as FormStep)}>Continue <ChevronRight size={15} /></button> : <button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? "Saving…" : isNew ? "Create analysis" : "Save changes"}</button>}
          </div>
        </div>

        <aside className="analysis-editor-sidebar"><div className="analysis-save-card">
          <span className="analysis-sidebar-step">Step {step} of 3</span>
          <h2>{step === 1 ? "Set the context" : step === 2 ? "Choose participants" : isNew ? "Ready to create?" : "Ready to save?"}</h2>
          <p>{step === 1 ? "Add the core information that helps players understand this review." : step === 2 ? "Choose the players who appear in the footage or should receive the feedback." : isNew ? "The analysis starts as a draft. You can add footage and comments from its detail page." : "Saving updates the analysis without changing its publication status."}</p>
          <dl><div><dt>Participants</dt><dd>{form.player_profile_ids.length}</dd></div><div><dt>Coach</dt><dd>{form.assigned_coach_profile_id ? "Assigned" : "Not set"}</dd></div><div><dt>Context</dt><dd>{form.training_session_id || form.tournament_id ? "Linked" : "Optional"}</dd></div></dl>
          {step < 3 ? <button type="button" className="btn-primary analysis-save-button" onClick={() => goToStep((step + 1) as FormStep)}>Continue <ChevronRight size={15} /></button> : <button type="submit" className="btn-primary analysis-save-button" disabled={saving}><Save size={16} /> {saving ? "Saving…" : isNew ? "Create analysis" : "Save changes"}</button>}
          <button type="button" className="analysis-cancel-button" disabled={saving} onClick={() => navigate(detailPath)}>Cancel</button>
        </div></aside>
      </form>
    </div>
  );
}