import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type GroupDetail as Group,
  type GroupMember,
  type OrganisationMemberCandidate,
  type OrganisationMembership,
} from "../api";
import { useAuth } from "../auth/AuthContext";

function roleLabel(role: GroupMember["role"]) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

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

/** Stable subject key for one roster row, mirroring the Groups editor. */
const rosterKey = (member: GroupMember): string => {
  if (member.memberable_type && member.memberable_id != null) {
    return `${member.memberable_type}:${member.memberable_id}`;
  }
  if (member.account_id != null) return `Account:${member.account_id}`;
  return `Membership:${member.id}`;
};

/**
 * Every subject key under which an organisation membership row can match: the
 * polymorphic memberable plus, when the row is account-backed, the account
 * itself (a claimed player may sit on the roster via either subject).
 */
const membershipSubjectKeys = (
  membership: OrganisationMembership,
): string[] => {
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

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // The add-member form: candidate search scoped to the group's organisation,
  // the chosen role for the next add, and inline error/success messaging.
  const [showAddMember, setShowAddMember] = useState(false);
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
  // Subject keys of the organisation's active roster, fetched when the form
  // opens. Candidates are only offered while this is loaded, so the search can
  // never surface somebody outside the group's organisation — the global
  // candidate endpoint searches everybody, the intersection narrows it back.
  const [orgSubjectKeys, setOrgSubjectKeys] = useState<Set<string> | null>(
    null,
  );

  useEffect(() => {
    if (id) {
      api.group(id)
        .then(({ group: value }) => setGroup(value))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load group."));
    }
  }, [id]);

  // Candidate pool = the group's organisation roster (§10): the global search
  // endpoint returns anybody, so results are intersected with the
  // organisation's active members before they are ever offered. The search
  // itself waits until that roster is loaded (`orgSubjectKeys` non-null).
  useEffect(() => {
    const organisationId = group?.organisation?.id;
    if (
      !showAddMember ||
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
            reason instanceof Error ? reason.message : "Failed to search members.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [group, showAddMember, memberQuery, orgSubjectKeys]);

  if (error) return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  if (!group) return <div className="loading">Loading…</div>;

  const canManage = group.can_approve_members;

  // Who the form is offered to: site oversight (admin/curator), the group's
  // owner, or an owner of the group's organisation. The server stays the
  // authority — it still answers 403 to anybody it does not recognise — this
  // only decides whether the affordance is worth rendering.
  const canAddMembers = (() => {
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
  })();

  // Roster subjects already on the team, so a candidate who is a member
  // already cannot be added twice.
  const rosterKeys = new Set(group.members.map(rosterKey));
  const memberCandidatesVisible =
    group.organisation && orgSubjectKeys && memberQuery.trim().length >= 2
      ? memberCandidates.filter((candidate) =>
          sharesSubjectWith(orgSubjectKeys, candidate),
        )
      : [];
  const memberSearchActive =
    group.organisation != null &&
    orgSubjectKeys !== null &&
    memberQuery.trim().length >= 2;

  const toggleAddMember = async () => {
    const opening = !showAddMember;
    setShowAddMember(opening);
    setMemberQuery("");
    setMemberCandidates([]);
    setMemberSelected(null);
    setMemberRole("member");
    setMemberError(null);
    setMemberNotice(null);
    setOrgSubjectKeys(null);
    if (!opening || !group.organisation) return;
    // Load the organisation's active roster first: the candidate search stays
    // disabled until these subject keys exist, so nothing outside the
    // organisation can ever be offered, not even for a keystroke.
    try {
      const roster = await api.organisationMembers(group.organisation.id);
      const keys = new Set<string>();
      roster.data
        .filter((membership) => membership.status === "active")
        .forEach((membership) => {
          membershipSubjectKeys(membership).forEach((key) => keys.add(key));
        });
      setOrgSubjectKeys(keys);
    } catch (err) {
      // Fail closed: with no roster the pool is empty, and the reason shows.
      setOrgSubjectKeys(new Set());
      setMemberError(
        err instanceof Error
          ? err.message
          : "Failed to load the organisation roster.",
      );
    }
  };

  // The backend enrols new members with the default role; the requested role
  // is applied to the fresh row right after, the same way the select above
  // assigns roles to an existing row.
  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
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
      const { group: detail } = await api.addGroupMember(group.id, payload);
      // Update the roster right away — before the role step — so the list
      // reflects the addition even if the role change below fails.
      let members = detail.members;
      const added = detail.members.find((member) =>
        sameSubject(member, memberSelected),
      );
      if (added && memberRole !== "member") {
        try {
          const { membership } = await api.updateGroupMember(
            group.id,
            added.id,
            memberRole,
          );
          members = members.map((member) =>
            member.id === membership.id ? membership : member,
          );
        } catch (err) {
          // The member is on the roster; only the role change failed.
          setMemberError(
            err instanceof Error
              ? err.message
              : "Failed to set the member's role.",
          );
        }
      }
      setGroup((prev) => (prev ? { ...prev, members } : prev));
      setMemberNotice(`${memberSelected.display_name} added to ${group.name}.`);
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

  const changeRole = async (membershipId: number, newRole: GroupMember["role"]) => {
    setBusyId(membershipId);
    try {
      await api.updateGroupMember(group.id, membershipId, newRole);
      setGroup((prev) => prev ? {
        ...prev,
        members: prev.members.map((m) =>
          m.id === membershipId ? { ...m, role: newRole } : m
        ),
      } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (membershipId: number) => {
    if (!confirm("Remove this member from the group?")) return;
    setBusyId(membershipId);
    try {
      await api.endGroupMember(group.id, membershipId);
      setGroup((prev) => prev ? {
        ...prev,
        members: prev.members.filter((m) => m.id !== membershipId),
      } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  };

  const members = group.members.sort((a, b) => {
    const roleOrder: Record<GroupMember["role"], number> = { owner: 0, coach: 1, member: 2 };
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>{group.name}</h1>
        <p>{group.description || "Group roster"}</p>
      </header>
      <section className="detail-section">
        <h2>Details</h2>
        <dl className="identity-context">
          <dt>Status</dt><dd>{group.status_label}</dd>
          <dt>Visibility</dt><dd>{group.visibility}</dd>
          {group.organisation && (
            <>
              <dt>Organisation</dt>
              <dd>
                <Link className="identity-link" to={`/organisations/${group.organisation.slug ?? group.organisation.id}`}>
                  {group.organisation.name}
                </Link>
              </dd>
            </>
          )}
        </dl>
      </section>
      <section className="detail-section">
        <h2>Members</h2>
        {canAddMembers && (
          <div className="group-add-member">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => void toggleAddMember()}
              aria-expanded={showAddMember}
            >
              {showAddMember ? "Cancel" : "Add member"}
            </button>
            {showAddMember && (
              <form className="organisations-add" onSubmit={submitMember}>
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
                {!group.organisation ? (
                  <p className="field-hint">
                    This group has no organisation yet, so its candidate pool
                    cannot be searched. Ask an administrator to place it in an
                    organisation first.
                  </p>
                ) : (
                  <>
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
                          const onRoster = rosterKeys.has(
                            `${candidate.memberable_type}:${candidate.memberable_id}`,
                          );
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
                        No members of {group.organisation.name} match “
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
                        {addingMember ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        )}
        {members.length ? (
          <ul className="identity-link-list">
            {members.map((member) => (
              <li key={member.id} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                <span style={{ flex: 1 }}>
                  {member.player_profile_id ? (
                    <Link className="identity-link" to={`/players/${member.player_profile_id}`}>
                      {member.name || `Player profile #${member.player_profile_id}`}
                    </Link>
                  ) : (
                    member.name || "Member"
                  )}
                </span>
                {canManage && member.id !== busyId && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member.id, e.target.value as GroupMember["role"])}
                      disabled={busyId === member.id}
                      style={{ padding: "4px 8px" }}
                    >
                      <option value="owner">Owner</option>
                      <option value="coach">Coach</option>
                      <option value="member">Member</option>
                    </select>
                    {member.role !== "owner" && (
                      <button
                        onClick={() => removeMember(member.id)}
                        disabled={busyId === member.id}
                        className="btn btn-danger btn-sm"
                        style={{ padding: "4px 8px" }}
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
                <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>
                  {roleLabel(member.role)} · {member.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No members.</p>
        )}
      </section>
    </div>
  );
}
