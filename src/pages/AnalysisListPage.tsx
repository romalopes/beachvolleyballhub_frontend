import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight,
  CirclePlay, Filter, Layers3, Plus, RotateCcw, Search, Users, Video, X,
} from "lucide-react";
import {
  api,
  type AnalysisStatus,
  type AnalysisSummary,
  type Group as GroupRecord,
  type Organisation,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";

const PER_PAGE = 12;
const STATUS_OPTIONS: { value: AnalysisStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function StatusBadge({ status }: { status: AnalysisStatus }) {
  return <span className={`analysis-status-badge status-${status}`}><span className="analysis-status-dot" aria-hidden="true" />{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function formatUpdated(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}`;
}

function AnalysisListSkeleton() {
  return <div className="analysis-library-grid" aria-label="Loading analyses">{Array.from({ length: 6 }, (_, index) => <div key={index} className="analysis-library-card analysis-library-skeleton"><span /><span /><span /><span /></div>)}</div>;
}

function AnalysisSearch({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(query);
  return <form className="analysis-library-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()); }}>
    <Search size={17} aria-hidden="true" />
    <input type="search" aria-label="Search analyses" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search analyses…" />
    {draft && <button type="button" aria-label="Clear search" onClick={() => { setDraft(""); onSearch(""); }}><X size={15} /></button>}
    <button type="submit">Search</button>
  </form>;
}

export default function AnalysisListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [meta, setMeta] = useState<{ page: number; per_page: number; total_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = useMemo(() => {
    const value = searchParams.get("status");
    return value === "draft" || value === "published" || value === "archived" ? value : null;
  }, [searchParams]);
  const query = searchParams.get("q") ?? "";
  const organisationId = searchParams.get("organisation_id") ?? "";
  const groupId = searchParams.get("group_id") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const canCreate = Boolean(user?.roles?.some((role) => role === "admin" || role === "coach" || role === "curator"));
  const activeFilterCount = [query, statusFilter, organisationId, groupId].filter(Boolean).length;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total_count / meta.per_page)) : 1;

  const filteredGroups = useMemo(
    () => groups.filter((group) => !organisationId || group.organisation?.id === Number(organisationId)),
    [groups, organisationId],
  );

  const updateFilters = useCallback((updates: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.analyses({
      status: statusFilter ?? undefined,
      organisation_id: organisationId ? Number(organisationId) : undefined,
      group_id: groupId ? Number(groupId) : undefined,
      q: query || undefined,
      page,
      per_page: PER_PAGE,
    }).then((result) => {
      setAnalyses(result.data);
      setMeta(result.meta);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Failed to load analyses.");
    }).finally(() => setLoading(false));
  }, [groupId, organisationId, page, query, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.organisations("active"),
      api.groups({ status: "active", include_private: true }),
    ]).then(([organisationPage, groupPage]) => {
      if (cancelled) return;
      setOrganisations(organisationPage.data);
      setGroups(groupPage.data);
    }).catch(() => {
      // The list remains useful without optional filter metadata.
    });
    return () => { cancelled = true; };
  }, []);

  // This effect intentionally starts a remote-data request whenever URL filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const firstShown = meta && meta.total_count > 0 ? (page - 1) * meta.per_page + 1 : 0;
  const lastShown = meta ? Math.min(page * meta.per_page, meta.total_count) : 0;

  return (
    <div className="page analysis-page analysis-library-page">
      <header className="analysis-library-hero">
        <div className="analysis-library-hero-copy">
          <span className="analysis-eyebrow">Coaching workspace</span>
          <h1>Video analysis</h1>
          <p>Turn match and training footage into focused feedback your players can revisit.</p>
          <div className="analysis-library-highlights" aria-label="Analysis workflow">
            <span><Video size={14} /> Review footage</span>
            <span><CirclePlay size={14} /> Mark key moments</span>
            <span><Users size={14} /> Discuss with players</span>
          </div>
        </div>
        {canCreate && <Link to="/analyses/new" className="btn-primary analysis-library-create"><Plus size={17} /> New analysis</Link>}
      </header>

      <section className="analysis-library-toolbar" aria-label="Analysis filters">
        <div className="analysis-status-tabs" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((option) => <button key={option.value || "all"} type="button" className={(statusFilter ?? "") === option.value ? "active" : ""} aria-pressed={(statusFilter ?? "") === option.value} onClick={() => updateFilters({ status: option.value || null })}>{option.label}</button>)}
        </div>
        <AnalysisSearch key={query} query={query} onSearch={(value) => updateFilters({ q: value || null })} />
        <div className="analysis-library-selects">
          <label><Building2 size={15} /><span>Organisation</span><select aria-label="Filter by organisation" value={organisationId} onChange={(event) => updateFilters({ organisation_id: event.target.value || null, group_id: null })}><option value="">All organisations</option>{organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}</select></label>
          <label><Layers3 size={15} /><span>Group</span><select aria-label="Filter by group" value={groupId} onChange={(event) => updateFilters({ group_id: event.target.value || null })}><option value="">All groups</option>{filteredGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        </div>
        {activeFilterCount > 0 && <button type="button" className="analysis-clear-filters" onClick={clearFilters}><RotateCcw size={14} /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</button>}
      </section>

      <div className="analysis-library-heading">
        <div><h2>{statusFilter ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} analyses` : "All analyses"}</h2><p>{loading ? "Loading your analysis workspace…" : meta ? `${meta.total_count} result${meta.total_count === 1 ? "" : "s"}${query ? ` for “${query}”` : ""}` : "Your visible analyses"}</p></div>
        {activeFilterCount > 0 && <span className="analysis-filter-indicator"><Filter size={14} /> Filtered view</span>}
      </div>

      {loading ? <AnalysisListSkeleton /> : error ? (
        <div className="analysis-library-error"><div><h2>We couldn’t load your analyses</h2><p>{error}</p></div><button type="button" className="btn-outline" onClick={load}><RotateCcw size={15} /> Try again</button></div>
      ) : analyses.length === 0 ? (
        <EmptyState
          title={activeFilterCount > 0 ? "No analyses match these filters" : "Your analysis workspace is ready"}
          description={activeFilterCount > 0 ? "Clear a filter or try a different search to find what you need." : "Create your first analysis, add footage, and share timestamped feedback with your players."}
          action={activeFilterCount > 0 ? <button type="button" className="btn-outline" onClick={clearFilters}><RotateCcw size={15} /> Clear filters</button> : canCreate ? <Link to="/analyses/new" className="btn-primary"><Plus size={16} /> Create analysis</Link> : undefined}
        />
      ) : (
        <>
          <div className="analysis-library-grid">
            {analyses.map((analysis) => {
              const context = analysis.training_session?.title || analysis.tournament?.name || analysis.group?.name || analysis.organisation?.name;
              const participants = analysis.participants.slice(0, 3);
              return <article key={analysis.id} className="analysis-library-card">
                <Link to={`/analyses/${analysis.id}`} className="analysis-library-card-link" aria-label={`Open ${analysis.title}`} />
                <div className="analysis-library-card-top"><StatusBadge status={analysis.status} /><span>{formatUpdated(analysis.updated_at)}</span></div>
                <div className="analysis-library-card-copy"><h3>{analysis.title}</h3><p>{analysis.summary || "No summary has been added to this analysis yet."}</p></div>
                {context && <div className="analysis-library-context">{analysis.training_session ? <CalendarDays size={14} /> : analysis.tournament ? <CirclePlay size={14} /> : analysis.group ? <Layers3 size={14} /> : <Building2 size={14} />}<span>{context}</span></div>}
                <div className="analysis-library-metrics"><span><Video size={15} /><strong>{analysis.video_count}</strong> video{analysis.video_count === 1 ? "" : "s"}</span><span><Users size={15} /><strong>{analysis.participants.length}</strong> player{analysis.participants.length === 1 ? "" : "s"}</span></div>
                <div className="analysis-library-card-footer">
                  <div className="analysis-library-owner"><span className="analysis-avatar analysis-avatar-small" aria-hidden="true">{analysis.created_by.name.charAt(0).toUpperCase()}</span><span><small>Created by</small><strong>{analysis.created_by.name}</strong></span></div>
                  <div className="analysis-library-participants" aria-label={`${analysis.participants.length} participants`}>{participants.map((participant) => <span key={participant.id} className="analysis-avatar analysis-avatar-small" title={participant.name}>{participant.name.charAt(0).toUpperCase()}</span>)}{analysis.participants.length > 3 && <span className="analysis-avatar analysis-avatar-small analysis-avatar-more">+{analysis.participants.length - 3}</span>}</div>
                  <ArrowRight className="analysis-library-arrow" size={18} aria-hidden="true" />
                </div>
              </article>;
            })}
          </div>

          {meta && <nav className="analysis-library-pagination" aria-label="Analysis pages"><p>Showing <strong>{firstShown}–{lastShown}</strong> of <strong>{meta.total_count}</strong></p><div><button type="button" className="btn-outline" disabled={page <= 1} onClick={() => updateFilters({ page: String(page - 1) }, false)}><ChevronLeft size={15} /> Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="btn-outline" disabled={page >= totalPages} onClick={() => updateFilters({ page: String(page + 1) }, false)}>Next <ChevronRight size={15} /></button></div></nav>}
        </>
      )}
    </div>
  );
}