import { createApi } from '@reduxjs/toolkit/query/react';
import { accountUpdated, sessionEnded, sessionStarted } from '../auth/authActions';

// The one place that talks to the backend. Every call goes to /api on the same origin (Vite forwards
// it to the backend), so the HTTP-only refresh cookie billsy_refresh (path /api/auth) is sent with
// POST /auth/refresh. The access token lives only in Redux state (memory), never in localStorage.

const BASE_URL = '/api';

const NETWORK_MESSAGE = "Couldn't reach Billsy. Check your connection and try again.";
const SERVER_MESSAGE = 'Something went wrong. Nothing was saved. Try again in a moment.';

// Only one refresh runs at a time: the backend rotates the cookie on every use, so a second refresh
// sent in parallel would carry the old cookie and be refused (and end the session).
let refreshPromise = null;

/**
 * Gets a new access token with the refresh cookie. Resolves to the session ({ user, membership,
 * accessToken }) and stores it, or to null when there is no valid session.
 */
export function refreshSession(dispatch) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) {
          return null;
        }
        const session = await response.json();
        dispatch(sessionStarted(session));
        return session;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/** The error every screen gets: { status, code, message, details: [{ field, message }], requestId }. */
async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON, for example the dev proxy's page while the backend is down.
  }
  const error = body?.error;
  const serverFault = response.status >= 500 && error?.code !== 'EMAIL_NOT_SENT';
  return {
    status: response.status,
    code: error?.code ?? (response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN_ERROR'),
    message: serverFault ? SERVER_MESSAGE : (error?.message ?? SERVER_MESSAGE),
    details: error?.details ?? [],
    requestId: error?.requestId ?? response.headers.get('X-Request-Id'),
  };
}

function buildRequest(getState, { method = 'GET', body, form, auth = true }) {
  const headers = {};
  let payload;
  if (form !== undefined) {
    payload = form; // FormData: the browser sets the multipart boundary itself.
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const token = getState().auth.accessToken;
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { method, headers, body: payload, credentials: 'same-origin' };
}

/** After 403 NO_BUSINESS (removed or left meanwhile), reload the account so the app routes to /no-business. */
async function reloadAccount(getState, dispatch) {
  try {
    const response = await fetch(`${BASE_URL}/me`, buildRequest(getState, {}));
    if (response.ok) {
      dispatch(accountUpdated(await response.json()));
    }
  } catch {
    // The original error is shown anyway.
  }
}

/**
 * Sends a request and returns { response } when it is OK, or { error } in the shared shape.
 * A logged-in request that gets 401 (usually the 15-minute token ran out) refreshes once and
 * retries; if that fails too, the session has ended. Public requests (auth: false: log in, sign-up,
 * invitations, reset) never refresh, so a wrong password stays a normal error.
 */
export async function sendWithSession({ getState, dispatch }, path, options = {}) {
  const auth = options.auth ?? true;
  const send = () => fetch(BASE_URL + path, buildRequest(getState, options));

  let response;
  try {
    response = await send();
    if (response.status === 401 && auth) {
      const session = await refreshSession(dispatch);
      if (session) {
        response = await send();
      }
      if (!session || response.status === 401) {
        dispatch(sessionEnded({ reason: 'expired' }));
        dispatch(api.util.resetApiState());
        return { error: { status: 401, code: 'SESSION_ENDED', message: "You've been logged out.", details: [] } };
      }
    }
  } catch {
    return { error: { status: 0, code: 'NETWORK_ERROR', message: NETWORK_MESSAGE, details: [] } };
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (auth && error.status === 403 && error.code === 'BUSINESS_DEACTIVATED') {
      // Staff and Accountants of a deactivated business are refused everywhere: back to Log in.
      dispatch(sessionEnded({ reason: 'deactivated', message: error.message }));
      dispatch(api.util.resetApiState());
    } else if (auth && error.status === 403 && error.code === 'NO_BUSINESS') {
      await reloadAccount(getState, dispatch);
    }
    return { error };
  }
  return { response };
}

/** RTK Query's base query: JSON in, JSON out (null for 204). Args: { url, method, body, form, auth }. */
async function baseQuery(args, api) {
  const request = typeof args === 'string' ? { url: args } : args;
  const { response, error } = await sendWithSession(api, request.url, request);
  if (error) {
    return { error };
  }
  const text = await response.text();
  return { data: text ? JSON.parse(text) : null };
}

// Cache tags: each mutation names what it changes, so every screen showing it refetches.
export const TAGS = [
  'Me',
  'Business',
  'Team',
  'Invitations',
  'Customer',
  'Product',
  'Invoice',
  'InvoiceList',
  'CreditNote',
  'Payment',
  'Report',
  'Dashboard',
];

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: TAGS,
  // Billing data changes while people work: refetch when a screen opens again after 30 seconds.
  refetchOnMountOrArgChange: 30,
  endpoints: () => ({}),
});

/**
 * The tags a mutation invalidates, only when it succeeded. RTK Query also invalidates after a
 * failed mutation, which refetched the record after a 409 or 422 and reset the form, losing what
 * the person had typed. After a refusal the screen now stays as it was, and Reload refetches on purpose.
 *   invalidatesTags: onSuccess(['Customer'])  or  onSuccess(({ id }) => [invoiceTag(id)])
 */
export function onSuccess(tags) {
  return (_result, error, arg) => {
    if (error) {
      return [];
    }
    return typeof tags === 'function' ? tags(arg) : tags;
  };
}

/** Everything an issued invoice's change touches (payment, credit note, cancel, issue). */
export const INVOICE_CHANGE_TAGS = ['InvoiceList', 'CreditNote', 'Payment', 'Report', 'Dashboard', 'Customer'];
