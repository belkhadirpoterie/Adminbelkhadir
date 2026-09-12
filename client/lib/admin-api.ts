import type {
  AdminDashboardResponse,
  AdminSessionResponse,
  LoginPayload,
  Order,
  Product,
  ProductMutationPayload,
  Review,
} from "@shared/api";

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Une erreur est survenue");
  return data as T;
}

export const adminApi = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: (payload: LoginPayload) => request<AdminSessionResponse>("/api/admin/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<AdminSessionResponse>("/api/admin/logout", { method: "POST" }),
  dashboard: () => request<AdminDashboardResponse>("/api/admin/dashboard"),
  products: () => request<Product[]>("/api/admin/products"),
  updateProduct: (id: string, payload: ProductMutationPayload) => request<Product>(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id: string) => request<{ deleted: boolean }>(`/api/admin/products/${id}`, { method: "DELETE" }),
  orders: () => request<Order[]>("/api/admin/orders"),
  updateOrderStatus: (id: string, status: string) => request<Order>(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  reviews: () => request<Review[]>("/api/admin/reviews"),
  moderateReview: (id: string, action: "approve" | "reject" | "delete") => request<Review | { deleted: boolean }>(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
};
