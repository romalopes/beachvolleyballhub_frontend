import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WeatherWeightSlider from "./WeatherWeightSlider";

describe("WeatherWeightSlider", () => {
  it("supports keyboard editing through the paired numeric input", () => {
    const onChange = vi.fn();
    render(
      <WeatherWeightSlider id="wind" label="Wind" value={40} onChange={onChange} />,
    );

    const input = screen.getByLabelText("Wind");
    fireEvent.change(input, { target: { value: "55" } });
    expect(onChange).toHaveBeenLastCalledWith(55);
  });

  it("mounts and unmounts cleanly in Strict Mode", () => {
    const { unmount, container } = render(
      <StrictMode>
        <WeatherWeightSlider id="rain" label="Rain" value={25} onChange={vi.fn()} />
      </StrictMode>,
    );

    expect(container.querySelectorAll(".noUi-target")).toHaveLength(1);
    expect(() => unmount()).not.toThrow();
  });
});