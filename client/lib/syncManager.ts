import { Network } from "@capacitor/network";
import { adminApi } from "./admin-api";
import { getPendingMutations, removePendingMutation, type PendingMutation } from "./offlineStorage";

type SyncStatus = { syncing: boolean; pending: number };
type SyncListener = (status: SyncStatus) => void;

const listeners = new Set<SyncListener>();
let isSyncing = false;
let networkListenerReady = false;

export function onSyncStatusChange(listener: SyncListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(status: SyncStatus) {
  listeners.forEach((listener) => listener(status));
}

async function applyMutation(mutation: PendingMutation) {
  switch (mutation.type) {
    case "update_order_status":
      return adminApi.updateOrderStatus(mutation.payload.orderId as string, mutation.payload.status as string, false);
    case "moderate_review":
      return adminApi.moderateReview(mutation.payload.reviewId as string, mutation.payload.action as "approve" | "reject" | "delete", false);
    case "update_product":
      return adminApi.updateProduct(mutation.payload.productId as string | number, mutation.payload.data as Parameters<typeof adminApi.updateProduct>[1], false);
  }
}

export async function syncPendingMutations() {
  if (isSyncing) return;
  const pending = await getPendingMutations();
  if (!pending.length) {
    notify({ syncing: false, pending: 0 });
    return;
  }

  isSyncing = true;
  notify({ syncing: true, pending: pending.length });
  for (const mutation of pending) {
    try {
      await applyMutation(mutation);
      await removePendingMutation(mutation.localId);
    } catch (error) {
      console.error("Synchronisation offline échouée", mutation.localId, error);
      break;
    }
  }
  const remaining = await getPendingMutations();
  isSyncing = false;
  notify({ syncing: false, pending: remaining.length });
}

export async function initNetworkListener() {
  if (networkListenerReady) return;
  networkListenerReady = true;
  await Network.addListener("networkStatusChange", (status) => {
    if (status.connected) void syncPendingMutations();
  });
  const status = await Network.getStatus();
  if (status.connected) void syncPendingMutations();
}

export async function isOnline() {
  const status = await Network.getStatus();
  return status.connected;
}
