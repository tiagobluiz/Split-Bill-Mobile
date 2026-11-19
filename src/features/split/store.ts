import { create } from "zustand";

import {
  buildClipboardSummary,
  buildPdfExportData,
  combineItemAmounts,
  getItemTotalForMergeCents,
  computeSettlement,
  createDefaultValues,
  createEmptyItem,
  createId,
  itemHasDuplicate,
  normalizeMoneyInput,
  parseMoneyToCents,
  parsePastedItems,
  rebalancePercentAllocations,
  resetPercentAllocations,
  resetShareAllocations,
  syncItemAllocations,
  normalizeItemName,
  SPLIT_NAME_MAX_LENGTH,
  trimName,
  type SplitMode,
} from "../../domain";
import { cloneDeep, getDeviceLocale } from "../../lib/device";
import { localDay } from "../../domain/splitDate";
import { compareSplitDates } from "../../domain/splitDateOrder";
import {
  rememberItemOrigins,
  syncDraftItemOrigins,
  trackCustomTagCreated,
  trackDefaultTagRemoved,
  trackSplitFlowCompleted,
} from "../../lib/telemetry";
import {
  deleteRecord,
  getRecordById,
  initializeRecordsStorage,
  removeSplitTagAndUpdateSettings,
  saveRecord,
  saveOwnerProfileAndLinkedRecords,
  savePersonAndLinkedRecords,
  saveParticipantGroup,
  type DraftRecord,
  type OwnerProfilePatch,
} from "../../storage/records";
import { deleteParticipantGroup, getGroups, getPeople, saveDirectoryPerson } from "../../storage/directory";
import { migratePersonIdentity } from "../../storage/personIdentityMigration";
import { deleteSavedPerson } from "../../storage/personDeletion";
import { listLegacyRecordIdsForPerson, listPersonNameConflicts, listRecordIdsForPerson } from "../../storage/personMemberships";
import {
  getAppSettings,
  initializeSettingsStorage,
  saveAppSettings,
  type AppSettings,
} from "../../storage/settings";
import {
  createCustomTag,
  isDefaultSplitTag,
  normalizeTagIds,
  normalizeTags,
  type SplitTagColor,
  type SplitTagIcon,
} from "./tags";
import {
  createPerson,
  findPersonByName,
  normalizeGroupName,
  normalizePersonName,
  normalizePersonNameInput,
  validatePersonName,
  type ParticipantGroup,
  type SavedPerson,
} from "./people";
import { selectSplitSettings, type SplitSettingsView } from "./splitSettingsView";
import { removeGroupPhoto } from "./groupPhotos";
import { removePersonPhoto } from "./personPhotos";
import { removeInvoicePhoto } from "./invoicePhotos";
import { getDefaultTranslationSettings, t } from "../../i18n";
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
import { notifyArchiveChange } from "./archiveChanges";
import { reconcileStoredReminders } from "./reconcileStoredReminders";
import { resolveDraftStep } from "./splitFlow";

type ImportMode = "append" | "replace";
type ParticipantsValue = DraftRecord["values"]["participants"];
type ParticipantsUpdater =
  | ParticipantsValue
  | ((participants: ParticipantsValue) => ParticipantsValue);

export type SavePersonResult =
  | { ok: true; personId: string }
  | { ok: false; reason: "invalid-name" | "duplicate" | "owner-alias" | "split-name-conflict" | "last-group-member" | "missing" | "persistence"; personId?: string; recordId?: string; splitName?: string };
export type PersonSaveDetails = {
  personId: string | null;
  name: string;
  photoUri: string | null;
  color: SplitTagColor;
  groupIds: string[];
  restore?: boolean;
};

type SplitStore = {
  ready: boolean;
  records: DraftRecord[];
  activeRecordId: string | null;
  ownerNameWritesPending: number;
  settings: AppSettings;
  people: SavedPerson[];
  participantGroups: ParticipantGroup[];
  ownerPersonId?: string;
  profileSetupCompleted: boolean;
  pendingOwnerName?: string;
  bootstrap: () => Promise<void>;
  createDraft: () => Promise<DraftRecord>;
  openRecord: (id: string, shouldActivate?: () => boolean) => Promise<DraftRecord | null>;
  loadRecord: (id: string, shouldKeep?: () => boolean) => Promise<DraftRecord | null>;
  releaseInactiveRecords: () => void;
  removeRecord: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateOwnerProfile: (partial: OwnerProfilePatch) => Promise<void>;
  upsertPerson: (name: string) => Promise<string | null>;
  updatePerson: (personId: string, name: string) => Promise<boolean>;
  savePerson: (details: PersonSaveDetails) => Promise<SavePersonResult>;
  getPersonDeletionImpact: (personId: string) => Promise<{ used: boolean; splitCount: number; groupCount: number }>;
  removePerson: (personId: string) => Promise<"deleted" | "archived" | "missing">;
  addParticipantGroup: (
    name: string,
    memberPersonIds: string[],
    details?: Partial<Pick<ParticipantGroup, "description" | "photoUri" | "icon" | "color">>,
    newPersonNames?: string[],
  ) => Promise<boolean>;
  updateParticipantGroup: (
    groupId: string,
    details: Partial<ParticipantGroup> & { name: string; memberPersonIds: string[]; newPersonNames?: string[] },
  ) => Promise<boolean>;
  removeParticipantGroup: (groupId: string) => Promise<void>;
  addParticipantsFromGroup: (
    groupId: string,
    personIds?: string[],
    recordId?: string,
  ) => Promise<void>;
  addTag: (
    label: string,
    icon?: SplitTagIcon | null,
    color?: SplitTagColor,
  ) => Promise<boolean>;
  removeTag: (tagId: string) => Promise<void>;
  updateRecordDetails: (
    recordId: string,
    details: { splitName: string; tagIds: string[]; splitDate?: string; invoicePhotoUri?: string | null; invoicePhotoName?: string | null; invoicePhotoSize?: number | null },
  ) => Promise<void>;
  updateDraftMeta: (
    splitName: string,
    currency: string,
    exchangeRate?: DraftRecord["values"]["exchangeRate"],
    exchangeRatesByPair?: DraftRecord["values"]["exchangeRatesByPair"],
    tagIds?: string[],
    splitDate?: string,
    invoicePhotoUri?: string | null,
    invoicePhotoName?: string | null,
    invoicePhotoSize?: number | null,
    recordId?: string,
  ) => Promise<void>;
  setStep: (step: number, recordId?: string) => Promise<void>;
  updateParticipants: (participants: ParticipantsUpdater, recordId?: string) => Promise<void>;
  setPayer: (participantId: string, recordId?: string) => Promise<void>;
  createItem: (item: DraftRecord["values"]["items"][number], recordId?: string) => Promise<string | null>;
  saveItemSplit: (
    itemId: string,
    item: DraftRecord["values"]["items"][number],
    recordId?: string,
  ) => Promise<void>;
  updateItemField: (
    itemId: string,
    field: "name" | "price" | "category",
    value: string,
    recordId?: string,
  ) => Promise<void>;
  removeItem: (itemId: string, recordId?: string) => Promise<void>;
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
    recordId?: string,
  ) => Promise<{
    warningMessages: string[];
    warningCodes: string[];
    importedCount: number;
    skippedDuplicateCount: number;
    importedItemIds: string[];
  }>;
  markBillPaid: (recordId?: string) => Promise<void>;
  revertBillPaid: (recordId?: string) => Promise<void>;
  toggleParticipantPaid: (participantId: string, recordId?: string) => Promise<void>;
  setSplitReminder: (
    recordId: string,
    scheduledForIso: string,
  ) => Promise<void>;
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
  markCompleted: (recordId?: string) => Promise<void>;
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
      splitDate: localDay(new Date(timestamp)),
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

