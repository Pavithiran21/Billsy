import { api, onSuccess } from '../../app/api';

// Public auth endpoints, the signed-in account (/me) and the reference data (/meta).
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    meta: build.query({
      query: () => ({ url: '/meta', auth: false }),
      // States, GST rates and payment modes never change while the app is open.
      keepUnusedDataFor: Number.MAX_SAFE_INTEGER,
    }),
    // 404 unless DEMO_MODE=true: the Log in page shows "Try the demo" only when this answers.
    demoAccounts: build.query({
      query: () => ({ url: '/demo/accounts', auth: false }),
    }),
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body, auth: false }),
    }),
    signup: build.mutation({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body, auth: false }),
    }),
    demoLogin: build.mutation({
      query: (role) => ({ url: '/demo/login', method: 'POST', body: { role }, auth: false }),
    }),
    forgotPassword: build.mutation({
      query: (email) => ({ url: '/auth/forgot-password', method: 'POST', body: { email }, auth: false }),
    }),
    resetPassword: build.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body, auth: false }),
    }),
    invitation: build.query({
      query: (token) => ({ url: `/invitations/${encodeURIComponent(token)}`, auth: false }),
    }),
    acceptInvitation: build.mutation({
      query: ({ token, ...body }) => ({
        url: `/invitations/${encodeURIComponent(token)}/accept`,
        method: 'POST',
        body,
        auth: false,
      }),
    }),
    me: build.query({
      query: () => '/me',
      providesTags: ['Me'],
    }),
    updateMe: build.mutation({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: onSuccess(['Me', 'Team']),
    }),
    changePassword: build.mutation({
      query: (body) => ({ url: '/me/password', method: 'POST', body }),
    }),
    leaveBusiness: build.mutation({
      query: (password) => ({ url: '/me/leave', method: 'POST', body: { password } }),
    }),
    deleteAccount: build.mutation({
      query: (password) => ({ url: '/me', method: 'DELETE', body: { password } }),
    }),
  }),
});

export const {
  useMetaQuery,
  useDemoAccountsQuery,
  useLoginMutation,
  useSignupMutation,
  useDemoLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useInvitationQuery,
  useAcceptInvitationMutation,
  useUpdateMeMutation,
  useChangePasswordMutation,
  useLeaveBusinessMutation,
  useDeleteAccountMutation,
} = authApi;
