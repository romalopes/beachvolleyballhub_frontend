import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Coach, type Account, type Organisation, type Group, type PaginatedResponse } from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
import ClaimInvitationPanel from "../components/people/ClaimInvitationPanel";
import CoachingRelationships from "../components/people/CoachingRelationships";
import ProfileMergePanel from "../components/identity/ProfileMergePanel";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import {
  archiveCoach,
  canManageProfiles,
  deleteCoachProfile,
  isArchived,
  restoreCoach,
} from "../utils/people";

/**
 * Coach detail: the identity behind the profile plus the coaching attributes.
 *
 * Unlike players, coaches have no training history here — attendance belongs to
 * the participant rows, and a CoachProfile is never a participant. What matters
 * on this page is who the person is, what they coach, and the profile state
 * (account, visibility, archived).
 */
export default function CoachDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const canMerge = Boolean(user?.roles.some((role) => role === "admin" || role === "curator"));
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Coach not found." : null,
  );
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Account and group memberships
  const [account, setAccount] = useState<Account | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
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
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);


  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .coach(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setCoach(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load coach.");
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


  // Fetch account and group memberships when coach is loaded
  useEffect(() => {
    if (!coach || !coach.account_id) {
      setAccount(null);
      setGroups(null);
      return;
    }
    let cancelled = false;
    api.account(coach.account_id)
      .then(acc => {
        if (cancelled) return;
        setAccount(acc);
        // Fetch all unique groups from the account's group memberships
        const groupIds = [...new Set(acc.group_memberships?.map(m => m.group_id) || [])];
        Promise.all(groupIds.map(id => api.group(id)))
          .then(fetchedGroups => {
            if (!cancelled) setGroups(fetchedGroups);
          })
          .catch(e => {
            if (!cancelled) console.error('Failed to fetch groups:', e);
          });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load account.");
      });
    return () => {
      cancelled = true;
    };
  }, [coach, coach.account_id]);

  /** Archive/restore are the same PATCH the edit form uses. */
  const handleArchive = async () => {
    if (!coach) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await archiveCoach(coach.id);
      setCoach({ ...coach, status: updated.status });
      setConfirmingArchive(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!coach) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await restoreCoach(coach.id);
      setCoach({ ...coach, status: updated.status });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!coach) return;
    setWorking(true);
    setActionError(null);
    try {
      await deleteCoachProfile(coach.id);
      navigate("/coaches");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  /** Check if the current user can manage an organisation membership for the given organisation ID. */
  const canManageOrganisationMembership = (organisationId: number) => {
    return user.organisation_memberships?.some(
      mem => mem.organisation_id === organisationId && mem.manages
    );
  };

  /** Check if the current user can manage a group membership for the given group ID. */
  const canManageGroupMembership = (groupId: number) => {
    const group = groups?.find(g => g.id === groupId);
    return group ? group.can_approve_members : false;
  };

  const handleJoinOrganisation = async () => {
    if (!coach || !coach.account_id) return;
    setJoinOrgLoading(true);
    setJoinOrgError(null);
    try {
      await api.addOrganisationMember(Number(joinOrgId), coach.account_id, {
        role: 'member',
        status: 'active',
      });
      // Refetch coach to update memberships
      const updatedCoach = await api.coach(coach.id);
      setCoach(updatedCoach);
      setShowJoinOrgModal(false);
    } catch (err: unknown) {
      setJoinOrgError(err instanceof Error ? err.message : 'Failed to join organisation');
    } finally {
      setJoinOrgLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!coach || !coach.person?.id || !coach.coach_profile_id) return;
    setJoinGroupLoading(true);
    setJoinGroupError(null);
    try {
      await api.addGroupMember(Number(joinGroupId), {
        memberableType: 'CoachProfile',
        memberableId: coach.coach_profile_id,
      });
      // Refetch coach to update account and groups (since group memberships are via account)
      const updatedCoach = await api.coach(coach.id);
      setCoach(updatedCoach);
      setShowJoinGroupModal(false);
    } catch (err: unknown) {
      setJoinGroupError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setJoinGroupLoading(false);
    }
  };

  const handleLeaveOrganisation = async (organisationId: number, membershipId: number) => {
    if (!coach) return;
    setLeaving({ type: 'organisation', id: organisationId });
    try {
      await api.endOrganisationMembership(organisationId, membershipId);
      // Refetch coach to update memberships
      const updatedCoach = await api.coach(coach.id);
      setCoach(updatedCoach);
    } catch (err: unknown) {
      // Error will be shown in UI via actionError? We don't have a specific state for leave error.
      // For now, we'll just reset leaving state and maybe show an alert.
      console.error('Failed to leave organisation:', err);
    } finally {
      setLeaving(null);
    }
  };

  const handleLeaveGroup = async (groupId: number, personId: number) => {
    if (!coach) return;
    setLeaving({ type: 'group', id: groupId });
    try {
      await api.removeGroupMember(groupId, personId);
      // Refetch coach to update account and groups
      const updatedCoach = await api.coach(coach.id);
      setCoach(updatedCoach);
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

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !coach)
    return (
      <EmptyState title="Coach not found" description={error ?? undefined} />
    );

  // Mirrors the API's `subject_owner?` for a coach profile: an admin, or the
  // coach who recorded it. Computed after the loading guards so `coach` is known.
  const invitationBlockedReason = !user
    ? "Sign in to invite this coach to claim their profile."
    : !user.roles.includes("admin") && !user.roles.includes("curator") &&
        !(user.roles.includes("coach") && coach.created_by?.id === user.id)
      ? "Only an administrator or the coach who recorded this profile can invite a coach to claim it."
      : null;
  const coachName = coach.full_name ?? coach.person?.first_name ?? coach.display_name ?? `Coach profile #${coach.id}`;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/coaches")}>
          <ArrowLeft size={16} />
          Back to Coaches
        </button>
        <span className="section-label">Coach</span>
        <h1>{coachName}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag>
            {coach.account_status === "connected"
              ? "Account connected"
              : "Profile only"}
          </Tag>
          {coach.coaching_level && <Tag>{coach.coaching_level}</Tag>}
          {coach.visibility === "private" && <Tag>Private</Tag>}
          {isArchived(coach) && <Tag>Archived</Tag>}
        </div>
        {canEdit && (
          <div className="admin-actions-bar">
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-btn admin-btn-add"
                onClick={() => navigate(`/coaches/${coach.id}/edit`)}
              >
                <Pencil size={14} />
                Edit
              </button>
              {isArchived(coach) ? (
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
          </div>
        )}
      </div>
{coach.status === "active" && canEdit && (
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

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={coachName}
          title={`Archive “${coachName}”?`}
          warning="The coach leaves the catalogue. Their profile and past trainings are kept, and this can be undone."
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
          entityName={coachName}
          title={`Delete “${coachName}”?`}
          warning="This permanently removes the coach profile. It cannot be undone. The coach must not be referenced in any assessment session."
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
        {coach.account_status === "connected" && coach.account ? (
          <p className="related-item-meta">
            Linked to account: <a href={`/accounts/${coach.account.id}`}><strong>{coach.account.full_name}</strong></a>
          </p>
        ) : (
          <p className="related-item-meta">This profile has no linked account. Create an invitation to let its owner claim it.</p>
        )}
        {coach.account_status !== "connected" && <ClaimInvitationPanel
          key={`${coach.id}:${coach.status}`}
          claimableType="CoachProfile"
          claimableId={coach.id}
          blockedReason={invitationBlockedReason}
          ineligibleReason={isArchived(coach) ? "Restore this profile before creating claim invitations." : null}
          inviteeEmail={null}
        />}
      </section>

      {canMerge && coach.status === "active" && <ProfileMergePanel
        kind="coach"
        sourceId={coach.id}
        sourceName={coachName}
        onMerged={(canonicalId) => navigate(`/coaches/${canonicalId}`, { replace: true })}
      />}

      {coach.person?.organisation_memberships?.length ? (
        <section className="detail-section">
          <h2>Organisation memberships</h2>
          <ul className="people-list">
            {coach.person.organisation_memberships.map((m) => (
              <li key={m.id} className="people-row">
                <div className="people-identity">
                  <span className="people-name">
                    {m.organisation?.name ??
                      `Organisation #${m.organisation_id}`}
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
          {!isArchived(coach) && coach.account_id && (
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

      {coach.person?.group_memberships?.length ? (
        <section className="detail-section">
          <h2>Group memberships</h2>
          <ul className="people-list">
            {coach.person.group_memberships.map((m) => (
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
          {!isArchived(coach) && coach.person?.id && (
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
        side="coach"
        profileId={coach.coach_profile_id!}
        canManage={
          canEdit &&
          (Boolean(user?.roles.includes("admin")) ||
            Boolean(
              user?.coach_profile_ids?.includes(coach.coach_profile_id!) ||
              user?.coach_profile_id === coach.coach_profile_id,
            ))
        }
        isAdmin={Boolean(user?.roles.includes("admin"))}
      />

      <section className="detail-section assessment-section">
        <h2>Recorded assessments</h2>
        <p className="related-item-meta">
          {coach.assessments_recorded_count ?? 0} published assessment
          {(coach.assessments_recorded_count ?? 0) === 1 ? "" : "s"} attributed
          to this coach.
        </p>
        <AssessmentList
          assessments={coach.recent_assessments}
          emptyTitle="No assessments recorded"
          emptyDescription="Ratings attributed to this coach will appear here."
          showHistory={false}
        />
      </section>

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
      <section className="detail-section">
        <h2>Coaching details</h2>
        <p>
          {coach.coaching_level ?? "No coaching level yet"}
          <br />
          {coach.qualifications ?? "No qualifications yet"}
        </p>
        <p className="related-item-meta">
          Visibility: {coach.visibility === "private" ? "Private" : "Shared"}
        </p>
      </section>
    </div>
  );
}