const pendingPeopleByName = new Map<string, SavedPerson>();
const pendingPeopleById = new Map<string, { person: SavedPerson; references: number }>();
const recordWriteStates = new Map<string, {
  nextSequence: number;
  outstanding: number;
  confirmedSequence: number;
  confirmedRecord: DraftRecord;
}>();

function resolveParticipantPerson(participant: ParticipantsValue[number], settings: SplitSettingsView) {
  if (participant.personId) return { participant, created: null as SavedPerson | null, restorePersonId: null as string | null };
  const normalized = normalizePersonNameInput(participant.name);
  if (validatePersonName(normalized, [], undefined, { allowOwnerPlaceholder: true })) {
    // Invalid split drafts remain visible to step validation, without creating registry entries.
    return { participant: { ...participant, name: normalized }, created: null as SavedPerson | null, restorePersonId: null as string | null };
  }
  if (settings.ownerPersonId && isOwnerAlias(normalized, settings.ownerName)) {
    return { participant: { ...participant, personId: settings.ownerPersonId }, created: null, restorePersonId: null };
  }
  const existing = findPersonByName(settings.people ?? [], normalized);
  if (existing) return { participant: { ...participant, name: existing.name, personId: existing.id }, created: null, restorePersonId: existing.archivedAt ? existing.id : null };
  const key = normalized.toLowerCase();
  let person = pendingPeopleByName.get(key);
  if (!person) {
    person = createPerson(normalized) ?? undefined;
    if (person) {
      pendingPeopleByName.set(key, person);
      pendingPeopleById.set(person.id, { person, references: 0 });
    }
  }
  return person
    ? { participant: { ...participant, name: person.name, personId: person.id }, created: person, restorePersonId: null }
    : { participant, created: null, restorePersonId: null };
}

async function persistRecord(record: DraftRecord, pendingPeople: SavedPerson[] = [], rollbackRecord: DraftRecord = record, restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  let writeState = recordWriteStates.get(record.id);
  if (!writeState) {
    writeState = { nextSequence: 0, outstanding: 0, confirmedSequence: 0, confirmedRecord: rollbackRecord };
    recordWriteStates.set(record.id, writeState);
  }
  const sequence = ++writeState.nextSequence;
  writeState.outstanding += 1;
  const referencedPending = [...pendingPeople];
  const pendingIds = new Set(referencedPending.map((person) => person.id));
  for (const participant of record.values.participants) {
    if (!participant.personId || pendingIds.has(participant.personId)) continue;
    const pending = pendingPeopleById.get(participant.personId)?.person;
    if (pending) { referencedPending.push(pending); pendingIds.add(pending.id); }
  }
  for (const person of referencedPending) {
    const pending = pendingPeopleById.get(person.id);
    if (pending) pending.references += 1;
  }
  try {
    const saved = restorePersonIds.length
      ? await saveRecord(record, referencedPending, restorePersonIds, incrementGroupUsageId)
      : incrementGroupUsageId
        ? await saveRecord(record, referencedPending, [], incrementGroupUsageId)
        : referencedPending.length
          ? await saveRecord(record, referencedPending)
          : await saveRecord(record);
    writeState = recordWriteStates.get(record.id)!;
    if (sequence >= writeState.confirmedSequence) {
      writeState.confirmedSequence = sequence;
      writeState.confirmedRecord = saved?.record ?? record;
      notifyArchiveChange({ type: "upsert", record: writeState.confirmedRecord });
    }
    if (saved) {
      useSplitStore.setState((state) => {
        const current = state.records.find((entry) => entry.id === record.id);
        const isCurrentMutation = current === record;
        const persistedGroup = saved.groupUsage;
        return {
          ...(saved.people?.length ? { people: applyPeopleChanges(state.people, saved.people) } : {}),
          ...(persistedGroup ? { participantGroups: state.participantGroups.map((group) =>
            group.id === persistedGroup.id && persistedGroup.usageCount > group.usageCount
              ? { ...group, usageCount: persistedGroup.usageCount, updatedAt: persistedGroup.updatedAt }
              : group,
          ) } : {}),
          ...(isCurrentMutation ? { records: state.records.map((entry) => entry.id === record.id ? saved.record : entry) } : {}),
        };
      });
    }
    return saved?.record ?? record;
  } finally {
    writeState = recordWriteStates.get(record.id);
    if (writeState) {
      writeState.outstanding -= 1;
      if (writeState.outstanding === 0) {
        const current = useSplitStore.getState().records.find((entry) => entry.id === record.id);
        const latestWriteFailed = current && writeState.confirmedSequence < writeState.nextSequence;
        if (latestWriteFailed) {
          useSplitStore.setState((state) => ({ records: nextRecords(state.records, writeState!.confirmedRecord) }));
        }
        recordWriteStates.delete(record.id);
      }
    }
    for (const person of referencedPending) {
      const pending = pendingPeopleById.get(person.id);
      if (!pending) continue;
      pending.references -= 1;
      if (pending.references === 0) {
        pendingPeopleById.delete(person.id);
        const key = normalizePersonName(person.name).toLowerCase();
        if (pendingPeopleByName.get(key)?.id === person.id) pendingPeopleByName.delete(key);
      }
    }
  }
}

function nextRecords(records: DraftRecord[], record: DraftRecord) {
  const otherRecords = records.filter((entry) => entry.id !== record.id);
  return [record, ...otherRecords].sort((left, right) => compareSplitDates(left, right, true));
}

function normalizeLoadedRecord(record: DraftRecord, settings: AppSettings): DraftRecord {
  return { ...record, values: { ...record.values, tagIds: normalizeTagIds(record.values.tagIds, normalizeTags(settings.tags)) } };
}

function applyPeopleChanges(current: SavedPerson[], changed: SavedPerson[]) {
  const byId = new Map(current.map((person) => [person.id, person]));
  for (const person of changed) byId.set(person.id, person);
  return [...byId.values()];
}

function applyGroupChanges(current: ParticipantGroup[], changed: ParticipantGroup[]) {
  const byId = new Map(current.map((group) => [group.id, group]));
  for (const group of changed) {
    const existing = byId.get(group.id);
    byId.set(group.id, existing && existing.usageCount > group.usageCount
      ? { ...group, usageCount: existing.usageCount } : group);
  }
  return [...byId.values()];
}

