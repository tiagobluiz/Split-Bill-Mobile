import { t } from "../i18n";
import { normalizePersonNameInput, PERSON_NAME_MAX_LENGTH, validatePersonName } from "./personNames";

export type SplitMode = "even" | "shares" | "percent";

export type ParticipantFormValue = {
  id: string;
  name: string;
  personId?: string;
};

export type AllocationFormValue = {
  participantId: string;
  evenIncluded: boolean;
  shares: string;
  percent: string;
  percentLocked?: boolean;
};

export type ItemFormValue = {
  id: string;
  name: string;
  price: string;
  category?: string;
  splitMode: SplitMode;
  allocations: AllocationFormValue[];
};

export type SplitFormValues = {
  splitName?: string;
  /** Calendar day of the split, independent of timezone. */
  splitDate?: string;
  /** Persistent local URI for the optional invoice image. */
  invoicePhotoUri?: string | null;
  /** Original picker name and byte size shown on the setup and edit screens. */
  invoicePhotoName?: string | null;
  invoicePhotoSize?: number | null;
  tagIds?: string[];
  currency: string;
  exchangeRate?: {
    sourceCurrency: string;
    targetCurrency: string;
    rate: number;
    rateSource?: "auto" | "manual" | "fallback";
    rateUpdatedAt?: string;
  };
  exchangeRatesByPair?: Record<
    string,
    {
      sourceCurrency: string;
      targetCurrency: string;
      rate: number;
      rateSource?: "auto" | "manual" | "fallback";
      rateUpdatedAt?: string;
    }
  >;
  participants: ParticipantFormValue[];
  payerParticipantId: string;
  items: ItemFormValue[];
};

export const SPLIT_NAME_MAX_LENGTH = 64;
export const PARTICIPANT_NAME_MAX_LENGTH = PERSON_NAME_MAX_LENGTH;
export const ITEM_NAME_MAX_LENGTH = 64;
export const ITEM_AMOUNT_MAX_CENTS = 100_000_000;
export const ITEM_AMOUNT_TOO_HIGH_MESSAGE = "Maximum is 1 000 000";

export type StepValidationCode =
  | "participant-name-required"
  | "participant-name-max"
  | "participant-name-unique"
  | "participants-min"
  | "payer-required"
  | "payer-must-exist"
  | "items-min"
  | "item-name-required"
  | "item-name-required-when-amount"
  | "item-name-max"
  | "item-amount-invalid"
  | "item-amount-too-high"
  | "item-duplicate"
  | "split-even-min"
  | "shares-total-min"
  | "shares-non-negative"
  | "percent-non-negative"
  | "percent-total"
  | "participant-share-negative";

export type StepValidationError = {
  code: StepValidationCode;
  path: string;
  message: string;
};

export type ParsedParticipant = {
  id: string;
  name: string;
  isPayer: boolean;
};

export type ParsedItemShare = {
  participantId: string;
  amountCents: number;
};

export type ParsedItem = {
  id: string;
  name: string;
  amountCents: number;
  splitMode: SplitMode;
  shares: ParsedItemShare[];
};

export type ParsedSplit = {
  currency: string;
  participants: ParsedParticipant[];
  items: ParsedItem[];
};

export type PersonSummary = {
  participantId: string;
  name: string;
  consumedCents: number;
  paidCents: number;
  netCents: number;
  isPayer: boolean;
};

export type Transfer = {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amountCents: number;
};

export type SettlementResult = {
  currency: string;
  itemBreakdown: ParsedItem[];
  people: PersonSummary[];
  transfers: Transfer[];
  totalCents: number;
};

const REGION_TO_CURRENCY: Record<string, string> = {
  AT: "EUR",
  AU: "AUD",
  BE: "EUR",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CZ: "CZK",
  DE: "EUR",
  DK: "DKK",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  JP: "JPY",
  NL: "EUR",
  NO: "NOK",
  NZ: "NZD",
  PL: "PLN",
  PT: "EUR",
  RO: "RON",
  SE: "SEK",
  US: "USD",
};

export function createId() {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function trimName(name: string) {
  return normalizePersonNameInput(name);
}

export function detectCurrency(locale = "en-US") {
  const region = locale.split("-")[1]?.toUpperCase();
  return (region && REGION_TO_CURRENCY[region]) || "EUR";
}

export function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
}

export function normalizeMoneyInput(value: string) {
  const amountCents = parseMoneyToCents(value);
  if (amountCents === null) {
    return value.trim().replace(/\s/g, "").replace(",", ".");
  }

  return (amountCents / 100).toFixed(2);
}

