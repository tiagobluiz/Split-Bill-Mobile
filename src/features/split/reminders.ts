import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  translateWithSettings,
  type TranslationSettings,
} from "../../i18n";

export type ReminderTarget = "split" | "participantDebt";

export type ReminderEntry = {
  scheduledForIso: string;
  notificationId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderState = {
  splitReminder?: ReminderEntry;
  participantDebtReminders: Record<string, ReminderEntry>;
};

export type ReminderScheduleInput = {
  target: ReminderTarget;
  draftId: string;
  participantId?: string;
  splitName?: string;
  participantName?: string;
  translation: TranslationSettings;
  url: string;
  scheduledForIso: string;
};

const REMINDER_CHANNEL_ID = "split-reminders";

let hasConfiguredChannel = false;

function nowIso() {
  return new Date().toISOString();
}

function toScheduledDate(scheduledForIso: string) {
  const date = new Date(scheduledForIso);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date;
}

function normalizeReminderEntry(value: unknown): ReminderEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as Partial<ReminderEntry>;
  const scheduledForIso =
    typeof payload.scheduledForIso === "string"
      ? payload.scheduledForIso.trim()
      : "";
  const notificationId =
    typeof payload.notificationId === "string"
      ? payload.notificationId.trim()
      : "";
  const createdAt =
    typeof payload.createdAt === "string" && payload.createdAt.trim()
      ? payload.createdAt.trim()
      : nowIso();
  const updatedAt =
    typeof payload.updatedAt === "string" && payload.updatedAt.trim()
      ? payload.updatedAt.trim()
      : createdAt;

  if (!scheduledForIso || !notificationId || !toScheduledDate(scheduledForIso)) {
    return null;
  }

  return {
    scheduledForIso,
    notificationId,
    createdAt,
    updatedAt,
  };
}

export function createEmptyReminderState(): ReminderState {
  return {
    participantDebtReminders: {},
  };
}

export function normalizeReminderState(value: unknown): ReminderState {
  if (!value || typeof value !== "object") {
    return createEmptyReminderState();
  }

  const payload = value as Partial<ReminderState>;
  const splitReminder = normalizeReminderEntry(payload.splitReminder);
  const participantDebtReminders: Record<string, ReminderEntry> = {};

  if (
    payload.participantDebtReminders &&
    typeof payload.participantDebtReminders === "object"
  ) {
    Object.entries(payload.participantDebtReminders).forEach(
      ([participantId, entry]) => {
        if (!participantId.trim()) {
          return;
        }
        const normalized = normalizeReminderEntry(entry);
        if (normalized) {
          participantDebtReminders[participantId] = normalized;
        }
      },
    );
  }

  return splitReminder
    ? {
        splitReminder,
        participantDebtReminders,
      }
    : {
        participantDebtReminders,
      };
}

function isGranted(status: Notifications.PermissionStatus | undefined) {
  return status === Notifications.PermissionStatus.GRANTED;
}

export async function ensureReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current.status) || current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return isGranted(requested.status) || requested.granted;
}

