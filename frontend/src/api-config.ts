export type ApiConfiguration = {
  baseUrl: string;
  healthUrl: string;
  crossOrigin: boolean;
  error: string | null;
};

function isLoopback(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized.split(".").join("") === "localhost" ||
    normalized === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

/**
 * Resolve the API origin without ever falling back to a development server.
 * An empty VITE_API_BASE_URL intentionally means same-origin `/api` routes.
 */
export function resolveApiConfiguration(
  rawBaseUrl: string | undefined,
  frontendHref: string,
): ApiConfiguration {
  const frontendUrl = new URL(frontendHref);
  const raw = (rawBaseUrl || "").trim();

  if (!raw) {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: false,
      error: null,
    };
  }

  let backendUrl: URL;
  try {
    backendUrl = new URL(raw);
  } catch {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: false,
      error: "VITE_API_BASE_URL must be an absolute HTTP(S) origin.",
    };
  }

  if (!/^https?:$/.test(backendUrl.protocol)) {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: false,
      error: "VITE_API_BASE_URL must use HTTP or HTTPS.",
    };
  }

  if (
    backendUrl.username ||
    backendUrl.password ||
    backendUrl.search ||
    backendUrl.hash ||
    !["", "/"].includes(backendUrl.pathname)
  ) {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: false,
      error: "VITE_API_BASE_URL must contain only the backend origin.",
    };
  }

  if (isLoopback(backendUrl.hostname) && !isLoopback(frontendUrl.hostname)) {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: true,
      error: "A deployed application cannot use a loopback API address.",
    };
  }

  if (frontendUrl.protocol === "https:" && backendUrl.protocol !== "https:") {
    return {
      baseUrl: "",
      healthUrl: "/api/ready",
      crossOrigin: true,
      error: "An HTTPS application cannot connect to an HTTP API.",
    };
  }

  const baseUrl = backendUrl.origin;
  return {
    baseUrl,
    healthUrl: `${baseUrl}/api/ready`,
    crossOrigin: baseUrl !== frontendUrl.origin,
    error: null,
  };
}

const frontendHref =
  typeof window === "undefined" ? "https://neurolearnx.invalid/" : window.location.href;

export const API_CONFIGURATION = resolveApiConfiguration(
  import.meta.env.VITE_API_BASE_URL,
  frontendHref,
);

export const API_BASE = API_CONFIGURATION.baseUrl;

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
