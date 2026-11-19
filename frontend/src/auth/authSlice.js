import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { authApi } from '../features/auth/authApi';
import { accountUpdated, sessionEnded, sessionStarted, signedOut, tokenReplaced } from './authActions';

// Who is signed in. status: 'checking' while the start-up refresh runs, then 'signedIn' or 'signedOut'.
// The access token is kept here, in memory only; a reload gets a new one from the refresh cookie.
// ended: why the last session stopped ({ reason, message }), shown once on the Log in page.
const initialState = { status: 'checking', accessToken: null, account: null, ended: null };

function startSession(state, { payload }) {
  const { accessToken, user, membership } = payload;
  state.status = 'signedIn';
  state.accessToken = accessToken;
  state.account = { user, membership };
  state.ended = null;
}

function updateAccount(state, { payload }) {
  if (state.status === 'signedIn') {
    state.account = { user: payload.user, membership: payload.membership };
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    endedNoticeSeen(state) {
      state.ended = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sessionStarted, startSession)
      .addCase(accountUpdated, updateAccount)
      .addCase(tokenReplaced, (state, { payload }) => {
        state.accessToken = payload.accessToken;
      })
      .addCase(signedOut, () => ({ ...initialState, status: 'signedOut' }))
      .addCase(sessionEnded, (_state, { payload }) => ({ ...initialState, status: 'signedOut', ended: payload }))
      // Every way in answers with the account and an access token.
      .addMatcher(
        isAnyOf(
          authApi.endpoints.login.matchFulfilled,
          authApi.endpoints.signup.matchFulfilled,
          authApi.endpoints.demoLogin.matchFulfilled,
          authApi.endpoints.acceptInvitation.matchFulfilled,
        ),
        startSession,
      )
      .addMatcher(
        isAnyOf(
          authApi.endpoints.me.matchFulfilled,
          authApi.endpoints.updateMe.matchFulfilled,
          authApi.endpoints.leaveBusiness.matchFulfilled,
        ),
        updateAccount,
      )
      .addMatcher(authApi.endpoints.changePassword.matchFulfilled, (state, { payload }) => {
        state.accessToken = payload.accessToken;
      });
  },
});

export const { endedNoticeSeen } = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectAuth = (state) => state.auth;
export const selectAccount = (state) => state.auth.account;
