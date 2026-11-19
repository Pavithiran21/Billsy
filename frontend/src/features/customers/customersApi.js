import { api, onSuccess } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

export const customersApi = api.injectEndpoints({
  endpoints: (build) => ({
    customers: build.query({
      query: (params) => `/customers${toQuery(params)}`,
      providesTags: ['Customer'],
    }),
    customer: build.query({
      query: (id) => `/customers/${id}`,
      providesTags: ['Customer'],
    }),
    createCustomer: build.mutation({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: onSuccess(['Customer']),
    }),
    updateCustomer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/customers/${id}`, method: 'PATCH', body }),
      invalidatesTags: onSuccess(['Customer', 'Invoice']),
    }),
    deleteCustomer: build.mutation({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: onSuccess(['Customer']),
    }),
  }),
});

export const {
  useCustomersQuery,
  useCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customersApi;
