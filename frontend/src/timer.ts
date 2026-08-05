export function remainingSeconds(expiresAtMs: number, nowMs = Date.now()) {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function countdownTone(seconds: number) {
  if (seconds <= 10) return "critical";
  if (seconds <= 30) return "warning";
  return "normal";
}

export function shouldPlayFinalTick(previous: number, current: number) {
  return current >= 1 && current <= 3 && current < previous;
}
