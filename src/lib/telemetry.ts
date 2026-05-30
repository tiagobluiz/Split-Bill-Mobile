import { Platform } from "react-native";

type AnalyticsParamValue = string | number;
type AnalyticsParams = Record<string, AnalyticsParamValue>;
type ItemInsertionMethod = "manual" | "ai_handover";
type SplitStepName =
  | "setup"
  | "participants"
  | "payer"
  | "items"
  | "overview"
  | "results";
type SplitStatus = "draft" | "completed";
type SplitModeName = "even" | "shares" | "percent";

type AnalyticsInstance = {
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  logEvent: (name: string, params?: AnalyticsParams) => Promise<void>;
};

type CrashlyticsInstance = {
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  log: (message: string) => void;
  recordError: (error: Error) => void;
};

let telemetryEnabled = true;
let telemetryInitialized = false;
const itemOriginByDraftId = new Map<string, Map<string, ItemInsertionMethod>>();
const trackedSplitModesByDraftId = new Set<string>();

function shouldSkipTelemetry() {
  return (
    !telemetryEnabled ||
    Platform.OS !== "android" ||
    process.env.NODE_ENV === "test"
  );
}

function getAnalyticsInstance(): AnalyticsInstance | null {
  try {
    const module = require("@react-native-firebase/analytics") as {
      default?: () => AnalyticsInstance;
    };
    return typeof module.default === "function" ? module.default() : null;
  } catch {
    return null;
  }
}

function getCrashlyticsInstance(): CrashlyticsInstance | null {
  try {
    const module = require("@react-native-firebase/crashlytics") as {
      default?: () => CrashlyticsInstance;
    };
    return typeof module.default === "function" ? module.default() : null;
  } catch {
    return null;
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown telemetry error");
}

function normalizeCrashContext(context?: unknown) {
  if (!context) {
    return "";
  }

  if (typeof context === "string") {
    return context;
  }

  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

export function setTelemetryEnabled(enabled: boolean) {
  telemetryEnabled = enabled;
}

export async function initializeTelemetry() {
  if (telemetryInitialized || shouldSkipTelemetry()) {
    return;
  }

  const analyticsInstance = getAnalyticsInstance();
  const crashlyticsInstance = getCrashlyticsInstance();
  if (!analyticsInstance || !crashlyticsInstance) {
    return;
  }

  try {
    await Promise.all([
      analyticsInstance.setAnalyticsCollectionEnabled(true),
      crashlyticsInstance.setCrashlyticsCollectionEnabled(true),
    ]);
    telemetryInitialized = true;
  } catch {
    // no-op: telemetry must never break app flow
  }
}

export async function trackEvent(name: string, params?: AnalyticsParams) {
  if (shouldSkipTelemetry()) {
    return;
  }

  const analyticsInstance = getAnalyticsInstance();
  if (!analyticsInstance) {
    return;
  }

  try {
    await analyticsInstance.logEvent(name, params);
  } catch {
    // no-op: telemetry must never break app flow
  }
}

export function recordError(error: unknown, context?: unknown) {
  if (shouldSkipTelemetry()) {
    return;
  }

  const crashlyticsInstance = getCrashlyticsInstance();
  if (!crashlyticsInstance) {
    return;
  }

  try {
    const normalizedContext = normalizeCrashContext(context);
    if (normalizedContext) {
      crashlyticsInstance.log(normalizedContext);
    }
    crashlyticsInstance.recordError(toError(error));
  } catch {
    // no-op: telemetry must never break app flow
  }
}

function getOrCreateItemOriginMap(draftId: string) {
  const existing = itemOriginByDraftId.get(draftId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, ItemInsertionMethod>();
  itemOriginByDraftId.set(draftId, created);
  return created;
}

function draftHasAiItems(draftId: string) {
  const originMap = itemOriginByDraftId.get(draftId);
  if (!originMap) {
    return false;
  }

  for (const origin of originMap.values()) {
    if (origin === "ai_handover") {
      return true;
    }
  }

  return false;
}

export function rememberItemOrigins(
  draftId: string,
  itemIds: string[],
  method: ItemInsertionMethod,
) {
  if (!draftId.trim() || itemIds.length === 0) {
    return;
  }

  const originMap = getOrCreateItemOriginMap(draftId);
  itemIds.forEach((itemId) => {
    if (!itemId.trim()) {
      return;
    }
    originMap.set(itemId, method);
  });
}

export async function trackSplitFlowStarted(params: {
  source: "home";
  hasDefaultCurrency: boolean;
}) {
  await trackEvent("split_flow_started", {
    source: params.source,
    has_default_currency: params.hasDefaultCurrency ? "yes" : "no",
  });
}

export async function trackSplitStepCompleted(params: {
  step: SplitStepName;
  draftStatus: SplitStatus;
}) {
  await trackEvent("split_step_completed", {
    step: params.step,
    draft_status: params.draftStatus,
  });
}

export async function trackSplitFlowCompleted(params: {
  draftId: string;
  participantCount: number;
  itemCount: number;
  currency: string;
}) {
  await trackEvent("split_flow_completed", {
    participant_count: params.participantCount,
    item_count: params.itemCount,
    currency: params.currency.trim().toUpperCase(),
    had_ai_items: draftHasAiItems(params.draftId) ? "yes" : "no",
  });
}

export async function trackItemSplitModeUsedOnce(params: {
  draftId: string;
  itemId: string;
  mode: SplitModeName;
}) {
  const dedupeKey = `${params.draftId}:${params.mode}`;
  if (trackedSplitModesByDraftId.has(dedupeKey)) {
    return;
  }

  const originMap = itemOriginByDraftId.get(params.draftId);
  const methodOrigin =
    originMap?.get(params.itemId) ??
    (draftHasAiItems(params.draftId) ? "ai_handover" : "manual");

  await trackEvent("item_split_mode_used", {
    mode: params.mode,
    method_origin: methodOrigin,
  });
  trackedSplitModesByDraftId.add(dedupeKey);
}
