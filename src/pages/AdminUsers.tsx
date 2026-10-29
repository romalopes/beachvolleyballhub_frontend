import { useEffect, useState } from "react";
import {
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, type AdminUser, type PaginationMeta } from "../api";
import { useAuth } from "../auth/AuthContext";
import AdminUserRoleControls from "../components/AdminUserRoleControls";
import LibraryHero from "../components/LibraryHero";
import Pagination from "../components/settings/Pagination";

const PER_PAGE = 20;

export default function AdminUsers() {
  const { user } = useAuth();
  const isAdmin =
    user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });

  // Which query the rows on screen belong to. While a newer query is in flight
  // the keys differ, so `loading` is derived from them instead of being synced
  // by an effect (which would cascade a second render on every change).
  const queryKey = `${page}|${search}|${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = isAdmin && loadedKey !== queryKey;

  // The query the effect below re-runs on: `page`/`search` define it, and
  // bumping `refreshKey` is the manual "reload" trigger (Refresh, role change).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .adminUsers({ page, per_page: PER_PAGE, search: search || undefined })
      .then((response) => {
        if (cancelled) return;
        setUsers(response.data);
        setMeta(response.meta);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load users.");
      })
      .finally(() => {
        if (cancelled) return;
        // Either way this query has been answered: stop showing the loading state.
        setLoadedKey(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, page, search, refreshKey, queryKey]);

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);
    setCreateUserSuccess(false);
    setCreatingUser(true);

    try {
      const data = {
        email_address: createUserData.email,
        password: createUserData.password,
        first_name: createUserData.first_name || undefined,
        last_name: createUserData.last_name || undefined,
      };

      await api.adminCreateUser(data);
      setCreateUserSuccess(true);
      setCreateUserModal(false);
      setRefreshKey((k) => k + 1); // Refresh the user list
    } catch (err: unknown) {
      setCreateUserError(
        err instanceof Error ? err.message : "Failed to create user",
      );
    } finally {
      setCreatingUser(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <LibraryHero
        eyebrow="Administration"
        title="Users"
        description="Manage roles for every account in the system."
        highlights={[
          { icon: Users, label: "Every account" },
          { icon: ShieldCheck, label: "Assign roles" },
          { icon: Search, label: "Find anyone" },
        ]}
        highlightsLabel="User administration features"
        theme="library-hero--admin"
      />

      <form
        onSubmit={applySearch}
        style={{ margin: "0 0 16px", display: "flex", gap: 8, maxWidth: 480 }}
      >
        <div style={{ flex: 1 }}>
          <label
            htmlFor="users-search"
            className="admin-table-name"
            style={{ display: "block", fontWeight: "normal" }}
          >
            Search by name or email
          </label>
          <input
            id="users-search"
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="e.g. Anderson or test.beachvolleyballhub.com"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="submit"
            className="admin-btn admin-btn-add"
            disabled={loading}
          >
            Search
          </button>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => setCreateUserModal(true)}
          disabled={loading}
        >
          Create User
        </button>
      </form>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {createUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <h3 id="create-user-title" className="text-lg font-medium mb-4">
              Create New User
            </h3>
            {createUserSuccess ? (
              <div className="bg-green-100 text-green-800 p-3 rounded mb-4">
                User created successfully!
              </div>
            ) : (
              <form
                onSubmit={(e) => handleCreateUser(e)}
                className="space-y-4"
                style={{ display: "iflex", gap: 4 }}
              >
                {createUserError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {createUserError}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="create-user-email"
                    className="block text-sm font-medium mb-2"
                  >
                    Email address
                  </label>
                  <input
                    id="create-user-email"
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={createUserData.email}
                    onChange={(e) =>
                      setCreateUserData({ ...createUserData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-user-password"
                    className="block text-sm font-medium mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="create-user-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={createUserData.password}
                    onChange={(e) =>
                      setCreateUserData({ ...createUserData, password: e.target.value })
                    }
                  />
                  <p className="text-sm text-gray-500">
                    Minimum 8 characters
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="create-user-first-name"
                    className="block text-sm font-medium mb-2"
                  >
                    First name (optional)
                  </label>
                  <input
                    id="create-user-first-name"
                    placeholder="John"
                    value={createUserData.first_name || ""}
                    onChange={(e) =>
                      setCreateUserData({
                        ...createUserData,
                        first_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-user-last-name"
                    className="block text-sm font-medium mb-2"
                  >
                    Last name (optional)
                  </label>
                  <input
                    id="create-user-last-name"
                    placeholder="Doe"
                    value={createUserData.last_name || ""}
                    onChange={(e) =>
                      setCreateUserData({
                        ...createUserData,
                        last_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary flex-1"
                    disabled={creatingUser}
                  >
                    {creatingUser ? "Creating..." : "Create User"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline flex-1"
                    onClick={() => setCreateUserModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <button
              type="button"
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              onClick={() => setCreateUserModal(false)}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : ""}

      {loading ? (
        <p>Loading users…</p>
      ) : !users ? (
        <p>No users found.</p>
      ) : (
        <div className="admin-users">
          {users.map((u) => (
            <AdminUserRoleControls
              key={u.id}
              adminUser={u}
              onError={(message) => setError(message || null)}
              onRoleChange={() => {
                setLoadedKey(null);
                setRefreshKey((k) => k + 1);
              }}
              onDelete={() => {
                setLoadedKey(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          ))}
        </div>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={(next) => {
            if (next === page) return;
            setError(null);
            setPage(next);
          }}
        />
      )}

      <button
        type="button"
        className="admin-btn admin-btn-add"
        onClick={() => {
          setError(null);
          setPage(1);
          setRefreshKey((k) => k + 1);
        }}
        disabled={loading}
      >
        Refresh
      </button>
    </div>
  );
}
