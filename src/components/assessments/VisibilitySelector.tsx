import type { AssessmentSessionVisibility } from "../../api";

interface VisibilitySelectorProps {
  value: AssessmentSessionVisibility;
  onChange: (value: AssessmentSessionVisibility) => void;
  disabled?: boolean;
  className?: string;
}

const visibilityOptions: { value: AssessmentSessionVisibility; label: string; description: string }[] = [
  {
    value: "public",
    label: "Public",
    description: "Any registered BeachVolleyballHub user can view",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the share link can view (no login required)",
  },
  {
    value: "internal",
    label: "Internal",
    description: "Organization members, assigned coaches, and involved players",
  },
  {
    value: "private",
    label: "Private",
    description: "Only assigned coaches and BVBH administrators",
  },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: VisibilitySelectorProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Visibility
      </label>
      <div className="space-y-2">
        {visibilityOptions.map((option) => (
          <label
            key={option.value}
            className={`flex items-center p-3 rounded-lg border-2 transition-colors cursor-pointer ${
              value === option.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={value === option.value}
              onChange={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <div className="ml-3">
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </div>
          </label>
        ))}
      </div>
      {disabled && (
        <p className="mt-2 text-sm text-gray-500">
          Visibility cannot be changed for this session.
        </p>
      )}
    </div>
  );
}