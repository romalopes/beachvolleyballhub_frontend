import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, Users } from "lucide-react";
import { api, type AnalysisParticipant, type Player } from "../../api";

function playerName(player: Player) {
  return (
    player.full_name ||
    player.display_name ||
    player.person?.first_name ||
    `Player ${player.id}`
  );
}

interface AnalysisParticipantsSectionProps {
  participants: AnalysisParticipant[];
  canManage: boolean;
  /** Called with the full next list of player profile ids after add/remove. */
  onUpdate: (playerProfileIds: number[]) => Promise<void>;
  /** Optional preloaded player list for browse mode (when search is empty). */
  browsePlayers?: Player[];
}

/**
 * Participants panel for the analysis detail page. Readers see the roster;
 * staff (canManage) additionally get a server-side player search to add
 * participants and a remove control per card.
 */
export default function AnalysisParticipantsSection({
  participants,
  canManage,
  onUpdate,
  browsePlayers,
}: AnalysisParticipantsSectionProps) {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Player[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The term whose search has settled. Derived (not stored) "searching" then
  // needs no synchronous setState in the effect body.
  const [settledTerm, setSettledTerm] = useState<string | null>(null);

  // Monotonic request id so a stale search response can never overwrite a
  // newer one.
  const seqRef = useRef(0);
  const term = search.trim();

  useEffect(() => {
    if (!term) return;
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      api
        .players({ q: term, status: "active", include_private: true, per_page: 20 })
        .then((response) => {
          if (seq !== seqRef.current) return;
          setSettledTerm(term);
          setMatches(response.data);
          setSearchError(null);
        })
        .catch((reason: unknown) => {
          if (seq !== seqRef.current) return;
          setSettledTerm(term);
          setMatches([]);
          setSearchError(
            reason instanceof Error ? reason.message : "Failed to search players.",
          );
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  // Searching until the current term has been answered (or has failed);
  // results and errors only apply while the settled response matches.
  const searching = term.length > 0 && settledTerm !== term;
  const settled = term.length > 0 && settledTerm === term;
  const activeError = settled ? searchError : null;

  // Never offer a player who is already on the roster.
  const candidates = useMemo(() => {
    const existingIds = new Set(participants.map((p) => p.player_profile_id));
    return (settled ? matches : []).filter(
      (player) => !existingIds.has(player.id),
    );
  }, [settled, matches, participants]);

  // Browse mode candidates (preloaded players not already on roster, when search is empty)
  const browseCandidates = useMemo(() => {
    if (!browsePlayers || term.length > 0) return [];
    const existingIds = new Set(participants.map((p) => p.player_profile_id));
    return browsePlayers.filter((player) => !existingIds.has(player.id));
  }, [browsePlayers, participants, term]);

  const applyUpdate = async (playerProfileIds: number[]) => {
    setWorking(true);
    setError(null);
    try {
      await onUpdate(playerProfileIds);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update the participants.",
      );
    } finally {
      setWorking(false);
    }
  };

  const addParticipant = (player: Player) => {
    void applyUpdate([
      ...participants.map((p) => p.player_profile_id),
      player.id,
    ]);
  };

  const removeParticipant = (participant: AnalysisParticipant) => {
    void applyUpdate(
      participants
        .filter((p) => p.player_profile_id !== participant.player_profile_id)
        .map((p) => p.player_profile_id),
    );
  };

  return (
    <section className="analysis-panel">
      <div className="analysis-panel-heading">
        <div className="analysis-panel-title">
          <span className="analysis-section-icon">
            <Users size={19} />
          </span>
          <div>
            <h2>Participants</h2>
            <p>Players included in this review</p>
          </div>
        </div>
        <span className="analysis-count">{participants.length}</span>
      </div>

      {canManage && (
        <>
          <label className="analysis-participant-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players by name or email to add them"
              aria-label="Search participants to add"
            />
          </label>
          {activeError && (
            <p className="analysis-search-error" role="alert">
              {activeError}
            </p>
          )}
          {searching && (
            <div className="analysis-empty-row">Searching players…</div>
          )}
          {settled && (
            <div className="analysis-player-picker analysis-participant-results">
              {candidates.length === 0 ? (
                <div className="analysis-empty-row">
                  No players match “{term}”.
                </div>
              ) : (
                candidates.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className="analysis-player-option"
                    disabled={working}
                    onClick={() => addParticipant(player)}
                    data-testid={`add-participant-${player.id}`}
                  >
                    <span className="analysis-avatar" aria-hidden="true">
                      {playerName(player).charAt(0).toUpperCase()}
                    </span>
                    <span className="analysis-player-copy">
                      <strong>{playerName(player)}</strong>
                      <small>
                        {player.preferred_position ||
                          player.level ||
                          "Player profile"}
                      </small>
                    </span>
                    <span className="analysis-check">
                      <Plus size={14} />
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {!term && browsePlayers && browseCandidates.length > 0 && (
            <div className="analysis-player-picker analysis-participant-results analysis-browse-results">
              {browseCandidates.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="analysis-player-option"
                  disabled={working}
                  onClick={() => addParticipant(player)}
                  data-testid={`add-participant-${player.id}`}
                >
                  <span className="analysis-avatar" aria-hidden="true">
                    {playerName(player).charAt(0).toUpperCase()}
                  </span>
                  <span className="analysis-player-copy">
                    <strong>{playerName(player)}</strong>
                    <small>
                      {player.preferred_position ||
                        player.level ||
                        "Player profile"}
                    </small>
                  </span>
                  <span className="analysis-check">
                    <Plus size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {!term && browsePlayers && browseCandidates.length === 0 && participants.length > 0 && (
            <div className="analysis-empty-row">
              All available players are already added.
            </div>
          )}

          {!term && browsePlayers && browseCandidates.length === 0 && participants.length === 0 && (
            <div className="analysis-empty-row">
              No players available to add.
            </div>
          )}
        </>
      )}

      {error && (
        <div className="admin-error analysis-section-error" role="alert">
          {error}
        </div>
      )}

      {participants.length === 0 ? (
        <div className="analysis-empty-row">
          {canManage
            ? "No participants have been added. Search above to add the first one."
            : "No participants have been added."}
        </div>
      ) : (
        <div className="analysis-participant-grid">
          {participants.map((participant) => (
            <div key={participant.id} className="analysis-participant-card">
              <span className="analysis-avatar" aria-hidden="true">
                {participant.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{participant.name}</strong>
                <span>{participant.notes || "Player"}</span>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="analysis-participant-remove analysis-participant-card-remove"
                  aria-label={`Remove ${participant.name} from this analysis`}
                  title={`Remove ${participant.name}`}
                  disabled={working}
                  onClick={() => removeParticipant(participant)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
