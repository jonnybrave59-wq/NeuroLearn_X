/**
 * NeuroLearn-X deliberately keeps authenticated research records out of
 * browser persistence. The service worker caches only the public application
 * shell; student/teacher API responses and progress mutations require a live
 * server connection.
 *
 * These compatibility exports keep the API client simple while ensuring that
 * older IndexedDB data is removed during sign-out and application startup.
 */

export const INTERNET_REQUIRED =
  "NeuroLearn-X cannot reach the server right now. Please try again.";

const LEGACY_DATABASE = "neurolearnx-offline-v1";

function deleteLegacyPrivateCache(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(LEGACY_DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export function isOfflineReadable(_path: string) {
  return false;
}

export async function cacheApiResponse(_path: string, _value: unknown) {
  // Authenticated API data is never persisted on the device.
}

export async function getCachedApiResponse<T>(
  _path: string,
): Promise<T | undefined> {
  return undefined;
}

export async function cacheAuthenticatedUser<T extends { id: number }>(
  _user: T,
) {
  // Identity and role data remain in the HTTP-only server session only.
}

export async function restoreAuthenticatedUser<T>(): Promise<T | undefined> {
  await deleteLegacyPrivateCache();
  return undefined;
}

export async function clearOfflineSession() {
  await deleteLegacyPrivateCache();
}

export async function queuePathwayCompletion(_path: string, _body?: string) {
  throw new Error(INTERNET_REQUIRED);
}

export async function pendingSyncCount() {
  return 0;
}

export async function flushPendingSync(_apiBase = "") {
  await deleteLegacyPrivateCache();
}
