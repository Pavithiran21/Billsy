import { api, refreshSession } from '../app/api';
import { signedOut } from './authActions';

// Start-up: one refresh with the cookie. StrictMode runs effects twice in development, so the
// promise is kept and shared; refreshSession itself also never runs two refreshes at once.
let startup = null;

export function restoreSession() {
  return (dispatch) => {
    if (!startup) {
      startup = refreshSession(dispatch).then((session) => {
        if (!session) {
          dispatch(signedOut());
        }
      });
    }
    return startup;
  };
}

/** Logs out: the server forgets the refresh token, and the cached data of this person is dropped. */
export function logOut() {
  return async (dispatch) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Logged out locally either way; the cookie expires on its own.
    }
    dispatch(signedOut());
    dispatch(api.util.resetApiState());
  };
}

/**
 * Forgets the session in this browser when the server has already ended it: after the account is
 * deleted, or after a password reset (which ends every session of the account).
 */
export function clearSession() {
  return (dispatch) => {
    dispatch(signedOut());
    dispatch(api.util.resetApiState());
  };
}
