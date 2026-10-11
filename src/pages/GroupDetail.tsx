import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type GroupDetail as Group, type GroupMember } from "../api";

function roleLabel(role: GroupMember["role"]) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      api.group(id)
        .then(({ group: value }) => setGroup(value))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load group."));
    }
  }, [id]);

  if (error) return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  if (!group) return <div className="loading">Loading…</div>;

  const canManage = group.can_approve_members;

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
                <Link className="identity-link" to={`/organisations/${group.organisation.id}`}>
                  {group.organisation.name}
                </Link>
              </dd>
            </>
          )}
        </dl>
      </section>
      <section className="detail-section">
        <h2>Members</h2>
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
