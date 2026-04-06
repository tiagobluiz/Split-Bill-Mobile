export function getDeviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
