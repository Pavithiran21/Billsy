import { api, onSuccess } from '../../app/api';

// The business (Business and GST settings, letterhead) and the team (Owner only).
export const businessApi = api.injectEndpoints({
  endpoints: (build) => ({
    business: build.query({
      query: () => '/business',
      providesTags: ['Business'],
    }),
    updateBusiness: build.mutation({
      query: (body) => ({ url: '/business', method: 'PATCH', body }),
      invalidatesTags: onSuccess(['Business', 'Me']),
    }),
    uploadLogo: build.mutation({
      query: (file) => {
        const form = new FormData();
        form.append('logo', file);
        return { url: '/business/logo', method: 'PUT', form };
      },
      invalidatesTags: onSuccess(['Business']),
    }),
    removeLogo: build.mutation({
      query: () => ({ url: '/business/logo', method: 'DELETE' }),
      invalidatesTags: onSuccess(['Business']),
    }),
    deactivateBusiness: build.mutation({
      query: (password) => ({ url: '/business/deactivate', method: 'POST', body: { password } }),
      invalidatesTags: onSuccess(['Business', 'Me']),
    }),
    reactivateBusiness: build.mutation({
      query: (password) => ({ url: '/business/reactivate', method: 'POST', body: { password } }),
      invalidatesTags: onSuccess(['Business', 'Me']),
    }),
    members: build.query({
      query: () => '/team/members',
      providesTags: ['Team'],
    }),
    changeRole: build.mutation({
      query: ({ userId, role }) => ({ url: `/team/members/${userId}`, method: 'PATCH', body: { role } }),
      invalidatesTags: onSuccess(['Team']),
    }),
    removeMember: build.mutation({
      query: (userId) => ({ url: `/team/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: onSuccess(['Team']),
    }),
    invitations: build.query({
      query: () => '/team/invitations',
      providesTags: ['Invitations'],
    }),
    invite: build.mutation({
      query: (body) => ({ url: '/team/invitations', method: 'POST', body }),
      // A 502 EMAIL_NOT_SENT still saved the invitation, so the list is refreshed either way.
      invalidatesTags: onSuccess(['Invitations']),
    }),
    resendInvitation: build.mutation({
      query: (id) => ({ url: `/team/invitations/${id}/resend`, method: 'POST' }),
      invalidatesTags: onSuccess(['Invitations']),
    }),
    revokeInvitation: build.mutation({
      query: (id) => ({ url: `/team/invitations/${id}/revoke`, method: 'POST' }),
      invalidatesTags: onSuccess(['Invitations']),
    }),
  }),
});

export const {
  useBusinessQuery,
  useUpdateBusinessMutation,
  useUploadLogoMutation,
  useRemoveLogoMutation,
  useDeactivateBusinessMutation,
  useReactivateBusinessMutation,
  useMembersQuery,
  useChangeRoleMutation,
  useRemoveMemberMutation,
  useInvitationsQuery,
  useInviteMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} = businessApi;
