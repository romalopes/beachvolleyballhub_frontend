import Dexie, { type Table } from "dexie";

export type OfflineOperationStatus = "pending" | "processing" | "failed";

export interface OfflineOperation<TPayload = unknown> {
  id?: number;
  operationId: string;
  userScope: string;
  domain: "training" | "assessment" | "tournament" | "drill" | "analysis" | "generic";
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: OfflineOperationStatus;
  lastError?: string;
}

export interface OfflineCacheEntry<T = unknown> {
  key: string;
  userScope: string;
  domain: string;
  value: T;
  cachedAt: string;
  expiresAt?: string;
}

export interface OfflineMetaEntry {
  key: string;
  value: string;
}

class BeachVolleyballOfflineDatabase extends Dexie {
  operations!: Table<OfflineOperation, number>;
  cache!: Table<OfflineCacheEntry, string>;
  meta!: Table<OfflineMetaEntry, string>;

  constructor() {
    super("beach-volleyball-hub-offline");
    this.version(1).stores({
      operations: "++id, &operationId, userScope, domain, status, createdAt",
      cache: "&key, userScope, domain, cachedAt",
      meta: "&key",
    });
  }
}

export const offlineDb = new BeachVolleyballOfflineDatabase();

export function currentUserScope(userId?: number | string | null): string {
  return userId == null ? "anonymous" : `user:${String(userId)}`;
}

export async function cacheOfflineValue<T>(entry: OfflineCacheEntry<T>): Promise<void> {
  await offlineDb.cache.put(entry);
}

export async function readOfflineValue<T>(key: string, userScope: string): Promise<T | null> {
  const entry = await offlineDb.cache.get(key);
  if (!entry || entry.userScope !== userScope) return null;
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
    await offlineDb.cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function clearOfflineUserData(userScope: string): Promise<void> {
  await offlineDb.transaction("rw", offlineDb.operations, offlineDb.cache, async () => {
    await offlineDb.operations.where("userScope").equals(userScope).delete();
    await offlineDb.cache.where("userScope").equals(userScope).delete();
  });
}