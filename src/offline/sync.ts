import {
  offlineDb,
  type OfflineOperation,
  type OfflineOperationStatus,
} from "./db";

export interface OfflineOperationRequest {
  operationId?: string;
  userScope: string;
  domain: OfflineOperation["domain"];
  method: OfflineOperation["method"];
  endpoint: string;
  payload: unknown;
}

export interface SyncResult {
  processed: number;
  failed: number;
}

function operationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueOfflineOperation(request: OfflineOperationRequest): Promise<string> {
  const now = new Date().toISOString();
  const id = request.operationId ?? operationId();
  await offlineDb.operations.put({
    operationId: id,
    userScope: request.userScope,
    domain: request.domain,
    method: request.method,
    endpoint: request.endpoint,
    payload: request.payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: "pending",
  });
  return id;
}

export async function pendingOfflineOperationCount(userScope: string): Promise<number> {
  return offlineDb.operations
    .where("userScope")
    .equals(userScope)
    .and((operation) => operation.status !== "processing")
    .count();
}

export async function markOperationFailed(id: number, error: unknown): Promise<void> {
  await offlineDb.operations.update(id, {
    status: "failed" satisfies OfflineOperationStatus,
    attempts: (await offlineDb.operations.get(id))?.attempts ?? 0,
    updatedAt: new Date().toISOString(),
    lastError: error instanceof Error ? error.message : String(error),
  });
}

export async function syncPendingOperations(
  userScope: string,
  send: (operation: OfflineOperation) => Promise<void>,
): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { processed: 0, failed: 0 };

  const operations = await offlineDb.operations
    .where("userScope")
    .equals(userScope)
    .and((operation) => operation.status === "pending" || operation.status === "failed")
    .sortBy("createdAt");
  let processed = 0;
  let failed = 0;

  for (const operation of operations) {
    if (operation.id == null) continue;
    await offlineDb.operations.update(operation.id, {
      status: "processing",
      attempts: operation.attempts + 1,
      updatedAt: new Date().toISOString(),
    });
    try {
      await send({ ...operation, status: "processing", attempts: operation.attempts + 1 });
      await offlineDb.operations.delete(operation.id);
      processed += 1;
    } catch (error) {
      await markOperationFailed(operation.id, error);
      failed += 1;
    }
  }
  return { processed, failed };
}