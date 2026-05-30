import { Platform } from "react-native";

const mockSetAnalyticsCollectionEnabled = jest.fn(async () => undefined);
const mockLogEvent = jest.fn(async () => undefined);
const mockSetCrashlyticsCollectionEnabled = jest.fn(async () => undefined);
const mockCrashlyticsLog = jest.fn();
const mockRecordCrashError = jest.fn();

jest.mock("@react-native-firebase/analytics", () => ({
  __esModule: true,
  default: () => ({
    setAnalyticsCollectionEnabled: mockSetAnalyticsCollectionEnabled,
    logEvent: mockLogEvent,
  }),
}));

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({
    setCrashlyticsCollectionEnabled: mockSetCrashlyticsCollectionEnabled,
    log: mockCrashlyticsLog,
    recordError: mockRecordCrashError,
  }),
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalPlatformOsDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  "OS",
);

function loadTelemetryModule() {
  let module: typeof import("./telemetry");
  jest.isolateModules(() => {
    module = require("./telemetry");
  });
  return module!;
}

describe("telemetry", () => {
  beforeEach(() => {
    jest.resetModules();
    mockSetAnalyticsCollectionEnabled.mockReset();
    mockLogEvent.mockReset();
    mockSetCrashlyticsCollectionEnabled.mockReset();
    mockCrashlyticsLog.mockReset();
    mockRecordCrashError.mockReset();
    mockSetAnalyticsCollectionEnabled.mockResolvedValue(undefined);
    mockLogEvent.mockResolvedValue(undefined);
    mockSetCrashlyticsCollectionEnabled.mockResolvedValue(undefined);
    process.env.NODE_ENV = "development";
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalPlatformOsDescriptor) {
      Object.defineProperty(Platform, "OS", originalPlatformOsDescriptor);
    }
  });

  it("initializes native Firebase analytics and crashlytics collection", async () => {
    const telemetry = loadTelemetryModule();

    await telemetry.initializeTelemetry();

    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(true);
    expect(mockSetCrashlyticsCollectionEnabled).toHaveBeenCalledWith(true);
  });

  it("tracks analytics events with params", async () => {
    const telemetry = loadTelemetryModule();

    await telemetry.trackEvent("item_insertion_success", {
      method: "manual",
      item_count: 1,
      provider: "none",
      import_mode: "none",
    });

    expect(mockLogEvent).toHaveBeenCalledWith("item_insertion_success", {
      method: "manual",
      item_count: 1,
      provider: "none",
      import_mode: "none",
    });
  });

  it("tracks split lifecycle helper events", async () => {
    const telemetry = loadTelemetryModule();

    await telemetry.trackSplitFlowStarted({
      source: "home",
      hasDefaultCurrency: true,
    });
    await telemetry.trackSplitStepCompleted({
      step: "setup",
      draftStatus: "draft",
    });
    await telemetry.trackSplitFlowCompleted({
      draftId: "draft-1",
      participantCount: 3,
      itemCount: 4,
      currency: "eur",
    });

    expect(mockLogEvent).toHaveBeenCalledWith("split_flow_started", {
      source: "home",
      has_default_currency: "yes",
    });
    expect(mockLogEvent).toHaveBeenCalledWith("split_step_completed", {
      step: "setup",
      draft_status: "draft",
    });
    expect(mockLogEvent).toHaveBeenCalledWith("split_flow_completed", {
      participant_count: 3,
      item_count: 4,
      currency: "EUR",
      had_ai_items: "no",
    });
  });

  it("tracks split mode usage once per draft/mode and respects item origin", async () => {
    const telemetry = loadTelemetryModule();
    telemetry.rememberItemOrigins("draft-1", ["item-ai"], "ai_handover");

    await telemetry.trackItemSplitModeUsedOnce({
      draftId: "draft-1",
      itemId: "item-ai",
      mode: "shares",
    });
    await telemetry.trackItemSplitModeUsedOnce({
      draftId: "draft-1",
      itemId: "item-ai",
      mode: "shares",
    });

    expect(mockLogEvent).toHaveBeenCalledWith("item_split_mode_used", {
      mode: "shares",
      method_origin: "ai_handover",
    });
    const splitModeCalls = mockLogEvent.mock.calls.filter(
      (call: any[]) => call[0] === "item_split_mode_used",
    );
    expect(splitModeCalls).toHaveLength(1);
  });

  it("records crash errors with context safely", () => {
    const telemetry = loadTelemetryModule();

    telemetry.recordError(new Error("save failed"), {
      screen: "AssignItemScreen",
      action: "saveEditor",
    });

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      JSON.stringify({
        screen: "AssignItemScreen",
        action: "saveEditor",
      }),
    );
    expect(mockRecordCrashError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "save failed",
      }),
    );
  });

  it("no-ops in test environment", async () => {
    process.env.NODE_ENV = "test";
    const telemetry = loadTelemetryModule();

    await telemetry.initializeTelemetry();
    await telemetry.trackEvent("item_insertion_success", {
      method: "manual",
      item_count: 1,
      provider: "none",
      import_mode: "none",
    });
    telemetry.recordError(new Error("ignored"));

    expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalled();
    expect(mockSetCrashlyticsCollectionEnabled).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockRecordCrashError).not.toHaveBeenCalled();
  });

  it("does not throw when Firebase SDK calls fail", async () => {
    mockSetAnalyticsCollectionEnabled.mockRejectedValueOnce(
      new Error("analytics unavailable"),
    );
    mockSetCrashlyticsCollectionEnabled.mockRejectedValueOnce(
      new Error("crashlytics unavailable"),
    );
    mockLogEvent.mockRejectedValueOnce(new Error("log failed"));
    mockRecordCrashError.mockImplementationOnce(() => {
      throw new Error("record error failed");
    });
    const telemetry = loadTelemetryModule();

    await expect(telemetry.initializeTelemetry()).resolves.toBeUndefined();
    await expect(
      telemetry.trackEvent("item_insertion_success", {
        method: "manual",
        item_count: 1,
        provider: "none",
        import_mode: "none",
      }),
    ).resolves.toBeUndefined();
    expect(() => telemetry.recordError(new Error("save failed"))).not.toThrow();
  });

  it("supports disabling telemetry at runtime", async () => {
    const telemetry = loadTelemetryModule();

    telemetry.setTelemetryEnabled(false);
    await telemetry.trackEvent("item_insertion_success", {
      method: "manual",
      item_count: 1,
      provider: "none",
      import_mode: "none",
    });
    telemetry.recordError(new Error("save failed"));

    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockRecordCrashError).not.toHaveBeenCalled();
  });
});
