import { normalizeInternalRoute } from "../src/lib/internalRoute";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  return normalizeInternalRoute(path, { emptyFallback: "/" });
}
