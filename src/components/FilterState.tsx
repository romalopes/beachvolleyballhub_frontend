import type { Organisation, TournamentFilters } from '../api';

interface FilterStateProps {
  filters: TournamentFilters;
  onReset: () => void;
  organisations?: Organisation[];
}

export default function FilterState({ filters, onReset, organisations }: FilterStateProps) {
  const activeFilters: Array<{ label: string; value: string }> = [];
  const orgById = new Map((organisations ?? []).map(organisation => [organisation.id, organisation.name]));
  const orgName = (id: number | string) => orgById.get(Number(id)) ?? String(id);

  if (filters.search) {
    activeFilters.push({ label: 'Search', value: filters.search });
  }
  if (filters.scope) {
    activeFilters.push({ label: 'Scope', value: filters.scope });
  }
  if (filters.organisation_ids?.length) {
    activeFilters.push({ label: 'Organisations', value: filters.organisation_ids.map(orgName).join(', ') });
  } else if (filters.organisation_id) {
    activeFilters.push({ label: 'Organisation', value: orgName(filters.organisation_id) });
  }
  if (filters.division_scheme) {
    activeFilters.push({ label: 'Division Scheme', value: filters.division_scheme });
  }
  if (filters.letter_levels?.length) {
    activeFilters.push({ label: 'Letter Levels', value: filters.letter_levels.join(', ') });
  }
  if (filters.division_numbers?.length) {
    activeFilters.push({ label: 'Division Numbers', value: filters.division_numbers.join(', ') });
  }
  if (filters.location) {
    activeFilters.push({ label: 'Location', value: filters.location });
  }
  if (filters.temporal_status) {
    activeFilters.push({ label: 'Temporal Status', value: filters.temporal_status });
  }
  if (filters.mine) {
    activeFilters.push({ label: 'My Tournaments', value: 'Yes' });
  }
  if (filters.publication_state) {
    activeFilters.push({ label: 'Publication State', value: filters.publication_state });
  }
  if (filters.starts_at) {
    activeFilters.push({ label: 'Starts At', value: filters.starts_at });
  }
  if (filters.ends_at) {
    activeFilters.push({ label: 'Ends At', value: filters.ends_at });
  }
  if (filters.page !== undefined && filters.page !== 1) {
    activeFilters.push({ label: 'Page', value: String(filters.page) });
  }
  if (filters.per_page !== undefined && filters.per_page !== 25) {
    activeFilters.push({ label: 'Per Page', value: String(filters.per_page) });
  }

  if (activeFilters.length === 0) {
    return <p className="text-muted">No active filters</p>;
  }

  return (
    <div className="filter-state">
      <h4 className="font-semibold mb-2">Active Filters:</h4>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter, index) => (
          <span key={index} className="filter-chip">
            <span className="filter-label">{filter.label}:</span>
            <span className="filter-value">{filter.value}</span>
            <button
              className="filter-remove"
              onClick={(e) => {
                e.stopPropagation();
                // We could implement removing a specific filter, but for simplicity we reset all
                onReset();
              }}
              title="Remove filter"
            >
              ×
            </button>
          </span>
        ))}
        <button className="reset-all-btn" onClick={onReset}>
          Clear All Filters
        </button>
      </div>
    </div>
  );
}