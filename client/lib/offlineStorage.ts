import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AdminDashboardResponse, Order, Product, Review } from "@shared/api";

const DB_NAME = "belkhadir-admin-offline";
const DB_VERSION = 1;
type CacheStore = "dashboard" | "orders" | "products" | "reviews";

export interface CachedRecord<T> {
  data: T;
  cachedAt: string;
}

export interface PendingMutation {
  localId: string;
  type: "update_order_status" | "moderate_review" | "update_product";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface OfflineSchema extends DBSchema {
  dashboard: { key: string; value: CachedRecord<AdminDashboardResponse> };
  orders: { key: string; value: CachedRecord<Order[]> };
  products: { key: string; value: CachedRecord<Product[]> };
  reviews: { key: string; value: CachedRecord<Review[]> };
  pending_mutations: { key: string; value: PendingMutation };
}

let dbInstance: IDBPDatabase<OfflineSchema> | null = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<OfflineSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("dashboard")) db.createObjectStore("dashboard");
      if (!db.objectStoreNames.contains("orders")) db.createObjectStore("orders");
      if (!db.objectStoreNames.contains("products")) db.createObjectStore("products");
      if (!db.objectStoreNames.contains("reviews")) db.createObjectStore("reviews");
      if (!db.objectStoreNames.contains("pending_mutations")) db.createObjectStore("pending_mutations", { keyPath: "localId" });
    },
  });
  return dbInstance;
}

export async function cacheSet<T extends AdminDashboardResponse | Order[] | Product[] | Review[]>(store: CacheStore, key: string, data: T) {
  const db = await getDb();
  await db.put(store as never, { data, cachedAt: new Date().toISOString() } as never, key);
}

export async function cacheGet<T extends AdminDashboardResponse | Order[] | Product[] | Review[]>(store: CacheStore, key: string): Promise<CachedRecord<T> | null> {
  const db = await getDb();
  const record = await db.get(store as never, key);
  return (record as CachedRecord<T> | undefined) ?? null;
}

export async function queueMutation(mutation: Omit<PendingMutation, "localId" | "createdAt">) {
  const db = await getDb();
  const full: PendingMutation = {
    ...mutation,
    localId: `${mutation.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await db.put("pending_mutations", full);
  return full;
}

export async function getPendingMutations() {
  const db = await getDb();
  return db.getAll("pending_mutations");
}

export async function removePendingMutation(localId: string) {
  const db = await getDb();
  await db.delete("pending_mutations", localId);
}

export async function clearAllCache() {
  const db = await getDb();
  await Promise.all([
    db.clear("dashboard"),
    db.clear("orders"),
    db.clear("products"),
    db.clear("reviews"),
    db.clear("pending_mutations"),
  ]);
}