async function ensureReminderChannel() {
  if (Platform.OS !== "android" || hasConfiguredChannel) {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Split reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  hasConfiguredChannel = true;
}

function buildReminderContent(input: ReminderScheduleInput) {
  const splitName = input.splitName?.trim();
  const participantName = input.participantName?.trim();
  const translate = (
    key:
      | "reminders.notification.splitFallbackTitle"
      | "reminders.notification.splitBody"
      | "reminders.notification.debtFallbackTitle"
      | "reminders.notification.debtBodyNamed"
      | "reminders.notification.debtBodyUnnamed",
    params?: Record<string, string>,
  ) =>
    translateWithSettings(input.translation, key, params, {
      fallbackTone: "plain",
    });

  if (input.target === "participantDebt") {
    const fallbackTitle = translate("reminders.notification.debtFallbackTitle");
    const title = splitName || fallbackTitle;
    return {
      title,
      body: participantName
        ? translate("reminders.notification.debtBodyNamed", {
            name: participantName,
          })
        : translate("reminders.notification.debtBodyUnnamed"),
    };
  }

  const fallbackTitle = translate("reminders.notification.splitFallbackTitle");
  const title = splitName || fallbackTitle;
  return {
    title,
    body: translate("reminders.notification.splitBody"),
  };
}

export async function scheduleReminder(input: ReminderScheduleInput) {
  const scheduledForDate = toScheduledDate(input.scheduledForIso);
  if (!scheduledForDate) {
    throw new Error("invalid-reminder-date");
  }
  if (scheduledForDate.getTime() <= Date.now()) {
    throw new Error("past-reminder-date");
  }

  await ensureReminderChannel();
  const content = buildReminderContent(input);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: {
        url: input.url,
        draftId: input.draftId,
        participantId: input.participantId,
        target: input.target,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledForDate,
      ...(Platform.OS === "android"
        ? { channelId: REMINDER_CHANNEL_ID }
        : {}),
    },
  });

  return { notificationId };
}

export async function cancelReminder(notificationId: string | undefined | null) {
  if (!notificationId?.trim()) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelReminderState(reminderState?: ReminderState) {
  if (!reminderState) {
    return;
  }

  const jobs: Promise<void>[] = [];
  if (reminderState.splitReminder?.notificationId) {
    jobs.push(cancelReminder(reminderState.splitReminder.notificationId));
  }
  Object.values(reminderState.participantDebtReminders).forEach((reminder) => {
    if (reminder.notificationId) {
      jobs.push(cancelReminder(reminder.notificationId));
    }
  });
  await Promise.allSettled(jobs);
}

export async function reconcileScheduledReminders<
  T extends {
    id: string;
    values: { participants: Array<{ id: string }> };
    reminderState?: ReminderState;
  },
>(records: T[]) {
  let didChange = false;
  const nowMs = Date.now();
  const nextRecords = await Promise.all(
    records.map(async (record) => {
      const normalizedReminderState = normalizeReminderState(record.reminderState);
      const participantIds = new Set(
        record.values.participants.map((participant) => participant.id),
      );
      const nextParticipantDebtReminders: ReminderState["participantDebtReminders"] =
        {};
      let splitReminder = normalizedReminderState.splitReminder;

      if (splitReminder) {
        const reminderDate = toScheduledDate(splitReminder.scheduledForIso);
        if (!reminderDate || reminderDate.getTime() <= nowMs) {
          await cancelReminder(splitReminder.notificationId);
          splitReminder = undefined;
          didChange = true;
        }
      }

      await Promise.all(
        Object.entries(normalizedReminderState.participantDebtReminders).map(
          async ([participantId, reminder]) => {
            const reminderDate = toScheduledDate(reminder.scheduledForIso);
            if (
              !participantIds.has(participantId) ||
              !reminderDate ||
              reminderDate.getTime() <= nowMs
            ) {
              await cancelReminder(reminder.notificationId);
              didChange = true;
              return;
            }
            nextParticipantDebtReminders[participantId] = reminder;
          },
        ),
      );

      const nextReminderState: ReminderState = splitReminder
        ? {
            splitReminder,
            participantDebtReminders: nextParticipantDebtReminders,
          }
        : {
            participantDebtReminders: nextParticipantDebtReminders,
          };
      const normalizedCurrent = normalizeReminderState(record.reminderState);

      const hasChanged =
        JSON.stringify(normalizedCurrent) !== JSON.stringify(nextReminderState);
      if (hasChanged) {
        didChange = true;
        return {
          ...record,
          reminderState: nextReminderState,
        };
      }

      return {
        ...record,
        reminderState: normalizedCurrent,
      };
    }),
  );

  return {
    records: nextRecords,
    changed: didChange,
  };
}