function publishGroupSave(
  set: (partial: Partial<SplitStore> | ((state: SplitStore) => Partial<SplitStore>)) => void,
  saved: NonNullable<Awaited<ReturnType<typeof saveParticipantGroup>>>,
) {
  set((state) => ({
    ...(saved.people.length ? { people: applyPeopleChanges(state.people, saved.people) } : {}),
    participantGroups: applyGroupChanges(state.participantGroups, [saved.group]),
  }));
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

function createReminderEntry(
  notificationId: string,
  scheduledForIso: string,
): ReminderEntry {
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

function pruneReminderState(record: DraftRecord, debtorIds = getCurrentDebtorIdSet(record)) {
  const normalized = normalizeReminderState(record.reminderState);
  const settledIds = new Set(
    record.settlementState?.settledParticipantIds ?? [],
  );
  const participantDebtReminders: ReminderState["participantDebtReminders"] =
    {};

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
  const previousValuesSnapshot = options?.recomputeStatusOnValueChange && record.status === "completed"
    ? JSON.stringify({ ...record.values, splitDate: undefined, invoicePhotoUri: undefined, invoicePhotoName: undefined, invoicePhotoSize: undefined })
    : null;
  if (!nextRecord.settlementState) {
    nextRecord.settlementState = {
      settledParticipantIds: [],
    };
  }
  nextRecord.reminderState = normalizeReminderState(nextRecord.reminderState);
  mutator(nextRecord);
  if (
    previousValuesSnapshot !== null &&
    previousValuesSnapshot !== JSON.stringify({ ...nextRecord.values, splitDate: undefined, invoicePhotoUri: undefined, invoicePhotoName: undefined, invoicePhotoSize: undefined })
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
  nextRecord.reminderState = pruneReminderState(nextRecord, validSettledIds);
  nextRecord.step = resolveDraftStep(nextRecord);
  nextRecord.updatedAt = nowIso();
  return nextRecord;
}

function normalizeActiveSettlementMutation(
  record: DraftRecord,
  mutator: (draft: DraftRecord) => void,
) {
  const nextRecord = cloneDeep(record);
  if (!nextRecord.settlementState) {
    nextRecord.settlementState = {
      settledParticipantIds: [],
    };
  }
  nextRecord.reminderState = normalizeReminderState(nextRecord.reminderState);
  mutator(nextRecord);
  const validSettledIds = new Set(getSettledDebtorIds(nextRecord.values));
  nextRecord.settlementState = {
    settledParticipantIds: (
      nextRecord.settlementState?.settledParticipantIds ?? []
    ).filter((participantId) => validSettledIds.has(participantId)),
  };
  nextRecord.reminderState = pruneReminderState(nextRecord, validSettledIds);
  nextRecord.updatedAt = nowIso();
  return nextRecord;
}

function ensureItemsAligned(values: DraftRecord["values"]) {
  return {
    ...values,
    items: syncItemAllocations(values.items, values.participants),
  };
}

function formatMergedImportPrice(amountCents: number) {
  return normalizeMoneyInput((amountCents / 100).toFixed(2));
}

function removeImportMergeTarget(
  itemId: string,
  targetLists: Array<DraftRecord["values"]["items"]>,
) {
  targetLists.forEach((targetList) => {
    const targetIndex = targetList.findIndex((entry) => entry.id === itemId);
    if (targetIndex >= 0) {
      targetList.splice(targetIndex, 1);
    }
  });
}

function normalizeOwnerName(value: string) {
  return (value ?? "").trim().toLowerCase();
}

function isOwnerAlias(name: string, ownerName: string) {
  const normalized = normalizeOwnerName(name);
  if (!normalized) {
    return false;
  }

  return normalized === normalizeOwnerName(ownerName) || normalized === "you";
}

function getLinkedParticipant(
  participants: ParticipantsValue,
  person: SavedPerson,
) {
  const normalizedName = normalizePersonName(person.name).toLowerCase();
  return participants.find(
    (participant) =>
      participant.personId === person.id ||
      (!participant.personId && normalizePersonName(participant.name).toLowerCase() === normalizedName),
  );
}

function createParticipantFromPerson(person: SavedPerson) {
  return {
    id: createId(),
    name: person.name,
    personId: person.id,
  };
}

function renameOwnerReferences(
  record: DraftRecord,
  previousOwnerName: string,
  nextOwnerName: string,
  ownerPersonId?: string,
) {
  if (!nextOwnerName.trim()) {
    return record;
  }

  const nextRecord = cloneDeep(record);
  let changed = false;
  nextRecord.values.participants = nextRecord.values.participants.map(
    (participant) => {
      if (participant.name === nextOwnerName ||
          (participant.personId ? participant.personId !== ownerPersonId : !isOwnerAlias(participant.name, previousOwnerName))) {
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

  return changed ? nextRecord : record;
}

function getActiveRecordMutation(
  get: () => SplitStore,
  mutator: (record: DraftRecord) => DraftRecord,
  recordId?: string,
) {
  const active = recordId ? get().records.find((record) => record.id === recordId) : get().getActiveRecord();
  if (!active) {
    return null;
  }

  const nextRecord = mutator(active);
  const currentIds = listReminderNotificationIds(active.reminderState);
  const nextIds = listReminderNotificationIds(nextRecord.reminderState);

  return {
    active,
    nextRecord,
    removedNotificationIds: [...currentIds].filter((id) => !nextIds.has(id)),
  };
}

async function withActiveRecord(
  set: (partial: Partial<SplitStore>) => void,
  get: () => SplitStore,
  mutator: (record: DraftRecord) => DraftRecord,
  recordId?: string,
) {
  const mutation = getActiveRecordMutation(get, mutator, recordId);
  if (!mutation) {
    return null;
  }

  const { active, nextRecord, removedNotificationIds } = mutation;
  set({
    activeRecordId: recordId ? get().activeRecordId : nextRecord.id,
    records: nextRecords(get().records, nextRecord),
  });
  const saved = await persistRecord(nextRecord, [], active);
  await Promise.allSettled(removedNotificationIds.map((notificationId) => cancelReminder(notificationId)));
  return saved;
}

async function withOptimisticActiveRecord(
  set: (partial: Partial<SplitStore>) => void,
  get: () => SplitStore,
  mutator: (record: DraftRecord) => DraftRecord,
  recordId?: string,
) {
  const mutation = getActiveRecordMutation(get, mutator, recordId);
  if (!mutation) {
    return null;
  }

  const { active, nextRecord, removedNotificationIds } = mutation;
  set({
    records: nextRecords(get().records, nextRecord),
  });

  await persistRecord(nextRecord, [], active);
  await Promise.allSettled(
    removedNotificationIds.map((notificationId) =>
      cancelReminder(notificationId),
    ),
  );

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

  const updatedRecords = nextRecords(get().records, nextRecord);
  set({
    records: updatedRecords,
    activeRecordId:
      get().activeRecordId === recordId ? recordId : get().activeRecordId,
  });
  try {
    const saved = await persistRecord(nextRecord, [], existing);
    await Promise.allSettled(removedIds.map((notificationId) => cancelReminder(notificationId)));
    return saved;
  } catch (error) {
    throw error;
  }
}

let storeWriteQueue = Promise.resolve();
let bootstrapPromise: Promise<void> | null = null;
let reminderReconciliationPromise: Promise<void> | null = null;
let ownerNameRevision = 0;

function enqueueStoreWrite<T>(job: () => Promise<T>) {
  const persistSnapshot = storeWriteQueue
    .catch(() => undefined)
    .then(job);
  storeWriteQueue = persistSnapshot.then(
    () => undefined,
    () => undefined,
  );
  return persistSnapshot;
}

function logBootstrapStep(message: string, details?: Record<string, unknown>) {
  console.info(
    `[Split Bill bootstrap] ${message}`,
    details ? JSON.stringify(details) : "",
  );
}

function logBootstrapFailure(
  stage: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  console.error(
    `[Split Bill bootstrap] failed during ${stage}`,
    details ? JSON.stringify(details) : "",
    error,
  );
}

function createBootstrapError(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Bootstrap failed during ${stage}: ${message}`, {
    cause: error,
  });
}

export const useSplitStore = create<SplitStore>((set, get) => ({
  ready: false,
  records: [],
  activeRecordId: null,
  ownerNameWritesPending: 0,
  people: [],
  participantGroups: [],
  profileSetupCompleted: false,
  settings: {
    ...getDefaultTranslationSettings(getDeviceLocale()),
    balanceFeatureEnabled: true,
    defaultCurrency: "EUR",
    splitListAmountDisplay: "remaining",
    tags: normalizeTags(undefined),
    customCurrencies: [],
  },
  async bootstrap() {
    if (get().ready) return;
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
    let stage = "initialize storage";
    const details: Record<string, unknown> = {};
    try {
      logBootstrapStep("start");
      await initializeSettingsStorage();
      await initializeRecordsStorage();
      stage = "migrate person identity";
      await migratePersonIdentity();

      stage = "load persisted data";
      const [settings, directory, participantGroups] = await Promise.all([getAppSettings(), getPeople(), getGroups()]);
      details.settingsTagCount = settings.tags?.length ?? null;
      logBootstrapStep("loaded persisted data", details);

      stage = "commit store state";
      set({
        ready: true,
        records: [],
        settings: { ...settings, tags: normalizeTags(settings.tags) },
        ...directory,
        participantGroups,
        activeRecordId: null,
      });
      logBootstrapStep("complete", { recordCount: 0, activeRecordId: null });
      void get().reconcileReminders().catch((error) => console.warn("[Split Bill] Reminder reconciliation failed", error));
    } catch (error) {
      logBootstrapFailure(stage, error, details);
      throw createBootstrapError(stage, error);
    }
    })();
    try { await bootstrapPromise; } finally { bootstrapPromise = null; }
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
        const records = state.records.filter(
          (record) => record.id !== draft.id,
        );
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
  async openRecord(id, shouldActivate) {
    const existing = get().records.find((record) => record.id === id);
    if (existing) {
      if (shouldActivate?.() !== false && get().activeRecordId !== id) set({ activeRecordId: id });
      return existing;
    }

    const stored = await getRecordById(id);
    if (!stored) {
      return null;
    }
    const record = normalizeLoadedRecord(stored, get().settings);

    if (shouldActivate?.() === false) return record;
    const latest = get().records.find((entry) => entry.id === id) ?? record;
    set({
      activeRecordId: id,
      records: nextRecords(get().records, latest),
    });
    return latest;
  },
  async loadRecord(id, shouldKeep) {
    const existing = get().records.find((record) => record.id === id);
    if (existing) return existing;
    const stored = await getRecordById(id);
    if (!stored) return null;
    const record = normalizeLoadedRecord(stored, get().settings);
    if (shouldKeep?.() === false) return record;
    const latest = get().records.find((entry) => entry.id === id);
    if (latest) return latest;
    set({ records: nextRecords(get().records, record) });
    return record;
  },
  releaseInactiveRecords() {
    set((state) => {
      const records = state.records.filter((record) => recordWriteStates.has(record.id));
      if (records.length === state.records.length && (state.activeRecordId === null || records.some((record) => record.id === state.activeRecordId))) return {};
      return { records, activeRecordId: state.activeRecordId && records.some((record) => record.id === state.activeRecordId) ? state.activeRecordId : null };
    });
  },
  async removeRecord(id) {
    const existing = get().records.find((record) => record.id === id) ?? await getRecordById(id);
    if (existing?.reminderState) {
      await cancelReminderState(existing.reminderState);
    }
    await deleteRecord(id);
    notifyArchiveChange({ type: "delete", id });
    await removeInvoicePhoto(existing?.values.invoicePhotoUri);
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
    await enqueueStoreWrite(async () => {
      const patch = partial.tags ? { ...partial, tags: normalizeTags(partial.tags) } : partial;
      await saveAppSettings(patch);
      set((state) => ({ settings: { ...state.settings, ...patch } }));
    });
  },
  async updateOwnerProfile(partial) {
    const before = get();
    const profile = selectSplitSettings(before);
    if (partial.ownerName !== undefined && partial.ownerName !== profile.ownerName) {
      partial = { ...partial, ownerName: normalizePersonNameInput(partial.ownerName) };
    }
    if (partial.ownerName !== undefined && (partial.ownerName !== profile.ownerName || partial.profileSetupCompleted)) {
      const validation = validatePersonName(partial.ownerName, before.people, before.ownerPersonId);
      if (validation) throw new Error(validation.reason === "duplicate" ? "Owner name conflicts with a saved person" : `Invalid person name: ${validation.reason}`);
    }
    const name = partial.ownerName;
    const revision = name !== undefined ? ++ownerNameRevision : ownerNameRevision;
    const rename = name !== undefined && name !== profile.ownerName;
    const trackName = rename || (name !== undefined && before.pendingOwnerName !== undefined);
    if (trackName) {
      set((state) => ({
        pendingOwnerName: name,
        ownerNameWritesPending: state.ownerNameWritesPending + 1,
        records: state.records.map((record) => renameOwnerReferences(record, profile.ownerName, name, state.ownerPersonId)),
      }));
    }
    try {
      await enqueueStoreWrite(async () => {
        const latest = get();
        const committedOwner = latest.people.find((person) => person.id === latest.ownerPersonId);
        const saved = await saveOwnerProfileAndLinkedRecords(partial);
        const ownerRenamed = saved.owner.name !== (committedOwner?.name ?? "You");
        if (ownerRenamed) notifyArchiveChange({ type: "invalidate" });
        set((state) => {
          const finishingRename = trackName && ownerNameRevision === revision;
          return {
            people: applyPeopleChanges(state.people, [saved.owner]),
            ...(saved.groups.length ? { participantGroups: applyGroupChanges(state.participantGroups, saved.groups) } : {}),
            profileSetupCompleted: saved.profileSetupCompleted,
            ...(finishingRename ? { pendingOwnerName: undefined } : {}),
            ...(ownerRenamed && (state.pendingOwnerName === undefined || finishingRename) ? {
              records: state.records.map((record) =>
                renameOwnerReferences(record, committedOwner?.name ?? "You", saved.owner.name, state.ownerPersonId),
              ),
            } : {}),
          };
        });
      });
    } catch (error) {
      if (trackName && ownerNameRevision === revision) {
        set((state) => {
          const committedName = state.people.find((person) => person.id === state.ownerPersonId)?.name ?? "You";
          return {
            pendingOwnerName: undefined,
            records: state.records.map((record) => renameOwnerReferences(record, name, committedName, state.ownerPersonId)),
          };
        });
      }
      throw error;
    } finally {
      if (trackName) set((state) => ({ ownerNameWritesPending: state.ownerNameWritesPending - 1 }));
    }
  },
  async upsertPerson(name) {
    const normalizedName = normalizePersonName(name);
    if (!normalizedName) {
      return null;
    }
    return enqueueStoreWrite(async () => {
      const settings = selectSplitSettings(get());
      if (isOwnerAlias(normalizedName, settings.ownerName) && settings.ownerPersonId) return settings.ownerPersonId;
      const people = settings.people ?? [];
      const existing = findPersonByName(people, normalizedName);
      if (existing && !existing.archivedAt) return existing.id;
      const person = existing ? { ...existing, archivedAt: null, updatedAt: nowIso() } : createPerson(normalizedName);
      if (!person) return null;
      await saveDirectoryPerson(person);
      set((state) => ({ people: applyPeopleChanges(state.people, [person]) }));
      return person.id;
    });
  },
  async updatePerson(personId, name) {
    const person = (get().people ?? []).find((entry) => entry.id === personId);
    if (!person) return false;
    const result = await get().savePerson({
      personId,
      name,
      photoUri: person.photoUri ?? null,
      color: person.color ?? "orange",
      groupIds: (get().participantGroups ?? [])
        .filter((group) => group.memberPersonIds.includes(personId))
        .map((group) => group.id),
    });
    return result.ok;
  },
  async savePerson(details) {
    if (validatePersonName(details.name, [], undefined, { allowOwnerPlaceholder: true })) return { ok: false, reason: "invalid-name" };
    const normalizedName = normalizePersonNameInput(details.name);
    try {
      return await enqueueStoreWrite(async () => {
        const state = get();
        const { people, ownerPersonId } = state;
        const { ownerName } = selectSplitSettings(state);
        const current = details.personId
          ? people.find((person) => person.id === details.personId)
          : undefined;
        if (details.personId && !current) return { ok: false, reason: "missing" };
        const isOwnerIdentity = Boolean(ownerPersonId && details.personId === ownerPersonId);
        const isCurrentOwnerName = normalizePersonName(normalizedName).toLowerCase() === normalizePersonName(ownerName || "").toLowerCase();
        if (isOwnerAlias(normalizedName, ownerName) && (!isOwnerIdentity || !isCurrentOwnerName)) {
          return { ok: false, reason: "owner-alias", ...(ownerPersonId ? { personId: ownerPersonId } : {}) };
        }
        const nameValidation = validatePersonName(details.name, people, details.personId ?? undefined, { allowOwnerPlaceholder: isOwnerIdentity && isCurrentOwnerName });
        if (nameValidation?.reason === "duplicate") return { ok: false, reason: "duplicate", personId: nameValidation.person.id };
        if (nameValidation) return { ok: false, reason: "invalid-name" };
        const renaming = Boolean(current && normalizePersonName(current.name).toLowerCase() !== normalizedName.toLowerCase());
        const nameKey = normalizedName.toLowerCase();
        if (renaming || !current) {
          const ownerAlias = renaming && isOwnerAlias(normalizedName, ownerName);
          const storedConflicts = await listPersonNameConflicts(normalizedName, details.personId, ownerAlias ? ownerName : undefined);
          const conflicts = new Map(storedConflicts.map((entry) => [entry.id, entry.splitName]));
          const latestRecords = get().records;
          for (const record of latestRecords) {
            const matches = record.values.participants.some((participant) =>
              participant.personId !== details.personId && (normalizePersonName(participant.name).toLowerCase() === nameKey || (ownerAlias && isOwnerAlias(participant.name, ownerName))),
            );
            if (matches) conflicts.set(record.id, record.values.splitName ?? ""); else conflicts.delete(record.id);
          }
          const conflict = conflicts.entries().next().value;
          if (conflict) return { ok: false, reason: "split-name-conflict", recordId: conflict[0], ...(latestRecords.some((record) => record.id === conflict[0]) ? {} : { splitName: conflict[1] }) };
        }

        const groups = state.participantGroups;
        const groupIds = new Set(details.groupIds);
        for (const group of groups) {
          const wasMember = group.memberPersonIds.includes(details.personId ?? "");
          if (wasMember && !groupIds.has(group.id) && group.memberPersonIds.length <= 1) {
            return { ok: false, reason: "last-group-member" };
          }
        }

        const timestamp = nowIso();
        const person: SavedPerson = current
          ? {
              ...current,
              name: normalizedName,
              photoUri: details.photoUri,
              color: details.color,
              archivedAt: details.restore ? null : current.archivedAt,
              updatedAt: timestamp,
            }
          : {
              id: createPerson(normalizedName)!.id,
              name: normalizedName,
              photoUri: details.photoUri,
              color: details.color,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
        const persisted = await savePersonAndLinkedRecords(person, [...groupIds], Boolean(current));
        if (renaming) notifyArchiveChange({ type: "invalidate" });
        set((latest) => {
          const records = current && current.name !== normalizedName
            ? latest.records.map((record) => {
                let changed = false;
                const participants = record.values.participants.map((participant) => {
                  if (participant.personId !== current.id || participant.name === normalizedName) return participant;
                  changed = true;
                  return { ...participant, name: normalizedName };
                });
                return changed ? { ...record, values: { ...record.values, participants }, updatedAt: timestamp } : record;
              })
            : latest.records;
          return {
            people: applyPeopleChanges(latest.people, [persisted.person]),
            ...(persisted.groups.length ? {
              participantGroups: applyGroupChanges(latest.participantGroups, persisted.groups),
            } : {}),
            ...(records !== latest.records ? { records } : {}),
          };
        });
        if (current?.photoUri && current.photoUri !== person.photoUri) await removePersonPhoto(current.photoUri);
        return { ok: true, personId: person.id };
      });
    } catch {
      return { ok: false, reason: "persistence" };
    }
  },
  async getPersonDeletionImpact(personId) {
    const state = get();
    const person = (state.people ?? []).find((entry) => entry.id === personId);
    if (!person) return { used: false, splitCount: 0, groupCount: 0 };
    const nameKey = normalizePersonName(person.name).toLowerCase();
    const [linked, legacy] = await Promise.all([
      listRecordIdsForPerson(personId),
      listLegacyRecordIdsForPerson(person.name, selectSplitSettings(state).ownerName),
    ]);
    const ids = new Set([...linked, ...legacy]);
    const latest = get();
    const { ownerName } = selectSplitSettings(latest);
    for (const record of latest.records) {
      const matches = record.values.participants.some((participant) =>
        participant.personId === personId || (!participant.personId && !isOwnerAlias(participant.name, ownerName) && normalizePersonName(participant.name).toLowerCase() === nameKey),
      );
      if (matches) ids.add(record.id); else ids.delete(record.id);
    }
    const splitCount = ids.size;
    const groupCount = (latest.participantGroups ?? []).filter((group) => group.memberPersonIds.includes(personId)).length;
    return { used: splitCount > 0 || groupCount > 0, splitCount, groupCount };
  },
  async removePerson(personId) {
    if (personId === get().ownerPersonId) return "missing";
    const deleted = await enqueueStoreWrite(async () => {
      const result = await deleteSavedPerson(personId);
      if (result.result !== "missing") set((state) => ({
        people: result.person ? applyPeopleChanges(state.people, [result.person]) : state.people.filter((person) => person.id !== personId),
        ...(result.groups?.length ? { participantGroups: applyGroupChanges(state.participantGroups, result.groups) } : {}),
      }));
      return result;
    });
    if (deleted.result === "deleted") await removePersonPhoto(deleted.photoUri);
    return deleted.result;
  },
  async addParticipantGroup(name, memberPersonIds, details = {}, newPersonNames = []) {
    const normalizedName = normalizeGroupName(name);
    return enqueueStoreWrite(async () => {
      const groups = get().participantGroups;
      if (!normalizedName || groups.some((entry) => entry.name.trim().toLowerCase() === normalizedName.toLowerCase())) return false;
      const saved = await saveParticipantGroup(null, { ...details, name: normalizedName, memberPersonIds, newPersonNames });
      if (!saved) return false;
      publishGroupSave(set, saved);
      return true;
    });
  },
  async updateParticipantGroup(groupId, details) {
    const name = normalizeGroupName(details.name);
    return enqueueStoreWrite(async () => {
      const groups = get().participantGroups;
      if (!name || !groups.some((group) => group.id === groupId)) return false;
      if (groups.some((group) => group.id !== groupId && group.name.trim().toLowerCase() === name.toLowerCase())) return false;
      const previousPhoto = groups.find((group) => group.id === groupId)?.photoUri;
      const saved = await saveParticipantGroup(groupId, { ...details, name, memberPersonIds: details.memberPersonIds, newPersonNames: details.newPersonNames });
      if (!saved) return false;
      publishGroupSave(set, saved);
      if (previousPhoto && previousPhoto !== details.photoUri) await removeGroupPhoto(previousPhoto);
      return true;
    });
  },
  async removeParticipantGroup(groupId) {
    await enqueueStoreWrite(async () => {
      const groups = get().participantGroups;
      const removedPhoto = groups.find((group) => group.id === groupId)?.photoUri;
      if (!groups.some((group) => group.id === groupId)) return;
      await deleteParticipantGroup(groupId);
      set((state) => ({ participantGroups: state.participantGroups.filter((group) => group.id !== groupId) }));
      await removeGroupPhoto(removedPhoto);
    });
  },
  async addParticipantsFromGroup(groupId, personIds, recordId) {
    const { participantGroups: groups, people } = get();
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }
    const requestedIds = new Set((personIds ?? group.memberPersonIds).filter((id) => group.memberPersonIds.includes(id)));
    const peopleToAdd = people.filter(
      (person) => requestedIds.has(person.id) && !person.archivedAt,
    );
    if (peopleToAdd.length === 0) {
      return;
    }
    const before = get().records.find((record) => record.id === (recordId ?? get().activeRecordId));
    if (!before || peopleToAdd.every((person) => getLinkedParticipant(before.values.participants, person))) return;
    const mutation = getActiveRecordMutation(get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          peopleToAdd.forEach((person) => {
            if (getLinkedParticipant(draft.values.participants, person)) return;
            draft.values.participants.push(createParticipantFromPerson(person));
          });
          draft.values = ensureItemsAligned(draft.values);
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
    if (!mutation || mutation.active.id !== before.id) return;
    set({ activeRecordId: recordId ? get().activeRecordId : mutation.nextRecord.id, records: nextRecords(get().records, mutation.nextRecord) });
    await persistRecord(mutation.nextRecord, [], before, [], groupId);
    await Promise.allSettled(mutation.removedNotificationIds.map((notificationId) => cancelReminder(notificationId)));
  },
  async addTag(label, icon, color) {
    const nextTag = await enqueueStoreWrite(async () => {
      const settings = get().settings;
      const tag = createCustomTag(label, settings.tags ?? [], icon, color);
      if (!tag) return null;
      const nextSettings = { ...settings, tags: [...normalizeTags(settings.tags), tag] };
      await saveAppSettings({ tags: nextSettings.tags });
      set((state) => ({ settings: { ...state.settings, tags: nextSettings.tags } }));
      return tag;
    });
    if (!nextTag) return false;
    void trackCustomTagCreated({
      iconType: nextTag.icon
        ? nextTag.icon.startsWith("custom:")
          ? "custom"
          : "default"
        : "none",
    });
    return true;
  },
  async removeTag(tagId) {
    const removedTag = await enqueueStoreWrite(async () => {
    const currentState = get();
    const removed = normalizeTags(currentState.settings.tags).find((tag) => tag.id === tagId);
    const nextSettings = { ...currentState.settings, tags: normalizeTags(currentState.settings.tags).filter((tag) => tag.id !== tagId) };
    await removeSplitTagAndUpdateSettings(tagId, nextSettings);
    notifyArchiveChange({ type: "metadata" });
    set((latest) => ({
      settings: { ...latest.settings, tags: nextSettings.tags },
      records: latest.records.map((record) => (record.values.tagIds ?? []).includes(tagId)
        ? { ...record, values: { ...record.values, tagIds: (record.values.tagIds ?? []).filter((id) => id !== tagId) }, updatedAt: nowIso() }
        : record),
    }));
    return removed;
    });
    if (removedTag && isDefaultSplitTag(removedTag)) {
      void trackDefaultTagRemoved();
    }
  },
  async updateRecordDetails(recordId, details) {
    await withRecordById(set, get, recordId, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.values.splitName = details.splitName.slice(
          0,
          SPLIT_NAME_MAX_LENGTH,
        );
        draft.values.tagIds = normalizeTagIds(
          details.tagIds,
          get().settings.tags,
        );
        if (details.splitDate) draft.values.splitDate = details.splitDate;
        if (details.invoicePhotoUri !== undefined) draft.values.invoicePhotoUri = details.invoicePhotoUri;
        if (details.invoicePhotoName !== undefined) draft.values.invoicePhotoName = details.invoicePhotoName;
        if (details.invoicePhotoSize !== undefined) draft.values.invoicePhotoSize = details.invoicePhotoSize;
      }),
    );
  },
  async updateDraftMeta(
    splitName,
    currency,
    exchangeRate,
    exchangeRatesByPair,
    tagIds,
    splitDate,
    invoicePhotoUri,
    invoicePhotoName,
    invoicePhotoSize,
    recordId,
  ) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          draft.values.splitName = splitName.slice(0, SPLIT_NAME_MAX_LENGTH);
          draft.values.splitDate = splitDate ?? draft.values.splitDate ?? localDay(new Date(draft.createdAt));
          if (invoicePhotoUri !== undefined) draft.values.invoicePhotoUri = invoicePhotoUri;
          if (invoicePhotoName !== undefined) draft.values.invoicePhotoName = invoicePhotoName;
          if (invoicePhotoSize !== undefined) draft.values.invoicePhotoSize = invoicePhotoSize;
          draft.values.currency =
            currency.trim().toUpperCase() || get().settings.defaultCurrency;
          draft.values.exchangeRate = exchangeRate;
          if (exchangeRatesByPair !== undefined) {
            draft.values.exchangeRatesByPair = exchangeRatesByPair;
          }
          if (tagIds !== undefined) {
            draft.values.tagIds = normalizeTagIds(tagIds, get().settings.tags);
          }
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
  },
  async setStep(step, recordId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.step = step;
      }), recordId,
    );
  },
  async updateParticipants(participants, recordId) {
    const target = recordId ? get().records.find((record) => record.id === recordId) : get().getActiveRecord();
    if (!target) return;
    const currentParticipants = target.values.participants;
    const requested = typeof participants === "function" ? participants(currentParticipants) : participants;
    const currentById = new Map(currentParticipants.map((participant) => [participant.id, participant]));
    const pending = new Map<string, SavedPerson>();
    const restorePersonIds = new Set<string>();
    const identifiedParticipants = requested.map((participant) => {
      const prior = currentById.get(participant.id);
      if (prior && !prior.personId) return participant;
      if (prior?.personId && !participant.personId) return { ...participant, personId: prior.personId };
      const resolved = resolveParticipantPerson(participant, selectSplitSettings(get()));
      if (resolved.created) pending.set(resolved.created.id, resolved.created);
      if (resolved.restorePersonId) restorePersonIds.add(resolved.restorePersonId);
      return resolved.participant;
    });
    const nextRecord = normalizeActiveRecordMutation(target, (draft) => {
      draft.values.participants = identifiedParticipants;
      if (!draft.values.participants.some((participant) => participant.id === draft.values.payerParticipantId)) draft.values.payerParticipantId = "";
      draft.settlementState.settledParticipantIds = draft.settlementState.settledParticipantIds.filter((id) => draft.values.participants.some((participant) => participant.id === id));
      draft.values = ensureItemsAligned(draft.values);
    }, { recomputeStatusOnValueChange: true });
    set({ records: nextRecords(get().records, nextRecord) });
    const nextReminderIds = listReminderNotificationIds(nextRecord.reminderState);
    const removedReminderIds = [...listReminderNotificationIds(target.reminderState)].filter((id) => !nextReminderIds.has(id));
    await persistRecord(nextRecord, [...pending.values()], target, [...restorePersonIds]);
    await Promise.allSettled(removedReminderIds.map((notificationId) => cancelReminder(notificationId)));
  },
  async setPayer(participantId, recordId) {
    await withOptimisticActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          draft.values.payerParticipantId = participantId;
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
  },
  async createItem(item, recordId) {
    let createdItemId: string | null = null;
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          if (itemHasDuplicate(draft.values.items, item)) {
            throw new Error("duplicate-item-name");
          }
          let uniqueId = item.id;
          const usedIds = new Set(draft.values.items.map((entry) => entry.id));
          while (usedIds.has(uniqueId)) {
            uniqueId = createId();
          }
          createdItemId = uniqueId;
          const [syncedItem] = syncItemAllocations(
            [{ ...item, id: uniqueId }],
            draft.values.participants,
          );
          draft.values.items.push(syncedItem);
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
    return createdItemId;
  },
  async saveItemSplit(itemId, item, recordId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          const existingItem = draft.values.items.find(
            (entry) => entry.id === itemId,
          );
          if (
            existingItem &&
            normalizeItemName(existingItem.name) !== normalizeItemName(item.name) &&
            itemHasDuplicate(draft.values.items, item, itemId)
          ) {
            throw new Error("duplicate-item-name");
          }
          const [syncedItem] = syncItemAllocations(
            [{ ...item, id: itemId }],
            draft.values.participants,
          );
          draft.values.items = draft.values.items.map((entry) =>
            entry.id === itemId ? syncedItem : entry,
          );
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
  },
  async updateItemField(itemId, field, value, recordId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          const existingItem = draft.values.items.find(
            (item) => item.id === itemId,
          );
          if (
            field === "name" &&
            existingItem &&
            normalizeItemName(existingItem.name) !== normalizeItemName(value) &&
            itemHasDuplicate(
              draft.values.items,
              { ...existingItem, name: value },
              itemId,
            )
          ) {
            throw new Error("duplicate-item-name");
          }
          draft.values.items = draft.values.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item,
          );
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
  },
  async removeItem(itemId, recordId) {
    const mutate = (record: DraftRecord) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          draft.values.items = draft.values.items.filter(
            (item) => item.id !== itemId,
          );
        },
        { recomputeStatusOnValueChange: true },
      );
    const updatedRecord = recordId
      ? await withRecordById(set, get, recordId, mutate)
      : await withActiveRecord(set, get, mutate);
    if (updatedRecord) {
      syncDraftItemOrigins(
        updatedRecord.id,
        updatedRecord.values.items.map((item) => item.id),
      );
    }
  },
  async setItemSplitMode(itemId, splitMode) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
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
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
  },
  async toggleEvenIncluded(itemId, participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          draft.values.items = draft.values.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  allocations: item.allocations.map((allocation) =>
                    allocation.participantId === participantId
                      ? {
                          ...allocation,
                          evenIncluded: !allocation.evenIncluded,
                        }
                      : allocation,
                  ),
                }
              : item,
          );
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
  },
  async setItemSharesValue(itemId, participantId, nextValue) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
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
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
  },
  async setItemPercentValue(itemId, participantId, nextValue) {
    let didChange = false;
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
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
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
    return didChange;
  },
  async resetItemAllocations(itemId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
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
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
  },
  async focusOnlyParticipant(itemId, participantId) {
    await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
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
                  shares:
                    allocation.participantId === participantId ? "1" : "0",
                })),
              };
            }

            return {
              ...item,
              allocations: item.allocations.map((allocation) => ({
                ...allocation,
                percent:
                  allocation.participantId === participantId ? "100" : "0",
                percentLocked: allocation.participantId === participantId,
              })),
            };
          });
        },
        { recomputeStatusOnValueChange: true },
      ),
    );
  },
  async importPastedList(rawInput, mode, recordId) {
    const parsed = parsePastedItems(rawInput);
    let importedCount = 0;
    let importedItemIds: string[] = [];
    let mergedExistingCount = 0;
    let hasAcceptedImport = false;
    const importWarnings: Array<{ code: string; message: string }> = [];
    const updatedRecord = await withActiveRecord(set, get, (record) =>
      normalizeActiveRecordMutation(
        record,
        (draft) => {
          const existingItems = draft.values.items.filter(
            (item) => item.name.trim() || item.price.trim(),
          );
          const importedItems: DraftRecord["values"]["items"] = [];
          const mergeTargets =
            mode === "replace"
              ? importedItems
              : [...existingItems, ...importedItems];

          parsed.items.forEach((item) => {
            const amountCents = parseMoneyToCents(item.price);
            if (amountCents === null || amountCents === 0) {
              return;
            }
            const mergeKey = normalizeItemName(item.name);
            if (!mergeKey) {
              return;
            }
            const existingMatch = mergeTargets.find(
              (candidate) => normalizeItemName(candidate.name) === mergeKey,
            );
            if (existingMatch) {
              const existingCents = getItemTotalForMergeCents(existingMatch);
              if (existingCents === null) {
                importWarnings.push({ code: "invalid-existing-item", message: t("pasteImport.invalidExistingItem", { item: trimName(item.name) }) });
                return;
              }
              const mergedCents = combineItemAmounts(existingCents, amountCents);
              if (mergedCents === null) {
                importWarnings.push({
                  code: "invalid-merge-amount-too-high",
                  message: t("pasteImport.invalidMergeAmountTooHigh", {
                    item: trimName(item.name),
                  }),
                });
                return;
              }
              if (mergedCents === 0) {
                const wasExistingItem = existingItems.some(
                  (existingItem) => existingItem.id === existingMatch.id,
                );
                removeImportMergeTarget(existingMatch.id, [
                  existingItems,
                  importedItems,
                  mergeTargets,
                ]);
                if (wasExistingItem) {
                  mergedExistingCount += 1;
                }
                hasAcceptedImport = true;
                return;
              }
              hasAcceptedImport = true;
              existingMatch.price = formatMergedImportPrice(mergedCents);
              existingMatch.quantity = 1;
              existingMatch.discount = null;
              if (
                existingItems.some(
                  (existingItem) => existingItem.id === existingMatch.id,
                )
              ) {
                mergedExistingCount += 1;
              }
              return;
            }

            const nextItem = createEmptyItem(draft.values.participants);
            const usedIds = new Set(mergeTargets.map((entry) => entry.id));
            while (usedIds.has(nextItem.id)) {
              nextItem.id = createId();
            }
            const importedItem = {
              ...nextItem,
              name: trimName(item.name),
              price: formatMergedImportPrice(amountCents),
            };

            importedItems.push(importedItem);
            hasAcceptedImport = true;
            if (mergeTargets !== importedItems) {
              mergeTargets.push(importedItem);
            }
          });
          importedCount = importedItems.length + mergedExistingCount;
          importedItemIds = importedItems.map((entry) => entry.id);

          draft.values.items =
            mode === "replace"
              ? hasAcceptedImport
                ? importedItems
                : draft.values.items
              : [...existingItems, ...importedItems];
        },
        { recomputeStatusOnValueChange: true },
      ), recordId,
    );
    if (updatedRecord) {
      syncDraftItemOrigins(
        updatedRecord.id,
        updatedRecord.values.items.map((item) => item.id),
      );
      if (importedItemIds.length > 0) {
        rememberItemOrigins(updatedRecord.id, importedItemIds, "ai_handover");
      }
    }
    return {
      warningCodes: [
        ...parsed.warnings.map((warning) => warning.code),
        ...importWarnings.map((warning) => warning.code),
      ],
      warningMessages: [
        ...parsed.warnings.map((warning) => warning.message),
        ...importWarnings.map((warning) => warning.message),
      ],
      importedCount,
      skippedDuplicateCount: 0,
      importedItemIds,
    };
  },
  async markBillPaid(recordId) {
    if (get().settings.balanceFeatureEnabled === false) return;
    await withOptimisticActiveRecord(set, get, (record) =>
      normalizeActiveSettlementMutation(record, (draft) => {
        draft.settlementState.settledParticipantIds = getSettledDebtorIds(
          draft.values,
        );
        draft.reminderState = createEmptyReminderState();
      }), recordId,
    );
  },
  async revertBillPaid(recordId) {
    if (get().settings.balanceFeatureEnabled === false) return;
    await withOptimisticActiveRecord(set, get, (record) =>
      normalizeActiveSettlementMutation(record, (draft) => {
        draft.settlementState.settledParticipantIds = [];
      }), recordId,
    );
  },
  async toggleParticipantPaid(participantId, recordId) {
    if (get().settings.balanceFeatureEnabled === false) return;
    await withOptimisticActiveRecord(set, get, (record) =>
      normalizeActiveSettlementMutation(record, (draft) => {
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
      }), recordId,
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
    const settledIds = new Set(
      record.settlementState?.settledParticipantIds ?? [],
    );
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
              [participantId]: createReminderEntry(
                notificationId,
                scheduledForIso,
              ),
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
    if (!get().ready) return;
    if (reminderReconciliationPromise) return reminderReconciliationPromise;
    reminderReconciliationPromise = (async () => {
    let retry: boolean;
    do {
    retry = false;
    const currentRecords = get().records;
    const { records: reconciledRecords, changed, changedRecordIds } =
      await reconcileScheduledReminders(currentRecords);
    if (changed) {
      const changedIds = new Set(changedRecordIds);
      const originals = new Map(currentRecords.map((record) => [record.id, record]));
      const replacements = new Map(reconciledRecords.filter((record) => changedIds.has(record.id)).map((record) => [record.id, record]));
      const toSave: DraftRecord[] = [];
      set((state) => ({ records: state.records.map((record) => {
        const replacement = replacements.get(record.id);
        if (!replacement) return record;
        if (originals.get(record.id) !== record) { retry = true; return record; }
        toSave.push(replacement);
        return replacement;
      }) }));
      await Promise.all(toSave.map((record) => saveRecord(record)));
      if (toSave.length) notifyArchiveChange({ type: "metadata" });
    }
    const stored = await reconcileStoredReminders({
      isLoaded: (id) => get().records.some((record) => record.id === id),
      onBatchChanged: () => notifyArchiveChange({ type: "metadata" }),
      onUpdated: (original, reminderState) => {
        if (!get().records.some((record) => record.id === original.id)) return true;
        let consistent = true;
        set((state) => ({ records: state.records.map((record) => {
          if (record.id !== original.id) return record;
          if (JSON.stringify(record.reminderState) !== JSON.stringify(original.reminderState) ||
              JSON.stringify(record.values.participants.map((person) => person.id)) !== JSON.stringify(original.values.participants.map((person) => person.id))) {
            consistent = false;
            return record;
          }
          return { ...record, reminderState };
        }) }));
        return consistent;
      },
    });
    retry ||= stored.retry;
    if (retry) await new Promise<void>((resolve) => setTimeout(resolve, 50));
    } while (retry && get().ready);
    })();
    try { await reminderReconciliationPromise; } finally { reminderReconciliationPromise = null; }
  },
  async markCompleted(recordId) {
    const mutate = (record: DraftRecord) =>
      normalizeActiveRecordMutation(record, (draft) => {
        draft.status = "completed";
        draft.completedAt = draft.completedAt ?? nowIso();
        draft.step = 6;
      });
    const completedRecord = recordId
      ? await withRecordById(set, get, recordId, mutate)
      : await withActiveRecord(set, get, mutate);
    if (!completedRecord) {
      return;
    }
    void trackSplitFlowCompleted({
      draftId: completedRecord.id,
      participantCount: completedRecord.values.participants.length,
      itemCount: completedRecord.values.items.filter(
        (item) => item.name.trim() || item.price.trim(),
      ).length,
      currency: completedRecord.values.currency,
    });
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

export function getClipboardSummaryPreview(
  record: DraftRecord | null,
  appCurrency?: string,
) {
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
