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

export function getDeviceLanguage() {
  const locale = getDeviceLocale();
  return locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
}
