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
  updateDraftMeta: (splitName: string, currency: string) => Promise<void>;
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

function normalizeActiveRecordMutation(
  record: DraftRecord,
  mutator: (draft: DraftRecord) => void,
) {
  const nextRecord = cloneDeep(record);
  if (!nextRecord.settlementState) {
    nextRecord.settlementState = {
      settledParticipantIds: [],
    };
  }
  mutator(nextRecord);
  const validSettledIds = new Set(getSettledDebtorIds(nextRecord.values));
  nextRecord.settlementState = {
    settledParticipantIds: (
      nextRecord.settlementState?.settledParticipantIds ?? []
    ).filter((participantId) => validSettledIds.has(participantId)),
  };
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
  set({
    activeRecordId: nextRecord.id,
    records: nextRecords(get().records, nextRecord),
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
    const [records, settings] = await Promise.all([
      listRecords(),
      getAppSettings(),
    ]);
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
  async updateDraftMeta(splitName, currency) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.splitName = splitName.slice(0, 20);
        draft.values.currency =
          currency.trim().toUpperCase() || get().settings.defaultCurrency;
      }),
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
      }),
    );
  },
  async setPayer(participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.payerParticipantId = participantId;
      }),
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
      }),
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
      }),
    );
  },
  async updateItemField(itemId, field, value) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item,
        );
      }),
    );
  },
  async removeItem(itemId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.items = draft.values.items.filter(
          (item) => item.id !== itemId,
        );
      }),
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
      }),
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
      }),
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
      }),
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
      }),
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
      }),
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
      }),
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
      }),
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

export function getClipboardSummaryPreview(record: DraftRecord | null) {
  if (!record) {
    return null;
  }

  return buildClipboardSummary(record.values, getDeviceLocale(), {
    settledParticipantIds: record.settlementState?.settledParticipantIds ?? [],
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
