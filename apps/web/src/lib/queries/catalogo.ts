import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Paginated } from '../types';

// =====================================================================
// Types — CONTROLE / cadastros (produtos, fornecedores, categorias, marcas)
// Money/decimal fields come from the API as Decimal strings.
// =====================================================================

export interface ProductCategory {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** present on GET /brands */
  productCount?: number;
}

export interface Product {
  id: string;
  companyId: string;
  categoryId?: string | null;
  brandId?: string | null;
  name: string;
  imageUrl?: string | null;
  salePrice: string;
  costPrice: string;
  stock: string;
  minStock: string;
  cashbackPercent: string;
  favorite: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  category?: ProductCategory | null;
  brand?: Brand | null;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stateRegistration?: string | null;
  cnpj?: string | null;
  addressJson?: unknown;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'in' | 'out' | 'adjust';

export interface CreateProductBody {
  name: string;
  categoryId?: string;
  brandId?: string;
  imageUrl?: string | null;
  salePrice: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
  cashbackPercent?: number;
  favorite?: boolean;
  active?: boolean;
}

export type UpdateProductBody = Partial<CreateProductBody> & { active?: boolean };

export interface StockMovementBody {
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

export interface ProductBatch {
  id: string;
  companyId: string;
  productId: string;
  code: string;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
  quantity: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductBatchBody {
  productId: string;
  code: string;
  manufacturedAt?: string;
  expiresAt?: string;
  quantity?: number;
  active?: boolean;
}

export type UpdateProductBatchBody = Partial<Omit<CreateProductBatchBody, 'productId'>>;

export interface SupplierBody {
  name: string;
  email?: string;
  phone?: string;
  stateRegistration?: string;
  cnpj?: string;
  addressJson?: unknown;
  active?: boolean;
}

// =====================================================================
// Products
// =====================================================================

export function useProducts(filters: {
  categoryId?: string;
  search?: string;
  lowStock?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () =>
      api.get<Paginated<Product>>('/products', {
        categoryId: filters.categoryId || undefined,
        search: filters.search || undefined,
        lowStock: filters.lowStock ? 'true' : undefined,
      }),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: Boolean(id),
    queryFn: () => api.get<Product>(`/products/${id}`),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductBody) => api.post<Product>('/products', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductBody }) =>
      api.patch<Product>(`/products/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      // Invalidate the detail query too so the open drawer picks up
      // side-effect PATCHes like an inline image upload.
      qc.invalidateQueries({ queryKey: ['product', id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Product>(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StockMovementBody }) =>
      api.post<Product>(`/products/${id}/movements`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

// =====================================================================
// Product batches (lotes e validades)
// =====================================================================

export function useProductBatches(productId?: string) {
  return useQuery({
    queryKey: ['product-batches', productId ?? null],
    queryFn: () =>
      api.get<ProductBatch[]>(
        '/product-batches',
        productId ? { productId } : undefined,
      ),
  });
}

export function useCreateProductBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductBatchBody) =>
      api.post<ProductBatch>('/product-batches', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-batches'] }),
  });
}

export function useUpdateProductBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductBatchBody }) =>
      api.patch<ProductBatch>(`/product-batches/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-batches'] }),
  });
}

export function useDeleteProductBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ProductBatch>(`/product-batches/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-batches'] }),
  });
}

// =====================================================================
// Product categories
// =====================================================================

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get<ProductCategory[]>('/product-categories'),
  });
}

export function useCreateProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; active?: boolean }) =>
      api.post<ProductCategory>('/product-categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories'] }),
  });
}

export function useUpdateProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; active?: boolean } }) =>
      api.patch<ProductCategory>(`/product-categories/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories'] }),
  });
}

export function useDeleteProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ProductCategory>(`/product-categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories'] }),
  });
}

// =====================================================================
// Brands
// =====================================================================

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get<Brand[]>('/brands'),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; active?: boolean }) =>
      api.post<Brand>('/brands', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; active?: boolean };
    }) => api.patch<Brand>(`/brands/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Brand>(`/brands/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

// =====================================================================
// Suppliers
// =====================================================================

export function useSuppliers(search?: string) {
  return useQuery({
    queryKey: ['suppliers', search ?? null],
    queryFn: () =>
      api.get<Paginated<Supplier>>('/suppliers', search ? { search } : undefined),
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', id],
    enabled: Boolean(id),
    queryFn: () => api.get<Supplier>(`/suppliers/${id}`),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SupplierBody) => api.post<Supplier>('/suppliers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<SupplierBody> }) =>
      api.patch<Supplier>(`/suppliers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Supplier>(`/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
