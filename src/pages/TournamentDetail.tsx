import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type ParticipationRole, type Tournament } from "../api";
import { useAuth } from "../auth/AuthContext";
import DivisionChip from "../components/DivisionChip";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import TournamentBadge from "../components/TournamentBadge";

const ROLE_LABELS: Record<ParticipationRole, string> = { player: "Player", coach: "Coach", referee: "Referee", organiser: "Organiser" };
const DIVISION_ROLES = new Set<ParticipationRole>(["player", "coach"]);

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const loadTournament = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try { setTournament(await api.tournament(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load tournament."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => {
    // The loader owns request-result state; loading on route-ID changes mirrors
    // the existing tournament directory's cancellable request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTournament();
  }, [loadTournament]);
  if (loading) return <div className="page"><LoadingState /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={() => void loadTournament()} /></div>;
  if (!tournament) return <div className="page">Tournament not found.</div>;

  const readOnly = tournament.publication_state === "cancelled" || new Date(tournament.ends_at) <= new Date();
  const locationParts = [tournament.location_name, tournament.city, tournament.state, tournament.country].filter(Boolean);
  const returnPath = `${location.pathname}${location.search}`;
  return <div className="page"><div className="tournament-detail">
    <div className="tournament-header"><div><h1>{tournament.name}</h1><div className="tournament-badges"><TournamentBadge type="scope" value={tournament.scope} /><TournamentBadge type="publicationState" value={tournament.publication_state} /></div></div></div>
    {tournament.publication_state === "cancelled" && <p className="tournament-notice" role="status">This tournament has been cancelled. Participation can be removed, but it cannot be changed.</p>}
    {readOnly && tournament.publication_state !== "cancelled" && <p className="tournament-notice" role="status">This tournament has ended. Participation can be removed, but it cannot be changed.</p>}
    <div className="tournament-info">
      <section className="info-section tournament-overview">
        <h2>Overview</h2>
        <dl className="tournament-facts">
          <div><dt>Organiser</dt><dd>{tournament.organisation.name}{tournament.organisation.acronym && ` (${tournament.organisation.acronym})`}</dd></div>
          <div><dt>Date</dt><dd>{formatDateRange(tournament)}</dd></div>
          <div><dt>Location</dt><dd>{locationParts.length ? locationParts.join(", ") : "Location to be confirmed"}</dd></div>
          {tournament.website_url && <div><dt>Website</dt><dd><a href={tournament.website_url} target="_blank" rel="noopener noreferrer">Official tournament website</a></dd></div>}
        </dl>
      </section>
      <section className="info-section"><h2>Description</h2><p>{tournament.description || "No description provided."}</p></section>
      <section className="info-section"><h2>Divisions</h2>{tournament.divisions.length ? <div className="divisions-list">{tournament.divisions.map(division => <DivisionChip key={division.id} division={division} />)}</div> : <p>No divisions defined.</p>}</section>
      <ParticipationPanel tournament={tournament} signedIn={Boolean(user)} readOnly={readOnly} saving={saving} error={mutationError} onSignIn={() => navigate("/login", { state: { from: returnPath } })} onSave={async (role, divisionIds) => { setSaving(true); setMutationError(null); try { await api.participateTournament(tournament.id, { role, division_ids: divisionIds }); await loadTournament(); } catch (err) { setMutationError(err instanceof Error ? err.message : "Unable to save participation."); } finally { setSaving(false); } }} onUnlink={async () => { setSaving(true); setMutationError(null); try { await api.leaveTournament(tournament.id); await loadTournament(); } catch (err) { setMutationError(err instanceof Error ? err.message : "Unable to remove participation."); } finally { setSaving(false); } }} />
      <section className="info-section"><h2>Watch links</h2>{tournament.watch_links.filter(link => link.active).sort((a, b) => a.position - b.position).length ? <ul className="watch-links">{tournament.watch_links.filter(link => link.active).sort((a, b) => a.position - b.position).map(link => <li key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.link_type || link.url}</a></li>)}</ul> : <p>No watch links available.</p>}</section>
    </div>
    <div className="tournament-actions"><button className="btn btn-secondary" onClick={() => navigate("/tournaments")}>Back to Tournaments</button></div>
  </div></div>;
}

function ParticipationPanel({ tournament, signedIn, readOnly, saving, error, onSignIn, onSave, onUnlink }: { tournament: Tournament; signedIn: boolean; readOnly: boolean; saving: boolean; error: string | null; onSignIn: () => void; onSave: (role: ParticipationRole, divisionIds: number[]) => Promise<void>; onUnlink: () => Promise<void> }) {
  const existing = tournament.my_participation;
  const [role, setRole] = useState<ParticipationRole>(existing?.role ?? "player");
  const [divisionIds, setDivisionIds] = useState<number[]>(existing?.division_ids ?? []);
  const canChooseDivisions = DIVISION_ROLES.has(role);
  useEffect(() => {
    // Reinitialize the edit form after a successful detail refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(existing?.role ?? "player"); setDivisionIds(existing?.division_ids ?? []);
  }, [existing?.id, existing?.role, existing?.division_ids]);
  const toggleDivision = (divisionId: number) => setDivisionIds(current => current.includes(divisionId) ? current.filter(id => id !== divisionId) : [...current, divisionId]);
  return <section className="info-section participation-panel"><h2>Your participation</h2><p>This records your personal interest or attendance in BVB Hub. It is not official tournament registration.</p>
    {!signedIn ? <button className="btn btn-primary" type="button" onClick={onSignIn}>Sign in to add participation</button> : <>{existing && <p className="participation-status">You are marked as: <strong>{ROLE_LABELS[existing.role]}</strong>.</p>}{error && <p className="participation-error" role="alert">{error}</p>}
      {!readOnly && <form onSubmit={event => { event.preventDefault(); void onSave(role, canChooseDivisions ? divisionIds : []); }}><div className="form-group"><label htmlFor="participation-role">Attendance role</label><select id="participation-role" value={role} disabled={saving} onChange={event => setRole(event.target.value as ParticipationRole)}>{(Object.keys(ROLE_LABELS) as ParticipationRole[]).map(value => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></div>{canChooseDivisions && <fieldset className="participation-divisions"><legend>Eligible divisions (optional)</legend>{tournament.divisions.map(division => { const selected = divisionIds.includes(division.id); return <label key={division.id}><input type="checkbox" checked={selected} disabled={saving || (!division.active && !selected)} onChange={() => toggleDivision(division.id)} /> {division.division_code}{!division.active && " (inactive)"}</label>; })}</fieldset>}<button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : existing ? "Update participation" : "Add participation"}</button></form>}
      {existing && <button className="btn btn-secondary participation-unlink" type="button" disabled={saving} onClick={() => void onUnlink()}>{saving ? "Working..." : "Remove my participation"}</button>}</>}
  </section>;
}

function formatDateRange(tournament: Tournament): string {
  const dateOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: tournament.timezone };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: tournament.timezone };
  const start = new Date(tournament.starts_at); const end = new Date(tournament.ends_at);
  const startDate = start.toLocaleDateString("en-US", dateOptions); const endDate = end.toLocaleDateString("en-US", dateOptions);
  if (tournament.all_day) return `${startDate}${startDate === endDate ? " (all day)" : ` – ${endDate} (all day)`}`;
  return `${startDate} ${start.toLocaleTimeString("en-US", timeOptions)} – ${endDate} ${end.toLocaleTimeString("en-US", timeOptions)} (${tournament.timezone})`;
}