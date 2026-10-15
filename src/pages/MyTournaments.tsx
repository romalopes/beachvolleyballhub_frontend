import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Tournament } from "../api";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import TournamentCard from "../components/TournamentCard";
import { fetchAllTournamentPages } from "../utils/tournaments";

export default function MyTournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setTournaments(await fetchAllTournamentPages({ mine: true }, undefined, api.tournaments)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load your tournaments."); setTournaments([]); }
  };
  useEffect(() => {
    // The asynchronous loader owns request-result state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  const groups = useMemo(() => {
    const now = new Date();
    const values: Record<"Upcoming" | "Ongoing" | "Past", Tournament[]> = { Upcoming: [], Ongoing: [], Past: [] };
    (tournaments ?? []).filter(tournament => tournament.publication_state !== "archived").forEach(tournament => {
      values[new Date(tournament.starts_at) > now ? "Upcoming" : new Date(tournament.ends_at) > now ? "Ongoing" : "Past"].push(tournament);
    });
    return values;
  }, [tournaments]);
  return <div className="page"><PageHeader title="My Tournaments" description="Tournaments you have marked as personal interest or attendance." />
    {tournaments === null ? <LoadingState /> : error ? <ErrorState error={error} onRetry={() => void load()} /> : tournaments.length === 0 ? <EmptyState title="No tournaments yet" description="Browse tournaments and add your participation to find them here." /> : <div className="my-tournaments">{(Object.keys(groups) as Array<keyof typeof groups>).map(title => groups[title].length > 0 && <section key={title}><h2>{title}</h2><div className="tournaments-grid">{groups[title].map(tournament => <TournamentCard key={tournament.id} tournament={tournament} onClick={() => navigate(`/tournaments/${tournament.id}`)} />)}</div></section>)}</div>}
  </div>;
}