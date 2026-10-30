import { t } from "../i18n";
import {
  parseDecimal,
  parseMoneyToCents,
  trimName,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
} from "./splitter";
import type {
  ItemFormValue,
  ParsedParticipant,
  ParsedSplit,
  SettlementResult,
  SplitFormValues,
  StepValidationError,
} from "./splitter";

function weightOrderIndex(
  participantId: string,
  participants: ParsedParticipant[],
) {
  return participants.findIndex((participant) => participant.id === participantId);
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

function allocateByWeights(
  amountCents: number,
  weights: Array<{ participantId: string; weight: number }>,
  participants: ParsedParticipant[],
) {
  const absoluteAmount = Math.abs(amountCents);
  const weightedParticipants = weights.filter((entry) => entry.weight > 0);
  const totalWeight = weightedParticipants.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
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
    const leftParticipant = participants.find(
      (participant) => participant.id === left.participantId,
    );
    const rightParticipant = participants.find(
      (participant) => participant.id === right.participantId,
    );
    const payerBias =
      Number(Boolean(leftParticipant?.isPayer)) -
      Number(Boolean(rightParticipant?.isPayer));

    if (payerBias !== 0) return payerBias;
    if (right.fraction !== left.fraction) return right.fraction - left.fraction;
    return (
      weightOrderIndex(left.participantId, participants) -
      weightOrderIndex(right.participantId, participants)
    );
  });

  const allocated = new Map<string, number>();
  raw.forEach((entry) => allocated.set(entry.participantId, entry.floor));
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

function allocateExactByWeights(
  amountCents: number,
  weights: Array<{ participantId: string; weight: number }>,
) {
  const weightedParticipants = weights.filter((entry) => entry.weight > 0);
  const totalWeight = weightedParticipants.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
  return weights.map((entry) => ({
    participantId: entry.participantId,
    amountCents:
      entry.weight > 0 ? (amountCents * entry.weight) / totalWeight : 0,
  }));
}

function roundAggregateShares(
  exactTotals: Array<{ participantId: string; amountCents: number }>,
  participants: ParsedParticipant[],
  targetTotalCents: number,
) {
  const bases = exactTotals.map((entry) => ({
    participantId: entry.participantId,
    base: Math.trunc(entry.amountCents),
    residual: entry.amountCents - Math.trunc(entry.amountCents),
  }));
  let delta = targetTotalCents - bases.reduce((sum, entry) => sum + entry.base, 0);
  const rounded = new Map(bases.map((entry) => [entry.participantId, entry.base]));
  const sortForDelta = (direction: 1 | -1) =>
    [...bases].sort((left, right) => {
      const leftParticipant = participants.find((entry) => entry.id === left.participantId);
      const rightParticipant = participants.find((entry) => entry.id === right.participantId);
      const payerBias =
        Number(Boolean(leftParticipant?.isPayer)) -
        Number(Boolean(rightParticipant?.isPayer));
      if (payerBias !== 0) return payerBias;
      if (direction > 0 && right.residual !== left.residual) {
        return right.residual - left.residual;
      }
      if (direction < 0 && left.residual !== right.residual) {
        return left.residual - right.residual;
      }
      return (
        weightOrderIndex(left.participantId, participants) -
        weightOrderIndex(right.participantId, participants)
      );
    });

  const orderedForAdd = sortForDelta(1);
  const orderedForSubtract = sortForDelta(-1);
  let addCursor = 0;
  let subtractCursor = 0;
  while (delta > 0 && orderedForAdd.length > 0) {
    const entry = orderedForAdd[addCursor % orderedForAdd.length];
    rounded.set(entry.participantId, rounded.get(entry.participantId)! + 1);
    delta -= 1;
    addCursor += 1;
  }
  while (delta < 0 && orderedForSubtract.length > 0) {
    const entry = orderedForSubtract[subtractCursor % orderedForSubtract.length];
    rounded.set(entry.participantId, rounded.get(entry.participantId)! - 1);
    delta += 1;
    subtractCursor += 1;
  }

  return exactTotals.map((entry) => ({
    participantId: entry.participantId,
    amountCents: rounded.get(entry.participantId)!,
  }));
}

function getRoundedAggregateParticipantShares(
  values: SplitFormValues,
  participants: ParsedParticipant[],
) {
  const exactTotals = new Map(participants.map((participant) => [participant.id, 0]));
  values.items.forEach((item) => {
    const amountCents = parseMoneyToCents(item.price);
    if (amountCents === null) return;
    allocateExactByWeights(amountCents, allocationsForItem(item)).forEach((share) => {
      exactTotals.set(
        share.participantId,
        (exactTotals.get(share.participantId) ?? 0) + share.amountCents,
      );
    });
  });

  const targetTotalCents = values.items.reduce(
    (sum, item) => sum + (parseMoneyToCents(item.price) ?? 0),
    0,
  );
  return roundAggregateShares(
    participants.map((participant) => ({
      participantId: participant.id,
      amountCents: exactTotals.get(participant.id) ?? 0,
    })),
    participants,
    targetTotalCents,
  );
}

export function parseSplit(values: SplitFormValues) {
  const stepErrors = [
    ...validateStepOne(values),
    ...validateStepTwo(values),
    ...validateStepThree(values),
  ];
  if (stepErrors.length > 0) return { ok: false as const, errors: stepErrors };

  const participants = values.participants.map((participant) => ({
    id: participant.id,
    name: trimName(participant.name),
    isPayer: participant.id === values.payerParticipantId,
  }));
  const items = values.items.map((item) => {
    const amountCents = parseMoneyToCents(item.price)!;
    return {
      id: item.id,
      name: trimName(item.name),
      amountCents,
      splitMode: item.splitMode,
      shares: allocateByWeights(
        amountCents,
        allocationsForItem(item),
        participants,
      ),
    };
  });

  return {
    ok: true as const,
    data: { currency: values.currency, participants, items } satisfies ParsedSplit,
  };
}

export function computeSettlement(values: SplitFormValues) {
  const parsed = parseSplit(values);
  if (!parsed.ok) return parsed;

  const totalCents = parsed.data.items.reduce((sum, item) => sum + item.amountCents, 0);
  const payer = parsed.data.participants.find((participant) => participant.isPayer)!;
  const roundedTotals = getRoundedAggregateParticipantShares(
    values,
    parsed.data.participants,
  );
  const roundedByParticipant = new Map(
    roundedTotals.map((entry) => [entry.participantId, entry.amountCents]),
  );
  const people = parsed.data.participants.map((participant) => {
    const consumedCents = roundedByParticipant.get(participant.id)!;
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
