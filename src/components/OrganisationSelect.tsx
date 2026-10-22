import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Organisation } from "../api";

interface OrganisationSelectProps {
  organisations: Organisation[];
  value: string;
  onChange: (organisationId: string) => void;
  id: string;
  disabled?: boolean;
  placeholder?: string;
}

/** Searchable single-organisation combobox for forms that persist one ID. */
export default function OrganisationSelect({
  organisations,
  value,
  onChange,
  id,
  disabled = false,
  placeholder = "Search organisation…",
}: OrganisationSelectProps) {
  const listboxId = `${id}-options`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => organisations.find(organisation => String(organisation.id) === value),
    [organisations, value],
  );
  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return organisations.filter(organisation =>
      !needle
      || organisation.name.toLocaleLowerCase().includes(needle)
      || organisation.acronym?.toLocaleLowerCase().includes(needle),
    );
  }, [organisations, query]);

  const select = (organisation: Organisation) => {
    onChange(String(organisation.id));
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };

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
      select(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="organisation-multi-select membership-organisation-select">
      {selected && (
        <div className="organisation-multi-select-selected" aria-label="Selected organisation">
          <span className="organisation-multi-select-chip">
            <span>{selected.name}</span>
            <button
              type="button"
              onClick={clear}
              aria-label={`Remove ${selected.name}`}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        </div>
      )}
      <div className="organisation-multi-select-input-wrap">
        <input
          id={id}
          type="search"
          value={query}
          placeholder={selected ? "Choose another organisation…" : placeholder}
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && suggestions[activeIndex]
            ? `${id}-option-${suggestions[activeIndex].id}`
            : undefined}
          onChange={event => {
            setQuery(event.target.value);
            if (value) onChange("");
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <ul
            className="organisation-multi-select-options"
            id={listboxId}
            role="listbox"
            aria-label="Organisation search results"
          >
            {suggestions.length > 0 ? suggestions.map((organisation, index) => (
              <li key={organisation.id}>
                <button
                  id={`${id}-option-${organisation.id}`}
                  type="button"
                  role="option"
                  aria-selected={String(organisation.id) === value}
                  className={index === activeIndex ? "active" : undefined}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => select(organisation)}
                >
                  <span>{`${"  ".repeat(organisation.depth ?? 0)}${organisation.name}`}</span>
                  {organisation.acronym && <small>{organisation.acronym}</small>}
                </button>
              </li>
            )) : (
              <li className="organisation-multi-select-empty">
                {query.trim()
                  ? `No organisations match “${query.trim()}”.`
                  : "No active organisations are available."}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}