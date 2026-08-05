// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus, InstallButton, publicShareUrl } from "./pwa";
import { resetConnectionStateForTests, setConnectionState } from "./connection";
import { resetApiDiagnosticsForTests } from "./api";

function installMatchMedia(installed = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: installed && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("PWA controls", () => {
  beforeEach(() => {
    installMatchMedia();
    window.history.replaceState({}, "", "/#/student/pathway?token=private");
  });

  afterEach(() => {
    cleanup();
    resetConnectionStateForTests();
    resetApiDiagnosticsForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shares only the public origin and root route", () => {
    expect(publicShareUrl()).toBe(`${window.location.origin}/#/`);
  });

  it("shows manual installation guidance when no native prompt is available", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    );
    render(<InstallButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Install NeuroLearn-X" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Install NeuroLearn-X" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
  });

  it("hides installation when the browser offers no supported install path", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    );
    render(<InstallButton />);
    expect(
      screen.queryByRole("button", { name: "Install NeuroLearn-X" }),
    ).not.toBeInTheDocument();
  });

  it("hides the installation control in standalone mode", () => {
    installMatchMedia(true);
    render(<InstallButton />);
    expect(
      screen.queryByRole("button", { name: "Install NeuroLearn-X" }),
    ).not.toBeInTheDocument();
  });

  it("shows one server warning and reconnects with Retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "ok", service: "NeuroLearn-X API" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    render(<ConnectionStatus />);
    expect(
      await screen.findByText(
        "NeuroLearn-X cannot reach the server right now. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("connection-status")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.queryByTestId("connection-status")).not.toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the session-expired message instead of an internet warning", async () => {
    setConnectionState("session-expired");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "ok", service: "NeuroLearn-X API" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<ConnectionStatus />);
    expect(
      await screen.findByText("Your session has expired. Please sign in again."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Internet connection is required for this feature."),
    ).not.toBeInTheDocument();
  });
});
