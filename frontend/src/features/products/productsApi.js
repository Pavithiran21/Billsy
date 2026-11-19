import { api, onSuccess } from '../../app/api';
import { toQuery } from '../../hooks/useUrlFilters';

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    products: build.query({
      query: (params) => `/products${toQuery(params)}`,
      providesTags: ['Product'],
    }),
    product: build.query({
      query: (id) => `/products/${id}`,
      providesTags: ['Product'],
    }),
    createProduct: build.mutation({
      query: (body) => ({ url: '/products', method: 'POST', body }),
      invalidatesTags: onSuccess(['Product']),
    }),
    updateProduct: build.mutation({
      query: ({ id, ...body }) => ({ url: `/products/${id}`, method: 'PATCH', body }),
      invalidatesTags: onSuccess(['Product']),
    }),
    deleteProduct: build.mutation({
      query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }),
      invalidatesTags: onSuccess(['Product']),
    }),
  }),
});

export const {
  useProductsQuery,
  useProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
