import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";


function BrokenSection(): never {
  throw new Error("sensitive internal details");
}


describe("AppErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a safe recovery page without exposing the thrown error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenSection />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("This section could not be displayed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload application/ })).toBeInTheDocument();
    expect(screen.queryByText("sensitive internal details")).not.toBeInTheDocument();
  });
});
