import { api } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

export const paymentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    payments: build.query({
      query: (params) => `/payments${toQuery(params)}`,
      providesTags: ['Payment'],
    }),
  }),
});

export const { usePaymentsQuery } = paymentsApi;
