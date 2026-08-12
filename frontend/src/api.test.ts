import { afterEach, describe, expect, it, vi } from "vitest";
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
  status: "ok",
  service: "NeuroLearn-X API",
};

describe("API client", () => {
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

  it("retries Render's temporary 200 HTML loading page", async () => {
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

  it("distinguishes a stopped same-origin backend from an offline device", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/api/student/dashboard")).rejects.toMatchObject({
      connectionKind: "server-unavailable",
    });
    expect(currentConnectionState().kind).toBe("server-unavailable");
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
