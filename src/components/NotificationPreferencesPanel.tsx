import { useEffect, useState } from "react";
import { api, type NotificationEmailCadence, type NotificationPreference } from "../api";

// Event types the user can mute individually. Kept as an explicit list so the
// labels stay human-readable; a type missing here is still delivered in-app and
// simply has no switch yet.
const MUTABLE_EVENT_TYPES: { value: string; label: string }[] = [
  { value: "training.invited", label: "Training invitations" },
  { value: "training.rescheduled", label: "Training reschedules" },
  { value: "training.cancelled", label: "Training cancellations" },
  { value: "membership.requested", label: "Membership requests" },
  { value: "membership.approved", label: "Membership approvals" },
  { value: "membership.rejected", label: "Membership rejections" },
];

const CADENCE_OPTIONS: { value: NotificationEmailCadence; label: string }[] = [
  { value: "immediate", label: "Immediately" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
  { value: "none", label: "No email" },
];

/**
 * Account-level notification preferences (IDENTITY-249 phase 7).
 *
 * Loads from and saves to `/api/v1/notification_preferences`. Each control saves
 * on change; a successful save shows a short confirmation, and a failure is
 * surfaced without losing the current form state.
 */
export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .notificationPreferences()
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load preferences.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (patch: Partial<NotificationPreference>) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api.updateNotificationPreferences(patch);
      setPrefs(data);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const toggleMute = (eventType: string, muted: boolean) => {
    if (!prefs) return;
    const next = muted
      ? [...prefs.muted_event_types, eventType]
      : prefs.muted_event_types.filter((value) => value !== eventType);
    void save({ muted_event_types: next });
  };

  if (!prefs && !error) return <p>Loading notification preferences…</p>;

  return (
    <section className="notification-preferences">
      <h2>Notifications</h2>
      {error && (
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="auth-flash auth-flash-notice" role="status">
          Preferences saved.
        </div>
      )}
      {prefs && (
        <>
          <label className="notification-preference-row">
            <input
              type="checkbox"
              checked={prefs.in_app_enabled}
              disabled={saving}
              onChange={(event) => void save({ in_app_enabled: event.target.checked })}
            />
            <span>Show notifications in the app</span>
          </label>

          <label className="notification-preference-row">
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              disabled={saving}
              onChange={(event) => void save({ email_enabled: event.target.checked })}
            />
            <span>Also email me about important updates</span>
          </label>

          <label className="notification-preference-row">
            <span>Email frequency</span>
            <select
              value={prefs.email_cadence}
              disabled={saving || !prefs.email_enabled}
              onChange={(event) =>
                void save({ email_cadence: event.target.value as NotificationEmailCadence })
              }
            >
              {CADENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="notification-preference-mutes" disabled={saving}>
            <legend>Mute specific updates</legend>
            {MUTABLE_EVENT_TYPES.map((type) => (
              <label key={type.value} className="notification-preference-row">
                <input
                  type="checkbox"
                  checked={prefs.muted_event_types.includes(type.value)}
                  disabled={saving}
                  onChange={(event) => toggleMute(type.value, event.target.checked)}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
    </section>
  );
}
