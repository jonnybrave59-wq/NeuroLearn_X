import { describe, expect, it } from "vitest";
import {
  INTERNET_REQUIRED,
  cacheApiResponse,
  getCachedApiResponse,
  isOfflineReadable,
  pendingSyncCount,
  queuePathwayCompletion,
} from "./offline";

describe("private offline data policy", () => {
  it("never marks authenticated API responses as offline-readable", () => {
    expect(isOfflineReadable("/api/student/dashboard")).toBe(false);
    expect(isOfflineReadable("/api/teacher/students")).toBe(false);
  });

  it("does not return cached research records", async () => {
    await cacheApiResponse("/api/student/dashboard", { participantCode: "STEM001" });
    expect(await getCachedApiResponse("/api/student/dashboard")).toBeUndefined();
  });

  it("requires the server for progress mutations", async () => {
    await expect(
      queuePathwayCompletion("/api/student/pathway-steps/1/complete"),
    ).rejects.toThrow(INTERNET_REQUIRED);
    expect(await pendingSyncCount()).toBe(0);
  });
});
