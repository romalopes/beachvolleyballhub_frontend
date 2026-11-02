import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import {
  DEFAULT_WEATHER_ADVISOR_PREFERENCE,
  WEATHER_PREFERENCE_CHANGED_EVENT,
} from "../../utils/weatherAdvisorPreferences";
import WeatherAdvisorPreferences from "./WeatherAdvisorPreferences";

vi.mock("../../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../api")>();
  return {
    ...original,
    api: {
      ...original.api,
      weatherAdvisorPreference: vi.fn(),
      updateWeatherAdvisorPreference: vi.fn(),
      resetWeatherAdvisorPreference: vi.fn(),
    },
  };
});

const getPreference = vi.mocked(api.weatherAdvisorPreference);
const updatePreference = vi.mocked(api.updateWeatherAdvisorPreference);
const resetPreference = vi.mocked(api.resetWeatherAdvisorPreference);

function renderPanel(path = "/account") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WeatherAdvisorPreferences />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getPreference.mockResolvedValue(DEFAULT_WEATHER_ADVISOR_PREFERENCE);
  updatePreference.mockImplementation(async (preference) => preference);
  resetPreference.mockResolvedValue(DEFAULT_WEATHER_ADVISOR_PREFERENCE);
  Element.prototype.scrollIntoView = vi.fn();
});

describe("WeatherAdvisorPreferences", () => {
  it("loads five accessible controls and explains independent safety warnings", async () => {
    renderPanel();

    expect(await screen.findByLabelText("Wind")).toHaveValue(40);
    expect(screen.getByLabelText("Temperature")).toHaveValue(20);
    expect(screen.getByLabelText("Rain")).toHaveValue(25);
    expect(screen.getByLabelText("UV")).toHaveValue(5);
    expect(screen.getByLabelText("Humidity")).toHaveValue(10);
    expect(screen.getByText(/warnings are calculated independently/i)).toBeInTheDocument();
    expect(screen.getByText("Total:").parentElement).toHaveTextContent("100%");
  });

  it("rebalances edits, saves them, and broadcasts a refresh event", async () => {
    const listener = vi.fn();
    window.addEventListener(WEATHER_PREFERENCE_CHANGED_EVENT, listener);
    renderPanel();
    const wind = await screen.findByLabelText("Wind");

    fireEvent.change(wind, { target: { value: "33" } });
    expect(screen.getByLabelText("Temperature")).toHaveValue(22);
    expect(screen.getByLabelText("Rain")).toHaveValue(28);
    expect(screen.getByText("Total:").parentElement).toHaveTextContent("100%");

    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(updatePreference).toHaveBeenCalledWith({
      wind_weight: 33,
      temperature_weight: 22,
      rain_weight: 28,
      uv_weight: 6,
      humidity_weight: 11,
    });
    expect(await screen.findByText("Weather advisor preferences saved.")).toBeInTheDocument();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(WEATHER_PREFERENCE_CHANGED_EVENT, listener);
  });

  it("discards unsaved edits and resets the persisted override", async () => {
    renderPanel();
    const wind = await screen.findByLabelText("Wind");
    fireEvent.change(wind, { target: { value: "70" } });
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Wind")).toHaveValue(40);

    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(resetPreference).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Weather advisor preferences reset to defaults.",
    );
  });

  it("shows API errors and keeps unsaved edits", async () => {
    updatePreference.mockRejectedValue(new Error("Weights must total 100"));
    renderPanel();
    const wind = await screen.findByLabelText("Wind");
    fireEvent.change(wind, { target: { value: "35" } });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Weights must total 100");
    expect(screen.getByLabelText("Wind")).toHaveValue(35);
  });

  it("scrolls to and focuses the section for a direct hash URL", async () => {
    renderPanel("/account#weather-advisor-preferences");
    const heading = await screen.findByRole("heading", { name: "Weather Advisor preferences" });

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(heading).toHaveFocus();
  });
});