export function getItemUniquenessKey(
  item: Pick<ItemFormValue, "name" | "price" | "category">
) {
  const name = normalizeItemName(item.name);
  if (!name) {
    return null;
  }
  return name;
}

export function normalizeItemName(name: string) {
  return trimName(name).replace(/\s+/g, " ").toLowerCase();
}

export function validateItemNameAndAmount(name: string, price: string) {
  const normalizedName = trimName(name);
  const amountCents = parseMoneyToCents(price);
  return Boolean(
    normalizedName && normalizedName.length <= ITEM_NAME_MAX_LENGTH &&
    amountCents !== null && amountCents !== 0 &&
    Math.abs(amountCents) <= ITEM_AMOUNT_MAX_CENTS,
  );
}

export function combineItemAmounts(existingCents: number, incomingCents: number) {
  const amountCents = existingCents + incomingCents;
  return amountCents === 0 || Math.abs(amountCents) <= ITEM_AMOUNT_MAX_CENTS
    ? amountCents
    : null;
}

export function itemHasDuplicate(
  items: Array<Pick<ItemFormValue, "id" | "name" | "price" | "category">>,
  candidate: Pick<ItemFormValue, "id" | "name" | "price" | "category">,
  ignoredItemId?: string
) {
  const candidateKey = getItemUniquenessKey(candidate);
  if (!candidateKey) {
    return false;
  }

  return items.some((item) => {
    if (item.id === ignoredItemId) {
      return false;
    }

    return getItemUniquenessKey(item) === candidateKey;
  });
}

export function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function formatPercentFromBasisPoints(basisPoints: number) {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;

  if (fraction === 0) {
    return String(whole);
  }

  return `${whole}.${fraction.toString().padStart(2, "0").replace(/0$/, "")}`;
}

export function createDefaultPercentValues(participantCount: number) {
  if (participantCount <= 0) {
    return [];
  }

  if (participantCount > 2) {
    return Array.from({ length: participantCount }, () => "0");
  }

  const totalBasisPoints = 10_000;
  const base = Math.floor(totalBasisPoints / participantCount);
  const remainder = totalBasisPoints - base * participantCount;

  return Array.from({ length: participantCount }, (_, index) =>
    formatPercentFromBasisPoints(base + (index < remainder ? 1 : 0))
  );
}

export function createAllocation(participantId: string): AllocationFormValue {
  return {
    participantId,
    evenIncluded: false,
    shares: "0",
    percent: "0",
    percentLocked: false,
  };
}

function withDefaultPercentages(allocations: AllocationFormValue[]) {
  const defaults = createDefaultPercentValues(allocations.length);

  return allocations.map((allocation, index) => ({
    ...allocation,
    percent: defaults[index]!,
    percentLocked: false,
  }));
}

export function resetShareAllocations(allocations: AllocationFormValue[]) {
  return allocations.map((allocation) => ({
    ...allocation,
    shares: "1",
  }));
}

export function resetPercentAllocations(allocations: AllocationFormValue[]) {
  return withDefaultPercentages(allocations);
}

export function rebalancePercentAllocations(
  allocations: AllocationFormValue[],
  changedParticipantId: string,
  nextPercentValue: string
) {
  const changedPercent = parseDecimal(nextPercentValue);
  if (changedPercent === null || changedPercent < 0) {
    return null;
  }

  const changedBasisPoints = Math.round(changedPercent * 100);
  const fixedAllocations = allocations.filter(
    (allocation) => allocation.participantId !== changedParticipantId && Boolean(allocation.percentLocked)
  );
  const fixedBasisPoints = fixedAllocations.reduce((sum, allocation) => {
      const currentPercent = parseDecimal(allocation.percent);
      if (currentPercent === null) {
        return sum;
      }
      return sum + Math.round(currentPercent * 100);
    }, 0);

  if (changedBasisPoints > 10_000) {
    return null;
  }

  if (allocations.length === 2) {
    const remainingBasisPoints = 10_000 - changedBasisPoints;
    return allocations.map((allocation) => {
      if (allocation.participantId === changedParticipantId) {
        return {
          ...allocation,
          percent: formatPercentFromBasisPoints(changedBasisPoints),
          percentLocked: true,
        };
      }

      return {
        ...allocation,
        percent: formatPercentFromBasisPoints(remainingBasisPoints),
        percentLocked: false,
      };
    });
  }

  if (fixedBasisPoints + changedBasisPoints > 10_000) {
    return null;
  }

  const dynamicAllocations = allocations.filter(
    (allocation) => allocation.participantId !== changedParticipantId && !allocation.percentLocked
  );
  const remainingBasisPoints = 10_000 - fixedBasisPoints - changedBasisPoints;

  if (dynamicAllocations.length === 0 && remainingBasisPoints !== 0) {
    return null;
  }

  const base = dynamicAllocations.length > 0 ? Math.floor(remainingBasisPoints / dynamicAllocations.length) : 0;
  const remainder = dynamicAllocations.length > 0 ? remainingBasisPoints % dynamicAllocations.length : 0;
  const dynamicBasisById = new Map(
    dynamicAllocations.map((allocation, index) => [
      allocation.participantId,
      base + (index < remainder ? 1 : 0),
    ])
  );

  return allocations.map((allocation) => {
    if (allocation.participantId === changedParticipantId) {
      return {
        ...allocation,
        percent: formatPercentFromBasisPoints(changedBasisPoints),
        percentLocked: true,
      };
    }

    if (allocation.percentLocked) {
      return {
        ...allocation,
        percent: formatPercentFromBasisPoints(Math.round((parseDecimal(allocation.percent) || 0) * 100)),
        percentLocked: true,
      };
    }

    return {
      ...allocation,
      percent: formatPercentFromBasisPoints(dynamicBasisById.get(allocation.participantId)!),
      percentLocked: false,
    };
  });
}

