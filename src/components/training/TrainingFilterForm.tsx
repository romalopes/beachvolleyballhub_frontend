import type { TrainingSessionStatus } from "../../api";
import { TRAINING_STATUSES } from "../../utils/training";

interface TrainingFilterFormProps {
  status: TrainingSessionStatus | "";
  mine: boolean;
  onChange: (patch: { status?: TrainingSessionStatus | ""; mine?: boolean }) => void;
  onReset: () => void;
}

/**
 * Session filters for the merged Training page, styled like the tournament
 * filter form (`.filter-form` + `.form-group`) so the directories match.
 */
export default function TrainingFilterForm({
  status,
  mine,
  onChange,
  onReset,
}: TrainingFilterFormProps) {
  return (
    <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
      <div className="form-group">
        <label htmlFor="training-status">Status</label>
        <select
          id="training-status"
          value={status}
          onChange={(event) =>
            onChange({ status: event.target.value as TrainingSessionStatus | "" })
          }
        >
          <option value="">Any status</option>
          {TRAINING_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="form-group">
        <legend>Your schedule</legend>
        <label>
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => onChange({ mine: event.target.checked })}
          />
          Only sessions I participate in
        </label>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="admin-btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </form>
  );
}
