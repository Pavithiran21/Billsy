import { createAction } from '@reduxjs/toolkit';

// Plain actions shared by the auth slice and the API layer. They live in their own file so that
// app/api.js can dispatch them without importing the slice (which imports the API: a cycle).

/** A log-in, sign-up, invitation, demo log-in or refresh succeeded: { user, membership, accessToken }. */
export const sessionStarted = createAction('auth/sessionStarted');

/** The account changed (name, left the business, business deactivated...): { user, membership }. */
export const accountUpdated = createAction('auth/accountUpdated');

/** A new access token without a new account (after Change password). */
export const tokenReplaced = createAction('auth/tokenReplaced');

/** No valid session (start-up without a cookie, log out, account deleted). */
export const signedOut = createAction('auth/signedOut');

/**
 * A logged-in request got 401 and the refresh failed too, or the business was deactivated:
 * { reason: 'expired' | 'deactivated', message }. The Log in page explains it.
 */
export const sessionEnded = createAction('auth/sessionEnded');
