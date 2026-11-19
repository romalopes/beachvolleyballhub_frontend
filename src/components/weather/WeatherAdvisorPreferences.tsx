import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type WeatherAdvisorPreference } from '../../api';
import {
  DEFAULT_WEATHER_ADVISOR_PREFERENCE,
  DEFAULT_WEATHER_ADVISOR_CONDITIONS,
  WEATHER_PREFERENCE_CHANGED_EVENT,
  WEATHER_WEIGHT_KEYS,
  rebalanceWeatherWeights,
  weatherPreferencesEqual,
  normalizeConditions,
  type WeatherWeightKey,
} from '../../utils/weatherAdvisorPreferences';
import WeatherWeightSlider from './WeatherWeightSlider';

const FACTORS: Array<{ key: WeatherWeightKey; label: string; explanation: string }> = [
  { key: 'wind_weight', label: 'Wind', explanation: 'Calm wind scores highest; strong wind and large gust differences reduce the factor score.' },
  { key: 'temperature_weight', label: 'Temperature', explanation: 'Feels-like temperature is preferred, with 18-28C scoring highest.' },
  { key: 'rain_weight', label: 'Rain', explanation: 'Lower forecast rain chance scores higher; current precipitation is used when chance is missing.' },
  { key: 'uv_weight', label: 'UV', explanation: 'Lower UV scores higher, while elevated and extreme UV still produce advice or warnings.' },
  { key: 'humidity_weight', label: 'Humidity', explanation: 'Humidity up to 60% scores highest and increasingly humid conditions score lower.' },
];

const CONDITION_FACTORS: Array<{ key: keyof typeof DEFAULT_WEATHER_ADVISOR_CONDITIONS; label: string; fields: Array<{ key: string; label: string; unit: string; step: number }> }> = [
  { key: 'temperature', label: 'Temperature comfort range (C)', fields: [
    { key: 'min_c', label: 'Minimum comfortable', unit: 'C', step: 1 },
    { key: 'ideal_min_c', label: 'Ideal minimum', unit: 'C', step: 1 },
    { key: 'ideal_max_c', label: 'Ideal maximum', unit: 'C', step: 1 },
    { key: 'max_c', label: 'Maximum comfortable', unit: 'C', step: 1 },
  ]},
  { key: 'wind', label: 'Wind comfort thresholds (kph)', fields: [
    { key: 'ideal_max_kph', label: 'Ideal maximum', unit: 'kph', step: 1 },
    { key: 'comfortable_max_kph', label: 'Comfortable maximum', unit: 'kph', step: 1 },
    { key: 'high_kph', label: 'High/unplayable', unit: 'kph', step: 1 },
  ]},
  { key: 'rain', label: 'Rain probability thresholds (%)', fields: [
    { key: 'preferred_max_percent', label: 'Preferred maximum', unit: '%', step: 5 },
    { key: 'comfortable_max_percent', label: 'Comfortable maximum', unit: '%', step: 5 },
    { key: 'high_percent', label: 'High', unit: '%', step: 5 },
  ]},
  { key: 'uv', label: 'UV index thresholds', fields: [
    { key: 'preferred_max', label: 'Preferred maximum', unit: '', step: 1 },
    { key: 'comfortable_max', label: 'Comfortable maximum', unit: '', step: 1 },
    { key: 'high', label: 'High', unit: '', step: 1 },
  ]},
  { key: 'humidity', label: 'Humidity thresholds (%)', fields: [
    { key: 'preferred_max_percent', label: 'Preferred maximum', unit: '%', step: 5 },
    { key: 'comfortable_max_percent', label: 'Comfortable maximum', unit: '%', step: 5 },
    { key: 'high_percent', label: 'High', unit: '%', step: 5 },
  ]},
];

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const DIRECTION_VALUES = ['neutral', 'bad', 'very_bad'] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const status = (error as Error & { status?: number }).status;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  return error.message || fallback;
}

