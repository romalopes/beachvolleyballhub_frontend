import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

export interface CalendarToolbarOption<Value extends string> {
  value: Value;
  label: string;
  icon?: LucideIcon;
}

interface CalendarToolbarTabsProps<Value extends string> {
  options: readonly CalendarToolbarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  ariaLabel: string;
  className?: string;
}

export function CalendarToolbarTabs<Value extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: CalendarToolbarTabsProps<Value>) {
  return (
    <div
      className={["calendar-toolbar-tabs", "training-view-toggle", className]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            className={`filter-btn${value === option.value ? " active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface CalendarToolbarProps<Value extends string> {
  title: ReactNode;
  subtitle?: ReactNode;
  options: readonly CalendarToolbarOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  tabsAriaLabel: string;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** Shared period navigation and view/range controls for calendar-based pages. */
export default function CalendarToolbar<Value extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  tabsAriaLabel,
  onPrevious,
  onToday,
  onNext,
  previousLabel = "Previous period",
  nextLabel = "Next period",
  className = "",
  children,
}: CalendarToolbarProps<Value>) {
  return (
    <div
      className={["calendar-toolbar", "training-calendar-nav", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="calendar-toolbar-navigation">
        <button
          type="button"
          className="admin-btn"
          onClick={onPrevious}
          aria-label={previousLabel}
        >
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="admin-btn" onClick={onToday}>
          Today
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onNext}
          aria-label={nextLabel}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="calendar-toolbar-period">
        <h2>{title}</h2>
        {subtitle && <p className="calendar-toolbar-subtitle">{subtitle}</p>}
      </div>
      <div className="calendar-toolbar-controls">
        <CalendarToolbarTabs
          options={options}
          value={value}
          onChange={onChange}
          ariaLabel={tabsAriaLabel}
        />
        {children}
      </div>
    </div>
  );
}