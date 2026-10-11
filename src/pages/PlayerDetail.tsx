import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Player, type Organisation, type Group, type PaginatedResponse } from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
import ClaimInvitationPanel from "../components/people/ClaimInvitationPanel";
import CoachingRelationships from "../components/people/CoachingRelationships";
import ProfileMergePanel from "../components/identity/ProfileMergePanel";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import {
  archivePlayer,
  canManageProfiles,
  deletePlayerProfile,
  isArchived,
  restorePlayer,
} from "../utils/people";
import { formatTrainingDateRange, participantStatusLabel } from "../utils/training";

/**
 * Player detail: the identity behind the profile, plus read-only history.
 *
 * Training history comes from the participant rows, so it shows the same status
 * the coach set on the session (invited → confirmed → attended/absent) — one
 * place where attendance is recorded, one place where it is read.
 *
 * Assessments are listed read-only: they are now authored inside assessment
 * sessions (assessment plan §8), so this page deliberately offers no
 * assessment-creation form. That keeps "who rated this player, and on what
 * rubric" authored in exactly one place.
 */
export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const canMerge = Boolean(user?.roles.some((role) => role === "admin" || role === "curator"));
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Player not found." : null,
  );
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Leave state
  const [leaving, setLeaving] = useState<{ type: 'organisation' | 'group'; id: number } | null>(null);
  // Join modal states
  const [showJoinOrgModal, setShowJoinOrgModal] = useState(false);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinOrgLoading, setJoinOrgLoading] = useState(false);
  const [joinOrgError, setJoinOrgError] = useState<string | null>(null);
  const [joinOrgId, setJoinOrgId] = useState<string>('');
  const [joinGroupLoading, setJoinGroupLoading] = useState(false);
  const [joinGroupError, setJoinGroupError] = useState<string | null>(null);
  const [joinGroupId, setJoinGroupId] = useState<string>('');

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);


  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .player(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setPlayer(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load player.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, numericId]);

  // fetch organisations and groups for join modals
  useEffect(() => {
    const fetchLists = async () => {
      setOrgsLoading(true);
      setGroupsLoading(true);
      try {
        const orgsResp = await api.organisations("active", undefined, false, false);
        const orgsData = (orgsResp as PaginatedResponse<Organisation>).data ?? orgsResp;
        setOrganisations(Array.isArray(orgsData) ? orgsData : []);
      } catch (e) {
        console.error("Failed to load organisations", e);
        setOrganisations([]);
      } finally {
        setOrgsLoading(false);
      }
      try {
        const groupsResp = await api.groups({ status: "active", mine: false });
        const groupsData = (groupsResp as PaginatedResponse<Group>).data ?? groupsResp;
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } catch (e) {
        console.error("Failed to load groups", e);
        setGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };
    fetchLists();
  }, []);


  /** Archive/restore are the same PATCH the edit form uses. */
  const handleArchive = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await archivePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
      setConfirmingArchive(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await restorePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      await deletePlayerProfile(player.id);
      navigate("/players");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !player)
    return <EmptyState title="Player not found" description={error ?? undefined} />;

  // Helper functions to check permissions
  const canManageOrganisationMembership = (organisationId: number) => {
    return user.organisation_memberships?.some(
      mem => mem.organisation_id === organisationId && mem.manages
    );
  };

  const canManageGroupMembership = (groupId: number) => {
    const group = groups?.find(g => g.id === groupId);
    return group ? group.can_approve_members : false;
  };

  const handleJoinOrganisation = async () => {
    if (!player || !player.account_id) return;
    setJoinOrgLoading(true);
    setJoinOrgError(null);
    try {
      await api.addOrganisationMember(Number(joinOrgId), player.account_id, {
        role: 'member',
        status: 'active',
      });
      // Refetch player to update memberships
      const updatedPlayer = await api.player(player.id);
      setPlayer(updatedPlayer);
      setShowJoinOrgModal(false);
    } catch (err: unknown) {
      setJoinOrgError(err instanceof Error ? err.message : 'Failed to join organisation');
    } finally {
      setJoinOrgLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!player || !player.person?.id) return;
    setJoinGroupLoading(true);
    setJoinGroupError(null);
    try {
      await api.addGroupMember(Number(joinGroupId), {
        memberableType: 'PlayerProfile',
        memberableId: player.id,
      });
      // Refetch player to update account and groups
      const updatedPlayer = await api.player(player.id);
      setPlayer(updatedPlayer);
      setShowJoinGroupModal(false);
    } catch (err: unknown) {
      setJoinGroupError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setJoinGroupLoading(false);
    }
  };

  const handleLeaveOrganisation = async (organisationId: number, membershipId: number) => {
    if (!player) return;
    setLeaving({ type: 'organisation', id: organisationId });
    try {
      await api.endOrganisationMembership(organisationId, membershipId);
      // Refetch player to update memberships
      const updatedPlayer = await api.player(player.id);
      setPlayer(updatedPlayer);
    } catch (err: unknown) {
      console.error('Failed to leave organisation:', err);
    } finally {
      setLeaving(null);
    }
  };

  const handleLeaveGroup = async (groupId: number, personId: number) => {
    if (!player) return;
    setLeaving({ type: 'group', id: groupId });
    try {
      await api.removeGroupMember(groupId, personId);
      // Refetch player to update account and groups
      const updatedPlayer = await api.player(player.id);
      setPlayer(updatedPlayer);
    } catch (err: unknown) {
      console.error('Failed to leave group:', err);
    } finally {
      setLeaving(null);
    }
  };

  const handleCloseJoinOrgModal = () => {
    setShowJoinOrgModal(false);
    setJoinOrgId('');
    setJoinOrgError(null);
  };

  const handleCloseJoinGroupModal = () => {
    setShowJoinGroupModal(false);
    setJoinGroupId('');
    setJoinGroupError(null);
  };
  const playerName = player.full_name?.trim() || player.person?.first_name || player.display_name || "Unnamed player";

  // Mirrors the API's `profile_owner?` (an admin, or the coach who recorded the
  // profile) so the panel can explain *why* it is unavailable instead of
  // silently rendering nothing.
  const invitationBlockedReason = !user
    ? "Sign in to invite this player to claim their profile."
    : !user.roles.includes("admin") && !user.roles.includes("curator") &&
        !(user.roles.includes("coach") && player.created_by?.id === user.id)
      ? "Only an administrator or the coach who recorded this profile can invite a player to claim it."
      : null;

  const history = [...(player.training_session_participants ?? [])].sort(
    (a, b) =>
      (b.training_session?.starts_at ?? "").localeCompare(
        a.training_session?.starts_at ?? "",
      ),
  );

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/players")}>
          <ArrowLeft size={16} />
          Back to Players
        </button>
        <span className="section-label">Player</span>
        <h1>{playerName}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag>
            {player.account_status === "connected"
              ? "Account connected"
              : "Profile only"}
          </Tag>
          {player.preferred_position && <Tag>{player.preferred_position}</Tag>}
          {player.level && <Tag>{player.level}</Tag>}
          <Tag>
            {player.training_session_count ?? history.length} training
            {(player.training_session_count ?? history.length) === 1 ? "" : "s"}
          </Tag>
          {player.visibility === "private" && <Tag>Private</Tag>}
          {isArchived(player) && <Tag>Archived</Tag>}
        </div>
        {canEdit && (
          <div className="admin-actions-bar">
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-btn admin-btn-add"
                onClick={() => navigate(`/players/${player.id}/edit`)}
              >
                <Pencil size={14} />
                Edit
              </button>
              {isArchived(player) ? (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={working}
                  onClick={handleRestore}
                >
                  <ArchiveRestore size={14} />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  disabled={working}
                  onClick={() => setConfirmingArchive(true)}
                >
                  <Archive size={14} />
                  Archive
                </button>
              )}
            </div>
{player.status === "active" && canEdit && (
              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-delete"
                  disabled={working}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <span className="sr-only">Delete</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={playerName}
          title={`Archive “${playerName}”?`}
          warning="The player leaves the catalogue and cannot be added to new trainings. Their training history is kept, and this can be undone."
          confirmLabel="Archive"
          pendingLabel="Archiving..."
          deleting={working}
          error={actionError}
          onCancel={() => {
            setConfirmingArchive(false);
            setActionError(null);
          }}
          onConfirm={handleArchive}
        />
      )}
{confirmingDelete && (
        <DeleteConfirm
          entityName={playerName}
          title={`Delete “${playerName}”?`}
          warning="This permanently removes the player profile. It cannot be undone. The player must not be referenced in any assessment session."
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          deleting={working}
          error={actionError}
          onCancel={() => {
            setConfirmingDelete(false);
            setActionError(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      <section className="detail-section">
        <h2>Account link</h2>
        {player.account_status === "connected" && player.account ? (
          <p className="related-item-meta">
            Linked to account: <a href={`/accounts/${player.account.id}`}><strong>{player.account.full_name}</strong></a>
          </p>
        ) : (
          <p className="related-item-meta">This profile has no linked account. Create an invitation to let its owner claim it.</p>
        )}
        {player.account_status !== "connected" && <ClaimInvitationPanel
          key={`${player.id}:${player.status}`}
          claimableType="PlayerProfile"
          claimableId={player.id}
          blockedReason={invitationBlockedReason}
          ineligibleReason={isArchived(player) ? "Restore this profile before creating claim invitations." : null}
          inviteeEmail={null}
        />}
      </section>

      {canMerge && player.status === "active" && <ProfileMergePanel
        kind="player"
        sourceId={player.id}
        sourceName={playerName}
        onMerged={(canonicalId) => navigate(`/players/${canonicalId}`, { replace: true })}
      />}

      <div className="player-detail-grid">
        {player.person?.organisation_memberships?.length ? (
        <section className="detail-section">
          <h2>Organisation memberships</h2>
          <ul className="people-list">
            {player.person.organisation_memberships.map((m) => (
              <li key={m.id} className="people-row">
                <div className="people-identity">
                  <span className="people-name">
                    {m.organisation?.name ?? `Organisation #${m.organisation_id}`}
                  </span>
                  <span className="people-contact">
                    {m.role} · {m.status}
                  </span>
                </div>
                {leaving?.type === 'organisation' && leaving?.id === m.organisation_id ? (
                  <button className="btn btn-sm btn-outline-secondary" disabled>
                    Leaving...
                  </button>
                ) : canManageOrganisationMembership(m.organisation_id) ? (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      if (window.confirm(`Leave organisation ${m.organisation?.name ?? `#${m.organisation_id}`}?`)) {
                        handleLeaveOrganisation(m.organisation_id, m.id);
                      }
                    }}
                  >
                    Leave
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {!isArchived(player) && player.account_id && (
            <button
              className="auth-submit"
              type="button"
              onClick={() => setShowJoinOrgModal(true)}
            >
              Join Organisation
            </button>
          )}
        </section>
      ) : null}

      {player.person?.group_memberships?.length ? (
        <section className="detail-section">
          <h2>Group memberships</h2>
          <ul className="people-list">
            {player.person.group_memberships.map((m) => (
              <li key={m.id} className="people-row">
                <div className="people-identity">
                  <span className="people-name">
                    {m.group?.name ?? `Group #${m.group_id}`}
                  </span>
                  <span className="people-contact">
                    {m.role} · {m.status} · {m.group.organisation?.name}
                  </span>
                </div>
                {leaving?.type === 'group' && leaving?.id === m.group_id ? (
                  <button className="btn btn-sm btn-outline-secondary" disabled>
                    Leaving...
                  </button>
                ) : canManageGroupMembership(m.group_id) ? (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      if (window.confirm(`Leave group ${m.group?.name ?? `#${m.group_id}`}?`)) {
                        handleLeaveGroup(m.group_id, m.person?.id);
                      }
                    }}
                  >
                    Leave
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {!isArchived(player) && player.person?.id && (
            <button
              className="auth-submit"
              type="button"
              onClick={() => setShowJoinGroupModal(true)}
            >
              Join Group
            </button>
          )}
        </section>
      ) : null}
      <CoachingRelationships
        side="player"
        profileId={player.id}
        canManage={
          canEdit &&
          (Boolean(user?.roles.includes("admin")) || Boolean(user?.coach_profile_ids?.length ?? user?.coach_profile_id))
        }
        viewerCoachProfileId={user?.coach_profile_id ?? null}
        viewerCoachProfiles={user?.coach_profiles}
        isAdmin={Boolean(user?.roles.includes("admin"))}
      />

      <section className="detail-section assessment-section">
        <h2>Assessments</h2>
        <p className="related-item-meta">
          Read-only history · {player.assessment_count ?? 0} published assessment{(player.assessment_count ?? 0) === 1 ? "" : "s"}.
          Assessments are recorded inside assessment sessions, not on this page.
        </p>
        <AssessmentList
          assessments={player.assessments}
          emptyTitle="No assessments yet"
          emptyDescription="Published coaching assessments from assessment sessions will appear here."
        />
      </section>

      <section className="detail-section">
        <h2>Training history</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No trainings yet"
            description="This player has not been added to a training session."
          />
        ) : (
          <ul className="people-list">
            {history.map((row) => (
              <li key={row.id} className="people-row">
                <div className="people-identity">
                  {row.training_session ? (
                    <Link
                      to={`/training/${row.training_session.id}`}
                      className="people-name"
                    >
                      {row.training_session.title}
                    </Link>
                  ) : (
                    <span className="people-name">Training session</span>
                  )}
                  <span className="people-contact">
                    {row.training_session
                      ? formatTrainingDateRange(
                          row.training_session.starts_at,
                          row.training_session.ends_at,
                        )
                      : ""}
                  </span>
                </div>
                <Tag>{participantStatusLabel(row.status)}</Tag>
                {row.notes && <span className="people-meta">{row.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
      {showJoinOrgModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseJoinOrgModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-org-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-org-title">Join Organisation</h2>
              <button
                className="modal-close"
                onClick={handleCloseJoinOrgModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinOrganisation();
                }}
              >
                {joinOrgError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {joinOrgError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="org_id">
                    Organisation <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="org_id"
                    name="org_id"
                    required
                    value={joinOrgId}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                    disabled={joinOrgLoading || orgsLoading}
                  >
                    <option value="">Select organisation</option>
                    {orgsLoading ? (
                      <option disabled>Loading organisations…</option>
                    ) : organisations.length === 0 ? (
                      <option disabled>No organisations available</option>
                    ) : (
                      organisations.map((org) => (
                        <option key={org.id} value={String(org.id)}>
                          {org.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="modal-actions" style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseJoinOrgModal}
                    disabled={joinOrgLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={joinOrgLoading || !joinOrgId}
                  >
                    {joinOrgLoading ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showJoinGroupModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseJoinGroupModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-group-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-group-title">Join Group</h2>
              <button
                className="modal-close"
                onClick={handleCloseJoinGroupModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinGroup();
                }}
              >
                {joinGroupError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {joinGroupError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="group_id">
                    Group <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="group_id"
                    name="group_id"
                    required
                    value={joinGroupId}
                    onChange={(e) => setJoinGroupId(e.target.value)}
                    disabled={joinGroupLoading || groupsLoading}
                  >
                    <option value="">Select group</option>
                    {groupsLoading ? (
                      <option disabled>Loading groups…</option>
                    ) : groups.length === 0 ? (
                      <option disabled>No groups available</option>
                    ) : (
                      groups.map((group) => (
                        <option key={group.id} value={String(group.id)}>
                          {group.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="modal-actions" style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseJoinGroupModal}
                    disabled={joinGroupLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={joinGroupLoading || !joinGroupId}
                  >
                    {joinGroupLoading ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
