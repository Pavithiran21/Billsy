import { createSlice, nanoid } from '@reduxjs/toolkit';

// Receipt-slip toasts (UI-UX "Toasts"). A success toast is role="status" and goes after 5 seconds;
// an error toast is role="alert" and stays until it is closed.
// Each toast: { id, kind: 'ok' | 'err', icon, text, strong, tail } → "text <b>strong</b> tail".
const toastSlice = createSlice({
  name: 'toasts',
  initialState: [],
  reducers: {
    toastAdded: {
      reducer(state, { payload }) {
        state.push(payload);
        // Keep the stack short on small screens.
        if (state.length > 4) {
          state.shift();
        }
      },
      prepare(toast) {
        return { payload: { id: nanoid(), kind: 'ok', icon: 'check', strong: null, tail: null, ...toast } };
      },
    },
    toastClosed(state, { payload: id }) {
      return state.filter((toast) => toast.id !== id);
    },
  },
});

export const { toastAdded, toastClosed } = toastSlice.actions;
export const toastReducer = toastSlice.reducer;

const SUCCESS_MS = 5000;

/** Shows a success toast for 5 seconds. */
export function showToast(toast) {
  return (dispatch) => {
    const action = dispatch(toastAdded({ ...toast, kind: 'ok' }));
    setTimeout(() => dispatch(toastClosed(action.payload.id)), SUCCESS_MS);
  };
}

/** Shows an error toast that stays until closed. */
export function showErrorToast(text) {
  return toastAdded({ kind: 'err', icon: 'alert', text });
}
