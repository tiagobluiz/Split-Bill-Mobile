export type SplitMode = "even" | "shares" | "percent";

export type ParticipantFormValue = {
  id: string;
  name: string;
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
  currency: string;
  participants: ParticipantFormValue[];
  payerParticipantId: string;
  items: ItemFormValue[];
};

export const PARTICIPANT_NAME_MAX_LENGTH = 25;
export const ITEM_NAME_MAX_LENGTH = 32;
export const ITEM_AMOUNT_MAX_CENTS = 100_000_000;
export const ITEM_AMOUNT_TOO_HIGH_MESSAGE = "Maximum is 1 000 000";

export type StepValidationError = {
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
  return name.trim().replace(/\s+/g, " ");
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

function parseDecimal(value: string) {
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

function weightOrderIndex(participantId: string, participants: ParsedParticipant[]) {
  return participants.findIndex((participant) => participant.id === participantId);
}

function allocateByWeights(
  amountCents: number,
  weights: Array<{ participantId: string; weight: number }>,
  participants: ParsedParticipant[]
) {
  const absoluteAmount = Math.abs(amountCents);
  const weightedParticipants = weights.filter((entry) => entry.weight > 0);
  const totalWeight = weightedParticipants.reduce((sum, entry) => sum + entry.weight, 0);

  const raw = weightedParticipants.map((entry) => {
    const exact = (absoluteAmount * entry.weight) / totalWeight;
    return {
      participantId: entry.participantId,
      floor: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });

  let remainder = absoluteAmount - raw.reduce((sum, entry) => sum + entry.floor, 0);

  raw.sort((left, right) => {
    const leftParticipant = participants.find((participant) => participant.id === left.participantId);
    const rightParticipant = participants.find((participant) => participant.id === right.participantId);
    const payerBias = Number(Boolean(leftParticipant?.isPayer)) - Number(Boolean(rightParticipant?.isPayer));

    if (payerBias !== 0) {
      return payerBias;
    }

    if (right.fraction !== left.fraction) {
      return right.fraction - left.fraction;
    }

    return weightOrderIndex(left.participantId, participants) - weightOrderIndex(right.participantId, participants);
  });

  const allocated = new Map<string, number>();
  raw.forEach((entry) => {
    allocated.set(entry.participantId, entry.floor);
  });

  let cursor = 0;
  while (remainder > 0 && raw.length > 0) {
    const entry = raw[cursor % raw.length];
    allocated.set(entry.participantId, allocated.get(entry.participantId)! + 1);
    remainder -= 1;
    cursor += 1;
  }

  return weights.map((entry) => ({
    participantId: entry.participantId,
    amountCents: (allocated.get(entry.participantId) || 0) * Math.sign(amountCents),
  }));
}

function allocateExactByWeights(amountCents: number, weights: Array<{ participantId: string; weight: number }>) {
  const weightedParticipants = weights.filter((entry) => entry.weight > 0);
  const totalWeight = weightedParticipants.reduce((sum, entry) => sum + entry.weight, 0);

  return weights.map((entry) => ({
    participantId: entry.participantId,
    amountCents: entry.weight > 0 ? (amountCents * entry.weight) / totalWeight : 0,
  }));
}

function roundAggregateShares(
  exactTotals: Array<{ participantId: string; amountCents: number }>,
  participants: ParsedParticipant[],
  targetTotalCents: number
) {
  const bases = exactTotals.map((entry) => ({
    participantId: entry.participantId,
    base: Math.trunc(entry.amountCents),
    residual: entry.amountCents - Math.trunc(entry.amountCents),
  }));

  let delta = targetTotalCents - bases.reduce((sum, entry) => sum + entry.base, 0);
  const roundedByParticipant = new Map(bases.map((entry) => [entry.participantId, entry.base]));

  const sortForDelta = (direction: 1 | -1) =>
    [...bases].sort((left, right) => {
      const leftParticipant = participants.find((participant) => participant.id === left.participantId);
      const rightParticipant = participants.find((participant) => participant.id === right.participantId);
      const payerBias = Number(Boolean(leftParticipant?.isPayer)) - Number(Boolean(rightParticipant?.isPayer));

      if (payerBias !== 0) {
        return payerBias;
      }

      if (direction > 0 && right.residual !== left.residual) {
        return right.residual - left.residual;
      }

      if (direction < 0 && left.residual !== right.residual) {
        return left.residual - right.residual;
      }

      return weightOrderIndex(left.participantId, participants) - weightOrderIndex(right.participantId, participants);
    });

  const orderedForAdd = sortForDelta(1);
  const orderedForSubtract = sortForDelta(-1);
  let addCursor = 0;
  let subtractCursor = 0;

  while (delta > 0 && orderedForAdd.length > 0) {
    const entry = orderedForAdd[addCursor % orderedForAdd.length];
    roundedByParticipant.set(entry.participantId, roundedByParticipant.get(entry.participantId)! + 1);
    delta -= 1;
    addCursor += 1;
  }

  while (delta < 0 && orderedForSubtract.length > 0) {
    const entry = orderedForSubtract[subtractCursor % orderedForSubtract.length];
    roundedByParticipant.set(entry.participantId, roundedByParticipant.get(entry.participantId)! - 1);
    delta += 1;
    subtractCursor += 1;
  }

  return exactTotals.map((entry) => ({
    participantId: entry.participantId,
    amountCents: roundedByParticipant.get(entry.participantId)!,
  }));
}

function allocationsForItem(item: ItemFormValue) {
  if (item.splitMode === "even") {
    return item.allocations.map((allocation) => ({
      participantId: allocation.participantId,
      weight: allocation.evenIncluded ? 1 : 0,
    }));
  }

  if (item.splitMode === "shares") {
      return item.allocations.map((allocation) => ({
        participantId: allocation.participantId,
        weight: parseDecimal(allocation.shares)!,
      }));
    }

  return item.allocations.map((allocation) => ({
    participantId: allocation.participantId,
    weight: parseDecimal(allocation.percent)!,
  }));
}

export function validateStepOne(values: SplitFormValues): StepValidationError[] {
  const errors: StepValidationError[] = [];
  const normalizedNames = values.participants.map((participant) => trimName(participant.name));
  const duplicates = new Set<string>();

  normalizedNames.forEach((name, index) => {
    if (!name) {
      errors.push({ path: `participants.${index}.name`, message: "Add a name for each participant." });
      return;
    }

    if (name.length > PARTICIPANT_NAME_MAX_LENGTH) {
      errors.push({
        path: `participants.${index}.name`,
        message: `Keep participant names under ${PARTICIPANT_NAME_MAX_LENGTH} characters.`,
      });
      return;
    }

    const normalized = name.toLowerCase();
    if (duplicates.has(normalized)) {
      errors.push({ path: `participants.${index}.name`, message: "Participant names must be unique." });
      return;
    }

    duplicates.add(normalized);
  });

  if (values.participants.length < 2) {
    errors.push({
      path: "participants",
      message: "Add at least two participants, including the payer.",
    });
  }

  if (values.participants.length > 0 && !values.payerParticipantId) {
    errors.push({ path: "payerParticipantId", message: "Choose who paid the bill." });
  } else if (
    values.participants.length > 0 &&
    !values.participants.some((participant) => participant.id === values.payerParticipantId)
  ) {
    errors.push({
      path: "payerParticipantId",
      message: "The selected payer must be one of the participants.",
    });
  }

  return errors;
}

export function validateStepTwo(values: SplitFormValues): StepValidationError[] {
  const errors: StepValidationError[] = [];

  if (values.items.length === 0) {
    errors.push({ path: "items", message: "Add at least one item before continuing." });
  }

  values.items.forEach((item, index) => {
    if (!item.name.trim()) {
      errors.push({
        path: `items.${index}.name`,
        message: item.price.trim() ? "This item needs a name." : "Add an item name.",
      });
    } else if (item.name.trim().length > ITEM_NAME_MAX_LENGTH) {
      errors.push({
        path: `items.${index}.name`,
        message: `Keep item names under ${ITEM_NAME_MAX_LENGTH} characters.`,
      });
    }

    const parsedAmount = parseMoneyToCents(item.price);
    if (parsedAmount === null || parsedAmount === 0) {
      errors.push({
        path: `items.${index}.price`,
        message: "Enter a valid amount different from zero.",
      });
      return;
    }

    if (Math.abs(parsedAmount) > ITEM_AMOUNT_MAX_CENTS) {
      errors.push({
        path: `items.${index}.price`,
        message: ITEM_AMOUNT_TOO_HIGH_MESSAGE,
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
          path: `items.${itemIndex}.allocations`,
          message: "Choose at least one participant for an even split.",
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
          path: `items.${itemIndex}.allocations`,
          message: "Total shares must be greater than zero.",
        });
      }

      item.allocations.forEach((allocation, allocationIndex) => {
        const shares = parseDecimal(allocation.shares);
        if (shares === null || shares < 0) {
          errors.push({
            path: `items.${itemIndex}.allocations.${allocationIndex}.shares`,
            message: "Shares must be zero or more.",
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
          path: `items.${itemIndex}.allocations.${allocationIndex}.percent`,
          message: "Percent must be zero or more.",
        });
      }
    });

    if (Math.abs(totalPercent - 100) > 0.001) {
      errors.push({
        path: `items.${itemIndex}.allocations`,
        message: "Percent totals must add up to 100.",
      });
    }
  });

  return errors;
}

export function parseSplit(values: SplitFormValues) {
  const stepErrors = [...validateStepOne(values), ...validateStepTwo(values), ...validateStepThree(values)];
  if (stepErrors.length > 0) {
    return { ok: false as const, errors: stepErrors };
  }

  const participants = values.participants.map((participant) => ({
    id: participant.id,
    name: trimName(participant.name),
    isPayer: participant.id === values.payerParticipantId,
  }));

  const items = values.items.map((item) => {
    const amountCents = parseMoneyToCents(item.price)!;
    const weights = allocationsForItem(item);
    const shares = allocateByWeights(amountCents, weights, participants);

    return {
      id: item.id,
      name: trimName(item.name),
      amountCents,
      splitMode: item.splitMode,
      shares,
    };
  });

  return {
    ok: true as const,
    data: {
      currency: values.currency,
      participants,
      items,
    } satisfies ParsedSplit,
  };
}

export function computeSettlement(values: SplitFormValues) {
  const parsed = parseSplit(values);
  if (!parsed.ok) {
    return parsed;
  }

  const totalCents = parsed.data.items.reduce((sum, item) => sum + item.amountCents, 0);
  const payer = parsed.data.participants.find((participant) => participant.isPayer)!;

  const exactTotalsByParticipant = new Map(parsed.data.participants.map((participant) => [participant.id, 0]));

  values.items.forEach((item) => {
    const amountCents = parseMoneyToCents(item.price)!;
    const exactShares = allocateExactByWeights(amountCents, allocationsForItem(item));

    exactShares?.forEach((share) => {
      exactTotalsByParticipant.set(
        share.participantId,
        (exactTotalsByParticipant.get(share.participantId) ?? 0) + share.amountCents
      );
    });
  });

  const roundedTotals = roundAggregateShares(
    parsed.data.participants.map((participant) => ({
      participantId: participant.id,
      amountCents: exactTotalsByParticipant.get(participant.id)!,
    })),
    parsed.data.participants,
    totalCents
  );
  const roundedTotalsByParticipant = new Map(roundedTotals.map((entry) => [entry.participantId, entry.amountCents]));

  const people = parsed.data.participants.map((participant) => {
    const consumedCents = roundedTotalsByParticipant.get(participant.id)!;
    const paidCents = participant.isPayer ? totalCents : 0;

    return {
      participantId: participant.id,
      name: participant.name,
      consumedCents,
      paidCents,
      netCents: paidCents - consumedCents,
      isPayer: participant.isPayer,
    };
  });

  const transfers = people
    .filter((person) => !person.isPayer && person.netCents < 0)
    .map((person) => ({
      fromParticipantId: person.participantId,
      fromName: person.name,
      toParticipantId: payer.id,
      toName: payer.name,
      amountCents: Math.abs(person.netCents),
    }))
    .filter((transfer) => transfer.amountCents > 0);

  return {
    ok: true as const,
    data: {
      currency: parsed.data.currency,
      itemBreakdown: parsed.data.items,
      people,
      transfers,
      totalCents,
    } satisfies SettlementResult,
  };
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
      return `${participant?.name ?? "Unknown"} ${formatMoney(share.amountCents, currency, locale)}`;
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
