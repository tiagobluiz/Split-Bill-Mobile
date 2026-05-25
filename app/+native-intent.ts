function normalizePath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  const trimmed = path?.trim();
  if (!trimmed) {
    return "/";
  }

  if (trimmed.startsWith("/")) {
    return normalizePath(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "expo-development-client") {
      return "/";
    }

    return `${normalizePath(parsed.pathname || "/")}${parsed.search}${parsed.hash}`;
  } catch {
    return normalizePath(trimmed);
  }
}
