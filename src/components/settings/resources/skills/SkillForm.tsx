import { useEffect, useState } from "react";
import { api, type Discipline, type Skill } from "../../../../api";

interface SkillFormProps {
  initial?: Skill | null;
  onSuccess: (skill: Skill) => void;
  onCancel: () => void;
}

export default function SkillForm({ initial, onSuccess, onCancel }: SkillFormProps) {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  // Seeded once from `initial`: the page renders the form only after the skill
  // is loaded, and keys it by id, so no state-syncing effect is needed.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [disciplineId, setDisciplineId] = useState<string>(
    initial ? String(initial.discipline_id) : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.disciplines().then(setDisciplines).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (disciplineId === "") { setError("Discipline is required."); return; }
    const payload = {
      title: title.trim(),
      discipline_id: Number(disciplineId),
      description: description.trim() || null,
    };
    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateSkill(initial.id, payload)
        : await api.adminCreateSkill(payload);
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <div className="admin-field">
        <label htmlFor="skill-title">Title *</label>
        <input id="skill-title" type="text" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Forearm Pass" maxLength={255} />
      </div>
      <div className="admin-field">
        <label htmlFor="skill-discipline">Discipline *</label>
        <select id="skill-discipline" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
          <option value="">Select a discipline</option>
          {disciplines.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor="skill-description">Description</label>
        <textarea id="skill-description" value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this skill..." rows={4} />
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update Skill" : "Create Skill"}
        </button>
      </div>
    </form>
  );
}
