import type { DraftRecord } from "../../../../storage/records";
import { STEP_ROUTE, resolveDraftStep } from "../../splitFlow";
import { t } from "../../../../i18n";

const CATEGORY_TRANSLATION_KEYS = {
  General: "flow.category.general",
  Produce: "flow.category.produce",
  Bakery: "flow.category.bakery",
  Dairy: "flow.category.dairy",
  Pantry: "flow.category.pantry",
  Drinks: "flow.category.drinks",
  Main: "flow.category.main",
  Entree: "flow.category.entree",
  Side: "flow.category.side",
  Dessert: "flow.category.dessert",
  Service: "flow.category.service",
  Museum: "flow.category.museum",
  Tickets: "flow.category.tickets",
} as const;

export function getDraftPendingStep(record: DraftRecord) {
  return resolveDraftStep(record);
}

export function getCategoryLabel(category?: string) {
  const trimmedCategory = category?.trim();
  if (!trimmedCategory) {
    return t("flow.category.general");
  }

  const translationKey =
    CATEGORY_TRANSLATION_KEYS[
      trimmedCategory as keyof typeof CATEGORY_TRANSLATION_KEYS
    ];
  return translationKey ? t(translationKey) : trimmedCategory;
}

export function getCategoryAccessibilityLabel(category?: string) {
  return getCategoryLabel(category);
}

export function getItemCategoryLabel(item: DraftRecord["values"]["items"][number]) {
  const trimmedCategory = item.category?.trim();
  if (!trimmedCategory) {
    return t("record.category.general");
  }

  return getCategoryLabel(trimmedCategory).toUpperCase();
}

export function isVisibleItem(item: DraftRecord["values"]["items"][number]) {
  return Boolean(item.name.trim() || item.price.trim() || item.category?.trim());
}

export function isItemAssigned(item: DraftRecord["values"]["items"][number]) {
  if (item.splitMode === "even") {
    return item.allocations.some((allocation) => allocation.evenIncluded);
  }

  if (item.splitMode === "shares") {
    return item.allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.shares) || 0), 0) > 0;
  }

  const totalPercent = item.allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.percent) || 0), 0);
  const hasNegativePercent = item.allocations.some((allocation) => (parseFloat(allocation.percent) || 0) < 0);
  return !hasNegativePercent && Math.abs(totalPercent - 100) <= 0.001;
}

export function getAssignedParticipantCount(item: DraftRecord["values"]["items"][number]) {
  if (item.splitMode === "even") {
    return item.allocations.filter((allocation) => allocation.evenIncluded).length;
  }

  if (item.splitMode === "shares") {
    return item.allocations.filter((allocation) => (parseFloat(allocation.shares) || 0) > 0).length;
  }

  return item.allocations.filter((allocation) => (parseFloat(allocation.percent) || 0) > 0).length;
}

export function getNextPendingSplitItem(record: DraftRecord) {
  const pendingItems = record.values.items.filter((item) => isVisibleItem(item) && !isItemAssigned(item));
  return pendingItems[0] ?? null;
}

export function getNextPendingSplitItemId(record: DraftRecord, currentItemId?: string) {
  const pendingItems = record.values.items.filter(
    (item) => isVisibleItem(item) && !isItemAssigned(item) && item.id !== currentItemId
  );
  return pendingItems[0]?.id ?? null;
}

export function cloneItem(item: DraftRecord["values"]["items"][number]) {
  return {
    ...item,
    allocations: item.allocations.map((allocation) => ({ ...allocation })),
  };
}

export function cloneAllocations(allocations: DraftRecord["values"]["items"][number]["allocations"]) {
  return allocations.map((allocation) => ({ ...allocation }));
}

const FRIENDLY_SPLIT_MESSAGES = {
  "Add at least two participants, including the payer.": t("validation.participantsMin"),
  "Add at least one non-zero item.": t("friendly.itemsMin"),
  "Choose at least one participant for an even split.": t("friendly.splitEvenMin"),
  "Total shares must be greater than zero.": t("friendly.sharesTotalMin"),
  "Shares must be zero or more.": t("friendly.sharesNonNegative"),
  "Percent must be zero or more.": t("friendly.percentNonNegative"),
  "Percent totals must add up to 100.": t("friendly.percentTotal"),
} as const;

