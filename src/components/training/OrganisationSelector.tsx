import { useState } from "react";
import type { Organisation } from "../../api";

export interface OrganisationSelectorProps {
  organisations: Organisation[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  noOrganisationsText?: string;
}

export default function OrganisationSelector({
  organisations,
  selectedId,
  onChange,
  required = false,
  disabled,
  helperText,
  noOrganisationsText,
}: OrganisationSelectorProps) {
  const [isRequiredError, setIsRequiredError] = useState(false);

  const handleBlur = () => {
    setIsRequiredError(required && !selectedId);
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value ? Number(event.target.value) : null;
    onChange(nextId);
    setIsRequiredError(false);
  };

  if (!organisations || organisations.length === 0) {
    return (
      <div className="admin-field">
        <label htmlFor="organisation-selector">
          Organisation {required ? <span className="required-indicator" aria-hidden="true">*</span> : ""}
        </label>
        <p className="field-hint" style={{ color: "var(--danger)" }}>
          {noOrganisationsText || "You don't have access to any organisations. Contact an administrator to be added to one."}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-field">
      <label htmlFor="organisation-selector">
        Organisation {required ? <span className="required-indicator" aria-hidden="true">*</span> : ""}
      </label>
      <select
        id="organisation-selector"
        value={selectedId ?? ""}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
      >
        <option value="">Select an organisation…</option>
        {organisations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} ({org.acronym || org.slug})
          </option>
        ))}
      </select>
      {(isRequiredError || required && !selectedId) && (
        <p className="field-hint" style={{ color: "var(--danger)" }}>
          Organisation is required.
        </p>
      )}
      {helperText && !isRequiredError && (
        <p className="field-hint">{helperText}</p>
      )}
    </div>
  );
}