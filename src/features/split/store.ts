import { create } from "zustand";

import {
  buildClipboardSummary,
  buildPdfExportData,
  computeSettlement,
  createDefaultValues,
  createEmptyItem,
  createId,
  itemHasDuplicate,
  parsePastedItems,
  rebalancePercentAllocations,
  resetPercentAllocations,
  resetShareAllocations,
  syncItemAllocations,
  type SplitMode,
} from "../../domain";
import { cloneDeep, getDeviceLocale } from "../../lib/device";
import {
  deleteRecord,
  getRecordById,
  initializeRecordsStorage,
  listRecords,
  saveRecord,
  type DraftRecord,
} from "../../storage/records";
import {
  getAppSettings,
  initializeSettingsStorage,
  normalizeFeatureFlags,
  saveAppSettings,
  type AppSettings,
} from "../../storage/settings";
import { getDefaultTranslationSettings } from "../../i18n";
import {
  cancelReminder,
  cancelReminderState,
  createEmptyReminderState,
  ensureReminderPermission,
  normalizeReminderState,
  reconcileScheduledReminders,
  scheduleReminder,
  type ReminderEntry,
  type ReminderState,
} from "./reminders";
import { buildRecordRoute } from "./routes";
import { resolveDraftStep } from "./splitFlow";

type ImportMode = "append" | "replace";
type ParticipantsValue = DraftRecord["values"]["participants"];
type ParticipantsUpdater =
  | ParticipantsValue
  | ((participants: ParticipantsValue) => ParticipantsValue);

type SplitStore = {
  ready: boolean;
  records: DraftRecord[];
  activeRecordId: string | null;
  settings: AppSettings;
  bootstrap: () => Promise<void>;
  createDraft: () => Promise<DraftRecord>;
  openRecord: (id: string) => Promise<DraftRecord | null>;
  removeRecord: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateDraftMeta: (
    splitName: string,
    currency: string,
    exchangeRate?: DraftRecord["values"]["exchangeRate"],
    exchangeRatesByPair?: DraftRecord["values"]["exchangeRatesByPair"],
  ) => Promise<void>;
  setStep: (step: number) => Promise<void>;
  updateParticipants: (
    participants: ParticipantsUpdater,
  ) => Promise<void>;
  setPayer: (participantId: string) => Promise<void>;
  createItem: (item: DraftRecord["values"]["items"][number]) => Promise<void>;
  saveItemSplit: (
    itemId: string,
    item: DraftRecord["values"]["items"][number],
  ) => Promise<void>;
  updateItemField: (
    itemId: string,
    field: "name" | "price" | "category",
    value: string,
  ) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  setItemSplitMode: (itemId: string, splitMode: SplitMode) => Promise<void>;
  toggleEvenIncluded: (itemId: string, participantId: string) => Promise<void>;
  setItemSharesValue: (
    itemId: string,
    participantId: string,
    nextValue: string,
  ) => Promise<void>;
  setItemPercentValue: (
    itemId: string,
    participantId: string,
    nextValue: string,
  ) => Promise<boolean>;
  resetItemAllocations: (itemId: string) => Promise<void>;
  focusOnlyParticipant: (
    itemId: string,
    participantId: string,
  ) => Promise<void>;
  importPastedList: (
    rawInput: string,
    mode: ImportMode,
  ) => Promise<{ warningMessages: string[]; warningCodes: string[] }>;
  markBillPaid: () => Promise<void>;
  revertBillPaid: () => Promise<void>;
  toggleParticipantPaid: (participantId: string) => Promise<void>;
  setSplitReminder: (recordId: string, scheduledForIso: string) => Promise<void>;
  clearSplitReminder: (recordId: string) => Promise<void>;
  setParticipantDebtReminder: (
    recordId: string,
    participantId: string,
    scheduledForIso: string,
  ) => Promise<void>;
  clearParticipantDebtReminder: (
    recordId: string,
    participantId: string,
  ) => Promise<void>;
  reconcileReminders: () => Promise<void>;
  markCompleted: () => Promise<void>;
  getActiveRecord: () => DraftRecord | null;
};

function nowIso() {
  return new Date().toISOString();
}

