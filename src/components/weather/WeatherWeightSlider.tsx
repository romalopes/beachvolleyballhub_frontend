import { useEffect, useRef } from "react";
import noUiSlider, { type API } from "nouislider";
import "nouislider/dist/nouislider.css";

interface WeatherWeightSliderProps {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export default function WeatherWeightSlider({
  id,
  label,
  value,
  disabled = false,
  onChange,
}: WeatherWeightSliderProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<API | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!elementRef.current) return;
    const slider = noUiSlider.create(elementRef.current, {
      start: initialValueRef.current,
      step: 1,
      range: { min: 0, max: 100 },
      connect: [true, false],
      keyboardSupport: true,
      handleAttributes: [{ "aria-label": `${label} weight` }],
    });
    slider.on("change", (_values, _handle, unencoded) => {
      onChangeRef.current(Math.round(unencoded[0]));
    });
    sliderRef.current = slider;
    return () => {
      slider.destroy();
      sliderRef.current = null;
    };
  }, [id, label]);

  useEffect(() => {
    sliderRef.current?.set(value, false);
  }, [value]);

  useEffect(() => {
    if (!sliderRef.current) return;
    if (disabled) sliderRef.current.disable();
    else sliderRef.current.enable();
  }, [disabled]);

  return (
    <div className="weather-weight-control">
      <div className="weather-weight-label-row">
        <label htmlFor={`${id}-input`}>{label}</label>
        <span aria-hidden="true">{value}%</span>
      </div>
      <div className="weather-weight-inputs">
        <div ref={elementRef} className="weather-weight-slider" />
        <div className="weather-weight-number">
          <input
            id={`${id}-input`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={disabled}
            aria-describedby={`${id}-suffix`}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span id={`${id}-suffix`}>%</span>
        </div>
      </div>
    </div>
  );
}