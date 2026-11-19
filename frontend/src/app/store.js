import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../auth/authSlice';
import { toastReducer } from '../toasts/toastSlice';
import { api } from './api';

// One store: who is signed in (auth), the toasts, and RTK Query's cache of server data (api).
// There are no React contexts in Billsy: Redux Toolkit holds the app-wide state.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    toasts: toastReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});
