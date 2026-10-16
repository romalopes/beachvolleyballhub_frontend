import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Organisation } from "../api";

interface OrganisationMultiSelectProps {
  organisations: Organisation[];
  value: string[];
  onChange: (organisationIds: string[]) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Controlled search-and-add picker for selecting one or more organisations.
 *
 * Callers own loading and persistence so this component can be reused in forms,
 * filters, and other contexts with different organisation visibility rules.
 */
export default function OrganisationMultiSelect({
  organisations,
  value,
  onChange,
  id,
  label = "Organisations",
  placeholder = "Search and add organisations…",
  disabled = false,
}: OrganisationMultiSelectProps) {
  const generatedId = useId();
  const inputId = id ?? `organisation-multi-select-${generatedId}`;
  const listboxId = `${inputId}-options`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIds = useMemo(() => new Set(value), [value]);
  const selected = useMemo(
    () => value.map(selectedId => organisations.find(organisation => String(organisation.id) === selectedId))
      .filter((organisation): organisation is Organisation => Boolean(organisation)),
    [organisations, value],
  );
  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return organisations.filter(organisation => {
      if (selectedIds.has(String(organisation.id))) return false;
      return !needle
        || organisation.name.toLocaleLowerCase().includes(needle)
        || organisation.acronym?.toLocaleLowerCase().includes(needle);
    });
  }, [organisations, query, selectedIds]);

  const add = (organisation: Organisation) => {
    const organisationId = String(organisation.id);
    if (!selectedIds.has(organisationId)) onChange([...value, organisationId]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };

  const remove = (organisationId: string) => onChange(value.filter(idValue => idValue !== organisationId));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => Math.min(current + 1, Math.max(suggestions.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && suggestions[activeIndex]) {
      event.preventDefault();
      add(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="organisation-multi-select">
      <label htmlFor={inputId}>{label}</label>
      {selected.length > 0 && (
        <div className="organisation-multi-select-selected" aria-label={`Selected ${label.toLowerCase()}`}>
          {selected.map(organisation => (
            <span className="organisation-multi-select-chip" key={organisation.id}>
              <span>{organisation.name}</span>
              <button
                type="button"
                onClick={() => remove(String(organisation.id))}
                aria-label={`Remove ${organisation.name}`}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="organisation-multi-select-clear"
            onClick={() => onChange([])}
            disabled={disabled}
          >
            Clear all
          </button>
        </div>
      )}
      <div className="organisation-multi-select-input-wrap">
        <input
          id={inputId}
          type="text"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && suggestions[activeIndex] ? `${inputId}-option-${suggestions[activeIndex].id}` : undefined}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <ul className="organisation-multi-select-options" id={listboxId} role="listbox" aria-label={`${label} search results`}>
            {suggestions.length > 0 ? suggestions.map((organisation, index) => (
              <li key={organisation.id}>
                <button
                  id={`${inputId}-option-${organisation.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "active" : undefined}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => add(organisation)}
                >
                  <span>{`${"  ".repeat(organisation.depth)}${organisation.name}`}</span>
                  {organisation.acronym && <small>{organisation.acronym}</small>}
                </button>
              </li>
            )) : <li className="organisation-multi-select-empty">No organisations found.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}