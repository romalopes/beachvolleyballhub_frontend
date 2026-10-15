import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Tournament } from '../api';
import { formatDate, formatTime } from '../utils/dateFormatter';
import TournamentBadge from '../components/TournamentBadge';
import DivisionChip from '../components/DivisionChip';

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTournament = async (tournamentId: string) => {
      setLoading(true);
      setError(null);
      try {
        setTournament(await api.tournament(tournamentId));
      } catch (err) {
        console.error('Failed to fetch tournament:', err);
        setError('Failed to load tournament');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTournament(id);
    }
  }, [id]);

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  if (!tournament) {
    return <div className="page">Tournament not found</div>;
  }

  return (
    <div className="page">
      <div className="tournament-detail">
        <div className="tournament-header">
          <h1>{tournament.name}</h1>
          <div className="tournament-badges">
            <TournamentBadge type="scope" value={tournament.scope} />
            <TournamentBadge type="publicationState" value={tournament.publication_state} />
          </div>
        </div>
        <div className="tournament-info">
          <div className="info-section">
            <h2>Overview</h2>
            <p><strong>Organisation:</strong> {tournament.organisation.name} ({tournament.organisation.acronym})</p>
            <p>
              <strong>Date:</strong> {formatDateRange(tournament.starts_at, tournament.ends_at, tournament.all_day, tournament.timezone)}
            </p>
            <p><strong>Location:</strong> {tournament.location_name}, {tournament.city}, {tournament.state}, {tournament.country}</p>
            {tournament.website_url && (
              <p>
                <strong>Website:</strong> <a href={tournament.website_url} target="_blank" rel="noopener noreferrer">{tournament.website_url}</a>
              </p>
            )}
          </div>
          <div className="info-section">
            <h2>Description</h2>
            <p>{tournament.description || 'No description provided.'}</p>
          </div>
          <div className="info-section">
            <h2>Divisions</h2>
            {tournament.divisions.length > 0 ? (
              <div className="divisions-list">
                {tournament.divisions.map(division => (
                  <DivisionChip key={division.id} division={division} />
                ))}
              </div>
            ) : (
              <p>No divisions defined.</p>
            )}
          </div>
          <div className="info-section">
            <h2>Participants</h2>
            <p>{tournament.participations.length} participants</p>
          </div>
          <div className="info-section">
            <h2>Watch Links</h2>
            {tournament.watch_links.length > 0 ? (
              <ul className="watch-links">
                {tournament.watch_links.map(link => (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.link_type || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No watch links available.</p>
            )}
          </div>
        </div>
        <div className="tournament-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to format date range (same as in TournamentCard)
function formatDateRange(startsAt: string, endsAt: string, allDay: boolean, timezone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  if (allDay) {
    // Format as just dates
    if (start.toDateString() === end.toDateString()) {
      return `${formatDate(start)} (All day)`;
    } else {
      return `${formatDate(start)} to ${formatDate(end)} (All day)`;
    }
  } else {
    // Format with time
    if (start.toDateString() === end.toDateString()) {
      return `${formatDate(start)} ${formatTime(start)} - ${formatTime(end)} (${timezone})`;
    } else {
      return `${formatDate(start)} ${formatTime(start)} to ${formatDate(end)} ${formatTime(end)} (${timezone})`;
    }
  }
}