function createDraftRecord(defaultCurrency: string): DraftRecord {
  const timestamp = nowIso();
  return {
    id: createId(),
    status: "draft",
    step: 1,
    values: {
      ...createDefaultValues(getDeviceLocale()),
      currency: defaultCurrency,
    },
    settlementState: {
      settledParticipantIds: [],
    },
    reminderState: createEmptyReminderState(),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

async function persistRecord(record: DraftRecord) {
  await saveRecord(record);
}

function nextRecords(records: DraftRecord[], record: DraftRecord) {
  const otherRecords = records.filter((entry) => entry.id !== record.id);
  return [record, ...otherRecords].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function getSettledDebtorIds(values: DraftRecord["values"]) {
  const settlement = computeSettlement(values);
  if (!settlement.ok) {
    return [];
  }

  const payer = settlement.data.people.find((person) => person.isPayer);
  if (!payer || payer.netCents === 0) {
    return [];
  }

  const targetNetSign = payer.netCents > 0 ? -1 : 1;
  return settlement.data.people
    .filter(
      (person) =>
        !person.isPayer && Math.sign(person.netCents) === targetNetSign,
    )
    .map((person) => person.participantId);
}

function createReminderEntry(notificationId: string, scheduledForIso: string): ReminderEntry {
  const timestamp = nowIso();
  return {
    notificationId,
    scheduledForIso,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function listReminderNotificationIds(reminderState?: ReminderState) {
  const ids = new Set<string>();
  const normalized = normalizeReminderState(reminderState);
  if (normalized.splitReminder?.notificationId) {
    ids.add(normalized.splitReminder.notificationId);
  }
  Object.values(normalized.participantDebtReminders).forEach((entry) => {
    if (entry.notificationId) {
      ids.add(entry.notificationId);
    }
  });
  return ids;
}

function getCurrentDebtorIdSet(record: DraftRecord) {
  return new Set(getSettledDebtorIds(record.values));
}

function pruneReminderState(record: DraftRecord) {
  const normalized = normalizeReminderState(record.reminderState);
  const debtorIds = getCurrentDebtorIdSet(record);
  const settledIds = new Set(record.settlementState?.settledParticipantIds ?? []);
  const participantDebtReminders: ReminderState["participantDebtReminders"] = {};

  Object.entries(normalized.participantDebtReminders).forEach(
    ([participantId, reminder]) => {
      if (!debtorIds.has(participantId) || settledIds.has(participantId)) {
        return;
      }
      participantDebtReminders[participantId] = reminder;
    },
  );

  return normalized.splitReminder
    ? {
        splitReminder: normalized.splitReminder,
        participantDebtReminders,
      }
    : {
        participantDebtReminders,
      };
}

function recordForReminderRoute(record: DraftRecord) {
  return {
    ...record,
    reminderState: pruneReminderState(record),
  };
}

function normalizeActiveRecordMutation(
  record: DraftRecord,
  mutator: (draft: DraftRecord) => void,
  options?: {
    recomputeStatusOnValueChange?: boolean;
  },
) {
  const nextRecord = cloneDeep(record);
  const previousValuesSnapshot = JSON.stringify(record.values);
  if (!nextRecord.settlementState) {
    nextRecord.settlementState = {
      settledParticipantIds: [],
    };
  }
  nextRecord.reminderState = normalizeReminderState(nextRecord.reminderState);
  mutator(nextRecord);
  const hasValuesChanged =
    previousValuesSnapshot !== JSON.stringify(nextRecord.values);
  if (
    options?.recomputeStatusOnValueChange &&
    record.status === "completed" &&
    hasValuesChanged
  ) {
    nextRecord.status = "draft";
    nextRecord.completedAt = null;
  }
  const validSettledIds = new Set(getSettledDebtorIds(nextRecord.values));
  nextRecord.settlementState = {
    settledParticipantIds: (
      nextRecord.settlementState?.settledParticipantIds ?? []
    ).filter((participantId) => validSettledIds.has(participantId)),
  };
  nextRecord.reminderState = pruneReminderState(nextRecord);
  nextRecord.step = resolveDraftStep(nextRecord);
  nextRecord.updatedAt = nowIso();
  return nextRecord;
}

function ensureItemsAligned(values: DraftRecord["values"]) {
  return {
    ...values,
    items: syncItemAllocations(values.items, values.participants),
  };
}

function normalizeOwnerName(value: string) {
  return value.trim().toLowerCase();
}

function isOwnerAlias(name: string, ownerName: string) {
  const normalized = normalizeOwnerName(name);
  if (!normalized) {
    return false;
  }

  return normalized === normalizeOwnerName(ownerName) || normalized === "you";
}

function renameOwnerReferences(
  record: DraftRecord,
  previousOwnerName: string,
  nextOwnerName: string,
) {
  if (!nextOwnerName.trim()) {
    return record;
  }

  const nextRecord = cloneDeep(record);
  let changed = false;
  nextRecord.values.participants = nextRecord.values.participants.map(
    (participant) => {
      if (!isOwnerAlias(participant.name, previousOwnerName)) {
        return participant;
      }

      changed = true;
      return {
        ...participant,
        name: nextOwnerName,
      };
    },
  );

  if (changed) {
    nextRecord.values = ensureItemsAligned(nextRecord.values);
    nextRecord.updatedAt = nowIso();
  }

  return nextRecord;
}

async function withActiveRecord(
  set: (partial: Partial<SplitStore>) => void,
  get: () => SplitStore,
  mutator: (record: DraftRecord) => DraftRecord,
) {
  const active = get().getActiveRecord();
  if (!active) {
    return null;
  }

  const nextRecord = mutator(active);
  const currentIds = listReminderNotificationIds(active.reminderState);
  const nextIds = listReminderNotificationIds(nextRecord.reminderState);
  const removedNotificationIds = [...currentIds]
    .filter((id) => !nextIds.has(id));
  await Promise.allSettled(
    removedNotificationIds.map((notificationId) =>
      cancelReminder(notificationId),
    ),
  );
  set({
    activeRecordId: nextRecord.id,
    records: nextRecords(get().records, nextRecord),
  });
  await persistRecord(nextRecord);
  return nextRecord;
}

async function withRecordById(
  set: (partial: Partial<SplitStore>) => void,
  get: () => SplitStore,
  recordId: string,
  mutator: (record: DraftRecord) => DraftRecord,
) {
  const existing = get().records.find((record) => record.id === recordId);
  if (!existing) {
    return null;
  }

  const nextRecord = mutator(existing);
  const currentIds = listReminderNotificationIds(existing.reminderState);
  const nextIds = listReminderNotificationIds(nextRecord.reminderState);
  const removedIds = [...currentIds].filter((id) => !nextIds.has(id));
  await Promise.allSettled(removedIds.map((notificationId) => cancelReminder(notificationId)));

  const updatedRecords = nextRecords(get().records, nextRecord);
  set({
    records: updatedRecords,
    activeRecordId:
      get().activeRecordId === recordId ? recordId : get().activeRecordId,
  });
  await persistRecord(nextRecord);
  return nextRecord;
}

export const useSplitStore = create<SplitStore>((set, get) => ({
  ready: false,
  records: [],
  activeRecordId: null,
  settings: {
    ...getDefaultTranslationSettings(getDeviceLocale()),
    ownerName: "You",
    ownerProfileImageUri: "",
    balanceFeatureEnabled: true,
    trackPaymentsFeatureEnabled: true,
    defaultCurrency: "EUR",
    splitListAmountDisplay: "remaining",
    customCurrencies: [],
  },
  async bootstrap() {
    await initializeSettingsStorage();
    await initializeRecordsStorage();
    const [rawRecords, settings] = await Promise.all([
      listRecords(),
      getAppSettings(),
    ]);
    const { records, changed } = await reconcileScheduledReminders(rawRecords);
    if (changed) {
      await Promise.all(records.map((record) => saveRecord(record)));
    }
    set({
      ready: true,
      records,
      settings,
      activeRecordId: records[0]?.id ?? null,
    });
  },
  async createDraft() {
    const draft = createDraftRecord(get().settings.defaultCurrency);
    const previousActiveRecordId = get().activeRecordId;
    set({
      activeRecordId: draft.id,
      records: nextRecords(get().records, draft),
    });
    try {
      await persistRecord(draft);
    } catch (error) {
      set((state) => {
        const records = state.records.filter((record) => record.id !== draft.id);
        const fallbackActiveRecordId =
          state.activeRecordId === draft.id
            ? previousActiveRecordId
            : state.activeRecordId;
        const activeRecordId =
          fallbackActiveRecordId &&
          records.some((record) => record.id === fallbackActiveRecordId)
            ? fallbackActiveRecordId
            : (records[0]?.id ?? null);

        return {
          records,
          activeRecordId,
        };
      });
      throw error;
    }
    return draft;
  },
  async openRecord(id) {
    const existing = get().records.find((record) => record.id === id);
    if (existing) {
      set({ activeRecordId: id });
      return existing;
    }

    const record = await getRecordById(id);
    if (!record) {
      return null;
    }

    set({
      activeRecordId: id,
      records: nextRecords(get().records, record),
    });
    return record;
  },
  async removeRecord(id) {
    const existing = get().records.find((record) => record.id === id);
    if (existing?.reminderState) {
      await cancelReminderState(existing.reminderState);
    }
    await deleteRecord(id);
    const next = get().records.filter((record) => record.id !== id);
    set({
      records: next,
      activeRecordId:
        get().activeRecordId === id
          ? (next[0]?.id ?? null)
          : get().activeRecordId,
    });
  },
  async updateSettings(partial) {
    const previousOwnerName = get().settings.ownerName || "";
    const mergedSettings = {
      ...get().settings,
      ...partial,
    };
    const normalizedFlags = normalizeFeatureFlags({
      balanceFeatureEnabled: mergedSettings.balanceFeatureEnabled,
      trackPaymentsFeatureEnabled: mergedSettings.trackPaymentsFeatureEnabled,
    });
    const nextSettings = {
      ...mergedSettings,
      ...normalizedFlags,
    };
    const nextOwnerName = nextSettings.ownerName || "";
    const nextRecords =
      normalizeOwnerName(previousOwnerName) !==
      normalizeOwnerName(nextOwnerName)
        ? get().records.map((record) =>
            renameOwnerReferences(record, previousOwnerName, nextOwnerName),
          )
        : get().records;

    set({
      settings: nextSettings,
      records: nextRecords,
    });
    await Promise.all(nextRecords.map((record) => saveRecord(record)));
    await saveAppSettings(nextSettings);
  },
  async updateDraftMeta(splitName, currency, exchangeRate, exchangeRatesByPair) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.splitName = splitName.slice(0, 20);
        draft.values.currency =
          currency.trim().toUpperCase() || get().settings.defaultCurrency;
        draft.values.exchangeRate = exchangeRate;
        if (exchangeRatesByPair !== undefined) {
          draft.values.exchangeRatesByPair = exchangeRatesByPair;
        }
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async setStep(step) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.step = step;
      }),
    );
  },
  async updateParticipants(participants) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const nextParticipants =
          typeof participants === "function"
            ? participants(draft.values.participants)
            : participants;
        draft.values.participants = nextParticipants;
        if (
          !nextParticipants.some(
            (participant) => participant.id === draft.values.payerParticipantId,
          )
        ) {
          draft.values.payerParticipantId = "";
        }
        draft.settlementState.settledParticipantIds =
          draft.settlementState.settledParticipantIds.filter((participantId) =>
            nextParticipants.some(
              (participant) => participant.id === participantId,
            ),
          );
        draft.values = ensureItemsAligned(draft.values);
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async setPayer(participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.payerParticipantId = participantId;
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async createItem(item) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const [syncedItem] = syncItemAllocations(
          [item],
          draft.values.participants,
        );
        draft.values.items.push(syncedItem);
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async saveItemSplit(itemId, item) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const [syncedItem] = syncItemAllocations(
          [{ ...item, id: itemId }],
          draft.values.participants,
        );
        draft.values.items = draft.values.items.map((entry) =>
          entry.id === itemId ? syncedItem : entry,
        );
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async updateItemField(itemId, field, value) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item,
        );
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async removeItem(itemId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.filter(
          (item) => item.id !== itemId,
        );
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async setItemSplitMode(itemId, splitMode) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          if (splitMode === "percent") {
            return {
              ...item,
              splitMode,
              allocations: resetPercentAllocations(item.allocations),
            };
          }

          if (splitMode === "shares") {
            return {
              ...item,
              splitMode,
              allocations: resetShareAllocations(item.allocations),
            };
          }

          return {
            ...item,
            splitMode,
            allocations: item.allocations.map((allocation) => ({
              ...allocation,
              evenIncluded: true,
            })),
          };
        });
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async toggleEvenIncluded(itemId, participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                allocations: item.allocations.map((allocation) =>
                  allocation.participantId === participantId
                    ? { ...allocation, evenIncluded: !allocation.evenIncluded }
                    : allocation,
                ),
              }
            : item,
        );
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async setItemSharesValue(itemId, participantId, nextValue) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                allocations: item.allocations.map((allocation) =>
                  allocation.participantId === participantId
                    ? { ...allocation, shares: nextValue }
                    : allocation,
                ),
              }
            : item,
        );
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async setItemPercentValue(itemId, participantId, nextValue) {
    let didChange = false;
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          const nextAllocations = rebalancePercentAllocations(
            item.allocations,
            participantId,
            nextValue,
          );
          if (!nextAllocations) {
            return item;
          }

          didChange = true;
          return { ...item, allocations: nextAllocations };
        });
      }, { recomputeStatusOnValueChange: true }),
    );
    return didChange;
  },
  async resetItemAllocations(itemId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          if (item.splitMode === "percent") {
            return {
              ...item,
              allocations: resetPercentAllocations(item.allocations),
            };
          }

          if (item.splitMode === "shares") {
            return {
              ...item,
              allocations: resetShareAllocations(item.allocations),
            };
          }

          return {
            ...item,
            allocations: item.allocations.map((allocation) => ({
              ...allocation,
              evenIncluded: true,
            })),
          };
        });
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async focusOnlyParticipant(itemId, participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          if (item.splitMode === "even") {
            return {
              ...item,
              allocations: item.allocations.map((allocation) => ({
                ...allocation,
                evenIncluded: allocation.participantId === participantId,
              })),
            };
          }

          if (item.splitMode === "shares") {
            return {
              ...item,
              allocations: item.allocations.map((allocation) => ({
                ...allocation,
                shares: allocation.participantId === participantId ? "1" : "0",
              })),
            };
          }

          return {
            ...item,
            allocations: item.allocations.map((allocation) => ({
              ...allocation,
              percent: allocation.participantId === participantId ? "100" : "0",
              percentLocked: allocation.participantId === participantId,
            })),
          };
        });
      }, { recomputeStatusOnValueChange: true }),
    );
  },
  async importPastedList(rawInput, mode) {
    const parsed = parsePastedItems(rawInput);
    let skippedDuplicateCount = 0;
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const existingItems = draft.values.items.filter(
          (item) => item.name.trim() || item.price.trim(),
        );
        const importedItems: DraftRecord["values"]["items"] = [];

        parsed.items.forEach((item) => {
          const nextItem = createEmptyItem(draft.values.participants);
          const importedItem = {
            ...nextItem,
            name: item.name,
            price: item.price,
          };
          const duplicateScope =
            mode === "replace" ? importedItems : [...existingItems, ...importedItems];

          if (itemHasDuplicate(duplicateScope, importedItem)) {
            skippedDuplicateCount += 1;
            return;
          }

          importedItems.push(importedItem);
        });

        draft.values.items =
          mode === "replace"
            ? importedItems.length > 0
              ? importedItems
              : draft.values.items
            : [
                ...existingItems,
                ...importedItems,
              ];
      }, { recomputeStatusOnValueChange: true }),
    );
    return {
      warningCodes: [
        ...parsed.warnings.map((warning) => warning.code),
        ...(skippedDuplicateCount > 0 ? ["ignored-duplicate-imported-items"] : []),
      ],
      warningMessages: [
        ...parsed.warnings.map((warning) => warning.message),
        ...(skippedDuplicateCount > 0
          ? [
              `Ignored ${skippedDuplicateCount} duplicate imported ${
                skippedDuplicateCount === 1 ? "item" : "items"
              }.`,
            ]
          : []),
      ],
    };
  },
  async markBillPaid() {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.settlementState.settledParticipantIds = getSettledDebtorIds(
          draft.values,
        );
        draft.reminderState = createEmptyReminderState();
      }),
    );
  },
  async revertBillPaid() {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.settlementState.settledParticipantIds = [];
      }),
    );
  },
  async toggleParticipantPaid(participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const debtorIds = new Set(getSettledDebtorIds(draft.values));
        if (!debtorIds.has(participantId)) {
          return;
        }
        const settledIds = new Set(draft.settlementState.settledParticipantIds);
        if (settledIds.has(participantId)) {
          settledIds.delete(participantId);
        } else {
          settledIds.add(participantId);
        }
        draft.settlementState.settledParticipantIds = [...settledIds];
      }),
    );
  },
  async setSplitReminder(recordId, scheduledForIso) {
    const record = get().records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }

    const hasPermission = await ensureReminderPermission();
    if (!hasPermission) {
      throw new Error("notification-permission-denied");
    }

    const reminderUrl = buildRecordRoute(recordForReminderRoute(record));
    const { notificationId } = await scheduleReminder({
      target: "split",
      draftId: record.id,
      splitName: record.values.splitName?.trim(),
      translation: {
        language: get().settings.language,
        humour: get().settings.humour,
      },
      url: reminderUrl,
      scheduledForIso,
    });

    try {
      await withRecordById(set, get, recordId, (currentRecord) =>
        normalizeActiveRecordMutation(currentRecord, (draft) => {
          const nextReminderState = normalizeReminderState(draft.reminderState);
          draft.reminderState = {
            ...nextReminderState,
            splitReminder: createReminderEntry(notificationId, scheduledForIso),
          };
        }),
      );
    } catch (error) {
      await cancelReminder(notificationId);
      throw error;
    }
  },
  async clearSplitReminder(recordId) {
    await withRecordById(set, get, recordId, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const nextReminderState = normalizeReminderState(draft.reminderState);
        draft.reminderState = {
          participantDebtReminders: nextReminderState.participantDebtReminders,
        };
      }),
    );
  },
  async setParticipantDebtReminder(recordId, participantId, scheduledForIso) {
    const record = get().records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }

    const debtorIds = getCurrentDebtorIdSet(record);
    const settledIds = new Set(record.settlementState?.settledParticipantIds ?? []);
    if (!debtorIds.has(participantId) || settledIds.has(participantId)) {
      throw new Error("participant-debt-not-actionable");
    }

    const participantName = record.values.participants.find(
      (participant) => participant.id === participantId,
    )?.name;
    const hasPermission = await ensureReminderPermission();
    if (!hasPermission) {
      throw new Error("notification-permission-denied");
    }

    const { notificationId } = await scheduleReminder({
      target: "participantDebt",
      draftId: record.id,
      participantId,
      splitName: record.values.splitName?.trim(),
      participantName,
      translation: {
        language: get().settings.language,
        humour: get().settings.humour,
      },
      url: `/split/${record.id}/results`,
      scheduledForIso,
    });

    try {
      await withRecordById(set, get, recordId, (currentRecord) =>
        normalizeActiveRecordMutation(currentRecord, (draft) => {
          const nextReminderState = normalizeReminderState(draft.reminderState);
          draft.reminderState = {
            ...nextReminderState,
            participantDebtReminders: {
              ...nextReminderState.participantDebtReminders,
              [participantId]: createReminderEntry(notificationId, scheduledForIso),
            },
          };
        }),
      );
    } catch (error) {
      await cancelReminder(notificationId);
      throw error;
    }
  },
  async clearParticipantDebtReminder(recordId, participantId) {
    await withRecordById(set, get, recordId, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        const nextReminderState = normalizeReminderState(draft.reminderState);
        const participantDebtReminders = {
          ...nextReminderState.participantDebtReminders,
        };
        delete participantDebtReminders[participantId];
        draft.reminderState = nextReminderState.splitReminder
          ? {
              splitReminder: nextReminderState.splitReminder,
              participantDebtReminders,
            }
          : {
              participantDebtReminders,
            };
      }),
    );
  },
  async reconcileReminders() {
    const currentRecords = get().records;
    const { records: reconciledRecords, changed } =
      await reconcileScheduledReminders(currentRecords);
    if (!changed) {
      return;
    }
    set({
      records: reconciledRecords,
      activeRecordId: reconciledRecords.some(
        (record) => record.id === get().activeRecordId,
      )
        ? get().activeRecordId
        : (reconciledRecords[0]?.id ?? null),
    });
    await Promise.all(reconciledRecords.map((record) => saveRecord(record)));
  },
  async markCompleted() {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.status = "completed";
        draft.completedAt = draft.completedAt ?? nowIso();
        draft.step = 6;
      }),
    );
  },
  getActiveRecord() {
    return (
      get().records.find((record) => record.id === get().activeRecordId) ?? null
    );
  },
}));

export function getSettlementPreview(record: DraftRecord | null) {
  if (!record) {
    return null;
  }

  return computeSettlement(record.values);
}

export function getClipboardSummaryPreview(record: DraftRecord | null, appCurrency?: string) {
  if (!record) {
    return null;
  }

  return buildClipboardSummary(record.values, getDeviceLocale(), {
    settledParticipantIds: record.settlementState?.settledParticipantIds ?? [],
    appCurrency,
  });
}

export function getPdfExportPreview(record: DraftRecord | null) {
  if (!record) {
    return null;
  }

  try {
    return buildPdfExportData(record.values, new Date(), getDeviceLocale());
  } catch {
    return null;
  }
}
