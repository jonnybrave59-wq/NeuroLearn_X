import { API_BASE, API_CONFIGURATION, apiUrl } from "./api-config";
import {
  type ConnectionKind,
  type ConnectionState,
  getConnectionState,
  setConnectionState,
} from "./connection";
import { cacheApiResponse, clearOfflineSession } from "./offline";

export { API_BASE, apiUrl };

const API_TIMEOUT_MS = 12_000;
const HEALTH_TIMEOUT_MS = 12_000;
const COLD_START_RETRY_DELAYS_MS =
  import.meta.env.MODE === "test"
    ? [0]
    : [0, 5_000, 10_000, 15_000, 20_000, 20_000];

type ApiRequestOptions = RequestInit & {
  suppressSessionExpiry?: boolean;
};

let healthProbeInFlight: Promise<ConnectionState> | null = null;
let lastHealthProbeAt = 0;
const HEALTH_RESULT_TTL_MS = 5_000;

function browserReportsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function classifyFailedConnection(
  browserOnline: boolean,
  configuration: Pick<typeof API_CONFIGURATION, "error" | "crossOrigin"> =
    API_CONFIGURATION,
): ConnectionKind {
  if (!browserOnline) return "offline";
  if (configuration.error) return "configuration-error";
  return "server-unavailable";
}