export default function WeatherAdvisorPreferences() {
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState<WeatherAdvisorPreference | null>(null);
  const [draft, setDraft] = useState<WeatherAdvisorPreference>(
    DEFAULT_WEATHER_ADVISOR_PREFERENCE,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .weatherAdvisorPreference()
      .then((preference) => {
        if (cancelled) return;
        setSaved(preference);
        setDraft(preference);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError, 'Failed to load weather preferences.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.hash !== '#weather-advisor-preferences') return;
    const frame = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: 'start' });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, loading]);

  const dirty = saved ? !weatherPreferencesEqual(saved, draft) : false;
  const total = WEATHER_WEIGHT_KEYS.reduce((sum, key) => sum + draft[key], 0);

  const changeWeight = (key: WeatherWeightKey, value: number) => {
    setDraft((current) => rebalanceWeatherWeights(current, key, value));
    setError(null);
    setNotice(null);
  };

  const changeCondition = (factor: keyof typeof DEFAULT_WEATHER_ADVISOR_CONDITIONS, field: string, value: number) => {
    setDraft((current) => ({
      ...current,
      conditions: normalizeConditions({
        ...current.conditions,
        [factor]: { ...current.conditions[factor], [field]: value },
      }),
    }));
    setError(null);
    setNotice(null);
  };

  const changeDirection = (direction: typeof DIRECTIONS[number], value: typeof DIRECTION_VALUES[number]) => {
    setDraft((current) => ({
      ...current,
      wind_direction_preferences: {
        ...current.wind_direction_preferences,
        [direction]: value,
      },
    }));
    setError(null);
    setNotice(null);
  };

  const announceChange = () => {
    window.dispatchEvent(new Event(WEATHER_PREFERENCE_CHANGED_EVENT));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const preference = await api.updateWeatherAdvisorPreference(draft);
      setSaved(preference);
      setDraft(preference);
      setNotice('Weather advisor preferences saved.');
      announceChange();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to save weather preferences.'));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const preference = await api.resetWeatherAdvisorPreference();
      setSaved(preference);
      setDraft(preference);
      setNotice('Weather advisor preferences reset to defaults.');
      announceChange();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to reset weather preferences.'));
    } finally {
      setSaving(false);
    }
  };

  const renderConditionInputs = () => CONDITION_FACTORS.map((factor) => (
    <details key={factor.key} className='weather-condition-group'>
      <summary>{factor.label}</summary>
      <div className='weather-condition-fields'>
        {factor.fields.map((field) => (
          <div key={field.key} className='weather-condition-field'>
            <label htmlFor={`condition-${factor.key}-${field.key}`}>{field.label} ({field.unit})</label>
            <input
              type='number'
              id={`condition-${factor.key}-${field.key}`}
              value={draft.conditions[factor.key][field.key as keyof typeof draft.conditions[typeof factor.key]]}
              onChange={(e) => changeCondition(factor.key, field.key, Number(e.target.value) || 0)}
              step={field.step}
              min={0}
              disabled={saving}
            />
          </div>
        ))}
      </div>
    </details>
  ));

  const renderDirectionInputs = () => (
    <details className='weather-direction-group'>
      <summary>Wind direction preferences</summary>
      <p className='weather-direction-explanation'>
        Wind direction is where the wind comes FROM. Preferences only reduce the wind score.
        Neutral = no effect, Bad = -10, Very bad = -20. Cannot create positive bonuses.
      </p>
      <div className='weather-direction-grid'>
        {DIRECTIONS.map((dir) => (
          <div key={dir} className='weather-direction-item'>
            <label htmlFor={`direction-${dir}`}>{dir}</label>
            <select
              id={`direction-${dir}`}
              value={draft.wind_direction_preferences[dir]}
              onChange={(e) => changeDirection(dir, e.target.value as typeof DIRECTION_VALUES[number])}
              disabled={saving}
            >
              {DIRECTION_VALUES.map((val) => (
                <option key={val} value={val}>{val.charAt(0).toUpperCase() + val.slice(1)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </details>
  );

  return (
    <section
      ref={sectionRef}
      id='weather-advisor-preferences'
      className='detail-section weather-advisor-preferences'
    >
      <h2 ref={headingRef} tabIndex={-1}>Weather Advisor preferences</h2>
      <p>
        Choose how strongly each measured factor influences your personal 0-100
        beach-volleyball suitability score. The five weights always total 100%.
      </p>
      <p>
        Missing measurements and zero-weight factors are excluded, then the remaining
        measured weights are normalized. Labels are Excellent (85+), Good (70+), Fair
        (50+), Poor (30+), and Unsuitable (below 30).
      </p>
      <p className='weather-preference-warning'>
        This is a coaching aid, not a certified safety assessment. Strong wind, extreme
        heat, heavy rain, and extreme UV warnings are calculated independently and cannot
        be disabled by changing weights.
      </p>
      <details className='weather-scoring-details'>
        <summary>How each factor is scored</summary>
        <ul>
          {FACTORS.map((factor) => <li key={factor.key}><strong>{factor.label}:</strong> {factor.explanation}</li>)}
        </ul>
      </details>

      {loading && <p role='status'>Loading weather advisor preferences...</p>}
      {error && <div className='auth-flash auth-flash-error' role='alert'>{error}</div>}
      {notice && <div className='auth-flash auth-flash-notice' role='status'>{notice}</div>}

      {!loading && saved && (
        <>
          <div className='weather-weight-list'>
            {FACTORS.map((factor) => (
              <WeatherWeightSlider
                key={factor.key}
                id={factor.key}
                label={factor.label}
                value={draft[factor.key]}
                disabled={saving}
                onChange={(value) => changeWeight(factor.key, value)}
              />
            ))}
          </div>
          <p className='weather-weight-total' aria-live='polite'>Total: <strong>{total}%</strong></p>

          {renderConditionInputs()}
          {renderDirectionInputs()}

          <div className='weather-preference-actions'>
            <button type='button' className='auth-submit' disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
            <button type='button' className='secondary-button' disabled={saving || !dirty} onClick={() => { setDraft(saved); setError(null); setNotice(null); }}>
              Discard changes
            </button>
            <button type='button' className='secondary-button' disabled={saving} onClick={() => void reset()}>
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </section>
  );
}
