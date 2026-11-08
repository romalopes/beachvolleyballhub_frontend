import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { Discipline, Skill } from "../../api";
import {
  createCustomFocus,
  createSkillFocus,
  moveFocus,
  type FocusDraft,
} from "./focusDraft";

interface SkillFocusSelectorProps {
  disciplines: Discipline[];
  skills: Skill[];
  focuses: FocusDraft[];
  onChange: (focuses: FocusDraft[]) => void;
}

type FocusType = "skill" | "custom";

export default function SkillFocusSelector({
  disciplines,
  skills,
  focuses,
  onChange,
}: SkillFocusSelectorProps) {
  const [focusType, setFocusType] = useState<FocusType>("skill");
  const [disciplineId, setDisciplineId] = useState<string>("");

  const [skillId, setSkillId] = useState<string>("");
  const [customText, setCustomText] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The Discipline select has no placeholder option, so the browser always shows
  // a value. Default to the first discipline to keep what is displayed in sync
  // with the skill list below it (otherwise the UI would show "Defense" while
  // listing skills from every discipline).
  const effectiveDisciplineId =
    disciplineId || (disciplines[0] ? String(disciplines[0].id) : "");

  const disciplineSkills = useMemo(
    () =>
      skills.filter((s) =>
        effectiveDisciplineId
          ? s.discipline_id === Number(effectiveDisciplineId)
          : true,
      ),
    [skills, effectiveDisciplineId],
  );

  const skillName = (id: number | null | undefined) =>
    skills.find((s) => s.id === id)?.title ?? "Unknown skill";

  const handleAdd = () => {
    setError(null);
    if (focusType === "skill") {
      if (!skillId) {
        setError("Choose a discipline and skill.");
        return;
      }
      const id = Number(skillId);
      if (focuses.some((focus) => focus.skill_id === id)) {
        setError("This skill is already a focus of this training.");
        return;
      }
      onChange([...focuses, createSkillFocus(id, description.trim())]);
      setSkillId("");
      setDescription("");
      return;
    }
    if (!customText.trim()) {
      setError("Describe the custom focus.");
      return;
    }
    onChange([
      ...focuses,
      createCustomFocus(customText.trim(), description.trim()),
    ]);
    setCustomText("");
    setDescription("");
  };

  return (
    <div
      className="training-editor-section"
      role="group"
      aria-label="Training Focuses"
    >
      <h3>Training Focuses</h3>
      {focuses.length === 0 ? (
        <p className="related-item-meta">
          No focuses yet. Add an existing skill or a custom focus.
        </p>
      ) : (
        <ol className="training-focus-list">
          {focuses.map((focus, index) => (
            <li key={focus.key} className="training-focus-item">
              <span className="training-focus-title">
                {index + 1}.{" "}
                {focus.skill_id
                  ? skillName(focus.skill_id)
                  : focus.custom_focus}
              </span>
              {!focus.skill_id && (
                <span className="related-item-meta"> · Custom focus</span>
              )}
              {focus.description && <p>{focus.description}</p>}
              <div className="training-editor-row-actions">
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move focus ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => onChange(moveFocus(focuses, index, -1))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move focus ${index + 1} down`}
                  disabled={index === focuses.length - 1}
                  onClick={() => onChange(moveFocus(focuses, index, 1))}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  aria-label={`Remove focus ${index + 1}`}
                  onClick={() =>
                    onChange(focuses.filter((item) => item.key !== focus.key))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="training-focus-form">
        <h4>Add Focus</h4>
        <div
          className="training-focus-type"
          role="radiogroup"
          aria-label="Focus type"
        >
          <label>
            <input
              type="radio"
              name="focus-type"
              checked={focusType === "skill"}
              onChange={() => setFocusType("skill")}
            />
            Existing Skill
          </label>
          <label>
            <input
              type="radio"
              name="focus-type"
              checked={focusType === "custom"}
              onChange={() => setFocusType("custom")}
            />
            Custom Focus
          </label>
        </div>

        {focusType === "skill" ? (
          <>
            <label>
              Discipline
              <select
                value={effectiveDisciplineId}
                onChange={(event) => {
                  setDisciplineId(event.target.value);
                  // The previously chosen skill may belong to another discipline;
                  // clear it so a stale selection can never be submitted.
                  setSkillId("");
                }}
              >
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Skill
              <select
                value={skillId}
                onChange={(event) => setSkillId(event.target.value)}
              >
                <option value="">Select a skill</option>
                {disciplineSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label>
            Custom focus
            <input
              type="text"
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              placeholder="e.g. Transition communication"
            />
          </label>
        )}

        <label>
          Focus description (optional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should this training focus on?"
            rows={2}
          />
        </label>

        {error && <div className="admin-error">{error}</div>}

        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={handleAdd}
        >
          Add focus
        </button>
      </div>
    </div>
  );
}