export function createEmptyItem(participants: ParticipantFormValue[]): ItemFormValue {
  const allocations = withDefaultPercentages(participants.map((participant) => createAllocation(participant.id)));

  return {
    id: createId(),
    name: "",
    price: "",
    category: "",
    splitMode: "even",
    allocations,
  };
}

export function createDefaultValues(locale?: string): SplitFormValues {
  return {
    splitName: "",
    tagIds: [],
    currency: detectCurrency(locale),
    participants: [],
    payerParticipantId: "",
    items: [],
  };
}

export function syncItemAllocations(items: ItemFormValue[], participants: ParticipantFormValue[]) {
  const defaultPercentages = createDefaultPercentValues(participants.length);

  return items.map((item) => {
    const allocationByParticipant = new Map(item.allocations.map((allocation) => [allocation.participantId, allocation]));
    const participantSetChanged =
      item.allocations.length !== participants.length ||
      item.allocations.some((allocation) => !participants.some((participant) => participant.id === allocation.participantId));

    if (item.splitMode === "percent" && participantSetChanged) {
      return {
        ...item,
        allocations: resetPercentAllocations(participants.map((participant) => createAllocation(participant.id))),
      };
    }

    return {
      ...item,
      allocations: participants.map((participant, index) => {
        const existing = allocationByParticipant.get(participant.id);
        if (existing) {
          return {
            ...existing,
            percentLocked: existing.percentLocked ?? false,
          };
        }

        return {
          participantId: participant.id,
          evenIncluded: false,
          shares: "0",
          percent: defaultPercentages[index]!,
          percentLocked: false,
        };
      }),
    };
  });
}

export function validateStepOne(values: SplitFormValues): StepValidationError[] {
  const errors: StepValidationError[] = [];
  values.participants.forEach((participant, index) => {
    // Existing split data may still use the legacy owner label; new-name editors reserve it.
    const validation = validatePersonName(participant.name, values.participants.slice(0, index), undefined, { allowOwnerPlaceholder: true });
    if (validation?.reason === "required") {
      errors.push({
        code: "participant-name-required",
        path: `participants.${index}.name`,
        message: t("validation.participantNameRequired"),
      });
      return;
    }

    if (validation?.reason === "max") {
      errors.push({
        code: "participant-name-max",
        path: `participants.${index}.name`,
        message: t("validation.participantNameMax", {
          max: validation.max,
        }),
      });
      return;
    }

    if (validation?.reason === "duplicate") {
      errors.push({
        code: "participant-name-unique",
        path: `participants.${index}.name`,
        message: t("validation.participantNameUnique"),
      });
      return;
    }
  });

  if (values.participants.length < 2) {
    errors.push({
      code: "participants-min",
      path: "participants",
      message: t("validation.participantsMin"),
    });
  }

  if (values.participants.length > 0 && !values.payerParticipantId) {
    errors.push({
      code: "payer-required",
      path: "payerParticipantId",
      message: t("validation.payerRequired"),
    });
  } else if (
    values.participants.length > 0 &&
    !values.participants.some((participant) => participant.id === values.payerParticipantId)
  ) {
    errors.push({
      code: "payer-must-exist",
      path: "payerParticipantId",
      message: t("validation.payerMustExist"),
    });
  }

  return errors;
}

