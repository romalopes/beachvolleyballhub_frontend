import type { TrainingTemplate } from "../../api";

export interface TrainingTemplateSelectorProps {
  templates: TrainingTemplate[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  helperText?: string;
  noTemplatesText?: string;
}

export default function TrainingTemplateSelector({
  templates,
  selectedId,
  onChange,
  disabled,
  helperText,
  noTemplatesText,
}: TrainingTemplateSelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value ? Number(event.target.value) : null;
    onChange(nextId);
  };

  if (!templates || templates.length === 0) {
    return (
      <div className="admin-field">
        <label htmlFor="training-template-selector">Training Template</label>
        <p className="field-hint">
          {noTemplatesText || "No templates available. Create one from the Training Templates page."}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-field">
      <label htmlFor="training-template-selector">Training Template</label>
      <select
        id="training-template-selector"
        value={selectedId ?? 0}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value={0}>Start from scratch</option>
        {templates.map((tpl) => (
          <option key={tpl.id} value={tpl.id}>
            {tpl.name}
          </option>
        ))}
      </select>
      {helperText && <p className="field-hint">{helperText}</p>}
    </div>
  );
}