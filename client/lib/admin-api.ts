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
import { cacheGet, cacheSet, queueMutation, type PendingMutation } from "./offlineStorage";
import { clearAuthToken, getAuthToken, setAuthToken } from "./sessionStore";

const API_BASE_URL = (import.meta.env.VITE_ADMIN_API_URL as string | undefined) ?? "";
type CacheMeta = { fromCache?: boolean; cachedAt?: string };
type OfflineResult<T> = T & CacheMeta;

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && (error.name === "AbortError" || error.message.includes("Failed to fetch")));
}

function addCacheMeta<T>(data: T, cachedAt: string): OfflineResult<T> {
  if (Array.isArray(data)) return Object.assign([...data], { fromCache: true, cachedAt }) as unknown as OfflineResult<T>;
  return { ...(data as object), fromCache: true, cachedAt } as unknown as OfflineResult<T>;
}

async function request<T>(path: string, options?: RequestInit) {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: options?.signal ?? controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

async function readWithCache<T extends AdminDashboardResponse | Order[] | Product[] | Review[]>(path: string, store: "dashboard" | "orders" | "products" | "reviews") {
  try {
    const data = await request<T>(path);
    await cacheSet(store, "latest", data);
    return data as OfflineResult<T>;
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const cached = await cacheGet<T>(store, "latest");
    if (!cached) throw error;
    return addCacheMeta(cached.data, cached.cachedAt);
  }
}

type QueuedRequest<T> = { type: PendingMutation["type"]; path: string; options: RequestInit; payload: Record<string, unknown>; optimistic: T };

async function queueOnNetworkFailure<T>({ type, path, options, payload, optimistic }: QueuedRequest<T>, queueOffline = true): Promise<OfflineResult<T>> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (!isNetworkFailure(error) || !queueOffline) throw error;
    await queueMutation({ type, payload });
    return Object.assign(optimistic as object, { pendingSync: true }) as unknown as OfflineResult<T>;
  }
}

export const adminApi = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: async (payload: LoginPayload) => {
    const response = await request<AdminSessionResponse>("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    if (response.token) await setAuthToken(response.token);
    return response;
  },
  logout: async () => {
    try {
      return await request<AdminSessionResponse>("/api/admin/logout", { method: "POST" });
    } finally {
      await clearAuthToken();
    }
  },
  dashboard: () => readWithCache<AdminDashboardResponse>("/api/admin/dashboard", "dashboard"),
  products: () => readWithCache<Product[]>("/api/admin/products", "products"),
  product: (id: string | number) => request<Product>(`/api/admin/products/${id}`),
  createProduct: (payload: ProductCreatePayload) => request<Product>("/api/admin/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: async (id: string | number, data: ProductMutationPayload, queueOffline = true) => queueOnNetworkFailure({ type: "update_product", path: `/api/admin/products/${id}`, options: { method: "PATCH", body: JSON.stringify(data) }, payload: { productId: id, data }, optimistic: { id } as Product }, queueOffline),
  deleteProduct: (id: string | number) => request<{ deleted: boolean }>(`/api/admin/products/${id}`, { method: "DELETE" }),
  orders: () => readWithCache<Order[]>("/api/admin/orders", "orders"),
  updateOrderStatus: async (id: string, status: string, queueOffline = true) => queueOnNetworkFailure({ type: "update_order_status", path: `/api/admin/orders/${id}/status`, options: { method: "PATCH", body: JSON.stringify({ status }) }, payload: { orderId: id, status }, optimistic: { id, status } as Order }, queueOffline),
  reviews: () => readWithCache<Review[]>("/api/admin/reviews", "reviews"),
  moderateReview: async (id: string, action: "approve" | "reject" | "delete", queueOffline = true) => queueOnNetworkFailure({ type: "moderate_review", path: `/api/admin/reviews/${id}`, options: { method: "PATCH", body: JSON.stringify({ action }) }, payload: { reviewId: id, action }, optimistic: (action === "delete" ? { deleted: true } : { id, is_approved: action === "approve" }) as Review | { deleted: boolean } }, queueOffline),
};