export function formatPercentValue(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const basisPoints = Math.round(value * 100);
  return (basisPoints / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function normalizePercentInput(nextPercentValue: string) {
  return nextPercentValue.replace(",", ".");
}

export function hasTrailingPercentSeparator(nextPercentValue: string) {
  return /^\d+[.,]$/.test(nextPercentValue.trim());
}

export function normalizeCommittedPercentValue(nextPercentValue: string) {
  const normalizedValue = normalizePercentInput(nextPercentValue).trim();
  if (!normalizedValue) {
    return "0";
  }
  return formatPercentValue(Number.parseFloat(normalizedValue));
}

export function getPercentInputMessage(nextPercentValue: string) {
  const trimmedValue = normalizePercentInput(nextPercentValue).trim();
  if (/^-/.test(trimmedValue)) {
    return t("validation.percentNonNegative");
  }

  if (/^\d+\.\d{3,}$/.test(trimmedValue)) {
    return t("validation.percentMaxDecimals");
  }

  if (!/^\d+(\.\d{0,2})?$/.test(trimmedValue)) {
    return t("validation.percentFormat");
  }

  return null;
}

export function rebalanceEditablePercentAllocations(
  allocations: DraftRecord["values"]["items"][number]["allocations"],
  changedParticipantId: string,
  nextPercentValue: string,
  options?: { clampToRemaining?: boolean }
) {
  const changedPercent = Number.parseFloat(normalizePercentInput(nextPercentValue));
  const changedAllocation = allocations.find((allocation) => allocation.participantId === changedParticipantId)!;
  const otherBasisPoints = allocations.reduce(
    (sum, allocation) => sum + Math.round((parseFloat(allocation.percent) || 0) * 100),
    -Math.round((parseFloat(changedAllocation.percent) || 0) * 100)
  );
  const maxAssignableBasisPoints = Math.max(0, 10_000 - otherBasisPoints);
  const requestedBasisPoints = Math.round(changedPercent * 100);
  const currentBasisPoints = Math.round((parseFloat(changedAllocation.percent) || 0) * 100);
  const hasExtraRoom = maxAssignableBasisPoints > currentBasisPoints;
  const changedBasisPoints = options?.clampToRemaining
    ? requestedBasisPoints > maxAssignableBasisPoints && !hasExtraRoom
      ? requestedBasisPoints
      : Math.min(requestedBasisPoints, maxAssignableBasisPoints)
    : requestedBasisPoints;

  if (changedBasisPoints > maxAssignableBasisPoints) {
    return null;
  }

  return allocations.map((allocation) => {
    if (allocation.participantId === changedParticipantId) {
      return {
        ...allocation,
        percent: formatPercentValue(changedBasisPoints / 100),
        percentLocked: false,
      };
    }

    return {
      ...allocation,
      percent: allocation.percent.trim() === "" ? allocation.percent : formatPercentValue(parseFloat(allocation.percent) || 0),
      percentLocked: false,
    };
  });
}

export function getFriendlySplitMessage(message: string) {
  return FRIENDLY_SPLIT_MESSAGES[message as keyof typeof FRIENDLY_SPLIT_MESSAGES] ?? message;
}

export function buildRecordRoute(record: DraftRecord) {
  if (record.status === "completed") {
    return `/split/${record.id}/results`;
  }

  const pendingStep = getDraftPendingStep(record);
  if (pendingStep === 5) {
    return `/split/${record.id}/overview`;
  }
  const route = STEP_ROUTE[pendingStep as keyof typeof STEP_ROUTE];
  return `/split/${record.id}/${route}`;
}

export function getRecordTitle(record: DraftRecord) {
  return (
    record.values.splitName?.trim() ||
    record.values.items[0]?.name ||
    t("record.title.untitled")
  );
}
