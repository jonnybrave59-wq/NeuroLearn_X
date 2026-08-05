import { describe, expect, it } from "vitest";
import {
  countdownTone,
  formatCountdown,
  remainingSeconds,
  shouldPlayFinalTick,
} from "./timer";

describe("persistent assessment timer helpers", () => {
  it("formats a five-minute countdown", () => {
    expect(formatCountdown(300)).toBe("05:00");
    expect(formatCountdown(9)).toBe("00:09");
  });

  it("uses an absolute expiry time so refreshes cannot reset the timer", () => {
    expect(remainingSeconds(400_000, 100_000)).toBe(300);
    expect(remainingSeconds(99_999, 100_000)).toBe(0);
  });

  it("changes tone at 30 and 10 seconds", () => {
    expect(countdownTone(31)).toBe("normal");
    expect(countdownTone(30)).toBe("warning");
    expect(countdownTone(10)).toBe("critical");
  });

  it("ticks only on transitions to 3, 2, and 1", () => {
    expect(shouldPlayFinalTick(4, 3)).toBe(true);
    expect(shouldPlayFinalTick(3, 2)).toBe(true);
    expect(shouldPlayFinalTick(2, 1)).toBe(true);
    expect(shouldPlayFinalTick(5, 4)).toBe(false);
    expect(shouldPlayFinalTick(1, 0)).toBe(false);
    expect(shouldPlayFinalTick(3, 3)).toBe(false);
  });
});
