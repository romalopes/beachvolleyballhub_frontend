import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  FileText,
  MessageSquare,
  Package,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import { api, ApiValidationError, type AnalysisPackage } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

/**
 * Admin management for analysis packages (`/settings/analysis-packages`).
 *
 * Packages are addressed everywhere by `key` (the public pricing API and
 * request submissions use the slug), so the key is immutable after creation.
 * Ordering is a typed position with up/down swaps rather than drag-and-drop:
 * the list is tiny and explicit swaps are easier to undo than a drag mistake.
 */
export default function AnalysisPackagesSettings() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<AnalysisPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = form closed, "new" = creating, key = editing that package.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    price_cents: "0",
    max_videos: "1",
    max_duration_minutes: "60",
    includes_annotated_video: false,
    includes_written_report: true,
    includes_consultation: false,
    turnaround_days: "7",
    position: "0",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [pendingDelete, setPendingDelete] = useState<AnalysisPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [reordering, setReordering] = useState(false);

  const isAdmin = Boolean(user?.roles?.includes("admin"));

  // The initial fetch touches state only from async callbacks (Subscribe.tsx
  // convention), so the effect body itself never sets state synchronously.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api
      .getAdminAnalysisPackages()
      .then(({ data }) => {
        if (!active) return;
        setPackages(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load packages.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  // Later reloads (after create/update/delete/reorder) run outside effects.
  const loadPackages = useCallback(async () => {
    try {
      const { data } = await api.getAdminAnalysisPackages();
      setPackages(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedPackages = [...packages].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.key.localeCompare(b.key),
  );

  const openCreate = () => {
    setEditing("new");
    setForm({
      key: "",
      name: "",
      description: "",
      price_cents: "0",
      max_videos: "1",
      max_duration_minutes: "60",
      includes_annotated_video: false,
      includes_written_report: true,
      includes_consultation: false,
      turnaround_days: "7",
      position: String(sortedPackages.length),
      active: true,
    });
    setFormErrors([]);
  };

  const openEdit = (pkg: AnalysisPackage) => {
    setEditing(pkg.key);
    setForm({
      key: pkg.key,
      name: pkg.name,
      description: pkg.description ?? "",
      price_cents: String(pkg.price_cents),
      max_videos: String(pkg.max_videos),
      max_duration_minutes: String(pkg.max_duration_minutes),
      includes_annotated_video: pkg.includes_annotated_video,
      includes_written_report: pkg.includes_written_report,
      includes_consultation: pkg.includes_consultation,
      turnaround_days: String(pkg.turnaround_days),
      position: String(pkg.position),
      active: pkg.active ?? true,
    });
    setFormErrors([]);
  };

  const closeForm = () => {
    setEditing(null);
    setFormErrors([]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEdit = editing !== "new" && editing !== null;
    const original = isEdit ? packages.find((p) => p.key === editing) : null;

    // Client-side validation first: key shape + uniqueness + numeric bounds,
    // so obviously invalid input never makes a round trip.
    const errors: string[] = [];
    const key = form.key.trim();
    if (!key) errors.push("Key is required.");
    else if (!/^[a-z0-9_]+$/.test(key))
      errors.push("Key must use lowercase letters, numbers and underscores only.");
    else if (!original && packages.some((p) => p.key.toLowerCase() === key.toLowerCase()))
      errors.push(`A package with key "${key}" already exists.`);
    if (!form.name.trim()) errors.push("Name is required.");
    if (!form.description.trim()) errors.push("Description is required.");
    if (!Number.isInteger(Number(form.price_cents)) || Number(form.price_cents) < 0)
      errors.push("Price must be a whole number of cents (0 or more).");
    if (!Number.isInteger(Number(form.max_videos)) || Number(form.max_videos) < 1)
      errors.push("Max videos must be 1 or more.");
    if (!Number.isInteger(Number(form.max_duration_minutes)) || Number(form.max_duration_minutes) < 1)
      errors.push("Max duration must be at least 1 minute.");
    if (!Number.isInteger(Number(form.turnaround_days)) || Number(form.turnaround_days) < 1)
      errors.push("Turnaround must be at least 1 day.");
    if (!Number.isInteger(Number(form.position)) || Number(form.position) < 0)
      errors.push("Display order must be 0 or more.");
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        key,
        name: form.name.trim(),
        description: form.description.trim(),
        price_cents: Number(form.price_cents),
        max_videos: Number(form.max_videos),
        max_duration_minutes: Number(form.max_duration_minutes),
        includes_annotated_video: form.includes_annotated_video,
        includes_written_report: form.includes_written_report,
        includes_consultation: form.includes_consultation,
        turnaround_days: Number(form.turnaround_days),
        position: Number(form.position),
        active: form.active,
      };
      if (original?.id != null) {
        await api.updateAnalysisPackage(original.id, payload);
      } else {
        await api.createAnalysisPackage(payload);
      }
      closeForm();
      await loadPackages();
    } catch (err: unknown) {
      setFormErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : "Failed to save the package."],
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete?.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAnalysisPackage(pendingDelete.id);
      setPendingDelete(null);
      if (editing === pendingDelete.key) closeForm();
      await loadPackages();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete the package.");
    } finally {
      setDeleting(false);
    }
  };

  /** Swaps the package with its neighbour and persists both new positions. */
  const movePackage = async (pkg: AnalysisPackage, direction: "up" | "down") => {
    const index = sortedPackages.findIndex((p) => p.key === pkg.key);
    const neighbour = sortedPackages[direction === "up" ? index - 1 : index + 1];
    if (!neighbour || neighbour.id == null || pkg.id == null) return;

    setReordering(true);
    try {
      await Promise.all([
        api.updateAnalysisPackage(pkg.id, { position: neighbour.position }),
        api.updateAnalysisPackage(neighbour.id, { position: pkg.position }),
      ]);
      await loadPackages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reorder the packages.");
    } finally {
      setReordering(false);
    }
  };

  const priceLabel = (cents: number) => (cents === 0 ? "Complimentary" : `$${(cents / 100).toFixed(2)} AUD`);

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const formOpen = editing !== null;

  return (
    <SettingsLayout
      title="Analysis Packages"
      description="Manage the packages offered on the Hire Analysis page. Price and scope changes here apply to every new request immediately."
      backTo="/settings"
      backLabel="Back to Settings"
      hero={{
        eyebrow: "Data management",
        highlights: [
          { icon: Package, label: "Pricing and scope" },
          { icon: ArrowUpDown, label: "Ordered display" },
          { icon: EyeOff, label: "Hide without deleting" },
        ],
        highlightsLabel: "Analysis package management features",
        theme: "library-hero--settings",
      }}
      actions={
        formOpen ? undefined : (
          <button
            type="button"
            className="admin-btn admin-btn-add settings-add-btn"
            onClick={openCreate}
          >
            + New Package
          </button>
        )
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {formOpen && (
        <form className="admin-form analysis-packages-form" onSubmit={handleSubmit} noValidate>
          {formErrors.length > 0 && (
            <div className="auth-flash auth-flash-error" role="alert">
              <ul>
                {formErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="analysis-packages-grid">
            <div className="admin-field">
              <label htmlFor="package-key">Key *</label>
              <input
                id="package-key"
                type="text"
                value={form.key}
                onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                placeholder="single_match"
                disabled={saving || editing !== "new"}
                maxLength={64}
              />
              <small className="admin-field-hint">
                Lowercase letters, numbers and underscores. The slug never changes after creation.
              </small>
            </div>
            <div className="admin-field">
              <label htmlFor="package-name">Name *</label>
              <input
                id="package-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Single Match Analysis"
                disabled={saving}
                maxLength={120}
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="package-description">Description *</label>
            <textarea
              id="package-description"
              rows={2}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="One match with written feedback"
              disabled={saving}
            />
          </div>

          <div className="analysis-packages-grid">
            <div className="admin-field">
              <label htmlFor="package-price">Price (cents) *</label>
              <input
                id="package-price"
                type="number"
                min={0}
                step={1}
                value={form.price_cents}
                onChange={(event) => setForm((prev) => ({ ...prev, price_cents: event.target.value }))}
                disabled={saving}
              />
              <small className="admin-field-hint">Shown as {priceLabel(Number(form.price_cents) || 0)}. 0 = complimentary.</small>
            </div>
            <div className="admin-field">
              <label htmlFor="package-position">Display order</label>
              <input
                id="package-position"
                type="number"
                min={0}
                step={1}
                value={form.position}
                onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                disabled={saving}
              />
              <small className="admin-field-hint">Lower numbers appear first.</small>
            </div>
          </div>

          <div className="analysis-packages-grid analysis-packages-grid--three">
            <div className="admin-field">
              <label htmlFor="package-max-videos">Max videos *</label>
              <input
                id="package-max-videos"
                type="number"
                min={1}
                step={1}
                value={form.max_videos}
                onChange={(event) => setForm((prev) => ({ ...prev, max_videos: event.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="package-max-duration">Max footage (minutes) *</label>
              <input
                id="package-max-duration"
                type="number"
                min={1}
                step={1}
                value={form.max_duration_minutes}
                onChange={(event) => setForm((prev) => ({ ...prev, max_duration_minutes: event.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="package-turnaround">Turnaround (days) *</label>
              <input
                id="package-turnaround"
                type="number"
                min={1}
                step={1}
                value={form.turnaround_days}
                onChange={(event) => setForm((prev) => ({ ...prev, turnaround_days: event.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <fieldset className="analysis-packages-includes">
            <legend>What the package includes</legend>
            <label className="analysis-packages-check">
              <input
                type="checkbox"
                checked={form.includes_annotated_video}
                onChange={(event) => setForm((prev) => ({ ...prev, includes_annotated_video: event.target.checked }))}
                disabled={saving}
              />
              <Video size={14} aria-hidden="true" />
              <span>Annotated video</span>
            </label>
            <label className="analysis-packages-check">
              <input
                type="checkbox"
                checked={form.includes_written_report}
                onChange={(event) => setForm((prev) => ({ ...prev, includes_written_report: event.target.checked }))}
                disabled={saving}
              />
              <FileText size={14} aria-hidden="true" />
              <span>Written report</span>
            </label>
            <label className="analysis-packages-check">
              <input
                type="checkbox"
                checked={form.includes_consultation}
                onChange={(event) => setForm((prev) => ({ ...prev, includes_consultation: event.target.checked }))}
                disabled={saving}
              />
              <MessageSquare size={14} aria-hidden="true" />
              <span>Consultation call</span>
            </label>
          </fieldset>

          <div className="admin-field analysis-packages-active">
            <label className="analysis-packages-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                disabled={saving}
              />
              <span>Active — visible on the Hire Analysis page</span>
            </label>
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
              {saving ? "Saving..." : editing === "new" ? "Create Package" : "Save Changes"}
            </button>
            <button type="button" className="admin-btn" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {pendingDelete && (
        <DeleteConfirm
          entityName={pendingDelete.name}
          warning="Existing requests keep their package price. This action cannot be undone."
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : sortedPackages.length === 0 ? (
        <EmptyState
          title="No analysis packages"
          description="Create the first package so the Hire Analysis page has something to offer."
          action={
            <button type="button" className="admin-btn admin-btn-add" onClick={openCreate}>
              + New Package
            </button>
          }
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="analysis-packages-order-col">Order</th>
                <th>Package</th>
                <th>Price</th>
                <th>Includes</th>
                <th>Limits</th>
                <th>Status</th>
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPackages.map((pkg, index) => (
                <tr key={pkg.key} className={editing === pkg.key ? "analysis-packages-row-editing" : undefined}>
                  <td className="analysis-packages-order-col">
                    <div className="analysis-packages-order">
                      <button
                        type="button"
                        className="analysis-packages-order-btn"
                        onClick={() => movePackage(pkg, "up")}
                        disabled={reordering || index === 0}
                        aria-label={`Move ${pkg.name} up`}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="analysis-packages-order-btn"
                        onClick={() => movePackage(pkg, "down")}
                        disabled={reordering || index === sortedPackages.length - 1}
                        aria-label={`Move ${pkg.name} down`}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <span>{pkg.position}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-table-name">{pkg.name}</div>
                    <code className="analysis-packages-key">{pkg.key}</code>
                    {pkg.description && <p className="analysis-packages-desc">{pkg.description}</p>}
                  </td>
                  <td>{priceLabel(pkg.price_cents)}</td>
                  <td>
                    <div className="analysis-packages-includes-badges">
                      <span
                        className={`analysis-packages-include ${pkg.includes_annotated_video ? "on" : "off"}`}
                        title={pkg.includes_annotated_video ? "Includes annotated video" : "No annotated video"}
                      >
                        <Video size={13} aria-hidden="true" />
                      </span>
                      <span
                        className={`analysis-packages-include ${pkg.includes_written_report ? "on" : "off"}`}
                        title={pkg.includes_written_report ? "Includes written report" : "No written report"}
                      >
                        <FileText size={13} aria-hidden="true" />
                      </span>
                      <span
                        className={`analysis-packages-include ${pkg.includes_consultation ? "on" : "off"}`}
                        title={pkg.includes_consultation ? "Includes consultation call" : "No consultation call"}
                      >
                        <MessageSquare size={13} aria-hidden="true" />
                      </span>
                    </div>
                  </td>
                  <td className="analysis-packages-limits">
                    {pkg.max_videos} video{pkg.max_videos === 1 ? "" : "s"} · {pkg.max_duration_minutes} min ·{" "}
                    {pkg.turnaround_days}d
                  </td>
                  <td>
                    <span className={`admin-table-status ${pkg.active ? "" : "analysis-packages-status-off"}`}>
                      {pkg.active ? (
                        <>
                          <Eye size={12} aria-hidden="true" /> Active
                        </>
                      ) : (
                        <>
                          <EyeOff size={12} aria-hidden="true" /> Hidden
                        </>
                      )}
                    </span>
                  </td>
                  <td className="admin-table-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => openEdit(pkg)}
                      disabled={formOpen}
                      aria-label={`Edit ${pkg.name}`}
                    >
                      <Pencil size={13} aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() => setPendingDelete(pkg)}
                      disabled={formOpen}
                      aria-label={`Delete ${pkg.name}`}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsLayout>
  );
}