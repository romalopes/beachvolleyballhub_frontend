import type { WeatherAdvisorPreference } from "../api";

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

export const DEFAULT_WEATHER_ADVISOR_PREFERENCE: WeatherAdvisorPreference = {
  wind_weight: 40,
  temperature_weight: 20,
  rain_weight: 25,
  uv_weight: 5,
  humidity_weight: 10,
};

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
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