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
import OrganisationSelect from "./OrganisationSelect";

interface MembershipSectionsProps {
  organisationMemberships?: OrganisationMembership[];
  groupMemberships?: UserGroupMembership[];
  /** Enables self-service controls for the authenticated account only. */
  canManageOwnMemberships?: boolean;
  /** Lets the profile's recorded creator manage that exact profile's memberships. */
  managedProfile?: { type: "PlayerProfile" | "CoachProfile"; id: number };
  /** Called after a successful self-service membership change. */
  onMembershipsChanged?: () => void;
}

/** Shared membership lists, with optional controls for the signed-in account. */
export default function MembershipSections({
  organisationMemberships,
  groupMemberships,
  canManageOwnMemberships = false,
  managedProfile,
  onMembershipsChanged,
}: MembershipSectionsProps) {
  const [showJoinOrganisation, setShowJoinOrganisation] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [organisationsError, setOrganisationsError] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupId, setGroupId] = useState("");
  const [joining, setJoining] = useState<"organisation" | "group" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showJoinOrganisation) return;
    let cancelled = false;

    const loadOrganisations = async () => {
      setOrganisationsLoading(true);
      setOrganisationsError(null);
      try {
        const organisationResponse = await api.organisations("active", undefined, false, false);
        if (cancelled) return;
        const organisationData =
          (organisationResponse as PaginatedResponse<Organisation>).data ?? organisationResponse;
        setOrganisations(Array.isArray(organisationData) ? organisationData : []);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load organisations", loadError);
          setOrganisations([]);
          setOrganisationsError("Could not load organisations. Please try again.");
        }
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };

    void loadOrganisations();
    return () => {
      cancelled = true;
    };
  }, [showJoinOrganisation]);

  useEffect(() => {
    if (!showJoinGroup) return;
    let cancelled = false;

    const loadGroups = async () => {
      setGroupsLoading(true);
      setGroupsError(null);
      try {
        const groupResponse = await api.groups(
          managedProfile
            ? { status: "active", mine: false }
            : { status: "active", joinable: true },
        );
        if (cancelled) return;
        const groupData = (groupResponse as PaginatedResponse<Group>).data ?? groupResponse;
        setGroups(Array.isArray(groupData) ? groupData : []);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load groups", loadError);
          setGroups([]);
          setGroupsError("Could not load groups. Please try again.");
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [managedProfile, showJoinGroup]);

  const notifyChanged = () => onMembershipsChanged?.();

  const closeOrganisationDialog = () => {
    setShowJoinOrganisation(false);
    setOrganisationId("");
    setOrganisationsError(null);
    setError(null);
  };

  const closeGroupDialog = () => {
    setShowJoinGroup(false);
    setGroupId("");
    setGroupSearchTerm("");
    setGroupsError(null);
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
      if (managedProfile) {
        await api.addProfileToOrganisation(id, managedProfile);
      } else {
        await api.joinOrganisation(id);
      }
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
      if (managedProfile) {
        await api.addProfileToGroup(id, managedProfile);
      } else {
        await api.joinGroup(id);
      }
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
      if (managedProfile) {
        await api.removeProfileFromOrganisation(id, managedProfile);
      } else {
        await api.leaveOrganisation(id);
      }
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
      if (managedProfile) {
        await api.removeProfileFromGroup(id, managedProfile);
      } else {
        await api.leaveGroup(id);
      }
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
                <Link className="identity-link" to={`/organisations/${membership.organisation?.slug ?? membership.organisation_id}`}>
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
                    <Link className="identity-link" to={`/organisations/${membership.group.organisation.slug ?? membership.group.organisation.id}`}>
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
                <label className="auth-field" htmlFor="membership-organisation-search">
                  Organisation <span aria-hidden="true">*</span>
                  {organisationsLoading ? (
                    <p className="membership-selector-status" role="status">Loading organisations…</p>
                  ) : organisationsError ? (
                    <p className="membership-selector-status membership-selector-error" role="alert">
                      {organisationsError}
                    </p>
                  ) : (
                    <OrganisationSelect
                      id="membership-organisation-search"
                      organisations={organisations}
                      value={organisationId}
                      onChange={setOrganisationId}
                      disabled={joining !== null}
                    />
                  )}
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
                <label className="auth-field" htmlFor="membership-group-search">
                  Group <span aria-hidden="true">*</span>
                  <div className="organisation-search-wrapper">
                    <input
                      type="text"
                      id="membership-group-search"
                      placeholder="Search group..."
                      value={groupSearchTerm}
                      onChange={(e) => setGroupSearchTerm(e.target.value)}
                      disabled={joining !== null || groupsLoading}
                      aria-label="Search group"
                    />
                    {groupsLoading ? (
                      <div className="organisation-search-results">
                        <p>Loading groups…</p>
                      </div>
                    ) : groupsError ? (
                      <p className="membership-selector-status membership-selector-error" role="alert">
                        {groupsError}
                      </p>
                    ) : groups.length > 0 ? (
                      <div
                        className="organisation-search-results"
                        role="listbox"
                        aria-label="Group search results"
                      >
                        {groups
                          .filter((group) =>
                            group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
                          )
                          .map((group) => (
                            <div
                              key={group.id}
                              role="option"
                              onClick={() => {
                                setGroupId(String(group.id));
                                setGroupSearchTerm("");
                              }}
                            >
                              {group.name} ({group.player_count})
                              {group.organisation ? ` — ${group.organisation.name}` : ""}
                            </div>
                          ))}
                        {!groups.some((group) =>
                          group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
                        ) ? (
                          <div role="option" aria-label="No groups found">
                            No groups found
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="no-orgs-hint">
                        No groups available
                      </p>
                    )}
                  </div>
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