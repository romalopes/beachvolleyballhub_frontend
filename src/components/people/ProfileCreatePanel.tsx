import { useState } from "react";
import { api, ApiValidationError } from "../../api";
import ProfileDetailsForm, {
  type ProfileFormValues,
  type ProfileKind,
} from "./ProfileDetailsForm";

interface ProfileCreatePanelProps {
  kind: ProfileKind;
  onCreated: (createdName: string) => void;
  onClose: () => void;
}

/**
 * Attach the just-created profile to the chosen organisation and/or group.
 * Both are optional; a chosen organisation adds an organisation membership
 * keyed on the profile itself (accountless profiles are members in their own
 * right), and a chosen group adds a group membership the same way. Errors are
 * gathered, never thrown, so the created profile always stands.
 */
async function attachMembership(
  kind: ProfileKind,
  profileId: number,
  values: ProfileFormValues,
): Promise<string[]> {
  const memberableType = kind === "player" ? "PlayerProfile" : "CoachProfile";
  const problems: string[] = [];

  if (values.organisation_id) {
    try {
      await api.addOrganisationMember(
        values.organisation_id,
        { memberable_type: memberableType, memberable_id: profileId },
        { role: "member", status: "active" },
      );
    } catch (err: unknown) {
      problems.push(err instanceof Error ? err.message : "Failed to add the profile to the organisation.");
    }
  }

  if (values.group_id) {
    try {
      await api.addGroupMember(values.group_id, { memberableType, memberableId: profileId });
    } catch (err: unknown) {
      problems.push(err instanceof Error ? err.message : "Failed to add the profile to the group.");
    }
  }

  return problems;
}

/** Records profile details without creating or editing a Person or Account. */
export default function ProfileCreatePanel({
  kind,
  onCreated,
  onClose,
}: ProfileCreatePanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const handleSubmit = async (values: ProfileFormValues) => {
    setErrors([]);
    setSubmitting(true);
    try {
      const result = kind === "player"
        ? await api.createPlayer({ player_profile: values.profile })
        : await api.createCoach({ coach_profile: values.profile });
      const name = result.full_name?.trim() ||
        ("display_name" in result ? result.display_name?.trim() : null) ||
        `New ${kind}`;

      // Optional membership. The profile is already saved, so a failed membership
      // write must never undo it: collect the errors and surface them alongside the
      // confirmation rather than throwing.
      const membershipErrors = await attachMembership(kind, result.id, values);
      setErrors(membershipErrors);
      setCreatedName(name);
      onCreated(name);
    } catch (err: unknown) {
      setErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : `Failed to save the ${kind} profile.`],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdName) {
    return (
      <section className="admin-form person-create-panel" aria-label={`Record a ${kind}`}>
        <h3>{createdName} is now a {kind} profile</h3>
        <p className="related-item-meta">Profile created. An account can be linked later through an invitation and claim.</p>
        {errors.length > 0 && (
          <div className="admin-error">
            <p>The profile was saved, but membership could not be applied:</p>
            <ul>{errors.map((error, index) => <li key={`${index}:${error}`}>{error}</li>)}</ul>
          </div>
        )}
        <div className="admin-form-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={onClose}>Done</button>
        </div>
      </section>
    );
  }

  return (
    <section className="person-create-panel">
      <ProfileDetailsForm
        kind={kind}
        submitting={submitting}
        showMembership
        errors={errors}
        submitLabel={`Add ${kind}`}
        onSubmit={handleSubmit}
        onCancel={onClose}
      >
        <h3>Record a {kind} profile</h3>
      </ProfileDetailsForm>
    </section>
  );
}
