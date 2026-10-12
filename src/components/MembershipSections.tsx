import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Group,
  type Organisation,
  type OrganisationMembership,
  type PaginatedResponse,
  type UserGroupMembership,
} from "../api";

interface MembershipSectionsProps {
  organisationMemberships?: OrganisationMembership[];
  groupMemberships?: UserGroupMembership[];
  /** Enables self-service controls for the authenticated account only. */
  canManageOwnMemberships?: boolean;
  /** Called after a successful self-service membership change. */
  onMembershipsChanged?: () => void;
}

/** Shared membership lists, with optional controls for the signed-in account. */
export default function MembershipSections({
  organisationMemberships,
  groupMemberships,
  canManageOwnMemberships = false,
  onMembershipsChanged,
}: MembershipSectionsProps) {
  const [showJoinOrganisation, setShowJoinOrganisation] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [organisationId, setOrganisationId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [joining, setJoining] = useState<"organisation" | "group" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageOwnMemberships) return;
    let cancelled = false;

    const loadOptions = async () => {
      setOrganisationsLoading(true);
      setGroupsLoading(true);
      try {
        const [organisationResponse, groupResponse] = await Promise.all([
          api.organisations("active", undefined, false, false),
          api.groups({ status: "active", mine: false }),
        ]);
        if (cancelled) return;
        const organisationData =
          (organisationResponse as PaginatedResponse<Organisation>).data ?? organisationResponse;
        const groupData = (groupResponse as PaginatedResponse<Group>).data ?? groupResponse;
        setOrganisations(Array.isArray(organisationData) ? organisationData : []);
        setGroups(Array.isArray(groupData) ? groupData : []);
      } catch (loadError) {
        if (!cancelled) console.error("Failed to load membership options", loadError);
      } finally {
        if (!cancelled) {
          setOrganisationsLoading(false);
          setGroupsLoading(false);
        }
      }
    };

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [canManageOwnMemberships]);

  const notifyChanged = () => onMembershipsChanged?.();

  const closeOrganisationDialog = () => {
    setShowJoinOrganisation(false);
    setOrganisationId("");
    setError(null);
  };

  const closeGroupDialog = () => {
    setShowJoinGroup(false);
    setGroupId("");
    setError(null);
  };

  const joinOrganisation = async () => {
    const id = Number(organisationId);
    if (!id) {
      setError("Please select an organisation.");
      return;
    }
    setJoining("organisation");
    setError(null);
    try {
      await api.joinOrganisation(id);
      closeOrganisationDialog();
      notifyChanged();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Failed to join organisation.");
    } finally {
      setJoining(null);
    }
  };

  const joinGroup = async () => {
    const id = Number(groupId);
    if (!id) {
      setError("Please select a group.");
      return;
    }
    setJoining("group");
    setError(null);
    try {
      await api.joinGroup(id);
      closeGroupDialog();
      notifyChanged();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Failed to join group.");
    } finally {
      setJoining(null);
    }
  };

  const leaveOrganisation = async (id: number) => {
    setJoining("organisation");
    setError(null);
    try {
      await api.leaveOrganisation(id);
      notifyChanged();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave organisation.");
    } finally {
      setJoining(null);
    }
  };

  const leaveGroup = async (id: number) => {
    setJoining("group");
    setError(null);
    try {
      await api.leaveGroup(id);
      notifyChanged();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave group.");
    } finally {
      setJoining(null);
    }
  };

  return (
    <>
      <section className="detail-section">
        <h2>Organisation memberships</h2>
        {organisationMemberships?.length ? (
          <ul className="identity-link-list">
            {organisationMemberships.map((membership) => (
              <li key={membership.id}>
                <Link className="identity-link" to={`/organisations/${membership.organisation_id}`}>
                  {membership.organisation?.name || `Organisation #${membership.organisation_id}`}
                </Link>{" "}
                · {membership.role} · {membership.status}
                {canManageOwnMemberships && membership.status === "active" && (
                  <button
                    className="admin-btn"
                    disabled={joining !== null}
                    onClick={() => void leaveOrganisation(membership.organisation_id)}
                  >
                    Leave
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No organisation memberships.</p>
        )}
        {canManageOwnMemberships && (
          <button
            className="auth-submit"
            type="button"
            onClick={() => setShowJoinOrganisation(true)}
          >
            Join Organisation
          </button>
        )}
      </section>

      <section className="detail-section">
        <h2>Group memberships</h2>
        {groupMemberships?.length ? (
          <ul className="identity-link-list">
            {groupMemberships.map((membership) => (
              <li key={membership.id}>
                <Link className="identity-link" to={`/groups/${membership.group_id}`}>
                  {membership.group.name}
                </Link>{" "}
                · {membership.role} · {membership.status}
                {membership.group.organisation && (
                  <>
                    {" "}·{" "}
                    <Link className="identity-link" to={`/organisations/${membership.group.organisation.id}`}>
                      {membership.group.organisation.name}
                    </Link>
                  </>
                )}
                {canManageOwnMemberships &&
                  membership.status === "active" &&
                  membership.role !== "owner" && (
                    <button
                      className="admin-btn"
                      disabled={joining !== null}
                      onClick={() => void leaveGroup(membership.group_id)}
                    >
                      Leave
                    </button>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No group memberships.</p>
        )}
        {canManageOwnMemberships && (
          <button
            className="auth-submit"
            type="button"
            onClick={() => setShowJoinGroup(true)}
          >
            Join Group
          </button>
        )}
      </section>

      {showJoinOrganisation && (
        <div
          className="modal-overlay"
          onClick={closeOrganisationDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-org-title"
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-org-title">Join Organisation</h2>
              <button className="modal-close" onClick={closeOrganisationDialog} aria-label="Close">×</button>
            </header>
            <div className="modal-body">
              <form onSubmit={(event) => { event.preventDefault(); void joinOrganisation(); }}>
                {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
                <label className="auth-field" htmlFor="membership-organisation-id">
                  Organisation <span aria-hidden="true">*</span>
                  <select
                    id="membership-organisation-id"
                    required
                    value={organisationId}
                    onChange={(event) => setOrganisationId(event.target.value)}
                    disabled={joining !== null || organisationsLoading}
                  >
                    <option value="">Select organisation</option>
                    {organisationsLoading ? (
                      <option disabled>Loading organisations…</option>
                    ) : (
                      organisations.map((organisation) => (
                        <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
                      ))
                    )}
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="admin-btn" onClick={closeOrganisationDialog} disabled={joining !== null}>Cancel</button>
                  <button type="submit" className="auth-submit" disabled={joining !== null || !organisationId}>
                    {joining === "organisation" ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showJoinGroup && (
        <div
          className="modal-overlay"
          onClick={closeGroupDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-group-title"
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-group-title">Join Group</h2>
              <button className="modal-close" onClick={closeGroupDialog} aria-label="Close">×</button>
            </header>
            <div className="modal-body">
              <form onSubmit={(event) => { event.preventDefault(); void joinGroup(); }}>
                {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
                <label className="auth-field" htmlFor="membership-group-id">
                  Group <span aria-hidden="true">*</span>
                  <select
                    id="membership-group-id"
                    required
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                    disabled={joining !== null || groupsLoading}
                  >
                    <option value="">Select group</option>
                    {groupsLoading ? (
                      <option disabled>Loading groups…</option>
                    ) : (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))
                    )}
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="admin-btn" onClick={closeGroupDialog} disabled={joining !== null}>Cancel</button>
                  <button type="submit" className="auth-submit" disabled={joining !== null || !groupId}>
                    {joining === "group" ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}