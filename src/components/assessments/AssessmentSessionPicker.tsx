import { useState } from "react";
import { Link2 } from "lucide-react";
import type { AssessmentSession } from "../../api";

interface AssessmentSessionPickerProps {
  /** Sessions the caller may link - already authorized upstream. */
  options: AssessmentSession[];
  /** Ids already linked; filtered out of the dropdown. */
  linkedIds: number[];
  busy?: boolean;
  /** Called with the selected session id when the add button is pressed. */
  onLink: (assessmentSessionId: number) => void;
  /** Visible/accessible label for the select; also namespaces the input id. */
  label?: string;
  buttonLabel?: string;
  placeholder?: string;
}

/** Shared staff picker for linking an assessment session as a deliverable.
 *  Used by both the analysis-request detail page and the analysis detail
 *  page; the caller owns the API call and the resulting state update. */
export function AssessmentSessionPicker({
  options,
  linkedIds,
  busy = false,
  onLink,
  label = "Add assessment session",
  buttonLabel = "Add as deliverable",
  placeholder = "Choose a session\u2026",
}: AssessmentSessionPickerProps) {
  const [choice, setChoice] = useState("");
  const inputId = `assessment-session-picker-${label
    .replace(/\s+/g, "-")
    .toLowerCase()}`;
  const available = options.filter((s) => !linkedIds.includes(s.id));

  return (
    <div className="form-group">
      <label className="visually-hidden" htmlFor={inputId}>
        {label}
      </label>
      <div className="contact-detail-actions">
        <select
          id={inputId}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {available.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
              {session.scheduled_on ? ` \u00b7 ${session.scheduled_on}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="auth-submit"
          disabled={busy || !choice}
          onClick={() => {
            onLink(Number(choice));
            setChoice("");
          }}
        >
          <Link2 size={14} aria-hidden="true" /> {buttonLabel}
        </button>
      </div>
    </div>
  );
}
