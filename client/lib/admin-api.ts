import type {
  AdminDashboardResponse,
  AdminSessionResponse,
  LoginPayload,
  Order,
  Product,
  ProductCreatePayload,
  ProductMutationPayload,
  Review,
} from "@shared/api";

const sessionToken = () => typeof window === "undefined" ? null : window.localStorage.getItem("atelier_admin_session");

async function request<T>(path: string, options?: RequestInit) {
  const token = sessionToken();
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Une erreur est survenue");
  return data as T;
}

export const adminApi = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: async (payload: LoginPayload) => {
    const response = await request<AdminSessionResponse>("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    if (response.token) window.localStorage.setItem("atelier_admin_session", response.token);
    return response;
  },
  logout: async () => {
    const response = await request<AdminSessionResponse>("/api/admin/logout", { method: "POST" });
    window.localStorage.removeItem("atelier_admin_session");
    return response;
  },
  dashboard: () => request<AdminDashboardResponse>("/api/admin/dashboard"),
  products: () => request<Product[]>("/api/admin/products"),
  product: (id: string | number) => request<Product>(`/api/admin/products/${id}`),
  createProduct: (payload: ProductCreatePayload) => request<Product>("/api/admin/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id: string | number, payload: ProductMutationPayload) => request<Product>(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id: string | number) => request<{ deleted: boolean }>(`/api/admin/products/${id}`, { method: "DELETE" }),
  orders: () => request<Order[]>("/api/admin/orders"),
  updateOrderStatus: (id: string, status: string) => request<Order>(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  reviews: () => request<Review[]>("/api/admin/reviews"),
  moderateReview: (id: string, action: "approve" | "reject" | "delete") => request<Review | { deleted: boolean }>(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
};
