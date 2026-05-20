import * as Localization from "expo-localization";

export function getDeviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

export function prefers24HourTime() {
  try {
    const calendars = Localization.getCalendars?.() ?? [];
    const primaryCalendar = calendars[0] as
      | { uses24hourClock?: boolean; uses24HourClock?: boolean }
      | undefined;
    if (typeof primaryCalendar?.uses24hourClock === "boolean") {
      return primaryCalendar.uses24hourClock;
    }
    if (typeof primaryCalendar?.uses24HourClock === "boolean") {
      return primaryCalendar.uses24HourClock;
    }

    const resolved = Intl.DateTimeFormat().resolvedOptions();
    if (resolved.hour12 === false) {
      return true;
    }
    if (resolved.hour12 === true) {
      return false;
    }
    if (resolved.hourCycle === "h23" || resolved.hourCycle === "h24") {
      return true;
    }
    if (resolved.hourCycle === "h11" || resolved.hourCycle === "h12") {
      return false;
    }
    const locale = (resolved.locale || "").toLowerCase();
    return locale.includes("-u-hc-h23") || locale.includes("-u-hc-h24");
  } catch {
    return false;
  }
}

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getDeviceLanguage() {
  const locale = getDeviceLocale();
  return locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
}