async function failedFetchKind(): Promise<ConnectionKind> {
  const basicKind = classifyFailedConnection(browserReportsOnline());
  if (basicKind !== "server-unavailable" || !API_CONFIGURATION.crossOrigin) {
    return basicKind;
  }

  // If a normal cross-origin request is blocked, an opaque probe can still
  // distinguish a reachable server with bad CORS from an unavailable server.
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 4_000);
  try {
    await fetch(API_CONFIGURATION.healthUrl, {
      method: "GET",
      mode: "no-cors",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    return "configuration-error";
  } catch {
    return "server-unavailable";
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export class ApiError extends Error {
  status: number;
  connectionKind: ConnectionKind | null;
  handledByConnectionStatus: boolean;

  constructor(
    message: string,
    status: number,
    connectionKind: ConnectionKind | null = null,
    handledByConnectionStatus = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.connectionKind = connectionKind;
    this.handledByConnectionStatus = handledByConnectionStatus;
  }
}

export function inlineApiError(error: unknown) {
  if (error instanceof ApiError && error.handledByConnectionStatus) return "";
  return error instanceof Error ? error.message : "Something went wrong";
}

function connectionApiError(state: ConnectionState) {
  return new ApiError(state.message, 0, state.kind, true);
}

function authenticatedRequest(path: string, suppressSessionExpiry: boolean) {
  if (suppressSessionExpiry) return false;
  return ![
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/register/student",
    "/api/auth/forgot-password",
  ].includes(path);
}

export async function diagnoseConnection(
  options: {
    showLoading?: boolean;
    force?: boolean;
    retryDelaysMs?: readonly number[];
  } = {},
) {
  if (API_CONFIGURATION.error) {
    return setConnectionState("configuration-error");
  }

  if (healthProbeInFlight) return healthProbeInFlight;

  const current = getConnectionState();
  if (
    !options.force &&
    current.kind !== "loading" &&
    Date.now() - lastHealthProbeAt < HEALTH_RESULT_TTL_MS
  ) {
    return current;
  }

  if (options.showLoading) setConnectionState("loading");

  healthProbeInFlight = (async () => {
    const retryDelays = options.retryDelaysMs || COLD_START_RETRY_DELAYS_MS;
    try {
      for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
        const retryDelay = retryDelays[attempt] || 0;
        if (retryDelay > 0) {
          setConnectionState("server-starting");
          await new Promise((resolve) => globalThis.setTimeout(resolve, retryDelay));
        }

        const controller = new AbortController();
        const timeout = globalThis.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        try {
          const response = await fetch(API_CONFIGURATION.healthUrl, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (response.status === 401 || response.status === 403) {
            await clearOfflineSession();
            return setConnectionState("session-expired");
          }
          if (response.status === 404) {
            return setConnectionState("configuration-error");
          }
          if (!response.ok) {
            if (response.status >= 500 && attempt < retryDelays.length - 1) {
              setConnectionState("server-starting");
              continue;
            }
            return setConnectionState("server-unavailable");
          }

          let payload: { status?: string; service?: string };
          try {
            payload = (await response.json()) as { status?: string; service?: string };
          } catch {
            // Render Free returns a temporary HTML "Application loading" page
            // with HTTP 200 while the instance wakes. It is reachable, but it
            // is not the API yet, so keep the single cold-start status visible
            // and retry at the normal spaced intervals.
            if (attempt < retryDelays.length - 1) {
              setConnectionState("server-starting");
              continue;
            }
            return setConnectionState("configuration-error");
          }
          if (payload.status !== "ok" || payload.service !== "NeuroLearn-X API") {
            if (attempt < retryDelays.length - 1) {
              setConnectionState("server-starting");
              continue;
            }
            return setConnectionState("configuration-error");
          }
          return setConnectionState("online");
        } catch {
          const failureKind = await failedFetchKind();
          if (
            failureKind === "server-unavailable" &&
            attempt < retryDelays.length - 1
          ) {
            setConnectionState("server-starting");
            continue;
          }
          return setConnectionState(failureKind);
        } finally {
          globalThis.clearTimeout(timeout);
        }
      }
      return setConnectionState("server-unavailable");
    } finally {
      lastHealthProbeAt = Date.now();
      healthProbeInFlight = null;
    }
  })();

  return healthProbeInFlight;
}

export function reportReachableResponse(
  path: string,
  status: number,
  suppressSessionExpiry = false,
) {
  const expiredStatus =
    status === 401 ||
    (status === 403 &&
      ["/api/student/dashboard", "/api/teacher/dashboard"].includes(path));
  if (
    expiredStatus &&
    authenticatedRequest(path, suppressSessionExpiry)
  ) {
    void clearOfflineSession();
    return setConnectionState("session-expired");
  }

  return setConnectionState("online", {
    clearSessionExpired:
      path === "/api/auth/login" || path === "/api/auth/logout",
  });
}

export async function reportNetworkFailure() {
  return diagnoseConnection();
}

export async function api<T = any>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (API_CONFIGURATION.error) {
    const state = setConnectionState("configuration-error");
    throw connectionApiError(state);
  }

  const { suppressSessionExpiry = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutController = requestOptions.signal ? null : new AbortController();
  const timeout = timeoutController
    ? globalThis.setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS)
    : null;

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...requestOptions,
      headers,
      credentials: "include",
      cache: requestOptions.method && requestOptions.method !== "GET" ? "no-store" : "no-cache",
      signal: requestOptions.signal || timeoutController?.signal,
    });
  } catch {
    const state = await reportNetworkFailure();
    throw connectionApiError(state);
  } finally {
    if (timeout !== null) globalThis.clearTimeout(timeout);
  }

  const connectionState = reportReachableResponse(
    path,
    response.status,
    suppressSessionExpiry,
  );

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      detail =
        typeof data.detail === "string"
          ? data.detail
          : data.detail?.[0]?.msg || detail;
    } catch {
      // The generic message remains useful for non-JSON failures.
    }
    const isExpired = connectionState.kind === "session-expired";
    throw new ApiError(
      isExpired ? connectionState.message : detail,
      response.status,
      isExpired ? "session-expired" : null,
      isExpired,
    );
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json()) as T;
  if ((requestOptions.method || "GET") === "GET") {
    await cacheApiResponse(path, data);
  }
  return data;
}

export function post<T = any>(path: string, body?: unknown) {
  return api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function put<T = any>(path: string, body: unknown) {
  return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function patch<T = any>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function remove<T = any>(path: string) {
  return api<T>(path, { method: "DELETE" });
}

export function currentConnectionState() {
  return getConnectionState();
}

export function resetApiDiagnosticsForTests() {
  healthProbeInFlight = null;
  lastHealthProbeAt = 0;
}
