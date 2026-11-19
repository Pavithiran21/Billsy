import { api } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

export const creditNotesApi = api.injectEndpoints({
  endpoints: (build) => ({
    creditNotes: build.query({
      query: (params) => `/credit-notes${toQuery(params)}`,
      providesTags: ['CreditNote'],
    }),
    creditNote: build.query({
      query: (id) => `/credit-notes/${id}`,
      providesTags: ['CreditNote'],
    }),
  }),
});

export const { useCreditNotesQuery, useCreditNoteQuery } = creditNotesApi;
