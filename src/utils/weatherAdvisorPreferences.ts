import type { WeatherAdvisorPreference, WeatherAdvisorConditions, WeatherDirectionPreferences, WeatherDirectionValue, WeatherDirectionKey } from "../api";

export const WEATHER_PREFERENCE_CHANGED_EVENT =
  "beachvolleyballhub:weather-advisor-preference-changed";

export const WEATHER_WEIGHT_KEYS = [
  "wind_weight",
  "temperature_weight",
  "rain_weight",
  "uv_weight",
  "humidity_weight",
] as const;

export type WeatherWeightKey = (typeof WEATHER_WEIGHT_KEYS)[number];

const DIRECTIONS: WeatherDirectionKey[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIRECTION_VALUES: WeatherDirectionValue[] = ["neutral", "bad", "very_bad"];

export const DEFAULT_WEATHER_ADVISOR_CONDITIONS: WeatherAdvisorConditions = {
  temperature: { min_c: 5, ideal_min_c: 17, ideal_max_c: 28, max_c: 40 },
  wind: { ideal_max_kph: 10, comfortable_max_kph: 20, high_kph: 40 },
  rain: { preferred_max_percent: 20, comfortable_max_percent: 40, high_percent: 80 },
  uv: { preferred_max: 3, comfortable_max: 6, high: 10 },
  humidity: { preferred_max_percent: 60, comfortable_max_percent: 70, high_percent: 90 },
};

export const DEFAULT_WEATHER_DIRECTION_PREFERENCES: WeatherDirectionPreferences = {
  N: "neutral", NE: "neutral", E: "neutral", SE: "neutral",
  S: "neutral", SW: "neutral", W: "neutral", NW: "neutral",
};

export const DEFAULT_WEATHER_ADVISOR_PREFERENCE: WeatherAdvisorPreference = {
  wind_weight: 40,
  temperature_weight: 20,
  rain_weight: 25,
  uv_weight: 5,
  humidity_weight: 10,
  conditions: DEFAULT_WEATHER_ADVISOR_CONDITIONS,
  wind_direction_preferences: DEFAULT_WEATHER_DIRECTION_PREFERENCES,
};

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeConditions(conditions: Partial<WeatherAdvisorConditions>): WeatherAdvisorConditions {
  const result = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS };
  if (conditions.temperature) {
    result.temperature = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS.temperature, ...conditions.temperature };
  }
  if (conditions.wind) {
    result.wind = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS.wind, ...conditions.wind };
  }
  if (conditions.rain) {
    result.rain = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS.rain, ...conditions.rain };
  }
  if (conditions.uv) {
    result.uv = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS.uv, ...conditions.uv };
  }
  if (conditions.humidity) {
    result.humidity = { ...DEFAULT_WEATHER_ADVISOR_CONDITIONS.humidity, ...conditions.humidity };
  }
  return result;
}

export function normalizeDirections(directions: Partial<WeatherDirectionPreferences>): WeatherDirectionPreferences {
  const result = { ...DEFAULT_WEATHER_DIRECTION_PREFERENCES };
  for (const dir of DIRECTIONS) {
    const val = directions[dir];
    if (val && DIRECTION_VALUES.includes(val)) {
      result[dir] = val;
    }
  }
  return result;
}

export function rebalanceWeatherWeights(
  current: WeatherAdvisorPreference,
  changedKey: WeatherWeightKey,
  requestedValue: number,
): WeatherAdvisorPreference {
  const changedValue = clampWeight(requestedValue);
  const remainingTotal = 100 - changedValue;
  const otherKeys = WEATHER_WEIGHT_KEYS.filter((key) => key !== changedKey);
  const currentOthersTotal = otherKeys.reduce(
    (sum, key) => sum + clampWeight(current[key]),
    0,
  );

  const next = { ...current, [changedKey]: changedValue };
  if (remainingTotal === 0) {
    otherKeys.forEach((key) => {
      next[key] = 0;
    });
    return next;
  }

  if (currentOthersTotal === 0) {
    const base = Math.floor(remainingTotal / otherKeys.length);
    let remainder = remainingTotal - base * otherKeys.length;
    otherKeys.forEach((key) => {
      next[key] = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
    });
    return next;
  }

  const allocations = otherKeys.map((key, order) => {
    const exact = (clampWeight(current[key]) / currentOthersTotal) * remainingTotal;
    return { key, order, floor: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder =
    remainingTotal - allocations.reduce((sum, allocation) => sum + allocation.floor, 0);
  const remainderOrder = [...allocations].sort(
    (left, right) => right.fraction - left.fraction || left.order - right.order,
  );
  remainderOrder.forEach((allocation) => {
    next[allocation.key] = allocation.floor + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
  });

  return next;
}

export function weatherWeightsEqual(
  left: WeatherAdvisorPreference,
  right: WeatherAdvisorPreference,
): boolean {
  return WEATHER_WEIGHT_KEYS.every((key) => left[key] === right[key]);
}

export function weatherPreferencesEqual(
  left: WeatherAdvisorPreference,
  right: WeatherAdvisorPreference,
): boolean {
  return weatherWeightsEqual(left, right) &&
    JSON.stringify(left.conditions) === JSON.stringify(right.conditions) &&
    JSON.stringify(left.wind_direction_preferences) === JSON.stringify(right.wind_direction_preferences);
}