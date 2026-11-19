import { IconAlertCircle, IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons-react';
import { useRef } from 'react';
import { initials } from '../lib/format';

// Small building blocks shared by Billsy's screens.

/** A field message under its input, linked with aria-describedby. */
export function FieldError({ id, message }) {
  if (!message) {
    return null;
  }
  return (
    <div className="ferr" id={id}>
      <IconAlertCircle size={15} aria-hidden="true" /> {message}
    </div>
  );
}

export function Hint({ id, children }) {
  return (
    <div className="hint" id={id}>
      {children}
    </div>
  );
}

/** A wide table in a box that scrolls sideways: a focusable, labelled region (keyboard users can scroll it). */
export function TableRegion({ label, children }) {
  return (
    <div className="tablewrap" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

/** The search box style from the design (a label wrapping an icon and the input). */
export function SearchBox({ label, placeholder, value, onChange, width = 260 }) {
  return (
    <label className="search" style={{ width }}>
      <IconSearch size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input type="search" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/**
 * Tabs or a radio group in the segmented style. kind 'tab' gives role="tablist" + role="tab"
 * (aria-selected); kind 'radio' gives role="radiogroup" + role="radio" (aria-checked).
 * Arrow keys move between the options.
 */
export function Segmented({ label, options, value, onChange, kind = 'tab' }) {
  const refs = useRef([]);
  const selectedKey = kind === 'tab' ? 'aria-selected' : 'aria-checked';

  function onKeyDown(event, index) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="seg" role={kind === 'tab' ? 'tablist' : 'radiogroup'} aria-label={label}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role={kind}
            {...{ [selectedKey]: selected }}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
            {option.count !== undefined ? <span className="mono">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** "Showing 1–20 of 42" with previous and next page buttons. */
export function Pager({ page, size, totalItems, totalPages, onPage }) {
  if (!totalItems) {
    return null;
  }
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, totalItems);
  return (
    <div className="pager">
      <span className="grow">
        Showing {first}–{last} of {totalItems}
      </span>
      <span>{size} per page</span>
      <button type="button" className="icon-btn" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}>
        <IconChevronLeft size={17} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" disabled={page >= totalPages} aria-label="Next page" onClick={() => onPage(page + 1)}>
        <IconChevronRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The business's letter tile: the uploaded logo, or the initials on ink. */
export function BusinessTile({ name, logoUrl, size = 30 }) {
  return (
    <span className="lg" style={{ width: size, height: size, fontSize: size < 36 ? 11 : 14 }} aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt="" /> : initials(name)}
    </span>
  );
}
