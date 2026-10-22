import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  cancelReminder,
  cancelReminderState,
  createEmptyReminderState,
  ensureReminderPermission,
  normalizeReminderState,
  reconcileScheduledReminders,
  scheduleReminder,
} from "./reminders";

jest.mock("expo-notifications", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));

const translation = { language: "en" as const, humour: "plain" as const };
const future = "2099-02-03T10:00:00.000Z";
const reminder = (overrides = {}) => ({
  scheduledForIso: future,
  notificationId: "notice-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

describe("reminder persistence and notification behavior", () => {
  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  });

  it("normalizes malformed state and entries while preserving valid timestamps", () => {
    expect(createEmptyReminderState()).toEqual({ participantDebtReminders: {} });
    expect(normalizeReminderState(null)).toEqual({ participantDebtReminders: {} });
    expect(normalizeReminderState({
      splitReminder: { ...reminder(), scheduledForIso: "not a date" },
      participantDebtReminders: {
        "  ana  ": reminder({ notificationId: " id " }),
        "   ": reminder(),
        bruno: { ...reminder(), notificationId: " " },
        carla: { scheduledForIso: future, notificationId: "new", createdAt: "", updatedAt: "" },
      },
    })).toEqual({
      participantDebtReminders: {
        ana: { ...reminder(), notificationId: "id" },
        carla: expect.objectContaining({ scheduledForIso: future, notificationId: "new" }),
      },
    });
    expect(normalizeReminderState({
      splitReminder: reminder(),
      participantDebtReminders: [],
    })).toEqual({ splitReminder: reminder(), participantDebtReminders: {} });
  });

  it("requests permission only when current permission is not already granted", async () => {
    const get = Notifications.getPermissionsAsync as jest.Mock;
    const request = Notifications.requestPermissionsAsync as jest.Mock;
    get.mockResolvedValueOnce({ status: "granted", granted: false });
    expect(await ensureReminderPermission()).toBe(true);
    expect(request).not.toHaveBeenCalled();

    get.mockResolvedValueOnce({ status: "denied", granted: false });
    request.mockResolvedValueOnce({ status: "undetermined", granted: true });
    expect(await ensureReminderPermission()).toBe(true);

    get.mockResolvedValueOnce({ status: "undetermined", granted: false });
    request.mockResolvedValueOnce({ status: "denied", granted: false });
    expect(await ensureReminderPermission()).toBe(false);
  });

  it("rejects invalid and past dates before touching notifications", async () => {
    await expect(scheduleReminder({ target: "split", draftId: "d1", translation, url: "/", scheduledForIso: "bad" })).rejects.toThrow("invalid-reminder-date");
    await expect(scheduleReminder({ target: "split", draftId: "d1", translation, url: "/", scheduledForIso: "2000-01-01T00:00:00.000Z" })).rejects.toThrow("past-reminder-date");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("schedules named and unnamed split and participant reminders with Android channel data", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    const splitResult = await scheduleReminder({ target: "split", draftId: "d1", splitName: "  Lisbon dinner ", translation, url: "/split/d1", scheduledForIso: future });
    const debtResult = await scheduleReminder({ target: "participantDebt", draftId: "d2", participantId: "p1", translation, url: "/split/d2", scheduledForIso: future });
    const namedDebtResult = await scheduleReminder({ target: "participantDebt", draftId: "d3", participantName: " Ana ", translation, url: "/split/d3", scheduledForIso: future });

    expect(splitResult.notificationId).toBe("notification-id");
    expect(debtResult.notificationId).toBe("notification-id");
    expect(namedDebtResult.notificationId).toBe("notification-id");
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(1, expect.objectContaining({
      content: expect.objectContaining({ title: "Lisbon dinner", data: expect.objectContaining({ draftId: "d1", target: "split" }) }),
      trigger: expect.objectContaining({ channelId: "split-reminders" }),
    }));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({ content: expect.objectContaining({ body: expect.any(String) }) }));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(3, expect.objectContaining({ content: expect.objectContaining({ body: expect.any(String) }) }));
  });

  it("omits Android channel setup on iOS and cancels only nonempty IDs", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    await scheduleReminder({ target: "split", draftId: "d1", translation, url: "/", scheduledForIso: future });
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.not.objectContaining({ channelId: expect.anything() }),
    }));

    await cancelReminder(undefined);
    await cancelReminder("  ");
    await cancelReminder(" notice-1 ");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(" notice-1 ");
  });

  it("cancels split and participant notifications and tolerates individual cancellation failures", async () => {
    const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
    cancel.mockRejectedValueOnce(new Error("gone"));
    await cancelReminderState(undefined);
    await cancelReminderState({
      splitReminder: reminder({ notificationId: "split-notice" }),
      participantDebtReminders: { ana: reminder({ notificationId: "debt-notice" }), bruno: reminder({ notificationId: "" }) },
    });
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("drops expired, malformed, and removed-person reminders but retains valid state", async () => {
    const records = [{
      id: "d1",
      values: { participants: [{ id: "ana" }] },
      reminderState: {
        splitReminder: reminder({ notificationId: "expired-split", scheduledForIso: "2000-01-01T00:00:00.000Z" }),
        participantDebtReminders: {
          ana: reminder({ notificationId: "valid-debt" }),
          removed: reminder({ notificationId: "removed-debt" }),
          expired: reminder({ notificationId: "expired-debt", scheduledForIso: "2000-01-01T00:00:00.000Z" }),
        },
      },
    }];
    const result = await reconcileScheduledReminders(records);
    expect(result.changed).toBe(true);
    expect(result.records[0].reminderState).toEqual({ participantDebtReminders: { ana: reminder({ notificationId: "valid-debt" }) } });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it("normalizes reminder state without reporting a change when all entries remain valid", async () => {
    const result = await reconcileScheduledReminders([{
      id: "d1",
      values: { participants: [{ id: "ana" }] },
      reminderState: { splitReminder: reminder(), participantDebtReminders: { ana: reminder() } },
    }]);
    expect(result.changed).toBe(false);
    expect(result.records[0].reminderState).toEqual({ splitReminder: reminder(), participantDebtReminders: { ana: reminder() } });
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
