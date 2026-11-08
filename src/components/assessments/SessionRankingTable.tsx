import { Trophy, AlertCircle, UserMinus } from "lucide-react";
import type {
  AssessmentSessionDiscipline,
  AssessmentSessionRankingPayload,
} from "../../api";
import { profileDisplayName } from "../../utils/profileName";

interface SessionRankingTableProps {
  disciplines: AssessmentSessionDiscipline[];
  rankingPayload: AssessmentSessionRankingPayload;
}

export default function SessionRankingTable({
  disciplines,
  rankingPayload,
}: SessionRankingTableProps) {
  const { ranking, incomplete, excluded } = rankingPayload;
  const disciplineMap = new Map(disciplines.map((c) => [c.id, c.label]));

  const hasRankings = ranking && ranking.length > 0;
  const hasIncomplete = incomplete && incomplete.length > 0;
  const hasExcluded = excluded && excluded.length > 0;

  if (!hasRankings && !hasIncomplete && !hasExcluded) {
    return (
      <div className="session-ranking-empty">
        <p>No players on the session roster yet.</p>
      </div>
    );
  }

  return (
    <div className="session-ranking-container">
      {/* 1. Complete Ranked Players */}
      <section className="ranking-section">
        <div className="ranking-section-header">
          <Trophy size={18} className="ranking-icon trophy" />
          <h4>Official Ranking ({ranking.length})</h4>
        </div>
        {hasRankings ? (
          <div className="ranking-table-wrapper">
            <table className="session-ranking-table">
              <thead>
                <tr>
                  <th className="col-rank">Rank</th>
                  <th className="col-player">Player</th>
                  <th className="col-score">Overall Score</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.player_profile_id} className="ranking-row">
                    <td className="cell-rank">
                      <span className={`rank-badge rank-${row.rank}`}>
                        #{row.rank}
                      </span>
                    </td>
                    <td className="cell-player">
                      <span className="player-name">{profileDisplayName(row.account_name, row.player_name)}</span>
                    </td>
                    <td className="cell-score">
                      <span className="overall-score-badge">{row.overall_score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ranking-empty-msg">
            No complete ratings recorded yet. Score every discipline for a player to include them in the ranking.
          </p>
        )}
      </section>

      {/* 2. Incomplete Scores */}
      {hasIncomplete && (
        <section className="ranking-section incomplete-section">
          <div className="ranking-section-header">
            <AlertCircle size={18} className="ranking-icon alert" />
            <h4>Incomplete / Missing Disciplines ({incomplete.length})</h4>
          </div>
          <p className="ranking-section-desc">
            These included players are not ranked because they have unscored disciplines.
          </p>
          <ul className="incomplete-player-list">
            {incomplete.map((row) => {
              const missingNames = row.missing_discipline_ids
                .map((id) => disciplineMap.get(id) || `Discipline #${id}`)
                .join(", ");

              return (
                <li key={row.player_profile_id} className="incomplete-player-item">
                  <div className="incomplete-player-info">
                    <span className="player-name">{profileDisplayName(row.account_name, row.player_name)}</span>
                    <span className="incomplete-disciplines-badge">
                      Missing: {missingNames || "unscored"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3. Excluded Roster Breakdown */}
      {hasExcluded && (
        <section className="ranking-section excluded-section">
          <div className="ranking-section-header">
            <UserMinus size={18} className="ranking-icon minus" />
            <h4>Excluded Players ({excluded.length})</h4>
          </div>
          <p className="ranking-section-desc">
            Players explicitly excluded from evaluation for this session (e.g. injured or absent).
          </p>
          <ul className="excluded-player-list">
            {excluded.map((row) => (
              <li key={row.player_profile_id} className="excluded-player-item">
                <div className="excluded-player-info">
                  <span className="player-name">{profileDisplayName(row.account_name, row.player_name)}</span>
                  {row.missing_reason && (
                    <span className="excluded-reason">Reason: {row.missing_reason}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
