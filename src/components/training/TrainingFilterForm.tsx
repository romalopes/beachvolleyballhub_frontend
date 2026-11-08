import type { TrainingSessionStatus } from "../../api";
import { TRAINING_STATUSES } from "../../utils/training";

export interface TrainingSeriesOption {
  value: number;
  label: string;
}

interface TrainingFilterFormProps {
  status: TrainingSessionStatus | "";
  mine: boolean;
  organisation: string;
  seriesOptions: TrainingSeriesOption[];
  seriesFilter: number | null;
  onChange: (patch: {
    status?: TrainingSessionStatus | "";
    mine?: boolean;
    organisation?: string;
    training_series_id?: number | null;
  }) => void;
  onReset: () => void;
}

/**
 * Session filters for the merged Training page, styled like the tournament
 * filter form (`.filter-form` + `.form-group`) so the directories match.
 */
export default function TrainingFilterForm({
  status,
  mine,
  organisation,
  seriesOptions,
  seriesFilter,
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

      <div className="form-group">
        <label htmlFor="training-series-filter">Training series</label>
        <select
          id="training-series-filter"
          value={seriesFilter ?? ""}
          onChange={(event) =>
            onChange({
              training_series_id: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
        >
          <option value="">Any series</option>
          {seriesOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="training-organisation">Organisation</label>
        <input
          id="training-organisation"
          type="search"
          value={organisation}
          placeholder="Search by organisation"
          onChange={(event) => onChange({ organisation: event.target.value })}
        />
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
