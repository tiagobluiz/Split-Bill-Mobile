import { validateStepOne } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";

const FREQUENT_FRIEND_COLORS = [
  { background: "#f6d6cd", foreground: "#8d3e18" },
  { background: "#d5ebf2", foreground: "#235875" },
  { background: "#dfe7e7", foreground: "#3f4a49" },
  { background: "#dde2de", foreground: "#2f4041" },
  { background: "#efd8c6", foreground: "#784221" },
] as const;

const CURRENCY_OPTIONS = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
] as const;

function normalizeName(value = "") {
  return value.trim().toLowerCase();
}

export function getParticipantsStepErrors(values: DraftRecord["values"]) {
  return validateStepOne(values).filter((error) => error.path !== "payerParticipantId");
}

export function getInitials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

export function getAvatarTone(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return FREQUENT_FRIEND_COLORS[0]!;
  }

  let hash = 0;
  for (const character of normalized) {
    hash += character.charCodeAt(0);
  }

  return FREQUENT_FRIEND_COLORS[hash % FREQUENT_FRIEND_COLORS.length]!;
}

export function isOwnerReference(name: string, ownerName: string) {
  const normalized = normalizeName(name);
  if (!normalized) {
    return false;
  }

  return normalized === normalizeName(ownerName) || normalized === "you";
}

export function getParticipantDisplayName(name: string, ownerName: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return name;
  }

  if (!isOwnerReference(trimmedName, ownerName)) {
    return trimmedName;
  }

  const resolvedOwnerName = ownerName.trim() || trimmedName;
  return `${resolvedOwnerName} (You)`;
}

export function getCurrencyOptions(
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const customOptions = (settings?.customCurrencies ?? []).map((entry) => ({
    code: entry.code.trim().toUpperCase(),
    label: `${entry.name.trim()} (${entry.symbol.trim()})`,
  }));

  return [...CURRENCY_OPTIONS, ...customOptions];
}

export function getCurrencyOptionLabel(
  code: string,
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const normalized = code.trim().toUpperCase();
  return getCurrencyOptions(settings).find((option) => option.code === normalized)?.label ?? normalized;
}

export function getFrequentFriends(records: DraftRecord[], activeDraftId: string, ownerName: string) {
  const candidates = new Map<string, {
    name: string;
    count: number;
    latestUpdatedAt: string;
    background: string;
    foreground: string;
  }>();

  for (const record of records.filter((entry) => entry.id !== activeDraftId)) {
    const seenInRecord = new Set<string>();
    for (const participant of record.values.participants as Array<{ name: string }>) {
      const trimmed = participant.name.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seenInRecord.has(key)) {
        continue;
      }

      if (isOwnerReference(trimmed, ownerName)) {
        seenInRecord.add(key);
        continue;
      }

      const existing = candidates.get(key);
      if (existing) {
        existing.count += 1;
        if (record.updatedAt.localeCompare(existing.latestUpdatedAt) > 0) {
          existing.latestUpdatedAt = record.updatedAt;
        }
      } else {
        candidates.set(key, {
          name: trimmed,
          count: 1,
          latestUpdatedAt: record.updatedAt,
          background: "",
          foreground: "",
        });
      }

      seenInRecord.add(key);
    }
  }

  const mapped = [...candidates.values()]
    .sort((left, right) => {
      const latestComparison = right.latestUpdatedAt.localeCompare(left.latestUpdatedAt);
      if (latestComparison !== 0) {
        return latestComparison;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 5)
    .map((entry) => {
      const color = getAvatarTone(entry.name);
      return {
        name: entry.name,
        background: color.background,
        foreground: color.foreground,
        selected: false,
      };
    });

  const trimmedOwnerName = ownerName.trim();
  if (!trimmedOwnerName) {
    return mapped;
  }

  const ownerColor = getAvatarTone(trimmedOwnerName);
  const ownerEntry = {
    name: trimmedOwnerName,
    background: ownerColor.background,
    foreground: ownerColor.foreground,
    selected: true,
  };

  const withoutOwner = mapped
    .filter((entry) => !isOwnerReference(entry.name, trimmedOwnerName))
    .map((entry) => ({ ...entry, selected: false }));

  return [ownerEntry, ...withoutOwner].slice(0, 5);
}
