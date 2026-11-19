import { INVOICE_CHANGE_TAGS, api, onSuccess } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

// Invoices: lists, the draft editor and every action on an issued invoice. Each change names the
// tags it touches, so the lists, counts, dashboard, reports and customer balances refetch.
const invoiceTag = (id) => ({ type: 'Invoice', id: Number(id) });
const DRAFT_TAGS = ['InvoiceList', 'Dashboard', 'Customer', 'Product'];

export const invoicesApi = api.injectEndpoints({
  endpoints: (build) => ({
    invoices: build.query({
      query: (params) => `/invoices${toQuery(params)}`,
      providesTags: ['InvoiceList'],
    }),
    invoiceCounts: build.query({
      query: () => '/invoices/counts',
      providesTags: ['InvoiceList'],
    }),
    nextNumber: build.query({
      query: () => '/invoices/next-number',
      providesTags: ['InvoiceList'],
    }),
    invoice: build.query({
      query: (id) => `/invoices/${id}`,
      providesTags: (_result, _error, id) => [invoiceTag(id), 'Invoice'],
    }),
    createDraft: build.mutation({
      query: (body) => ({ url: '/invoices', method: 'POST', body }),
      invalidatesTags: onSuccess(DRAFT_TAGS),
    }),
    updateDraft: build.mutation({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}`, method: 'PUT', body }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id), ...DRAFT_TAGS]),
    }),
    deleteDraft: build.mutation({
      query: (id) => ({ url: `/invoices/${id}`, method: 'DELETE' }),
      invalidatesTags: onSuccess(DRAFT_TAGS),
    }),
    issueInvoice: build.mutation({
      query: ({ id, version }) => ({ url: `/invoices/${id}/issue`, method: 'POST', body: { version } }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id), ...INVOICE_CHANGE_TAGS]),
    }),
    cancelInvoice: build.mutation({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}/cancel`, method: 'POST', body }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id), ...INVOICE_CHANGE_TAGS]),
    }),
    recordPayment: build.mutation({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}/payments`, method: 'POST', body }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id), ...INVOICE_CHANGE_TAGS]),
    }),
    issueCreditNote: build.mutation({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}/credit-notes`, method: 'POST', body }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id), ...INVOICE_CHANGE_TAGS]),
    }),
    emailInvoice: build.mutation({
      query: ({ id, message }) => ({ url: `/invoices/${id}/email`, method: 'POST', body: { message } }),
      invalidatesTags: onSuccess(({ id }) => [invoiceTag(id)]),
    }),
  }),
});

export const {
  useInvoicesQuery,
  useInvoiceCountsQuery,
  useNextNumberQuery,
  useInvoiceQuery,
  useCreateDraftMutation,
  useUpdateDraftMutation,
  useDeleteDraftMutation,
  useIssueInvoiceMutation,
  useCancelInvoiceMutation,
  useRecordPaymentMutation,
  useIssueCreditNoteMutation,
  useEmailInvoiceMutation,
} = invoicesApi;
