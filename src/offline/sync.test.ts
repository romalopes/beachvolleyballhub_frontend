import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineDb } from "./db";
import { enqueueOfflineOperation, pendingOfflineOperationCount, syncPendingOperations } from "./sync";

describe("offline synchronization", () => {
  beforeEach(async () => {
    await offlineDb.operations.clear();
    await offlineDb.cache.clear();
  });

  it("queues operations with a stable operation id and processes them once", async () => {
    const id = await enqueueOfflineOperation({
      userScope: "user:7",
      domain: "assessment",
      method: "POST",
      endpoint: "/assessment_sessions",
      payload: { assessment_session: { name: "Beach session" } },
    });
    const send = vi.fn().mockResolvedValue(undefined);

    expect(await pendingOfflineOperationCount("user:7")).toBe(1);
    await expect(syncPendingOperations("user:7", send)).resolves.toEqual({ processed: 1, failed: 0 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ operationId: id, attempts: 1 }));
    expect(await pendingOfflineOperationCount("user:7")).toBe(0);
  });

  it("retains failed operations for a later retry", async () => {
    await enqueueOfflineOperation({
      userScope: "user:8",
      domain: "tournament",
      method: "PATCH",
      endpoint: "/tournaments/1",
      payload: { tournament: { name: "Updated" } },
    });
    const send = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(syncPendingOperations("user:8", send)).resolves.toEqual({ processed: 0, failed: 1 });
    expect(await pendingOfflineOperationCount("user:8")).toBe(1);
    expect((await offlineDb.operations.toArray())[0]?.lastError).toBe("offline");
  });
});