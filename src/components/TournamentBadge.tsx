import type { TournamentScope, PublicationState } from '../api';

interface TournamentBadgeProps {
  /** The type of badge: 'scope' or 'publicationState' */
  type: 'scope' | 'publicationState';
  /** The value to display */
  value: TournamentScope | PublicationState;
}

export default function TournamentBadge({ type, value }: TournamentBadgeProps) {
  // We'll compute a class name based on type and value
  // For simplicity, we'll use a generic badge class and let CSS handle variations
  // We can also pass the value as a class name modifier
  const className = `tournament-badge tournament-badge-${type}-${String(value).toLowerCase()}`;

  return <span className={className}>{String(value)}</span>;
}