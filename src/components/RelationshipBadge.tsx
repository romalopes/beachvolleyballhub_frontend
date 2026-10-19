import type { TournamentRelationship } from "../api";

const RELATIONSHIP_LABELS: Record<TournamentRelationship, string> = {
  created: "Created by you",
  participating: "Participating",
  following: "Following",
};

/**
 * The badge naming the signed-in user's tie to a tournament. The text carries
 * the meaning; the colour is only an accent (the card's left stripe repeats
 * it), so the state never rides on colour alone.
 */
export default function RelationshipBadge({
  kind,
}: {
  kind: TournamentRelationship;
}) {
  return (
    <span
      className={`tournament-relationship-badge tournament-relationship-${kind}`}
    >
      {RELATIONSHIP_LABELS[kind]}
    </span>
  );
}