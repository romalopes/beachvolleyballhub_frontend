import { useState } from "react";
import { api, type Discipline } from "../../../../api";

interface DisciplineFormProps {
  initial?: Discipline | null;
  onSuccess: (discipline: Discipline) => void;
  onCancel: () => void;
}

/**
 * Create/edit form for one discipline.
 *
 * The fields are seeded once from `initial` (the page renders the form only
 * after the record is loaded, and keys it by id), so there is no
 * state-syncing effect to re-run on every prop change.
 */
export default function DisciplineForm({ initial, onSuccess, onCancel }: DisciplineFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateDiscipline(initial.id, { name: name.trim() })
        : await api.adminCreateDiscipline({ name: name.trim() });
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save discipline.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <div className="admin-field">
        <label htmlFor="discipline-name">Name *</label>
        <input id="discipline-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Serving" maxLength={255} />
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update Discipline" : "Create Discipline"}
        </button>
      </div>
    </form>
  );
}
