import {
  TIME_ZONES,
  WEEKDAYS,
  toggleWeekday,
} from "../../utils/recurringTraining";
import {
  TRAINING_DURATION_OPTIONS,
  durationChoices,
} from "../../utils/training";

export interface RecurrenceValues {
  startsOn: string;
  endsOn: string;
  weekdays: string[];
  localStartTime: string;
  durationMinutes: number;
  interval: number;
  timeZone: string;
}

interface Props {
  values: RecurrenceValues;
  onChange: (patch: Partial<RecurrenceValues>) => void;
  disabled?: boolean;
}

/**
 * Weekly recurrence inputs shared by the create form and future-edit flows.
 * The component is controlled; it never owns the rule or submits anything.
 */
export default function RecurrenceFields({ values, onChange, disabled = false }: Props) {
  const durations = durationChoices(TRAINING_DURATION_OPTIONS.map((option) => option.value), values.durationMinutes);
  const zones = Array.from(new Set([...TIME_ZONES, values.timeZone].filter(Boolean)));

  return (
    <fieldset className="recurrence-fields" disabled={disabled}>
      <legend>Recurrence</legend>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="recurrence-start">Starts on</label>
          <input
            id="recurrence-start"
            type="date"
            value={values.startsOn}
            onChange={(event) => onChange({ startsOn: event.target.value })}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="recurrence-end">Ends on (inclusive)</label>
          <input
            id="recurrence-end"
            type="date"
            value={values.endsOn}
            min={values.startsOn}
            onChange={(event) => onChange({ endsOn: event.target.value })}
            required
          />
        </div>
      </div>

      <div className="admin-field">
        <span className="admin-field-label">Weekdays</span>
        <div className="recurrence-weekdays" role="group" aria-label="Weekdays">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="recurrence-weekday">
              <input
                type="checkbox"
                checked={values.weekdays.includes(day.value)}
                onChange={() =>
                  onChange({ weekdays: toggleWeekday(values.weekdays, day.value) })
                }
              />
              <span>{day.short}</span>
            </label>
          ))}
        </div>
        {values.weekdays.length === 0 && (
          <p className="field-hint field-hint-warning">Choose at least one weekday.</p>
        )}
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="recurrence-time">Local start time</label>
          <input
            id="recurrence-time"
            type="time"
            value={values.localStartTime}
            onChange={(event) => onChange({ localStartTime: event.target.value })}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="recurrence-duration">Duration</label>
          <select
            id="recurrence-duration"
            value={values.durationMinutes}
            onChange={(event) => onChange({ durationMinutes: Number(event.target.value) })}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {TRAINING_DURATION_OPTIONS.find((option) => option.value === minutes)?.label ??
                  `${minutes} min`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="recurrence-interval">Repeat every</label>
          <select
            id="recurrence-interval"
            value={values.interval}
            onChange={(event) => onChange({ interval: Number(event.target.value) })}
          >
            {[1, 2, 3, 4].map((weeks) => (
              <option key={weeks} value={weeks}>
                {weeks === 1 ? "Every week" : `Every ${weeks} weeks`}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="recurrence-zone">Time zone</label>
          <select
            id="recurrence-zone"
            value={values.timeZone}
            onChange={(event) => onChange({ timeZone: event.target.value })}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="field-hint">
        Occurrences are created in the chosen time zone. A session that falls in a
        daylight-saving gap is rejected; an ambiguous time uses the earlier offset.
      </p>
    </fieldset>
  );
}
