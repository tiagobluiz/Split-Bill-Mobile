function normalizePath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildPathFromParsedUrl(parsed: URL) {
  if (parsed.hostname === "expo-development-client") {
    return "/";
  }

  const normalizedPath = normalizePath(parsed.pathname || "/");
  const includeHostnameInPath =
    parsed.hostname &&
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:";

  if (!includeHostnameInPath) {
    return `${normalizedPath}${parsed.search}${parsed.hash}`;
  }

  const hostPath = normalizePath(parsed.hostname);
  const combinedPath =
    normalizedPath === "/"
      ? hostPath
      : normalizePath(`${hostPath}/${normalizedPath.replace(/^\/+/, "")}`);
  return `${combinedPath}${parsed.search}${parsed.hash}`;
}

type NormalizeInternalRouteOptions = {
  emptyFallback?: string;
};

export function normalizeInternalRoute(
  urlCandidate: unknown,
  options: NormalizeInternalRouteOptions = {},
) {
  const { emptyFallback = "" } = options;
  if (typeof urlCandidate !== "string") {
    return emptyFallback;
  }

  const trimmed = urlCandidate.trim();
  if (!trimmed) {
    return emptyFallback;
  }

  if (trimmed.startsWith("/")) {
    return normalizePath(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return buildPathFromParsedUrl(parsed);
  } catch {
    return normalizePath(trimmed);
  }
}

