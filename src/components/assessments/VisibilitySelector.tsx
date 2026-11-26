import type { AssessmentSessionVisibility } from "../../api";
import { Globe, Link, Users, Lock } from "lucide-react";

interface VisibilitySelectorProps {
  value: AssessmentSessionVisibility;
  onChange: (value: AssessmentSessionVisibility) => void;
  disabled?: boolean;
  className?: string;
}

interface VisibilityOption {
  value: AssessmentSessionVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const visibilityOptions: VisibilityOption[] = [
  {
    value: "public",
    label: "Public",
    description: "Any registered BeachVolleyballHub user can view",
    icon: <Globe className="w-5 h-5" />,
    color: "var(--green-700)",
    bgColor: "var(--green-100)",
    borderColor: "var(--green-500)"
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the share link can view (no login required)",
    icon: <Link className="w-5 h-5" />,
    color: "var(--amber-700)",
    bgColor: "var(--amber-100)",
    borderColor: "var(--amber-500)"
  },
  {
    value: "internal",
    label: "Internal",
    description: "Organization members, assigned coaches, and involved players",
    icon: <Users className="w-5 h-5" />,
    color: "var(--blue-700)",
    bgColor: "var(--blue-100)",
    borderColor: "var(--blue-500)"
  },
  {
    value: "private",
    label: "Private",
    description: "Only assigned coaches and BVBH administrators",
    icon: <Lock className="w-5 h-5" />,
    color: "var(--red-700)",
    bgColor: "var(--red-100)",
    borderColor: "var(--red-500)"
  },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: VisibilitySelectorProps) {
  return (
    <div className={"visibility-selector " + className}>
      <label className="visibility-selector__label">
        Visibility <span className="required" aria-hidden="true">*</span>
      </label>
      <div className="visibility-selector__options" role="radiogroup" aria-label="Session visibility">
        {visibilityOptions.map((option) => (
          <label
            key={option.value}
            className={"visibility-selector__option " + (value === option.value ? " visibility-selector__option--selected" : "") + (disabled ? " visibility-selector__option--disabled" : "")}
            style={{
              "--option-color": option.color,
              "--option-bg": option.bgColor,
              "--option-border": option.borderColor,
            } as React.CSSProperties}
          >
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={value === option.value}
              onChange={() => disabled ? undefined : onChange(option.value)}
              disabled={disabled}
              className="visibility-selector__input"
              aria-label={option.label}
            />
            <span
              className="visibility-selector__icon"
              style={{ color: option.color }}
              aria-hidden="true"
            >
              {option.icon}
            </span>
            <div className="visibility-selector__content">
              <div className="visibility-selector__title" style={{ color: option.color }}>
                {option.label}
              </div>
              <div className="visibility-selector__description">{option.description}</div>
            </div>
          </label>
        ))}
      </div>
      {disabled && (
        <p className="visibility-selector__disabled-notice">
          Visibility cannot be changed for this session.
        </p>
      )}
    </div>
  );
}
