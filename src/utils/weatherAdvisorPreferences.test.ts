import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEATHER_ADVISOR_PREFERENCE,
  rebalanceWeatherWeights,
} from "./weatherAdvisorPreferences";

describe("rebalanceWeatherWeights", () => {
  it("redistributes proportionally with deterministic largest-remainder rounding", () => {
    expect(
      rebalanceWeatherWeights(DEFAULT_WEATHER_ADVISOR_PREFERENCE, "wind_weight", 33),
    ).toEqual({
      wind_weight: 33,
      temperature_weight: 22,
      rain_weight: 28,
      uv_weight: 6,
      humidity_weight: 11,
    });
  });

  it("supports zero and one hundred percent", () => {
    const allWind = rebalanceWeatherWeights(
      DEFAULT_WEATHER_ADVISOR_PREFERENCE,
      "wind_weight",
      100,
    );
    expect(allWind).toEqual({
      wind_weight: 100,
      temperature_weight: 0,
      rain_weight: 0,
      uv_weight: 0,
      humidity_weight: 0,
    });

    expect(rebalanceWeatherWeights(allWind, "wind_weight", 20)).toEqual({
      wind_weight: 20,
      temperature_weight: 20,
      rain_weight: 20,
      uv_weight: 20,
      humidity_weight: 20,
    });
  });

  it("keeps every repeated edit within range and totaling one hundred", () => {
    let weights = DEFAULT_WEATHER_ADVISOR_PREFERENCE;
    for (const value of [0, 73, 17, 100, 46, 3]) {
      weights = rebalanceWeatherWeights(weights, "rain_weight", value);
      expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBe(100);
      Object.values(weights).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(100);
        expect(Number.isInteger(weight)).toBe(true);
      });
    }
  });

  it("clamps malformed requested values", () => {
    expect(
      rebalanceWeatherWeights(DEFAULT_WEATHER_ADVISOR_PREFERENCE, "uv_weight", 140)
        .uv_weight,
    ).toBe(100);
    expect(
      rebalanceWeatherWeights(DEFAULT_WEATHER_ADVISOR_PREFERENCE, "uv_weight", -4)
        .uv_weight,
    ).toBe(0);
  });
});