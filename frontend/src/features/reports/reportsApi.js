import { api } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

// Reports (Owner, Accountant) and the dashboard (Owner, Staff). The server works out every figure,
// net of credit notes; the screens only show them.
export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    gstReport: build.query({
      query: (params) => `/reports/gst${toQuery(params)}`,
      providesTags: ['Report'],
    }),
    salesReport: build.query({
      query: (params) => `/reports/sales${toQuery(params)}`,
      providesTags: ['Report'],
    }),
    dashboard: build.query({
      query: (period) => `/dashboard?period=${period}`,
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGstReportQuery, useSalesReportQuery, useDashboardQuery } = reportsApi;
