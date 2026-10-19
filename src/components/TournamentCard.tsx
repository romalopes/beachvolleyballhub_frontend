import { useAuth } from '../auth/AuthContext';
import type { Tournament, TournamentRelationship } from '../api';
import { formatDate, formatTime } from '../utils/dateFormatter';
import { tournamentRelationship } from '../utils/tournaments';
import RelationshipBadge from './RelationshipBadge';
import TournamentBadge from './TournamentBadge';

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
}

export default function TournamentCard({ tournament, onClick }: TournamentCardProps) {
  const { user } = useAuth();
  // One stripe per card, strongest tie wins — see tournamentRelationship.
  const relationship: TournamentRelationship | null = tournamentRelationship(tournament, user?.account_id);

  return (
    <div
      className={`card tournament-card${relationship ? ` tournament-card--${relationship}` : ''}`}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-header">
        <h3 className="card-title">{tournament.name}</h3>
        <div className="tournament-badges">
          {relationship && <RelationshipBadge kind={relationship} />}
          <TournamentBadge type="scope" value={tournament.scope} />
          <TournamentBadge type="publicationState" value={tournament.publication_state} />
        </div>
      </div>
      <div className="card-body">
        <p className="tournament-organisation">
          Organised by: <strong>{tournament.organisation.name}</strong> ({tournament.organisation.acronym})
        </p>
        <p className="tournament-dates">
          <strong>Date:</strong> {formatDateRange(tournament.starts_at, tournament.ends_at, tournament.all_day, tournament.timezone)}
        </p>
        <p className="tournament-location">
          <strong>Location:</strong> {tournament.location_name}, {tournament.city}, {tournament.state}, {tournament.country}
        </p>
        {tournament.website_url && (
          <p className="tournament-website">
            <strong>Website:</strong> <a href={tournament.website_url} target="_blank" rel="noopener noreferrer">{tournament.website_url}</a>
          </p>
        )}
        {tournament.description && (
          <p className="tournament-description">
            <strong>Description:</strong> {tournament.description}
          </p>
        )}
      </div>
      <div className="card-footer">
        <div className="tournament-stats">
          <span className="stat-item">
            <strong>Divisions:</strong> {tournament.divisions.length}
          </span>
          <span className="stat-item">
            <strong>Participants:</strong> {tournament.participations.length}
          </span>
          <span className="stat-item">
            <strong>Watch Links:</strong> {tournament.watch_links.length}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper function to format date range
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