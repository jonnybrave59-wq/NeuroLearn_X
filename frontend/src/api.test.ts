import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  api,
  classifyFailedConnection,
  currentConnectionState,
  diagnoseConnection,
  inlineApiError,
  resetApiDiagnosticsForTests,
} from "./api";
import { resetConnectionStateForTests } from "./connection";

const healthPayload = {
  status: "ready",
  service: "NeuroLearn-X API",
};

describe("API client", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetConnectionStateForTests();
    resetApiDiagnosticsForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON and includes credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api("/api/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(currentConnectionState().kind).toBe("online");
  });

  it("marks a successful backend health response online", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(healthPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(diagnoseConnection()).resolves.toMatchObject({ kind: "online" });
  });

  it("retries a free-server cold start and continues when health becomes ready", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Cold start"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(healthPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      diagnoseConnection({ retryDelaysMs: [0, 0] }),
    ).resolves.toMatchObject({ kind: "online" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a temporary non-JSON readiness response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("<html><title>Render - Application loading</title></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(healthPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      diagnoseConnection({ retryDelaysMs: [0, 0] }),
    ).resolves.toMatchObject({ kind: "online" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never replays a write request that receives a non-API response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>unexpected gateway page</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(
      api("/api/auth/register/student", {
        method: "POST",
        body: JSON.stringify({ participant_code: "NEW-STUDENT" }),
      }),
    ).rejects.toMatchObject({ connectionKind: "configuration-error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a stopped same-origin backend from an offline device", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/api/student/dashboard")).rejects.toMatchObject({
      connectionKind: "server-unavailable",
    });
    expect(currentConnectionState().kind).toBe("server-unavailable");
    expect(console.error).toHaveBeenCalledWith(
      "[NeuroLearn-X API] Request failed",
      expect.objectContaining({
        phase: "api-request",
        url: "/api/student/dashboard",
        errorName: "TypeError",
        errorMessage: "Failed to fetch",
      }),
    );
  });

  it("logs a failed readiness response with status and URL but no request data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Unavailable" }), { status: 503 }),
    );

    await expect(
      diagnoseConnection({ retryDelaysMs: [0] }),
    ).resolves.toMatchObject({ kind: "server-unavailable" });
    expect(console.error).toHaveBeenCalledWith(
      "[NeuroLearn-X API] Request failed",
      expect.objectContaining({
        phase: "health-check",
        url: "/api/ready",
        status: 503,
      }),
    );
    const diagnostic = vi.mocked(console.error).mock.calls[0]?.[1];
    expect(diagnostic).not.toHaveProperty("headers");
    expect(diagnostic).not.toHaveProperty("body");
  });

  it("reports offline only when the browser is offline and requests fail", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/api/student/dashboard")).rejects.toMatchObject({
      connectionKind: "offline",
    });
  });

  it("does not assume every failed cross-origin request is a CORS problem", () => {
    expect(
      classifyFailedConnection(true, { error: null, crossOrigin: true }),
    ).toBe("server-unavailable");
  });

  it("treats 401 and 403 on authenticated routes as an expired session", async () => {
    for (const status of [401, 403]) {
      resetConnectionStateForTests();
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Session expired" }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const rejection = await api("/api/student/dashboard").catch((error) => error);
      expect(rejection).toBeInstanceOf(ApiError);
      expect(rejection).toMatchObject({
        status,
        connectionKind: "session-expired",
        handledByConnectionStatus: true,
      });
      expect(inlineApiError(rejection)).toBe("");
    }
  });

  it("does not log the expected signed-out auth probe as a server failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Sign in required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      api("/api/auth/me", { suppressSessionExpiry: true }),
    ).rejects.toMatchObject({ status: 401 });
    expect(console.error).not.toHaveBeenCalled();
    expect(currentConnectionState().kind).toBe("online");
  });

  it("does not label reachable 404 or 500 responses as no internet", async () => {
    for (const status of [404, 500]) {
      resetConnectionStateForTests();
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: `Server response ${status}` }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await expect(api("/api/settings")).rejects.toMatchObject({ status });
      expect(currentConnectionState().kind).toBe("online");
    }
  });

  it("surfaces server validation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Weights must total 1" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api("/api/settings")).rejects.toEqual(
      expect.objectContaining({
        message: "Weights must total 1",
        status: 422,
      }),
    );
  });
});