export function validateStepTwo(values: SplitFormValues): StepValidationError[] {
  const errors: StepValidationError[] = [];

  if (values.items.length === 0) {
    errors.push({
      code: "items-min",
      path: "items",
      message: t("validation.itemsMin"),
    });
  }

  values.items.forEach((item, index) => {
    if (!item.name.trim()) {
      errors.push({
        code: item.price.trim()
          ? "item-name-required-when-amount"
          : "item-name-required",
        path: `items.${index}.name`,
        message: item.price.trim()
          ? t("validation.itemNameRequiredWhenAmount")
          : t("validation.itemNameRequired"),
      });
    } else if (item.name.trim().length > ITEM_NAME_MAX_LENGTH) {
      errors.push({
        code: "item-name-max",
        path: `items.${index}.name`,
        message: t("validation.itemNameMax", { max: ITEM_NAME_MAX_LENGTH }),
      });
    }

    const parsedAmount = parseMoneyToCents(item.price);
    if (parsedAmount === null || parsedAmount === 0) {
      errors.push({
        code: "item-amount-invalid",
        path: `items.${index}.price`,
        message: t("validation.itemAmountInvalid"),
      });
      return;
    }

    if (Math.abs(parsedAmount) > ITEM_AMOUNT_MAX_CENTS) {
      errors.push({
        code: "item-amount-too-high",
        path: `items.${index}.price`,
        message: t("validation.itemAmountTooHigh"),
      });
    }

  });

  return errors;
}

export function validateStepThree(values: SplitFormValues): StepValidationError[] {
  const errors: StepValidationError[] = [];

  values.items.forEach((item, itemIndex) => {
    if (item.splitMode === "even") {
      const included = item.allocations.filter((allocation) => allocation.evenIncluded);
      if (included.length === 0) {
        errors.push({
          code: "split-even-min",
          path: `items.${itemIndex}.allocations`,
          message: t("validation.splitEvenMin"),
        });
      }
      return;
    }

    if (item.splitMode === "shares") {
      const totalShares = item.allocations.reduce(
        (sum, allocation) => sum + (parseDecimal(allocation.shares) ?? 0),
        0
      );

      if (totalShares <= 0) {
        errors.push({
          code: "shares-total-min",
          path: `items.${itemIndex}.allocations`,
          message: t("validation.sharesTotalMin"),
        });
      }

      item.allocations.forEach((allocation, allocationIndex) => {
        const shares = parseDecimal(allocation.shares);
        if (shares === null || shares < 0) {
          errors.push({
            code: "shares-non-negative",
            path: `items.${itemIndex}.allocations.${allocationIndex}.shares`,
            message: t("validation.sharesNonNegative"),
          });
        }
      });

      return;
    }

    const totalPercent = item.allocations.reduce(
      (sum, allocation) => sum + (parseDecimal(allocation.percent) ?? 0),
      0
    );

    item.allocations.forEach((allocation, allocationIndex) => {
      const percent = parseDecimal(allocation.percent);
      if (percent === null || percent < 0) {
        errors.push({
          code: "percent-non-negative",
          path: `items.${itemIndex}.allocations.${allocationIndex}.percent`,
          message: t("validation.percentNonNegative"),
        });
      }
    });

    if (Math.abs(totalPercent - 100) > 0.001) {
      errors.push({
        code: "percent-total",
        path: `items.${itemIndex}.allocations`,
        message: t("validation.percentTotal"),
      });
    }
  });

  return errors;
}

export function formatMoney(amountCents: number, currency: string, locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function formatMoneyTrailingSymbol(amountCents: number, currency: string, locale = "en-US") {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amountCents / 100);

    const currencyPart = parts.find((part) => part.type === "currency")!.value;
    const numberPart = parts
      .filter((part) => part.type !== "currency" && part.type !== "literal")
      .map((part) => part.value)
      .join("");

    return `${numberPart}${currencyPart}`;
  } catch {
    return `${(amountCents / 100).toFixed(2)}${currency}`;
  }
}

export function buildShareSummary(item: ParsedItem, participants: ParsedParticipant[], currency: string, locale = "en-US") {
  return item.shares
    .map((share) => {
      const participant = participants.find((entry) => entry.id === share.participantId);
      return `${participant?.name ?? t("pdf.unknownParticipant")} ${formatMoney(share.amountCents, currency, locale)}`;
    })
    .join(" • ");
}

export function removeSingleTrailingBlankItem(values: SplitFormValues): SplitFormValues {
  const lastItem = values.items.at(-1);
  if (!lastItem) {
    return values;
  }

  if (lastItem.name.trim() || lastItem.price.trim()) {
    return values;
  }

  return {
    ...values,
    items: values.items.slice(0, -1),
  };
}
