import { useId, useState } from 'react';

/**
 * A text input with a list of suggestions (WAI-ARIA combobox with a listbox): the customer picker
 * and the product picker on invoice lines. The parent owns the text and the options (it searches
 * the API); this component handles opening, the highlighted option and the keys:
 * ArrowDown / ArrowUp move, Enter picks, Escape closes.
 *
 * options: [{ id, label, detail }]; onPick(option) is called with the chosen one.
 */
export function Combobox({
  id,
  label,
  hideLabel = false,
  value,
  onTextChange,
  options,
  onPick,
  loading = false,
  emptyText = 'No matches',
  inputProps = {},
  className = 'inp',
  placeholder,
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const showList = open && (options.length > 0 || (value?.trim() && !loading));

  function pick(option) {
    onPick(option);
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault();
      pick(options[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="combo">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        className={className}
        role="combobox"
        autoComplete="off"
        placeholder={placeholder}
        aria-expanded={showList ? 'true' : 'false'}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(event) => {
          onTextChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Close after a click on an option has been handled.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul className="combo-list" id={listId} role="listbox" aria-label={label}>
          {options.length === 0 ? (
            <li className="empty" role="option" aria-selected="false" aria-disabled="true">
              {emptyText}
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(index)}
              >
                <b>{option.label}</b> {option.detail ? <span className="mono xs muted">{option.detail}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
