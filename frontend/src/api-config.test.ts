import { describe, expect, it } from "vitest";
import { resolveApiConfiguration } from "./api-config";

describe("API configuration", () => {
  it("uses relative API routes for a same-origin deployment", () => {
    expect(
      resolveApiConfiguration(undefined, "https://learn.example.edu/#/student"),
    ).toEqual({
      baseUrl: "",
      healthUrl: "/api/health",
      crossOrigin: false,
      error: null,
    });
  });

  it("accepts a separate HTTPS API origin", () => {
    expect(
      resolveApiConfiguration(
        "https://api.example.edu/",
        "https://learn.example.edu/#/student",
      ),
    ).toMatchObject({
      baseUrl: "https://api.example.edu",
      healthUrl: "https://api.example.edu/api/health",
      crossOrigin: true,
      error: null,
    });
  });

  it("rejects mixed content", () => {
    expect(
      resolveApiConfiguration(
        "http://api.example.edu",
        "https://learn.example.edu/#/student",
      ).error,
    ).toContain("HTTPS application");
  });

  it("rejects deployed loopback API URLs", () => {
    expect(
      resolveApiConfiguration(
        "http://127.0.0.1:8021",
        "https://learn.example.edu/#/student",
      ).error,
    ).toContain("loopback");
    expect(
      resolveApiConfiguration(
        "http://localhost:8021",
        "https://learn.example.edu/#/student",
      ).error,
    ).toContain("loopback");
  });

  it("rejects an origin with an accidental API path", () => {
    expect(
      resolveApiConfiguration(
        "https://api.example.edu/v1",
        "https://learn.example.edu/#/student",
      ).error,
    ).toContain("only the backend origin");
  });
});
