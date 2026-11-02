import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, type WeatherAdvisorPreference } from "../../api";
import {
  DEFAULT_WEATHER_ADVISOR_PREFERENCE,
  WEATHER_PREFERENCE_CHANGED_EVENT,
  WEATHER_WEIGHT_KEYS,
  rebalanceWeatherWeights,
  weatherWeightsEqual,
  type WeatherWeightKey,
} from "../../utils/weatherAdvisorPreferences";
import WeatherWeightSlider from "./WeatherWeightSlider";

const FACTORS: Array<{ key: WeatherWeightKey; label: string; explanation: string }> = [
  { key: "wind_weight", label: "Wind", explanation: "Calm wind scores highest; strong wind and large gust differences reduce the factor score." },
  { key: "temperature_weight", label: "Temperature", explanation: "Feels-like temperature is preferred, with 18–28°C scoring highest." },
  { key: "rain_weight", label: "Rain", explanation: "Lower forecast rain chance scores higher; current precipitation is used when chance is missing." },
  { key: "uv_weight", label: "UV", explanation: "Lower UV scores higher, while elevated and extreme UV still produce advice or warnings." },
  { key: "humidity_weight", label: "Humidity", explanation: "Humidity up to 60% scores highest and increasingly humid conditions score lower." },
];

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const status = (error as Error & { status?: number }).status;
  if (status === 401) return "Your session has expired. Please sign in again.";
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
        if (!cancelled) setError(errorMessage(requestError, "Failed to load weather preferences."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.hash !== "#weather-advisor-preferences") return;
    const frame = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, loading]);

  const dirty = saved ? !weatherWeightsEqual(saved, draft) : false;
  const total = WEATHER_WEIGHT_KEYS.reduce((sum, key) => sum + draft[key], 0);

  const changeWeight = (key: WeatherWeightKey, value: number) => {
    setDraft((current) => rebalanceWeatherWeights(current, key, value));
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
      setNotice("Weather advisor preferences saved.");
      announceChange();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to save weather preferences."));
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
      setNotice("Weather advisor preferences reset to defaults.");
      announceChange();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to reset weather preferences."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="weather-advisor-preferences"
      className="detail-section weather-advisor-preferences"
    >
      <h2 ref={headingRef} tabIndex={-1}>Weather Advisor preferences</h2>
      <p>
        Choose how strongly each measured factor influences your personal 0–100
        beach-volleyball suitability score. The five weights always total 100%.
      </p>
      <p>
        Missing measurements and zero-weight factors are excluded, then the remaining
        measured weights are normalized. Labels are Excellent (85+), Good (70+), Fair
        (50+), Poor (30+), and Unsuitable (below 30).
      </p>
      <p className="weather-preference-warning">
        This is a coaching aid, not a certified safety assessment. Strong wind, extreme
        heat, heavy rain, and extreme UV warnings are calculated independently and cannot
        be disabled by changing weights.
      </p>
      <details className="weather-scoring-details">
        <summary>How each factor is scored</summary>
        <ul>
          {FACTORS.map((factor) => <li key={factor.key}><strong>{factor.label}:</strong> {factor.explanation}</li>)}
        </ul>
      </details>

      {loading && <p role="status">Loading weather advisor preferences…</p>}
      {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
      {notice && <div className="auth-flash auth-flash-notice" role="status">{notice}</div>}

      {!loading && saved && (
        <>
          <div className="weather-weight-list">
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
          <p className="weather-weight-total" aria-live="polite">Total: <strong>{total}%</strong></p>
          <div className="weather-preference-actions">
            <button type="button" className="auth-submit" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? "Saving…" : "Save preferences"}
            </button>
            <button type="button" className="secondary-button" disabled={saving || !dirty} onClick={() => { setDraft(saved); setError(null); setNotice(null); }}>
              Discard changes
            </button>
            <button type="button" className="secondary-button" disabled={saving} onClick={() => void reset()}>
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </section>
  );
}