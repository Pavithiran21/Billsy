import { useEffect, useRef, useState } from 'react';
import { SearchBox } from './Controls';

/**
 * A list's search box bound to the URL (?q=). It keeps what is typed and calls onSearch 300 ms
 * after the last key, so the list isn't refetched on every keystroke. If the URL changes from
 * elsewhere (the top search box), the text follows it.
 */
export function ListSearch({ label, placeholder, value, onSearch, width }) {
  const [text, setText] = useState(value);
  const [shownValue, setShownValue] = useState(value);
  const timer = useRef(null);

  // The URL changed without this box (Back, or the top search): show the new search.
  if (value !== shownValue) {
    setShownValue(value);
    setText(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), 300);
  }

  return <SearchBox label={label} placeholder={placeholder} value={text} onChange={change} width={width} />;
}
