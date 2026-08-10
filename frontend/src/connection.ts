export type ConnectionKind =
  | "loading"
  | "server-starting"
  | "online"
  | "offline"
  | "server-unavailable"
  | "session-expired"
  | "configuration-error";

export type ConnectionState = {
  kind: ConnectionKind;
  message: string;
};

export const CONNECTION_MESSAGES: Record<ConnectionKind, string> = {
  loading: "Connecting to NeuroLearn-X…",
  "server-starting": "Starting NeuroLearn-X server…",
  online: "Connected to NeuroLearn-X.",
  offline: "You appear to be offline. Check your connection and try again.",
  "server-unavailable":
    "NeuroLearn-X cannot reach the server right now. Please try again.",
  "session-expired": "Your session has expired. Please sign in again.",
  "configuration-error": "The application server is not configured correctly.",
};

let currentState: ConnectionState = {
  kind: "loading",
  message: CONNECTION_MESSAGES.loading,
};

const subscribers = new Set<(state: ConnectionState) => void>();

export function getConnectionState() {
  return currentState;
}

export function subscribeConnection(
  subscriber: (state: ConnectionState) => void,
) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function setConnectionState(
  kind: ConnectionKind,
  options: { clearSessionExpired?: boolean } = {},
) {
  if (
    currentState.kind === "session-expired" &&
    kind === "online" &&
    !options.clearSessionExpired
  ) {
    return currentState;
  }

  const nextState = { kind, message: CONNECTION_MESSAGES[kind] };
  if (
    currentState.kind === nextState.kind &&
    currentState.message === nextState.message
  ) {
    return currentState;
  }

  currentState = nextState;
  subscribers.forEach((subscriber) => subscriber(currentState));
  return currentState;
}

export function resetConnectionStateForTests() {
  currentState = {
    kind: "loading",
    message: CONNECTION_MESSAGES.loading,
  };
}
