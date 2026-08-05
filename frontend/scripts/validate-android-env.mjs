const raw = (process.env.VITE_API_BASE_URL || "").trim();

function isPrivateOrLoopback(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  if (/^10(?:\.\d{1,3}){3}$/.test(host) || /^192\.168(?:\.\d{1,3}){2}$/.test(host)) {
    return true;
  }
  const match172 = host.match(/^172\.(\d{1,3})(?:\.\d{1,3}){2}$/);
  return Boolean(match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31);
}

let url;
try {
  url = new URL(raw);
} catch {
  throw new Error("Android builds require VITE_API_BASE_URL to be the deployed HTTPS origin.");
}

if (
  url.protocol !== "https:" ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  url.username ||
  url.password ||
  isPrivateOrLoopback(url.hostname)
) {
  throw new Error(
    "VITE_API_BASE_URL must be a clean public HTTPS origin, never localhost or a private IP.",
  );
}

console.log(`Android API origin validated: ${url.origin}`);
