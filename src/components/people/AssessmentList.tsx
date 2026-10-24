import type { Assessment } from "../../api";
import { Link } from "react-router-dom";
import {
  assessmentRecorderLabel,
  assessmentRubricLabel,
  assessmentStatusLabel,
} from "../../utils/assessments";
import { formatApiDate } from "../../utils/dateFormatter";
import { profileDisplayName } from "../../utils/profileName";
import EmptyState from "../EmptyState";
import Tag from "../Tag";
import ScoreBadge from "./ScoreBadge";

interface AssessmentListProps {
  assessments?: Assessment[];
  emptyTitle?: string;
  emptyDescription?: string;
  showHistory?: boolean;
}

function rubricKey(row: Assessment): string {
  if (row.assessment_definition_id != null) return `definition:${row.assessment_definition_id}`;
  if (row.category_id != null) return `category:${row.category_id}`;
  return `custom:${row.custom_category ?? "unspecified"}`;
}

function assessmentDate(row: Assessment): string {
  return row.assessment_session_scheduled_on || row.assessment_session?.scheduled_on || row.created_at;
}

function AssessmentDetails({ row }: { row: Assessment }) {
  const coach = profileDisplayName(
    row.coach_account_name ?? row.coach_profile?.account_name,
    row.coach_name ?? row.coach_profile?.display_name,
  ) || "Unknown coach";
  const date = assessmentDate(row);

  return (
    <div className="assessment-meta">
      <span><strong>Responsible coach:</strong> {coach}</span>
      <span>
        <strong>Assessment session:</strong>{" "}
        {row.assessment_session_id ? (
          <Link to={`/assessment-sessions/${row.assessment_session_id}`}>
            {row.assessment_session_name || row.assessment_session?.name || `Session #${row.assessment_session_id}`}
          </Link>
        ) : (
          "Standalone assessment"
        )}
      </span>
      <span>
        <strong>Assessment date:</strong>{" "}
        <time dateTime={date}>{formatApiDate(date)}</time>
      </span>
      <span>{assessmentRecorderLabel(row)}</span>
    </div>
  );
}

export default function AssessmentList({
  assessments,
  emptyTitle = "No assessments yet",
  emptyDescription = "Coaching assessments will appear here once recorded.",
  showHistory = true,
}: AssessmentListProps) {
  const rows = assessments ?? [];
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const latestByRubric = new Map<string, Assessment>();
  for (const row of rows) {
    const key = rubricKey(row);
    if (!latestByRubric.has(key)) latestByRubric.set(key, row);
  }

  return (
    <div className="assessment-list">
      <ul className="assessment-latest-list">
        {[...latestByRubric.values()].map((row) => (
          <li key={row.id} className="assessment-latest-row">
            <div>
              <strong>{assessmentRubricLabel(row)}</strong>
              <div className="assessment-meta">
                <Tag variant={row.status === "active" ? "teal" : "default"}>
                  {assessmentStatusLabel(row.status)}
                </Tag>
              </div>
              <AssessmentDetails row={row} />
            </div>
            <ScoreBadge score={row.score} />
          </li>
        ))}
      </ul>
      {showHistory && rows.length > latestByRubric.size && (
        <details className="assessment-history">
          <summary>Assessment history ({rows.length})</summary>
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="assessment-history-row">
                <div>
                  <strong>{assessmentRubricLabel(row)}</strong>
                  <AssessmentDetails row={row} />
                  {row.notes && <p>{row.notes}</p>}
                </div>
                <div className="assessment-row-actions">
                  <Tag>{assessmentStatusLabel(row.status)}</Tag>
                  <ScoreBadge score={row.score} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
