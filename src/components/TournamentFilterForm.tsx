import type {
  PublicationState,
  TemporalStatus,
  TournamentFilters,
  TournamentOptions,
} from '../api';

const TEMPORAL_STATUSES: TemporalStatus[] = ['upcoming', 'ongoing', 'completed'];
const PUBLICATION_STATES: PublicationState[] = [
  'draft',
  'active',
  'cancelled',
  'archived',
];

interface TournamentFilterFormProps {
  filters: TournamentFilters;
  onChange: (filters: Partial<TournamentFilters>) => void;
  options?: TournamentOptions;
}

export default function TournamentFilterForm({
  filters,
  onChange,
  options,
}: TournamentFilterFormProps) {
  const handleChange = (
    field: keyof TournamentFilters,
    value: TournamentFilters[keyof TournamentFilters],
  ) => {
    onChange({
      ...(field === 'page' || field === 'per_page' ? { [field]: Number(value) } : { [field]: value }),
    });
  };

  return (
    <form className="filter-form" onSubmit={e => e.preventDefault()}>
      <div className="form-group">
        <label htmlFor="search">Search</label>
        <input
          type="text"
          id="search"
          value={filters.search || ''}
          onChange={e => handleChange('search', e.target.value || undefined)}
          placeholder="Search tournaments..."
        />
      </div>
      <div className="form-group">
        <label htmlFor="scope">Scope</label>
        <select
          id="scope"
          value={filters.scope || ''}
          onChange={e => handleChange('scope', e.target.value || undefined)}
        >
          <option value="">Any Scope</option>
          {options?.scopes?.map(scope => (
            <option key={scope} value={scope}>
              {scope}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="organisation_id">Organisation ID</label>
        <input
          type="number"
          id="organisation_id"
          value={filters.organisation_id ?? ''}
          onChange={e => {
            const val = e.target.value;
            handleChange('organisation_id', val || undefined);
          }}
          placeholder="Organisation ID"
        />
      </div>
      <div className="form-group">
        <label htmlFor="division_scheme">Division Scheme</label>
        <select
          id="division_scheme"
          value={filters.division_scheme || ''}
          onChange={e => handleChange('division_scheme', e.target.value || undefined)}
        >
          <option value="">Any Scheme</option>
          {options?.schemes.map(scheme => (
            <option key={scheme} value={scheme}>
              {scheme}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="location">Location</label>
        <input
          type="text"
          id="location"
          value={filters.location || ''}
          onChange={e => handleChange('location', e.target.value || undefined)}
          placeholder="Location"
        />
      </div>
      <div className="form-group">
        <label htmlFor="temporal_status">Temporal Status</label>
        <select
          id="temporal_status"
          value={filters.temporal_status || ''}
          onChange={e => handleChange('temporal_status', e.target.value || undefined)}
        >
          <option value="">Any Status</option>
          {TEMPORAL_STATUSES.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={filters.mine === true}
            onChange={e => handleChange('mine', e.target.checked)}
          />
          My Tournaments
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="publication_state">Publication State</label>
        <select
          id="publication_state"
          value={filters.publication_state || ''}
          onChange={e => handleChange('publication_state', e.target.value || undefined)}
        >
          <option value="">Any State</option>
          {PUBLICATION_STATES.map(state => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="starts_at">Starts At</label>
        <input
          type="date"
          id="starts_at"
          value={filters.starts_at || ''}
          onChange={e => handleChange('starts_at', e.target.value || undefined)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="ends_at">Ends At</label>
        <input
          type="date"
          id="ends_at"
          value={filters.ends_at || ''}
          onChange={e => handleChange('ends_at', e.target.value || undefined)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="page">Page</label>
        <input
          type="number"
          id="page"
          min="1"
          value={filters.page ?? 1}
          onChange={e => {
            const val = e.target.value;
            handleChange('page', val ? Number(val) : undefined);
          }}
        />
      </div>
      <div className="form-group">
        <label htmlFor="per_page">Per Page</label>
        <select
          id="per_page"
          value={filters.per_page?.toString() || ''}
          onChange={e => handleChange('per_page', Number(e.target.value))}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Apply Filters
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onChange({})}
        >
          Reset
        </button>
      </div>
    </form>
  );
}