import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import { AlertCircle, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import {
  api,
  type Group as GroupRecord,
  type GroupDetail,
  type GroupInput,
  type GroupMember,
  type GroupVisibility,
  type Organisation,
  type OrganisationMemberCandidate,
  type OrganisationMembership,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

/** Owner / Coach / Member, as the roster screen spells it. */
const memberRoleLabel = (role: GroupMember["role"]) =>
  role.charAt(0).toUpperCase() + role.slice(1);

/**
 * Does a roster row and a search candidate name the same subject? Rows prefer
 * the polymorphic memberable; account-only rows fall back to `account_id`.
 */
const sameSubject = (
  member: GroupMember,
  candidate: OrganisationMemberCandidate,
): boolean => {
  if (member.memberable_type && member.memberable_id != null) {
    return (
      member.memberable_type === candidate.memberable_type &&
      member.memberable_id === candidate.memberable_id
    );
  }
  return (
    candidate.memberable_type === "Account" &&
    member.account_id != null &&
    member.account_id === candidate.account_id
  );
};

/**
 * Every subject key under which an organisation membership row can match: the
 * polymorphic memberable plus, when the row is account-backed, the account
 * itself (a claimed player may sit on the roster via either subject).
 */
const membershipSubjectKeys = (membership: OrganisationMembership): string[] => {
  const keys: string[] = [];
  if (membership.memberable_type && membership.memberable_id != null) {
    keys.push(`${membership.memberable_type}:${membership.memberable_id}`);
  }
  if (membership.account_id != null) {
    keys.push(`Account:${membership.account_id}`);
  }
  return keys.length > 0 ? keys : [`Membership:${membership.id}`];
};

/** The same key set for a search candidate. */
const candidateSubjectKeys = (
  candidate: OrganisationMemberCandidate,
): string[] => {
  const keys = [`${candidate.memberable_type}:${candidate.memberable_id}`];
  if (candidate.account_id != null) {
    keys.push(`Account:${candidate.account_id}`);
  }
  return keys;
};

const sharesSubjectWith = (
  keys: Set<string>,
  candidate: OrganisationMemberCandidate,
): boolean =>
  candidateSubjectKeys(candidate).some((key) => keys.has(key));

/** The organisation's active roster as one flat set of subject keys. */
const activeRosterSubjectKeys = (
  memberships: OrganisationMembership[],
): Set<string> => {
  const keys = new Set<string>();
  memberships
    .filter((membership) => membership.status === "active")
    .forEach((membership) => {
      membershipSubjectKeys(membership).forEach((key) => keys.add(key));
    });
  return keys;
};

/**
 * Groups are reusable rosters ("U19 squad"). A group exists purely so a coach
 * picking participants for a session does not re-search the same twenty people;
 * membership confers no access and no attendance. That is why this screen is a
 * plain CRUD list with no per-member status and no scoring, and why a group that
 * has already run sessions is archived rather than deleted.
 */
export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Which query the rows on screen belong to. `loading` is derived from it
  // rather than synced by an effect, so flipping the archived toggle does not
  // cost an extra render pass (the AdminUsers.tsx pattern).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const queryKey = showArchived ? "all" : "active";
  const loading = loadedKey !== queryKey;

  // The editor holds either a brand new group or an existing one.
  const [editing, setEditing] = useState<GroupDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<GroupInput>({
    name: "",
    description: "",
    visibility: "shared",
    organisation_id: null,
  });
  // A roster subject is polymorphic (Account vs PlayerProfile/CoachProfile), so
  // plain numeric ids collide across tables. A `Type:id` key keeps every
  // checkbox independent, including accountless profiles.
  const subjectKey = (
    type: string | null | undefined,
    id: number | null | undefined,
  ) => `${type ?? "Unknown"}:${id ?? "?"}`;

  // Stable key for one organisation roster row. Prefers the polymorphic
  // subject; falls back to account, membership id, then position so legacy or
  // sparse rows still get a unique key.
  const orgMemberKey = (member: OrganisationMembership, index: number) => {
    const subject = subjectKey(member.memberable_type ?? member.member_type, member.memberable_id ?? member.member_id);
    if (!subject.startsWith("Unknown") && !subject.endsWith(":?")) return subject;
    if (member.account_id != null) return subjectKey("Account", member.account_id);
    return `Membership:${member.id}:${index}`;
  };

  // Stable key for one existing group roster row, same scheme as the org rows
  // so edit mode can pre-tick from the loaded group.
  const groupMemberKey = (member: GroupDetail["members"][number], index: number) => {
    const subject = subjectKey(member.memberable_type, member.memberable_id);
    if (!subject.startsWith("Unknown") && !subject.endsWith(":?")) return subject;
    if (member.account_id != null) return subjectKey("Account", member.account_id);
    return `GroupMember:${member.id}:${index}`;
  };
  const [myOrganisations, setMyOrganisations] = useState<Organisation[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganisationMembership[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingOrgMembers, setLoadingOrgMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // The add-member modal: which group it targets, its loaded roster, the
  // candidate search and the chosen role for the next add.
  const [memberTarget, setMemberTarget] = useState<GroupRecord | null>(null);
  const [memberRoster, setMemberRoster] = useState<GroupDetail | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberCandidates, setMemberCandidates] = useState<
    OrganisationMemberCandidate[]
  >([]);
  const [memberSelected, setMemberSelected] =
    useState<OrganisationMemberCandidate | null>(null);
  const [memberRole, setMemberRole] = useState<GroupMember["role"]>("member");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  // Subject keys of the organisation's active roster, fetched with the group
  // when the modal opens. The search stays disabled until this lands, so
  // candidates can never be offered outside the group's organisation — the
  // global candidate endpoint searches everybody, the intersection narrows it.
  const [orgSubjectKeys, setOrgSubjectKeys] = useState<Set<string> | null>(null);

  const load = useCallback(() => {
    return api
      .groups({ status: showArchived ? "all" : "active", include_private: true })
      .then((res) => {
        setGroups(res.data);
        setError(null);
        setLoadedKey(queryKey);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load groups.");
        setLoadedKey(queryKey);
      });
  }, [showArchived, queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (!showArchived && g.status === "archived") return false;
      if (!term) return true;
      return (
        g.name.toLowerCase().includes(term) ||
        (g.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [groups, search, showArchived]);

  

  const loadAvailableOrganisations = async () => {
    if (myOrganisations.length > 0) return;
    setLoadingOrgs(true);
    try {
      // Site oversight can create groups for any organisation; other creators
      // remain limited to organisations they actively belong to.
      const canCreateForAnyOrganisation = Boolean(
        user?.roles.some((role) => role === "admin" || role === "curator"),
      );
      const res = await api.organisations(
        "active",
        undefined,
        false,
        !canCreateForAnyOrganisation,
      );
      setMyOrganisations(res.data);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load organisations.",
      );
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadOrgMembers = async (organisationId: number) => {
    setLoadingOrgMembers(true);
    try {
      const res = await api.organisationMembers(organisationId);
      // res.data is OrganisationMembership[] (the data property of OrganisationMembershipList)
      const activeMembers = res.data.filter((m) => m.status === "active");
      setOrgMembers(activeMembers);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load organisation members.",
      );
    } finally {
      setLoadingOrgMembers(false);
    }
  };

  const handleOrganisationChange = async (organisationId: number | null) => {
    setForm((prev) => ({ ...prev, organisation_id: organisationId }));
    setSelectedKeys([]);
    if (organisationId) {
      await loadOrgMembers(organisationId);
    } else {
      setOrgMembers([]);
    }
  };

  const openCreate = async () => {
    setIsCreating(true);
    setEditing(null);
    setForm({
      name: "",
      description: "",
      visibility: "shared",
      organisation_id: null,
    });
    setSelectedKeys([]);
    setFormError(null);
    await loadAvailableOrganisations();
  };

  const openEdit = async (group: GroupRecord) => {
    if (!group.can_edit) return;
    setIsCreating(false);
    setFormError(null);
    try {
      await loadAvailableOrganisations();
      const detail = await api.group(group.id);
      setEditing(detail.group);
      setForm({
        name: detail.group.name,
        description: detail.group.description ?? "",
        visibility: detail.group.visibility,
        status: detail.group.status,
        organisation_id: detail.group.organisation?.id ?? null,
      });
      // Pre-tick from the loaded roster using the same subject keys the org
      // rows use, so edit mode reflects the current membership.
      setSelectedKeys(detail.group.members.map(groupMemberKey));
      if (detail.group.organisation?.id) {
        await loadOrgMembers(detail.group.organisation.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group.");
    }
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setIsCreating(false);
    setFormError(null);
  };

  const toggleMember = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Split selection back into the polymorphic payload the API understands:
  // account subjects go as `account_ids`, accountless profiles as memberables.
  const selectedMembersPayload = () => {
    const accountIds: number[] = [];
    const memberables: { type: "PlayerProfile" | "CoachProfile"; id: number }[] = [];
    for (const key of selectedKeys) {
      const [type, rawId] = key.split(":");
      const id = Number(rawId);
      if (!Number.isFinite(id)) continue;
      if (type === "Account") accountIds.push(id);
      else if (type === "PlayerProfile" || type === "CoachProfile")
        memberables.push({ type, id });
    }
    return { accountIds, memberables };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("A name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const members = selectedMembersPayload();
      if (editing) {
        await api.updateGroup(editing.id, form, members);
      } else {
        await api.createGroup(form, members);
      }
      setEditing(null);
      setIsCreating(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save the group.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (group: GroupRecord) => {
    if (!group.can_archive) return;
    setError(null);
    try {
      await api.updateGroup(group.id, {
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        status: group.status === "archived" ? "active" : "archived",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group.");
    }
  };

  const handleDelete = async (group: GroupRecord) => {
    if (!group.can_delete) return;
    // The server refuses to delete a group that has run sessions and says so in
    // its error message; confirming first keeps that refusal from surprising
    // anyone mid-flow.
    const ok = window.confirm(
      `Delete "${group.name}"? A group that has already run assessment sessions must be archived instead.`,
    );
    if (!ok) return;

    setError(null);
    try {
      await api.deleteGroup(group.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  // ---------- Add member (modal) ---------------------------------------------

  // Who the form is shown to: site oversight (admin/curator), the group's
  // owner, or an owner of the group's organisation. The server stays the
  // authority — it still answers 403 to anybody it does not recognise — this
  // only decides whether the affordance is worth rendering.
  const canAddMembersTo = (group: GroupRecord): boolean => {
    if (group.status === "archived") return false;
    const roles = user?.roles ?? [];
    if (roles.includes("admin") || roles.includes("curator")) return true;
    if (group.can_edit) return true;
    if (
      group.owner?.account_id != null &&
      user?.account_id != null &&
      group.owner.account_id === user.account_id
    ) {
      return true;
    }
    if (
      group.organisation &&
      user?.organisation_memberships?.some(
        (membership) =>
          membership.organisation_id === group.organisation!.id &&
          membership.role === "owner" &&
          membership.status === "active",
      )
    ) {
      return true;
    }
    return false;
  };

  const closeMemberModal = () => {
    if (addingMember) return;
    setMemberTarget(null);
    setMemberRoster(null);
    setMemberQuery("");
    setMemberCandidates([]);
    setMemberSelected(null);
    setMemberRole("member");
    setMemberError(null);
    setMemberNotice(null);
  };

  const openAddMember = async (group: GroupRecord) => {
    setMemberTarget(group);
    setMemberQuery("");
    setMemberCandidates([]);
    setMemberSelected(null);
    setMemberRole("member");
    setMemberError(null);
    setMemberNotice(null);
    setOrgSubjectKeys(null);
    if (!group.organisation) return;
    // Load the group detail and the organisation's active roster together: the
    // candidate search stays disabled until the roster keys exist, so nothing
    // outside the organisation can ever be offered, not even for a keystroke.
    try {
      const [detail, roster] = await Promise.all([
        api.group(group.id),
        api.organisationMembers(group.organisation.id),
      ]);
      setMemberRoster(detail.group);
      setOrgSubjectKeys(activeRosterSubjectKeys(roster.data));
    } catch (err) {
      // Fail closed: with no roster the pool is empty, and the reason shows.
      setOrgSubjectKeys(new Set());
      setMemberError(
        err instanceof Error
          ? err.message
          : "Failed to load the roster.",
      );
    }
  };

  // Roster subjects already on the team, keyed like the editor's checkboxes so
  // a candidate who is already a member cannot be added twice.
  const rosterKeys = new Set(
    (memberRoster?.members ?? []).map((member) => groupMemberKey(member, 0)),
  );

  // Candidate pool = the group's organisation roster (§10): the global search
  // endpoint returns anybody, so results are intersected with the
  // organisation's active members before they are ever offered. The search
  // itself waits until that roster is loaded (`orgSubjectKeys` non-null).
  useEffect(() => {
    const organisationId = memberTarget?.organisation?.id;
    if (
      !organisationId ||
      orgSubjectKeys === null ||
      memberQuery.trim().length < 2
    ) {
      return;
    }
    let cancelled = false;
    api
      .organisationMemberCandidates(organisationId, memberQuery.trim())
      .then((result) => {
        if (!cancelled) setMemberCandidates(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setMemberError(
            reason instanceof Error
              ? reason.message
              : "Failed to search members.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [memberTarget, memberQuery, orgSubjectKeys]);
  const memberCandidatesVisible =
    memberTarget?.organisation != null &&
    orgSubjectKeys !== null &&
    memberQuery.trim().length >= 2
      ? memberCandidates.filter((candidate) =>
          sharesSubjectWith(orgSubjectKeys, candidate),
        )
      : [];
  const memberSearchActive =
    memberTarget?.organisation != null &&
    orgSubjectKeys !== null &&
    memberQuery.trim().length >= 2;

  // The backend enrols new members with the default role; the requested role
  // is applied to the fresh row right after, the same way the roster screen
  // assigns roles to an existing row.
  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!memberTarget) return;
    if (!memberSelected) {
      setMemberError("Choose a person to add.");
      return;
    }
    setAddingMember(true);
    setMemberError(null);
    setMemberNotice(null);
    try {
      const payload =
        memberSelected.memberable_type === "Account" &&
        memberSelected.account_id != null
          ? { accountIds: [memberSelected.account_id] }
          : {
              memberableType: memberSelected.memberable_type as
                | "PlayerProfile"
                | "CoachProfile",
              memberableId: memberSelected.memberable_id,
            };
      const { group: detail } = await api.addGroupMember(
        memberTarget.id,
        payload,
      );
      // Update the roster right away — before the role step — so the list
      // reflects the addition even if the role change below fails.
      let roster = detail;
      const added = detail.members.find((member) =>
        sameSubject(member, memberSelected),
      );
      if (added && memberRole !== "member") {
        try {
          const { membership } = await api.updateGroupMember(
            memberTarget.id,
            added.id,
            memberRole,
          );
          roster = {
            ...detail,
            members: detail.members.map((member) =>
              member.id === membership.id ? membership : member,
            ),
          };
        } catch (err) {
          // The member is on the roster; only the role change failed.
          setMemberError(
            err instanceof Error
              ? err.message
              : "Failed to set the member's role.",
          );
        }
      }
      setMemberRoster(roster);
      setGroups((current) =>
        current.map((item) =>
          item.id === memberTarget.id
            ? { ...item, player_count: roster.player_count }
            : item,
        ),
      );
      setMemberNotice(`${memberSelected.display_name} added to ${memberTarget.name}.`);
      setMemberQuery("");
      setMemberCandidates([]);
      setMemberSelected(null);
      setMemberRole("member");
    } catch (err) {
      setMemberError(
        err instanceof Error ? err.message : "Failed to add the member.",
      );
    } finally {
      setAddingMember(false);
    }
  };

  const renderEditor = () => (
    <form onSubmit={handleSubmit}>
      {formError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{formError}</span>
        </div>
      )}

      <div className="admin-field">
        <label htmlFor="group-name">Name *</label>
        <input
          id="group-name"
          type="text"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g. U19 squad"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="group-description">Description</label>
        <textarea
          id="group-description"
          rows={2}
          value={form.description ?? ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Optional context for this roster"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="group-visibility">Visibility</label>
        <select
          id="group-visibility"
          value={form.visibility ?? "shared"}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              visibility: e.target.value as GroupVisibility,
            }))
          }
        >
          <option value="shared">Shared — every coach can pick this group</option>
          <option value="private">Private — only me, curators and admins</option>
        </select>
        <p className="field-hint">
          Visibility is presentation only. It never decides who may be scheduled.
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="group-organisation">Organisation</label>
        <select
          id="group-organisation"
          value={form.organisation_id ?? ""}
          onChange={(e) =>
            handleOrganisationChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={loadingOrgs}
        >
          <option value="">— Select organisation —</option>
          {loadingOrgs ? (
            <option disabled>Loading…</option>
          ) : (
            myOrganisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))
          )}
        </select>
        <p className="field-hint">
          A group belongs to one organisation. Only active members of that
          organisation can be added to the roster.
        </p>
      </div>

      <div className="admin-field">
        <span className="group-roster-label" id="group-members-label">
          Roster ({selectedKeys.length})
        </span>
        <div
          className="consolidation-session-picker group-member-picker"
          role="group"
          aria-labelledby="group-members-label"
        >
          {/* No role/label of its own: the wrapper above already names the group,
              and a second identically-labelled group would be ambiguous. */}
          <div className="session-picker-list">
            {!form.organisation_id ? (
              <p className="candidate-empty">
                Select an organisation to see its members.
              </p>
            ) : loadingOrgMembers ? (
              <p className="candidate-empty">Loading members…</p>
            ) : orgMembers.length === 0 ? (
              <p className="candidate-empty">
                No active members in this organisation.
              </p>
            ) : (
              orgMembers.map((member, index) => {
                const key = orgMemberKey(member, index);
                const checked = selectedKeys.includes(key);
                const name =
                  member.display_name ?? member.person_name ?? "Unknown";
                return (
                  <label
                    key={key}
                    className={
                      checked
                        ? "consolidation-session-option selected"
                        : "consolidation-session-option"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(key)}
                    />
                    <span className="session-option-body">
                      <span className="session-option-name">
                        {name}
                      </span>
                      <span className="session-option-meta">
                        {member.role_label}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Saving..." : editing ? "Save changes" : "Create group"}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={closeEditor}
        >
          Cancel
        </button>
      </div>
    </form>
  );


  return (
    <div className="page groups-page">
      <PageHeader
        title="Groups"
        description="Reusable rosters for assessment sessions. A group is a selection aid: membership is not attendance, and it grants no access."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => void openCreate()}
        >
          <Plus size={16} />
          New group
        </button>
      </PageHeader>

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="groups-toolbar">
        <div className="groups-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search groups"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups"
          />
        </div>
        <label className="groups-archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a roster so you can fill a session roster without searching for the same players every time."
        />
      ) : (
        <ul className="group-list">
          {visibleGroups.map((group) => (
            <li key={group.id} className="group-row">
              <div className="group-row-main">
                <Link className="group-name" to={`/groups/${group.id}`}>{group.name}</Link>
                {group.visibility === "private" && (
                  <span className="tag">Private</span>
                )}
                {group.status === "archived" && (
                  <span className="tag">Archived</span>
                )}
                <span className="group-meta">
                  {group.player_count} player
                  {group.player_count === 1 ? "" : "s"}
                  {group.organisation && (
                    <>
                      {" · "}
                      <span className="group-org">{group.organisation.name}</span>
                    </>
                  )}
                </span>
              </div>
              {group.description && (
                <p className="group-description">{group.description}</p>
              )}
              <div className="group-row-actions">
                {canAddMembersTo(group) && <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => void openAddMember(group)}
                >
                  <UserPlus size={14} />
                  Add member
                </button>}
                {group.can_edit && <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => void openEdit(group)}
                >
                  Edit
                </button>}
                {group.can_archive && <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => void handleArchiveToggle(group)}
                >
                  {group.status === "archived" ? "Restore" : "Archive"}
                </button>}
                {group.can_delete && <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  onClick={() => void handleDelete(group)}
                >
                  <Trash2 size={14} />
                  Delete
                </button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(isCreating || editing) && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editing ? `Edit ${editing.name}` : "New group"}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditor}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{renderEditor()}</div>
          </div>
        </div>
      )}

      {memberTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add member to {memberTarget.name}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeMemberModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {memberError && (
                <div className="admin-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{memberError}</span>
                </div>
              )}
              {memberNotice && (
                <p className="field-hint" role="status">
                  {memberNotice}
                </p>
              )}

              <div className="admin-field">
                <span className="group-roster-label" id="member-roster-label">
                  Roster ({memberRoster?.members.length ?? 0})
                </span>
                {!memberRoster ? (
                  <p className="candidate-empty">Loading roster…</p>
                ) : memberRoster.members.length > 0 ? (
                  <ul className="identity-link-list" aria-labelledby="member-roster-label">
                    {memberRoster.members.map((member) => (
                      <li key={member.id}>
                        <span>{member.name || "Member"}</span>
                        <small>
                          {" "}
                          {memberRoleLabel(member.role)} · {member.status}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="candidate-empty">No members yet.</p>
                )}
              </div>

              {!memberTarget.organisation ? (
                <p className="field-hint">
                  This group has no organisation yet, so its candidate pool
                  cannot be searched. Ask an administrator to place it in an
                  organisation first.
                </p>
              ) : (
                <form className="organisations-add" onSubmit={submitMember}>
                  <div className="form-row">
                    <label htmlFor="group-member-search">Search by name</label>
                    <input
                      id="group-member-search"
                      placeholder="Search by name"
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      disabled={addingMember}
                    />
                  </div>
                  {memberCandidatesVisible.length > 0 && (
                    <ul className="organisations-add-results">
                      {memberCandidatesVisible.map((candidate) => {
                        const key = `${candidate.memberable_type}:${candidate.memberable_id}`;
                        const onRoster = rosterKeys.has(key);
                        return (
                          <li key={candidate.id}>
                            <span>
                              {candidate.display_name}
                              <small> {candidate.member_type_label}</small>
                            </span>
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={onRoster || addingMember}
                              onClick={() => setMemberSelected(candidate)}
                            >
                              {onRoster
                                ? "Already on roster"
                                : memberSelected?.id === candidate.id
                                  ? "Selected"
                                  : "Select"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {memberSearchActive && memberCandidatesVisible.length === 0 && (
                    <p className="candidate-empty">
                      No members of {memberTarget.organisation.name} match “
                      {memberQuery.trim()}”.
                    </p>
                  )}
                  {memberSelected && (
                    <p className="field-hint">
                      Adding {memberSelected.display_name}.
                    </p>
                  )}
                  <div className="form-row">
                    <label htmlFor="group-member-role">Role</label>
                    <select
                      id="group-member-role"
                      value={memberRole}
                      onChange={(e) =>
                        setMemberRole(e.target.value as GroupMember["role"])
                      }
                      disabled={addingMember}
                    >
                      <option value="member">Member</option>
                      <option value="coach">Coach</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="admin-btn admin-btn-primary"
                      disabled={addingMember}
                    >
                      {addingMember ? "Adding…" : "Add member"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={closeMemberModal}
                    >
                      Done
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

