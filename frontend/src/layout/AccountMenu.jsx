import { IconDots, IconLogout, IconUser } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { logOut } from '../auth/authThunks';

/** The "…" button at the bottom of the sidebar: Profile and Log out (role="menu", Esc closes). */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    firstItemRef.current?.focus();
    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        style={{ width: 30, height: 30 }}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconDots size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="me-menu" role="menu" aria-label="Account">
          <li role="none">
            <Link ref={firstItemRef} role="menuitem" to="/profile" onClick={() => setOpen(false)}>
              <IconUser size={16} aria-hidden="true" /> Profile
            </Link>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => dispatch(logOut())}>
              <IconLogout size={16} aria-hidden="true" /> Log out
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
