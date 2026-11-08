import { API_BASE_URL, getApiToken, getTestAccessToken } from "../api";
import type { OfflineOperation } from "./db";

export async function sendOfflineOperation(operation: OfflineOperation): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getApiToken();
  const testAccessToken = getTestAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (testAccessToken) headers["X-Test-Access-Token"] = testAccessToken;
  headers["X-Idempotency-Key"] = operation.operationId;

  const response = await fetch(`${API_BASE_URL}${operation.endpoint}`, {
    method: operation.method,
    headers,
    body: JSON.stringify(operation.payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Offline operation failed with HTTP ${response.status}`);
  }
}