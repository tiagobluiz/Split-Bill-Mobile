// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, Keyboard, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  Camera,
  Check,
  ClipboardCopy,
  Equal,
  FileJson,
  Filter,
  Hash,
  Home,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import { Paragraph, Text, XStack, YStack } from "tamagui";

import {
  AppScreen,
  AvatarBadge,
  EmptyState,
  FieldLabel,
  FloatingFooter,
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
} from "../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  createEmptyItem,
  createId,
  formatMoney,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepOne,
  validateStepTwo,
  validateStepThree,
  type DraftRecord,
  type ParticipantFormValue,
} from "../../domain";
import { getDeviceLocale } from "../../lib/device";
import { FONTS, PALETTE } from "../../theme/palette";
import { getClipboardSummaryPreview, getPdfExportPreview, getSettlementPreview, STEP_ROUTE, useSplitStore } from "./store";

const FREQUENT_FRIEND_COLORS = [
  { background: "#f6d6cd", foreground: "#8d3e18" },
  { background: "#d5ebf2", foreground: "#235875" },
  { background: "#dfe7e7", foreground: "#3f4a49" },
  { background: "#dde2de", foreground: "#2f4041" },
  { background: "#efd8c6", foreground: "#784221" },
] as const;
const HOME_TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "splits", label: "Splits", icon: ReceiptText },
  { key: "settings", label: "Settings", icon: Settings },
] as const;
type HomeTabKey = (typeof HOME_TABS)[number]["key"];
type ActivityStateFilter = "all" | "settled" | "unsettled";
type ActivityDateFilter = "newest" | "oldest";
const STEP_LABELS = {
  1: "Setup",
  2: "Participants",
  3: "Payer",
  4: "Items",
  5: "Split",
  6: "Settle",
} as const;
const MAX_SPLIT_NAME_LENGTH = 20;
const MAX_OWNER_NAME_LENGTH = 12;
const MAX_ITEM_NAME_LENGTH = 25;
const ITEM_CATEGORY_OPTIONS = [
  "General",
  "Produce",
  "Bakery",
  "Dairy",
  "Pantry",
  "Drinks",
  "Main",
  "Entree",
  "Side",
  "Dessert",
  "Service",
  "Museum",
  "Tickets",
] as const;
const CURRENCY_OPTIONS = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
] as const;

function getDraftMaxReachableStep(record: DraftRecord) {
  if (record.status === "completed") {
    return 6;
  }

  const stepOneErrors = validateStepOne(record.values);
  if (stepOneErrors.some((error) => error.path !== "payerParticipantId")) {
    return 2;
  }

  if (stepOneErrors.length > 0) {
    return 3;
  }

  if (validateStepTwo(record.values).length > 0) {
    return 4;
  }

  return 5;
}

function getDraftPendingStep(record: DraftRecord) {
  const maxReachableStep = getDraftMaxReachableStep(record);
  if (record.status === "completed") {
    return maxReachableStep;
  }

  const requestedStep = Number.isFinite(record.step) ? Math.trunc(record.step) : 1;
  const normalizedRequestedStep = Math.min(Math.max(requestedStep, 1), 5);
  return Math.min(normalizedRequestedStep, maxReachableStep);
}

function getItemCategoryLabel(item: DraftRecord["values"]["items"][number]) {
  return item.category?.trim() ? item.category.trim().toUpperCase() : "GENERAL";
}

function isVisibleItem(item: DraftRecord["values"]["items"][number]) {
  return Boolean(item.name.trim() || item.price.trim() || item.category?.trim());
}

function isItemAssigned(item: DraftRecord["values"]["items"][number]) {
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

function getAssignedParticipantCount(item: DraftRecord["values"]["items"][number]) {
  if (item.splitMode === "even") {
    return item.allocations.filter((allocation) => allocation.evenIncluded).length;
  }

  if (item.splitMode === "shares") {
    return item.allocations.filter((allocation) => (parseFloat(allocation.shares) || 0) > 0).length;
  }

  return item.allocations.filter((allocation) => (parseFloat(allocation.percent) || 0) > 0).length;
}

function getLatestPendingSplitItem(record: DraftRecord) {
  const pendingItems = record.values.items.filter((item) => isVisibleItem(item) && !isItemAssigned(item));
  return pendingItems[pendingItems.length - 1] ?? null;
}

function getNextVisibleItemId(record: DraftRecord, currentItemId: string) {
  const visibleItems = record.values.items.filter(isVisibleItem);
  const currentIndex = visibleItems.findIndex((item) => item.id === currentItemId);
  if (currentIndex === -1) {
    return null;
  }

  return visibleItems[currentIndex + 1]?.id ?? null;
}

function cloneItem(item: DraftRecord["values"]["items"][number]) {
  return {
    ...item,
    allocations: item.allocations.map((allocation) => ({ ...allocation })),
  };
}

function cloneAllocations(allocations: DraftRecord["values"]["items"][number]["allocations"]) {
  return allocations.map((allocation) => ({ ...allocation }));
}

const FRIENDLY_SPLIT_MESSAGES = {
  "Add at least two participants, including the payer.": "Add at least two participants, including the payer.",
  "Add at least one non-zero item.": "Add at least one item with a price before continuing.",
  "Choose at least one participant for an even split.": "Pick at least one person for this item.",
  "Total shares must be greater than zero.": "Add at least one share before you continue.",
  "Shares must be zero or more.": "Shares cannot go below zero.",
  "Percent must be zero or more.": "Percent cannot go below zero.",
  "Percent totals must add up to 100.": "Make sure the percentages add up to 100%.",
} as const;

function formatPercentValue(value: number) {
  const basisPoints = Math.round(value * 100);
  return (basisPoints / 100).toFixed(2).replace(/\.?0+$/, "");
}

function normalizePercentInput(nextPercentValue: string) {
  return nextPercentValue.replace(",", ".");
}

function hasTrailingPercentSeparator(nextPercentValue: string) {
  return /^\d+[.,]$/.test(nextPercentValue.trim());
}

function normalizeCommittedPercentValue(nextPercentValue: string) {
  const normalizedValue = normalizePercentInput(nextPercentValue).trim();
  return formatPercentValue(Number.parseFloat(normalizedValue));
}

function getPercentInputMessage(nextPercentValue: string) {
  const trimmedValue = normalizePercentInput(nextPercentValue).trim();
  if (/^-/.test(trimmedValue)) {
    return "Percent can't be negative.";
  }

  if (/^\d+\.\d{3,}$/.test(trimmedValue)) {
    return "Use no more than 2 decimal places.";
  }

  if (!/^\d+(\.\d{0,2})?$/.test(trimmedValue)) {
    return "Enter a valid percentage.";
  }

  return null;
}

function rebalanceEditablePercentAllocations(
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

function getFriendlySplitMessage(message: string) {
  return FRIENDLY_SPLIT_MESSAGES[message as keyof typeof FRIENDLY_SPLIT_MESSAGES] ?? message;
}

function buildRecordRoute(record: DraftRecord) {
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

function getRecordTitle(record: DraftRecord) {
  return record.values.splitName.trim() || record.values.items[0]?.name || "Untitled split";
}

function useRecord(draftId: string) {
  const { records, activeRecordId, openRecord } = useSplitStore(useShallow((state) => ({
    records: state.records,
    activeRecordId: state.activeRecordId,
    openRecord: state.openRecord,
  })));
  const requestedDraftIdsRef = useRef<string[]>([]);
  const record = records.find((item) => item.id === draftId) ?? null;

  useEffect(() => {
    if (!draftId || activeRecordId === draftId || requestedDraftIdsRef.current.includes(draftId)) {
      return;
    }

    requestedDraftIdsRef.current = [...requestedDraftIdsRef.current, draftId];
    void openRecord(draftId).finally(() => {
      requestedDraftIdsRef.current = requestedDraftIdsRef.current.filter((id) => id !== draftId);
    });
  }, [activeRecordId, draftId, openRecord, record]);

  useEffect(() => {
    if (record) {
      requestedDraftIdsRef.current = [];
    }
  }, [draftId, record]);

  useEffect(() => {
    return () => {
      requestedDraftIdsRef.current = [];
    };
  }, []);

  return record;
}

function getInitials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

function getAvatarTone(name: string) {
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

function ParticipantAvatar({
  name,
  ownerName,
  ownerProfileImageUri,
  style,
  label,
  textSize = 15,
}: {
  name: string;
  ownerName: string;
  ownerProfileImageUri?: string;
  style: any;
  label: string;
  textSize?: number;
}) {
  const imageUri = ownerProfileImageUri?.trim();
  if (isOwnerReference(name, ownerName) && imageUri) {
    return <Image accessibilityLabel={label} source={{ uri: imageUri }} style={[style, screenStyles.avatarImage]} />;
  }

  const tone = getAvatarTone(name);
  return (
    <View accessibilityLabel={label} style={[style, { backgroundColor: tone.background }]}>
      <Text fontFamily={FONTS.bodyBold} fontSize={textSize} color={tone.foreground}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function getCurrencyOptions(
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

function getCurrencyOptionLabel(
  code: string,
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const normalized = code.trim().toUpperCase();
  return getCurrencyOptions(settings).find((option) => option.code === normalized)?.label ?? normalized;
}

function getParticipantDisplayName(name: string, ownerName: string) {
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

function formatAppMoney(
  amountCents: number,
  currency: string,
  locale: string,
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const customCurrency = settings?.customCurrencies?.find(
    (entry) => entry.code.trim().toUpperCase() === currency.trim().toUpperCase()
  );
  if (customCurrency) {
    return `${customCurrency.symbol}${(amountCents / 100).toFixed(2)}`;
  }

  return formatMoney(amountCents, currency, locale);
}

function ModePills({
  active,
  options,
  onChange,
}: {
  active: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={screenStyles.modePillShell}>
      {options.map((option) => {
        const selected = option.key === active;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            style={[screenStyles.modePillButton, selected ? screenStyles.modePillButtonActive : null]}
            onPress={() => onChange(option.key)}
          >
            <Text
              fontFamily={selected ? FONTS.bodyBold : FONTS.bodyMedium}
              fontSize={14}
              color={selected ? PALETTE.primary : PALETTE.onSurfaceVariant}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <View style={screenStyles.errorPanel}>
      <SectionEyebrow>Not there yet...</SectionEyebrow>
      {messages.map((message) => (
        <Paragraph key={message} color={PALETTE.danger} fontFamily={FONTS.bodyMedium} fontSize={13}>
          {message}
        </Paragraph>
      ))}
    </View>
  );
}

function getParticipantsStepErrors(values: Parameters<typeof validateStepOne>[0]) {
  return validateStepOne(values).filter((error) => error.path !== "payerParticipantId");
}

function normalizeName(value = "") {
  return value.trim().toLowerCase();
}

function isOwnerReference(name: string, ownerName: string) {
  const normalized = normalizeName(name);
  if (!normalized) {
    return false;
  }

  return normalized === normalizeName(ownerName) || normalized === "you";
}

function getSettledParticipantIds(record: DraftRecord) {
  return new Set(record.settlementState?.settledParticipantIds ?? []);
}

function getRecordMoneyPreview(record: DraftRecord, ownerName: string) {
  const settlement = getSettlementPreview(record);
  if (!settlement?.ok) {
    return null;
  }

  const payer = settlement.data.people.find((person) => person.isPayer);
  if (!payer) {
    return null;
  }

  const owner = settlement.data.people.find((person) => isOwnerReference(person.name, ownerName));
  const debtorPeople = settlement.data.people.filter((person) => !person.isPayer && person.netCents < 0);
  const settledIds = getSettledParticipantIds(record);
  const totalDebtCents = debtorPeople.reduce((sum, person) => sum + Math.abs(person.netCents), 0);
  const settledDebtCents = debtorPeople.reduce(
    (sum, person) => sum + (settledIds.has(person.participantId) ? Math.abs(person.netCents) : 0),
    0
  );
  const unsettledDebtCents = Math.max(totalDebtCents - settledDebtCents, 0);

  if (!owner) {
    return {
      currency: settlement.data.currency,
      ownerNetCents: 0,
      ownerRelation: "none" as const,
      payerName: payer.name,
      totalDebtCents,
      settledDebtCents,
      unsettledDebtCents,
      debtorPeople,
    };
  }

  return {
    currency: settlement.data.currency,
    ownerNetCents:
      owner.isPayer
        ? unsettledDebtCents
        : owner.netCents < 0 && !settledIds.has(owner.participantId)
          ? Math.abs(owner.netCents)
          : 0,
    ownerRelation: owner.isPayer ? ("payer" as const) : owner.netCents < 0 ? ("debtor" as const) : ("none" as const),
    payerName: payer.name,
    totalDebtCents,
    settledDebtCents,
    unsettledDebtCents,
    debtorPeople,
  };
}

function getHomeBalanceCards(records: DraftRecord[], ownerName: string, preferredCurrency?: string) {
  const previews = records
    .map((record) => getRecordMoneyPreview(record, ownerName))
    .filter(Boolean);

  const totalsByCurrency = new Map<string, { owedCents: number; oweCents: number }>();

  for (const preview of previews) {
    const normalizedCurrency = preview.currency.trim().toUpperCase();
    const nextTotals = totalsByCurrency.get(normalizedCurrency) ?? { owedCents: 0, oweCents: 0 };

    if (preview.ownerRelation === "payer") {
      nextTotals.owedCents += preview.ownerNetCents;
    }

    if (preview.ownerRelation === "debtor") {
      nextTotals.oweCents += preview.ownerNetCents;
    }

    totalsByCurrency.set(normalizedCurrency, nextTotals);
  }

  const preferredKey = preferredCurrency?.trim().toUpperCase() ?? "";
  const currency =
    (preferredKey && totalsByCurrency.has(preferredKey) ? preferredKey : null) ??
    previews[0]?.currency ??
    records[0]?.values.currency ??
    "USD";
  const totals = totalsByCurrency.get(currency.trim().toUpperCase()) ?? { owedCents: 0, oweCents: 0 };

  return { currency, owedCents: totals.owedCents, oweCents: totals.oweCents };
}

function getRecentRowMeta(
  record: DraftRecord,
  ownerName: string,
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const preview = getRecordMoneyPreview(record, ownerName);
  const locale = getDeviceLocale();
  const currency = preview?.currency ?? record.values.currency;
  const rawAmountCents = preview?.ownerNetCents ?? 0;
  const amountPrefix = rawAmountCents > 0 ? "+" : "";
  const amount = `${amountPrefix}${formatAppMoney(Math.abs(rawAmountCents), currency, locale, settings)}`;
  const pendingStep = getDraftPendingStep(record);

  if (record.status === "completed") {
    return {
      amount,
      statusLabel: "Settled",
      statusColor: PALETTE.secondary,
      showUnpaidDots: false,
    };
  }

  return {
    amount,
    statusLabel: `Pending: ${STEP_LABELS[pendingStep as keyof typeof STEP_LABELS]}`,
    statusColor: PALETTE.primary,
    showUnpaidDots: false,
  };
}

function getFrequentFriends(records: DraftRecord[], activeDraftId: string, ownerName: string) {
  const candidates = new Map<string, {
    name: string;
    count: number;
    latestUpdatedAt: string;
    background: string;
    foreground: string;
  }>();

  for (const record of records.filter((entry) => entry.id !== activeDraftId)) {
    const seenInRecord = new Set<string>();
    for (const participant of record.values.participants) {
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
    .map((entry, index) => {
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

function ParticipantRow({
  participant,
  ownerName,
  ownerProfileImageUri,
  onRemove,
}: {
  participant: ParticipantFormValue;
  ownerName: string;
  ownerProfileImageUri?: string;
  onRemove: () => void;
}) {
  const displayName = getParticipantDisplayName(participant.name, ownerName);

  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$4" style={screenStyles.participantPill}>
      <XStack alignItems="center" gap="$3.5" flex={1}>
        <ParticipantAvatar
          name={participant.name}
          ownerName={ownerName}
          ownerProfileImageUri={ownerProfileImageUri}
          style={screenStyles.participantAvatar}
          label={`Participant avatar ${participant.name.trim() || "unknown"}`}
        />
        <YStack flex={1}>
          <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>
            {displayName}
          </Text>
        </YStack>
      </XStack>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove participant ${participant.name}`}
        style={screenStyles.participantRemoveButton}
      >
        <X color={PALETTE.onSurfaceVariant} size={20} />
      </Pressable>
    </XStack>
  );
}

function ModeToggle({
  active,
  onChange,
}: {
  active: "even" | "shares" | "percent";
  onChange: (value: "even" | "shares" | "percent") => void;
}) {
  const options = [
    { key: "even", label: "Even" },
    { key: "shares", label: "Shares" },
    { key: "percent", label: "Percentage" },
  ] as const;

  return (
    <XStack gap="$1.5">
      {options.map((option) => {
        const selected = active === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              screenStyles.togglePill,
              { backgroundColor: selected ? PALETTE.primary : PALETTE.surfaceContainerLow },
            ]}
          >
            <Text color={selected ? PALETTE.onPrimary : PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={13}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}

function HomeTabBar({
  activeTab,
  onChange,
}: {
  activeTab: HomeTabKey;
  onChange: (tab: HomeTabKey) => void;
}) {
  return (
    <View style={screenStyles.homeTabShell}>
      <XStack justifyContent="space-between" alignItems="center">
        {HOME_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tab.label}`}
              onPress={() => onChange(tab.key)}
              style={[screenStyles.homeTabButton, isActive ? screenStyles.homeTabButtonActive : null]}
            >
              <YStack alignItems="center" gap="$1.5">
                <Icon color={isActive ? PALETTE.primary : "#b1aba7"} size={20} />
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  textTransform="uppercase"
                  letterSpacing={1.5}
                  color={isActive ? PALETTE.primary : "#b1aba7"}
                >
                  {tab.label}
                </Text>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>
    </View>
  );
}

function ActionSheetModal({
  title,
  options,
  onDismiss,
}: {
  title: string;
  options: Array<{ label: string; onPress: () => void; tone?: "default" | "danger" }>;
  onDismiss: () => void;
}) {
  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss action sheet" style={screenStyles.splitNoticeBackdrop} onPress={onDismiss} />
      <View style={screenStyles.actionSheetCard}>
        <YStack gap="$2.5">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          {options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={[
                screenStyles.actionSheetButton,
                option.tone === "danger" ? screenStyles.actionSheetButtonDanger : null,
              ]}
              onPress={option.onPress}
            >
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={15}
                color={option.tone === "danger" ? "#b43d29" : PALETTE.primary}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </YStack>
      </View>
    </View>
  );
}

function ConfirmChoiceModal({
  title,
  body,
  confirmLabel,
  discardLabel,
  onConfirm,
  onDiscard,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  discardLabel: string;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <View style={screenStyles.splitNoticeBackdrop} />
      <View style={screenStyles.splitNoticeCard}>
        <YStack gap="$3">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            {title}
          </Text>
          <Text fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={22} color={PALETTE.onSurfaceVariant}>
            {body}
          </Text>
          <YStack gap="$2">
            <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} style={screenStyles.splitNoticeButton} onPress={onConfirm}>
              <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
                {confirmLabel}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={discardLabel} style={screenStyles.actionSheetButton} onPress={onDiscard}>
              <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.primary}>
                {discardLabel}
              </Text>
            </Pressable>
          </YStack>
        </YStack>
      </View>
    </View>
  );
}

function RecordRow({
  record,
  index,
  ownerName,
  settings,
  onDelete,
}: {
  record: DraftRecord;
  index: number;
  ownerName: string;
  settings: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  };
  onDelete: (recordId: string, title: string) => void;
}) {
  const meta = getRecentRowMeta(record, ownerName, settings);
  const title = getRecordTitle(record);

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete draft ${title}`}
          style={screenStyles.recentSwipeDeleteAction}
          onPress={() => onDelete(record.id, title)}
        >
          <Trash2 color={PALETTE.onPrimary} size={18} />
          <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.6}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      <View style={screenStyles.recentShadowWrap}>
        <Pressable onPress={() => router.push(buildRecordRoute(record))} style={[screenStyles.recentRow, screenStyles.itemsListCard]}>
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <XStack alignItems="center" gap="$4" flex={1}>
              <AvatarBadge label={getInitials(title)} accent={index % 2 === 0} />
              <YStack flex={1} gap="$1">
                <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                  {title}
                </Text>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={meta.statusColor}
                  textTransform="uppercase"
                  letterSpacing={1.8}
                >
                  {meta.statusLabel}
                </Text>
              </YStack>
            </XStack>
            <YStack alignItems="flex-end" justifyContent="center">
              <Text fontFamily={FONTS.headlineBlack} fontSize={18} color={PALETTE.onSurface}>
                {meta.amount}
              </Text>
            </YStack>
          </XStack>
        </Pressable>
      </View>
    </Swipeable>
  );
}

export function HomeScreen() {
  const { records, createDraft, removeRecord, settings, updateSettings } = useSplitStore(useShallow((state) => ({
    records: state.records,
    createDraft: state.createDraft,
    removeRecord: state.removeRecord,
    settings: state.settings,
    updateSettings: state.updateSettings,
  })));
  const insets = useSafeAreaInsets();
  const locale = getDeviceLocale();
  const [activeTab, setActiveTab] = useState<HomeTabKey>("home");
  const [pendingDelete, setPendingDelete] = useState<null | { id: string; title: string }>(null);
  const [activityStateFilter, setActivityStateFilter] = useState<ActivityStateFilter>("all");
  const [activityDateFilter, setActivityDateFilter] = useState<ActivityDateFilter>("newest");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [visibleSplitCount, setVisibleSplitCount] = useState(20);
  const [settingsNoticeMessages, setSettingsNoticeMessages] = useState<string[]>([]);
  const [ownerNameDraft, setOwnerNameDraft] = useState(settings.ownerName ?? "");
  const [ownerProfileImageUriDraft, setOwnerProfileImageUriDraft] = useState(settings.ownerProfileImageUri ?? "");
  const [balanceFeatureEnabledDraft, setBalanceFeatureEnabledDraft] = useState(settings.balanceFeatureEnabled);
  const [defaultCurrencyDraft, setDefaultCurrencyDraft] = useState(settings.defaultCurrency ?? "");
  const [customCurrenciesDraft, setCustomCurrenciesDraft] = useState(settings.customCurrencies ?? []);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [profileActionMenuOpen, setProfileActionMenuOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [customCurrencyName, setCustomCurrencyName] = useState("");
  const [customCurrencySymbol, setCustomCurrencySymbol] = useState("");
  const [customCurrencyErrors, setCustomCurrencyErrors] = useState<{ name: boolean; symbol: boolean }>({
    name: false,
    symbol: false,
  });
  const [pendingTabChange, setPendingTabChange] = useState<HomeTabKey | null>(null);
  const deleteTimeoutRef = useRef<any>(null);
  const customCurrencySymbolInputRef = useRef<TextInput | null>(null);

  const visibleRecords = pendingDelete ? records.filter((record) => record.id !== pendingDelete.id) : records;
  const balances = getHomeBalanceCards(visibleRecords, settings.ownerName, settings.defaultCurrency);
  const recentRecords = visibleRecords.slice(0, 5);
  const filteredSplitRecords = useMemo(() => {
    const byState = visibleRecords.filter((record) => {
      if (activityStateFilter === "settled") {
        return record.status === "completed";
      }

      if (activityStateFilter === "unsettled") {
        return record.status !== "completed";
      }

      return true;
    });

    return [...byState].sort((left, right) =>
      activityDateFilter === "newest"
        ? right.updatedAt.localeCompare(left.updatedAt)
        : left.updatedAt.localeCompare(right.updatedAt)
    );
  }, [activityDateFilter, activityStateFilter, visibleRecords]);
  const pagedSplitRecords = filteredSplitRecords.slice(0, visibleSplitCount);
  const draftCurrencyOptions = getCurrencyOptions({ customCurrencies: customCurrenciesDraft });
  const settingsDirty =
    ownerNameDraft.trim() !== (settings.ownerName ?? "") ||
    ownerProfileImageUriDraft.trim() !== (settings.ownerProfileImageUri ?? "") ||
    balanceFeatureEnabledDraft !== settings.balanceFeatureEnabled ||
    defaultCurrencyDraft.trim().toUpperCase() !== (settings.defaultCurrency ?? "") ||
    JSON.stringify(customCurrenciesDraft) !== JSON.stringify(settings.customCurrencies ?? []);

  const commitPendingDelete = async (nextPending: { id: string; title: string }) => {
    clearTimeout(deleteTimeoutRef.current);
    deleteTimeoutRef.current = null;
    await removeRecord(nextPending.id);
    setPendingDelete(null);
  };

  const queueDelete = (recordId: string, title: string) => {
    if (pendingDelete?.id && pendingDelete.id !== recordId) {
      void removeRecord(pendingDelete.id);
    }

    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }

    const nextPending = { id: recordId, title };
    setPendingDelete(nextPending);
    deleteTimeoutRef.current = setTimeout(() => {
      void commitPendingDelete(nextPending);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled);
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
  }, [settings.balanceFeatureEnabled, settings.customCurrencies, settings.defaultCurrency, settings.ownerName, settings.ownerProfileImageUri]);

  useEffect(() => {
    setVisibleSplitCount(20);
  }, [activityDateFilter, activityStateFilter]);

  const saveSettings = async () => {
    const trimmedName = ownerNameDraft.trim();
    if (!trimmedName) {
      setSettingsNoticeMessages(["Please choose a short name for yourself."]);
      return false;
    }

    if (!defaultCurrencyDraft.trim()) {
      setSettingsNoticeMessages(["Please choose a default currency first."]);
      return false;
    }

    await updateSettings({
      ownerName: trimmedName,
      ownerProfileImageUri: ownerProfileImageUriDraft.trim(),
      balanceFeatureEnabled: balanceFeatureEnabledDraft,
      defaultCurrency: defaultCurrencyDraft.trim().toUpperCase(),
      customCurrencies: customCurrenciesDraft,
    });
    setCurrencyMenuOpen(false);
    setSettingsNoticeMessages([]);
    return true;
  };

  const discardSettingsDraft = () => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled);
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCurrencyMenuOpen(false);
    setCurrencyModalOpen(false);
    setProfileActionMenuOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
    setPendingTabChange(null);
    setSettingsNoticeMessages([]);
  };

  const attemptTabChange = (nextTab: HomeTabKey) => {
    if (activeTab === "settings" && nextTab !== "settings" && settingsDirty) {
      setPendingTabChange(nextTab);
      return;
    }

    setActiveTab(nextTab);
  };

  const pickProfileImage = async (mode: "camera" | "library") => {
    setProfileActionMenuOpen(false);
    const permission =
      mode === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setSettingsNoticeMessages([
        mode === "camera"
          ? "Please allow camera access to take a profile picture."
          : "Please allow photo access to choose a profile picture.",
      ]);
      return;
    }

    const result =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setOwnerProfileImageUriDraft(result.assets[0].uri);
    setSettingsNoticeMessages([]);
  };

  const addCustomCurrency = async () => {
    const trimmedName = customCurrencyName.trim();
    const trimmedSymbol = customCurrencySymbol.trim();
    const nextErrors = {
      name: !trimmedName || trimmedName.length > 15,
      symbol: !trimmedSymbol || trimmedSymbol.length > 3,
    };
    setCustomCurrencyErrors(nextErrors);

    if (nextErrors.name || nextErrors.symbol) {
      if (!trimmedName) {
        setSettingsNoticeMessages(["Please add a currency name first."]);
      } else {
        setSettingsNoticeMessages(["Please add a currency symbol too."]);
      }
      return;
    }

    const normalizedCode = trimmedName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) || "CUR";
    const existingCodes = new Set(getCurrencyOptions({ customCurrencies: customCurrenciesDraft }).map((entry) => entry.code));
    let nextCode = normalizedCode;
    let suffix = 2;
    while (existingCodes.has(nextCode) && suffix <= 999) {
      const suffixToken = String(suffix);
      nextCode = `${normalizedCode.slice(0, Math.max(0, 3 - suffixToken.length))}${suffixToken}`;
      suffix += 1;
    }

    if (existingCodes.has(nextCode)) {
      nextCode = createId().replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3) || "CUR";
    }

    const nextCustomCurrencies = [
      ...customCurrenciesDraft,
      { code: nextCode, name: trimmedName, symbol: trimmedSymbol },
    ];
    setCustomCurrenciesDraft(nextCustomCurrencies);
    setDefaultCurrencyDraft(nextCode);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCustomCurrencyErrors({ name: false, symbol: false });
    setCurrencyModalOpen(false);
    setSettingsNoticeMessages([]);
  };

  const renderHomeContent = () => (
    <ScrollView
      style={screenStyles.flex}
      stickyHeaderIndices={[0]}
      contentContainerStyle={[
        screenStyles.mainTabScrollContent,
        {
          paddingBottom: 196 + Math.max(insets.bottom, 12),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[screenStyles.stickyHomeHeader, { paddingTop: Math.max(insets.top + 8, 18) }]}>
        <View style={screenStyles.homeHeader}>
          <Text
            fontFamily={FONTS.headlineBlack}
            fontSize={28}
            color={PALETTE.primary}
            textTransform="uppercase"
            fontStyle="italic"
            letterSpacing={-1.2}
          >
            Split Bill
          </Text>
        </View>
      </View>

      <YStack gap="$5">
        <View style={screenStyles.ctaHalo}>
          <Pressable
            style={screenStyles.homeCta}
            onPress={async () => {
              const draft = await createDraft();
              router.push(`/split/${draft.id}/setup`);
            }}
          >
            <View style={screenStyles.homeCtaIconWrap}>
              <Plus color={PALETTE.primary} size={20} />
            </View>
            <Text fontFamily={FONTS.headlineBlack} fontSize={26} color={PALETTE.onPrimary} letterSpacing={-1}>
              Start New Split
            </Text>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={12}
              color="rgba(255,255,255,0.82)"
              textTransform="uppercase"
              letterSpacing={3}
            >
              Create Shared Memory
            </Text>
          </Pressable>
        </View>

        {settings.balanceFeatureEnabled ? (
          <XStack gap="$4" alignItems="stretch">
            <View style={screenStyles.homeBalanceCardWrap}>
              <SectionCard>
                <View style={screenStyles.homeBalanceCardContent}>
                  <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.secondary} textTransform="uppercase" letterSpacing={2}>
                    You are owed
                  </Text>
                  <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurface} letterSpacing={-1.5}>
                    {formatAppMoney(balances.owedCents, balances.currency, locale, settings)}
                  </Text>
                </View>
              </SectionCard>
            </View>
            <View style={screenStyles.homeBalanceCardWrap}>
              <SectionCard>
                <View style={screenStyles.homeBalanceCardContent}>
                  <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.primary} textTransform="uppercase" letterSpacing={2}>
                    You owe
                  </Text>
                  <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurface} letterSpacing={-1.5}>
                    {formatAppMoney(balances.oweCents, balances.currency, locale, settings)}
                  </Text>
                </View>
              </SectionCard>
            </View>
          </XStack>
        ) : null}

        <YStack gap="$5">
          <XStack justifyContent="space-between" alignItems="flex-end">
            <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurfaceVariant} letterSpacing={-1.2}>
              Recent
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View all splits" onPress={() => setActiveTab("splits")}>
              <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.primary}>
                View All
              </Text>
            </Pressable>
          </XStack>

          {recentRecords.length === 0 ? (
            <EmptyState title="No splits yet" description="Start a new split to create your first shared memory." />
          ) : (
            <YStack gap="$3">
              {recentRecords.map((record, index) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  index={index}
                  ownerName={settings.ownerName}
                  settings={settings}
                  onDelete={queueDelete}
                />
              ))}
            </YStack>
          )}
        </YStack>
      </YStack>
    </ScrollView>
  );

  const renderSplitsContent = () => (
    <YStack flex={1}>
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const distanceFromBottom =
            nativeEvent.contentSize.height - (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
          if (distanceFromBottom < 240 && visibleSplitCount < filteredSplitRecords.length) {
            setVisibleSplitCount((current) => current + 20);
          }
        }}
        contentContainerStyle={[
          screenStyles.homeScrollContent,
          {
            paddingBottom: 148 + Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={screenStyles.mainTabHeaderWrap}>
          <View style={[screenStyles.stickyHomeHeader, { paddingTop: Math.max(insets.top + 8, 18) }]}>
            <View style={screenStyles.homeHeader}>
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={28}
                color={PALETTE.primary}
                textTransform="uppercase"
                fontStyle="italic"
                letterSpacing={-1.2}
              >
                Split Bill
              </Text>
            </View>
          </View>
        </View>

        <YStack gap="$5">
          {settings.balanceFeatureEnabled ? (
            <>
              <XStack gap="$4" alignItems="stretch">
                <View style={screenStyles.homeBalanceCardWrap}>
                  <SectionCard>
                    <View style={screenStyles.homeBalanceCardContent}>
                      <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.secondary} textTransform="uppercase" letterSpacing={2}>
                        You are owed
                      </Text>
                      <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurface} letterSpacing={-1.5}>
                        {formatAppMoney(balances.owedCents, balances.currency, locale, settings)}
                      </Text>
                    </View>
                  </SectionCard>
                </View>
                <View style={screenStyles.homeBalanceCardWrap}>
                  <SectionCard>
                    <View style={screenStyles.homeBalanceCardContent}>
                      <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.primary} textTransform="uppercase" letterSpacing={2}>
                        You owe
                      </Text>
                      <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurface} letterSpacing={-1.5}>
                        {formatAppMoney(balances.oweCents, balances.currency, locale, settings)}
                      </Text>
                    </View>
                  </SectionCard>
                </View>
              </XStack>
              <View style={screenStyles.itemsSectionSeparator} />
            </>
          ) : null}
          <XStack justifyContent="flex-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={filtersExpanded ? "Hide filters" : "Show filters"}
              style={[
                screenStyles.settingsInlineAction,
                filtersExpanded ? screenStyles.settingsInlineActionActive : null,
              ]}
              onPress={() => setFiltersExpanded((value) => !value)}
            >
              <Filter color={PALETTE.primary} size={18} />
            </Pressable>
          </XStack>
          {filtersExpanded ? (
            <SectionCard>
              <YStack gap="$3.5">
                <SectionEyebrow>Filters</SectionEyebrow>
                <YStack gap="$2.5">
                  <FieldLabel>Status</FieldLabel>
                  <ModePills
                    active={activityStateFilter}
                    options={[
                      { key: "all", label: "All" },
                      { key: "settled", label: "Settled" },
                      { key: "unsettled", label: "Unsettled" },
                    ]}
                    onChange={(value) => setActivityStateFilter(value as ActivityStateFilter)}
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>Date</FieldLabel>
                  <ModePills
                    active={activityDateFilter}
                    options={[
                      { key: "newest", label: "Newest" },
                      { key: "oldest", label: "Oldest" },
                    ]}
                    onChange={(value) => setActivityDateFilter(value as ActivityDateFilter)}
                  />
                </YStack>
              </YStack>
            </SectionCard>
          ) : null}

          {pagedSplitRecords.length === 0 ? (
            <EmptyState title="No splits here" description="Try a different filter or start a new split." />
          ) : (
            <YStack gap="$3">
              {pagedSplitRecords.map((item, index) => (
                <RecordRow
                  key={item.id}
                  record={item}
                  index={index}
                  ownerName={settings.ownerName}
                  settings={settings}
                  onDelete={queueDelete}
                />
              ))}
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );

  const renderSettingsContent = () => (
    <ScrollView
      style={screenStyles.flex}
      stickyHeaderIndices={[0]}
      contentContainerStyle={[
        screenStyles.mainTabScrollContent,
        {
          paddingBottom: 268 + Math.max(insets.bottom, 20),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <YStack gap="$3.5">
        <View style={[screenStyles.stickyHomeHeader, { paddingTop: Math.max(insets.top + 8, 18) }]}>
          <View style={screenStyles.homeHeader}>
            <Text
              fontFamily={FONTS.headlineBlack}
              fontSize={28}
              color={PALETTE.primary}
              textTransform="uppercase"
              fontStyle="italic"
              letterSpacing={-1.2}
            >
              Split Bill
            </Text>
          </View>
        </View>

        <YStack gap="$5">
          <YStack gap="$4">
            <SectionEyebrow>User profile</SectionEyebrow>
            <XStack gap="$4" alignItems="flex-start">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile picture options"
                style={screenStyles.settingsAvatarWrap}
                onPress={() => setProfileActionMenuOpen(true)}
              >
                {ownerProfileImageUriDraft ? (
                  <Image source={{ uri: ownerProfileImageUriDraft }} style={screenStyles.settingsAvatarImage} />
                ) : (
                  <Text fontFamily={FONTS.headlineBlack} fontSize={22} color={PALETTE.primary}>
                    {getInitials(ownerNameDraft || settings.ownerName)}
                  </Text>
                )}
              </Pressable>
              <YStack flex={1} gap="$2">
                <FieldLabel>Your name</FieldLabel>
                <View style={screenStyles.assignInputShell}>
                  <TextInput
                    value={ownerNameDraft}
                    onChangeText={(value) => setOwnerNameDraft(value.slice(0, MAX_OWNER_NAME_LENGTH))}
                    placeholder="e.g. Tiago"
                    placeholderTextColor="rgba(86,67,57,0.35)"
                    style={screenStyles.assignInput}
                    maxLength={MAX_OWNER_NAME_LENGTH}
                  />
                </View>
                <Text fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={21} color={PALETTE.onSurfaceVariant}>
                  This is the name the app uses for your own spot in a split, like `Tiago (You)`.
                </Text>
              </YStack>
            </XStack>
          </YStack>

          <View style={screenStyles.itemsSectionSeparator} />

            <YStack gap="$4">
              <SectionEyebrow>Default currency</SectionEyebrow>
            <Text fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={21} color={PALETTE.onSurfaceVariant}>
              New splits start with this money type, but you can still change it for one split when you begin.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose default currency"
              style={screenStyles.selectRow}
              onPress={() => setCurrencyMenuOpen((value) => !value)}
            >
              <XStack alignItems="center" justifyContent="space-between" gap="$3">
                <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                  {getCurrencyOptionLabel(defaultCurrencyDraft, { customCurrencies: customCurrenciesDraft })}
                </Text>
                <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
              </XStack>
            </Pressable>
            {currencyMenuOpen ? (
              <YStack gap="$2">
                {draftCurrencyOptions.map((option) => {
                  const active = defaultCurrencyDraft === option.code;
                  return (
                    <Pressable
                      key={option.code}
                      style={[screenStyles.selectRow, active ? screenStyles.selectRowActive : null]}
                      onPress={() => {
                        setDefaultCurrencyDraft(option.code);
                        setCurrencyMenuOpen(false);
                      }}
                    >
                      <Text fontFamily={FONTS.bodyMedium} fontSize={16} color={active ? PALETTE.primary : PALETTE.onSurface}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose other currency"
                  style={screenStyles.selectRow}
                  onPress={() => {
                    setCurrencyMenuOpen(false);
                    setCurrencyModalOpen(true);
                  }}
                >
                  <Text fontFamily={FONTS.bodyMedium} fontSize={16} color={PALETTE.primary}>
                    Other
                  </Text>
                </Pressable>
              </YStack>
            ) : null}
          </YStack>

          <View style={screenStyles.itemsSectionSeparator} />

          <YStack gap="$4">
            <SectionEyebrow>Features</SectionEyebrow>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                  Balance helper
                </Text>
                <Text fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={21} color={PALETTE.onSurfaceVariant}>
                  Turn this on if you want the app to remember simple open money, like `you owe` and `you are owed`.
                </Text>
              </YStack>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle balance helper"
                style={[
                  screenStyles.settingsFeatureToggle,
                  balanceFeatureEnabledDraft ? screenStyles.settingsFeatureToggleActive : null,
                ]}
                onPress={() => setBalanceFeatureEnabledDraft((value) => !value)}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={balanceFeatureEnabledDraft ? PALETTE.onPrimary : PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {balanceFeatureEnabledDraft ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>
          </YStack>
        </YStack>
      </YStack>
    </ScrollView>
  );

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3">
            {activeTab === "settings" ? (
              <PrimaryButton label="Save Settings" onPress={() => void saveSettings()} disabled={!settingsDirty} />
            ) : null}
            {pendingDelete ? (
              <View style={screenStyles.undoBanner}>
                <YStack flex={1} gap="$1">
                  <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
                    Draft deleted
                  </Text>
                  <Text fontFamily={FONTS.bodyMedium} fontSize={12} color="rgba(255,255,255,0.82)">
                    {pendingDelete.title}
                  </Text>
                </YStack>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Undo delete"
                  style={screenStyles.undoButton}
                  onPress={() => {
                    clearTimeout(deleteTimeoutRef.current);
                    deleteTimeoutRef.current = null;
                    setPendingDelete(null);
                  }}
                >
                  <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.6}>
                    Undo
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <HomeTabBar activeTab={activeTab} onChange={attemptTabChange} />
          </YStack>
        </FloatingFooter>
      }
    >
      {activeTab === "home" ? renderHomeContent() : null}
      {activeTab === "splits" ? renderSplitsContent() : null}
      {activeTab === "settings" ? renderSettingsContent() : null}
      <SplitNoticeModal messages={settingsNoticeMessages} onDismiss={() => setSettingsNoticeMessages([])} />
      {profileActionMenuOpen ? (
        <ActionSheetModal
          title="Profile picture"
          onDismiss={() => setProfileActionMenuOpen(false)}
          options={[
            ...(ownerProfileImageUriDraft
              ? [
                  {
                    label: "Remove photo",
                    tone: "danger" as const,
                    onPress: () => {
                      setOwnerProfileImageUriDraft("");
                      setProfileActionMenuOpen(false);
                    },
                  },
                ]
              : []),
            { label: "Take photo", onPress: () => void pickProfileImage("camera") },
            { label: "Upload photo", onPress: () => void pickProfileImage("library") },
            { label: "Cancel", onPress: () => setProfileActionMenuOpen(false) },
          ]}
        />
      ) : null}
      {currencyModalOpen ? (
        <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
          <View style={screenStyles.splitNoticeBackdrop} />
          <View style={screenStyles.splitNoticeCard}>
            <YStack gap="$3">
              <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
                Add a currency
              </Text>
              <View style={[screenStyles.assignInputShell, customCurrencyErrors.name ? screenStyles.assignInputShellError : null]}>
                <TextInput
                  value={customCurrencyName}
                  onChangeText={(value) => {
                    setCustomCurrencyName(value.slice(0, 15));
                    if (customCurrencyErrors.name) {
                      setCustomCurrencyErrors((current) => ({ ...current, name: false }));
                    }
                  }}
                  placeholder="Currency name"
                  placeholderTextColor="rgba(86,67,57,0.35)"
                  style={screenStyles.assignInput}
                  returnKeyType="next"
                  onSubmitEditing={() => customCurrencySymbolInputRef.current?.focus()}
                  maxLength={15}
                />
              </View>
              <View style={[screenStyles.assignInputShell, customCurrencyErrors.symbol ? screenStyles.assignInputShellError : null]}>
                <TextInput
                  ref={customCurrencySymbolInputRef}
                  value={customCurrencySymbol}
                  onChangeText={(value) => {
                    setCustomCurrencySymbol(value.slice(0, 3));
                    if (customCurrencyErrors.symbol) {
                      setCustomCurrencyErrors((current) => ({ ...current, symbol: false }));
                    }
                  }}
                  placeholder="Currency symbol"
                  placeholderTextColor="rgba(86,67,57,0.35)"
                  style={screenStyles.assignInput}
                  returnKeyType="done"
                  onSubmitEditing={() => void addCustomCurrency()}
                  maxLength={3}
                />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Save custom currency" style={screenStyles.splitNoticeButton} onPress={() => void addCustomCurrency()}>
                <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
                  Save currency
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel custom currency"
                style={screenStyles.actionSheetButton}
                onPress={() => {
                  setCurrencyModalOpen(false);
                  setCustomCurrencyErrors({ name: false, symbol: false });
                }}
              >
                <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onSurfaceVariant}>
                  Cancel
                </Text>
              </Pressable>
            </YStack>
          </View>
        </View>
      ) : null}
      {pendingTabChange ? (
        <ConfirmChoiceModal
          title="Save your changes?"
          body="You changed your settings. Save them now or discard them before leaving this page."
          confirmLabel="Save changes"
          discardLabel="Discard changes"
          onConfirm={() => {
            void saveSettings().then((saved) => {
              if (saved) {
                setActiveTab(pendingTabChange);
                setPendingTabChange(null);
              }
            });
          }}
          onDiscard={() => {
            discardSettingsDraft();
            setActiveTab(pendingTabChange);
            setPendingTabChange(null);
          }}
        />
      ) : null}
    </AppScreen>
  );
}

export function SetupScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { updateDraftMeta, setStep, settings } = useSplitStore(useShallow((state) => ({
    updateDraftMeta: state.updateDraftMeta,
    setStep: state.setStep,
    settings: state.settings,
  })));
  const insets = useSafeAreaInsets();
  const [splitName, setSplitName] = useState(record?.values.splitName ?? "");
  const [currency, setCurrency] = useState(record?.values.currency ?? settings.defaultCurrency);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [setupNoticeMessages, setSetupNoticeMessages] = useState<string[]>([]);

  useEffect(() => {
    if (record) {
      setSplitName(record.values.splitName ?? "");
      setCurrency(record.values.currency ?? settings.defaultCurrency);
      setCurrencyMenuOpen(false);
      setSetupNoticeMessages([]);
    }
  }, [record, settings.defaultCurrency]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const currencyOptions = [
    ...getCurrencyOptions(settings),
    ...(!getCurrencyOptions(settings).some((option) => option.code === settings.defaultCurrency)
      ? [{ code: settings.defaultCurrency, label: getCurrencyOptionLabel(settings.defaultCurrency, settings) }]
      : []),
  ];
  const normalizedCurrency = currency.trim().toUpperCase();
  const canContinue = Boolean(normalizedCurrency);

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next: Add Participants"
            accessibilityState={{ disabled: !canContinue }}
            style={[
              screenStyles.participantsContinueButton,
              !canContinue ? screenStyles.participantsContinueButtonDisabled : null,
            ]}
            onPress={async () => {
              if (!canContinue) {
                return;
              }
              if (!splitName.trim()) {
                setSetupNoticeMessages(["Please give this bill a short name first."]);
                return;
              }
              await updateDraftMeta(splitName.trim().slice(0, MAX_SPLIT_NAME_LENGTH), normalizedCurrency);
              await setStep(2);
              router.push(`/split/${draftId}/participants`);
            }}
          >
            <XStack alignItems="center" justifyContent="center" gap="$2.5">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={18}
                color={!canContinue ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer}
              >
                Next: Add Participants
              </Text>
              <ArrowRight color={!canContinue ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer} size={20} />
            </XStack>
          </Pressable>
        </FloatingFooter>
      }
      >
        <ScrollView
          style={screenStyles.flex}
          keyboardShouldPersistTaps="always"
          stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
          },
        ]}
        showsVerticalScrollIndicator={false}
        >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="New Split" onBack={() => router.replace("/")} />
        </View>

        <YStack gap="$5">
          <YStack gap="$4">
            <YStack gap="$2">
              <FieldLabel>Split name</FieldLabel>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  value={splitName}
                  onChangeText={(value) => {
                    setSplitName(value.slice(0, MAX_SPLIT_NAME_LENGTH));
                    if (setupNoticeMessages.length > 0) {
                      setSetupNoticeMessages([]);
                    }
                  }}
                  placeholder="e.g. Weekend groceries"
                  placeholderTextColor="rgba(86,67,57,0.35)"
                  style={screenStyles.assignInput}
                  maxLength={MAX_SPLIT_NAME_LENGTH}
                />
              </View>
            </YStack>

            <YStack gap="$2">
              <FieldLabel>Currency</FieldLabel>
              <YStack gap="$2.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose currency"
                  style={screenStyles.selectRow}
                  onPress={() => setCurrencyMenuOpen((value) => !value)}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$3">
                    <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                      {getCurrencyOptionLabel(normalizedCurrency || settings.defaultCurrency, settings)}
                    </Text>
                    <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                  </XStack>
                </Pressable>
                {currencyMenuOpen ? (
                  <YStack gap="$2">
                    {currencyOptions.map((option) => {
                      const active = normalizedCurrency === option.code;
                      return (
                        <Pressable
                          key={option.code}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose currency ${option.code}`}
                          style={[screenStyles.selectRow, active ? screenStyles.selectRowActive : null]}
                          onPress={() => {
                            setCurrency(option.code);
                            setCurrencyMenuOpen(false);
                          }}
                        >
                          <Text
                            fontFamily={FONTS.bodyMedium}
                            fontSize={16}
                            color={active ? PALETTE.primary : PALETTE.onSurface}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </YStack>
                ) : null}
              </YStack>
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={setupNoticeMessages} onDismiss={() => setSetupNoticeMessages([])} />
    </AppScreen>
  );
}

export function ParticipantsScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { records, updateParticipants, setStep, settings } = useSplitStore(useShallow((state) => ({
    records: state.records,
    updateParticipants: state.updateParticipants,
    setStep: state.setStep,
    settings: state.settings,
  })));
  const [name, setName] = useState("");
  const [participantsNoticeMessages, setParticipantsNoticeMessages] = useState<string[]>([]);
  const participantInputRef = useRef<TextInput>(null);
  const participantNameRef = useRef(name);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    participantNameRef.current = name;
  }, [name]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const participantsStepErrors = getParticipantsStepErrors(record.values);
  const stepOneErrors = [...new Set(participantsStepErrors.map((error) => error.message))];
  const isParticipantsStepReady = participantsStepErrors.length === 0;
  const activeParticipantNames = new Set(record.values.participants.map((participant) => participant.name.trim().toLowerCase()).filter(Boolean));
  const frequentFriends = getFrequentFriends(records, draftId, settings.ownerName).filter(
    (friend) => !activeParticipantNames.has(friend.name.trim().toLowerCase())
  );
  const addParticipant = async (rawName: string, options?: { keepKeyboardOpen?: boolean }) => {
    const trimmed = rawName.trim();
    if (!trimmed || record.values.participants.some((participant) => participant.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    await updateParticipants([...record.values.participants, { id: createId(), name: trimmed }]);
    setParticipantsNoticeMessages([]);
    setName("");
    if (options?.keepKeyboardOpen) {
      requestAnimationFrame(() => {
        participantInputRef.current?.focus();
      });
    } else {
      Keyboard.dismiss();
    }
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next: Select Payer"
            accessibilityState={{ disabled: !isParticipantsStepReady }}
            style={[
              screenStyles.participantsContinueButton,
              !isParticipantsStepReady ? screenStyles.participantsContinueButtonDisabled : null,
            ]}
            onPress={async () => {
              if (!isParticipantsStepReady) {
                setParticipantsNoticeMessages([...new Set(stepOneErrors.map(getFriendlySplitMessage))]);
                return;
              }

              await setStep(3);
              router.push(`/split/${draftId}/payer`);
            }}
          >
            <XStack alignItems="center" justifyContent="center" gap="$2.5">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={18}
                color={!isParticipantsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer}
              >
                Next: Select Payer
              </Text>
              <ArrowRight color={!isParticipantsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer} size={20} />
            </XStack>
          </Pressable>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        keyboardShouldPersistTaps="always"
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Who's splitting?" onBack={() => router.replace(`/split/${draftId}/setup`)} />
        </View>

        <YStack gap="$5">
          {frequentFriends.length > 0 ? (
            <YStack gap="$4">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={2.4}
              >
                Frequent Participants
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={screenStyles.frequentFriendsRow}>
                {frequentFriends.map((friend) => (
                  <Pressable
                    key={friend.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Add frequent friend ${friend.name}`}
                    style={screenStyles.frequentFriendItem}
                    onPress={() => void addParticipant(friend.name, { keepKeyboardOpen: false })}
                  >
                    <View style={[screenStyles.frequentFriendFrame, friend.selected ? screenStyles.frequentFriendFrameSelected : null]}>
                      <ParticipantAvatar
                        name={friend.name}
                        ownerName={settings.ownerName}
                        ownerProfileImageUri={settings.ownerProfileImageUri}
                        style={[screenStyles.frequentFriendAvatar, { backgroundColor: friend.background }]}
                        label={`Frequent friend avatar ${friend.name}`}
                        textSize={18}
                      />
                    </View>
                    <Text fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurface}>
                      {friend.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </YStack>
          ) : null}

          <View style={screenStyles.participantInputShell}>
            <TextInput
              ref={participantInputRef}
              value={name}
              onChangeText={(value) => {
                participantNameRef.current = value;
                setName(value);
              }}
              onSubmitEditing={() => void addParticipant(participantNameRef.current, { keepKeyboardOpen: true })}
              blurOnSubmit={false}
              returnKeyType="done"
              placeholder="Enter name"
              placeholderTextColor="rgba(86, 67, 57, 0.42)"
              style={screenStyles.participantInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add person"
              style={screenStyles.participantAddButton}
              onPress={() => void addParticipant(participantNameRef.current, { keepKeyboardOpen: true })}
            >
              <Plus color={PALETTE.onPrimary} size={20} />
            </Pressable>
          </View>

          <YStack gap="$3.5">
            <Text
              fontFamily={FONTS.bodyBold}
              fontSize={11}
              color={PALETTE.onSurfaceVariant}
              textTransform="uppercase"
              letterSpacing={2.4}
            >
              Added Participants
            </Text>

            {record.values.participants.length === 0 ? (
              null
            ) : (
              <YStack gap="$3.5">
                {record.values.participants.map((participant) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      onRemove={() =>
                        void updateParticipants(record.values.participants.filter((entry) => entry.id !== participant.id))
                      }
                  />
                ))}
              </YStack>
            )}
          </YStack>

        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={participantsNoticeMessages} onDismiss={() => setParticipantsNoticeMessages([])} />
    </AppScreen>
  );
}

export function PayerScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { setPayer, setStep, settings } = useSplitStore(useShallow((state) => ({
    setPayer: state.setPayer,
    setStep: state.setStep,
    settings: state.settings,
  })));
  const [showPayerHint, setShowPayerHint] = useState(false);
  const insets = useSafeAreaInsets();

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const payerErrors = record.values.payerParticipantId ? [] : ["Choose who paid the bill."];

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next: Add Items"
            accessibilityState={{ disabled: !record.values.payerParticipantId }}
            style={[
              screenStyles.participantsContinueButton,
              !record.values.payerParticipantId ? screenStyles.participantsContinueButtonDisabled : null,
            ]}
            onPress={async () => {
              if (!record.values.payerParticipantId) {
                setShowPayerHint(true);
                return;
              }

                await setStep(4);
                router.push(`/split/${draftId}/items`);
            }}
          >
            <XStack alignItems="center" justifyContent="center" gap="$2.5">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={18}
                color={!record.values.payerParticipantId ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer}
              >
                Next: Add Items
              </Text>
              <ArrowRight color={!record.values.payerParticipantId ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer} size={20} />
            </XStack>
          </Pressable>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
            gap: 26,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Who paid?" onBack={() => router.replace(`/split/${draftId}/participants`)} />
        </View>

        <YStack gap="$5">
          <YStack gap="$3.5">
            {record.values.participants.map((participant) => {
              const selected = participant.id === record.values.payerParticipantId;

              return (
                <Pressable
                  key={participant.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose payer ${participant.name}`}
                  style={[screenStyles.payerOptionRow, selected ? screenStyles.payerOptionRowSelected : null]}
                  onPress={() => void setPayer(participant.id)}
                >
                  <XStack alignItems="center" gap="$3.5" flex={1}>
                    <ParticipantAvatar
                      name={participant.name}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      style={screenStyles.payerAvatar}
                      label={`Payer avatar ${participant.name}`}
                      textSize={16}
                    />
                    <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>
                      {getParticipantDisplayName(participant.name, settings.ownerName)}
                    </Text>
                  </XStack>
                  {selected ? (
                    <View style={screenStyles.payerSelectedIndicator}>
                      <Check color={PALETTE.onPrimary} size={16} />
                    </View>
                  ) : (
                    <View style={screenStyles.payerUnselectedIndicator} />
                  )}
                </Pressable>
              );
            })}
          </YStack>

        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={showPayerHint ? payerErrors : []} onDismiss={() => setShowPayerHint(false)} />
    </AppScreen>
  );
}

export function ItemsScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { removeItem, setStep } = useSplitStore(useShallow((state) => ({
    removeItem: state.removeItem,
    setStep: state.setStep,
  })));
  const [itemsNoticeMessages, setItemsNoticeMessages] = useState<string[]>([]);
  const [pendingItemDelete, setPendingItemDelete] = useState<null | { id: string; title: string }>(null);
  const itemDeleteTimeoutRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {
      if (itemDeleteTimeoutRef.current) {
        clearTimeout(itemDeleteTimeoutRef.current);
      }
    };
  }, []);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const stepTwoErrors = [...new Set(validateStepTwo(record.values).map((error) => error.message))];
  const locale = getDeviceLocale();
  const visibleItems = record.values.items.filter(isVisibleItem);
  const effectiveRecordForStep = pendingItemDelete
    ? {
        ...record,
        values: {
          ...record.values,
          items: record.values.items.filter((item) => item.id !== pendingItemDelete.id),
        },
      }
    : record;
  const effectiveStepTwoErrors = [...new Set(validateStepTwo(effectiveRecordForStep.values).map((error) => error.message))];
  const isItemsStepReady = effectiveStepTwoErrors.length === 0;
  const runningTotal = formatMoney(
    visibleItems.reduce((sum, item) => sum + (parseMoneyToCents(item.price) ?? 0), 0),
    record.values.currency,
    locale
  );

  const addManualItem = async () => {
    setItemsNoticeMessages([]);
    router.push(`/split/${draftId}/assign/new`);
  };

  const commitPendingItemDelete = async (nextPending: { id: string; title: string }) => {
    clearTimeout(itemDeleteTimeoutRef.current);
    itemDeleteTimeoutRef.current = null;
    await removeItem(nextPending.id);
    setPendingItemDelete(null);
  };

  const queueItemDelete = (itemId: string, title: string) => {
    if (pendingItemDelete?.id && pendingItemDelete.id !== itemId) {
      void removeItem(pendingItemDelete.id);
    }

    if (itemDeleteTimeoutRef.current) {
      clearTimeout(itemDeleteTimeoutRef.current);
    }

    const nextPending = { id: itemId, title };
    setPendingItemDelete(nextPending);
    itemDeleteTimeoutRef.current = setTimeout(() => {
      void commitPendingItemDelete(nextPending);
    }, 4000);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3.5">
            {pendingItemDelete ? (
              <View style={screenStyles.undoBanner}>
                <YStack flex={1} gap="$1">
                  <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
                    Item deleted
                  </Text>
                  <Text fontFamily={FONTS.bodyMedium} fontSize={12} color="rgba(255,255,255,0.82)">
                    {pendingItemDelete.title}
                  </Text>
                </YStack>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Undo item delete"
                  style={screenStyles.undoButton}
                  onPress={() => {
                    clearTimeout(itemDeleteTimeoutRef.current);
                    itemDeleteTimeoutRef.current = null;
                    setPendingItemDelete(null);
                  }}
                >
                  <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.6}>
                    Undo
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <YStack gap="$1">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={10}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={2.1}
              >
                Running total
              </Text>
              <XStack alignItems="flex-end" gap="$2.5">
                <Text fontFamily={FONTS.headlineBlack} fontSize={30} color={PALETTE.onSurface} letterSpacing={-1.2}>
                  {runningTotal}
                </Text>
                <Text fontFamily={FONTS.bodyMedium} fontSize={14} color={PALETTE.onSurfaceVariant} paddingBottom="$1">
                  {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
                </Text>
              </XStack>
            </YStack>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next: Split Bill"
              accessibilityState={{ disabled: !isItemsStepReady }}
              style={[
                screenStyles.itemsNextButton,
                !isItemsStepReady ? screenStyles.participantsContinueButtonDisabled : null,
              ]}
              onPress={async () => {
                if (!isItemsStepReady) {
                  setItemsNoticeMessages([...new Set(effectiveStepTwoErrors.map(getFriendlySplitMessage))]);
                  return;
                }
                await setStep(5);
                const nextItem = getLatestPendingSplitItem(effectiveRecordForStep);
                router.push(nextItem ? `/split/${draftId}/split/${nextItem.id}` : `/split/${draftId}/overview`);
              }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={18}
                  color={!isItemsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimary}
                >
                  Next: Split Bill
                </Text>
                <ArrowRight color={!isItemsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimary} size={20} />
              </XStack>
            </Pressable>
          </YStack>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 188 + Math.max(insets.bottom, 14),
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Add Items" onBack={() => router.replace(`/split/${draftId}/payer`)} />
        </View>

        <YStack gap="$5">
          <View style={screenStyles.itemsImportCard}>
            <XStack alignItems="center" gap="$3">
              <View style={screenStyles.itemsImportIconWrap}>
                <ReceiptText color={PALETTE.primary} size={16} />
              </View>
              <XStack alignItems="center" gap="$2.5" flex={1}>
                <YStack justifyContent="center" minHeight={34} flex={1}>
                  <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                    Import Receipt
                  </Text>
                </YStack>
                <View style={screenStyles.soonChip}>
                  <Text fontFamily={FONTS.bodyBold} fontSize={10} color={PALETTE.primary} textTransform="uppercase" letterSpacing={1.2}>
                    Soon
                  </Text>
                </View>
              </XStack>
            </XStack>
            <XStack gap="$3" paddingTop="$3.5">
              <View
                accessibilityLabel="Scan Photo coming soon"
                style={[screenStyles.itemsImportPrimaryButton, screenStyles.itemsImportButtonDisabled]}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2">
                  <Camera color={PALETTE.onSurfaceVariant} size={16} />
                  <Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onSurfaceVariant}>
                    Scan Photo
                  </Text>
                </XStack>
              </View>
              <View
                accessibilityLabel="AI Paste coming soon"
                style={[screenStyles.itemsImportSecondaryButton, screenStyles.itemsImportButtonDisabled]}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2">
                  <ClipboardCopy color={PALETTE.onSurfaceVariant} size={16} />
                  <Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onSurfaceVariant}>
                    AI Paste
                  </Text>
                </XStack>
              </View>
            </XStack>
          </View>

          <View style={screenStyles.itemsSectionSeparator} />

          <YStack gap="$3.5">
            <YStack gap="$3">
              {visibleItems.map((item, index) => (
                <Swipeable
                  key={item.id}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete item ${item.name.trim() || `Item ${index + 1}`}`}
                      style={screenStyles.recentSwipeDeleteAction}
                      onPress={() => queueItemDelete(item.id, item.name.trim() || `Item ${index + 1}`)}
                    >
                      <Trash2 color={PALETTE.onPrimary} size={18} />
                      <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.6}>
                        Delete
                      </Text>
                    </Pressable>
                  )}
                >
                  <Pressable
                    style={screenStyles.itemsListCard}
                    onPress={() => router.push(`/split/${draftId}/assign/${item.id}`)}
                  >
                    <XStack alignItems="center" justifyContent="space-between" gap="$4">
                      <YStack flex={1} gap="$1.5">
                        <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                          {item.name.trim() || `Item ${index + 1}`}
                        </Text>
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={11}
                          color={PALETTE.onSurfaceVariant}
                          textTransform="uppercase"
                          letterSpacing={1.5}
                        >
                          {getItemCategoryLabel(item)}
                        </Text>
                      </YStack>
                      <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                        {formatMoney(parseMoneyToCents(item.price) ?? 0, record.values.currency, locale)}
                      </Text>
                    </XStack>
                  </Pressable>
                </Swipeable>
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Item Manually"
                style={screenStyles.itemsManualAddButton}
                onPress={() => void addManualItem()}
              >
                <XStack alignItems="center" justifyContent="center" gap="$2.5">
                  <View style={screenStyles.itemsManualAddIconWrap}>
                    <Plus color={PALETTE.onPrimary} size={14} />
                  </View>
                  <Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurfaceVariant}>
                    Add Item Manually
                  </Text>
                </XStack>
              </Pressable>
            </YStack>
          </YStack>

        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={itemsNoticeMessages} onDismiss={() => setItemsNoticeMessages([])} />
    </AppScreen>
  );
}

function FlowScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$3">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack}>
          <ArrowLeft color={PALETTE.primary} size={22} />
        </Pressable>
        <Text fontFamily={FONTS.headlineBlack} fontSize={24} color={PALETTE.primary} letterSpacing={-1.1}>
          {title}
        </Text>
      </XStack>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => router.replace("/")}>
        <X color={PALETTE.primary} size={22} />
      </Pressable>
    </XStack>
  );
}

function SplitNoticeModal({
  messages,
  onDismiss,
}: {
  messages: string[];
  onDismiss: () => void;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <View style={screenStyles.splitNoticeBackdrop} />
      <View style={screenStyles.splitNoticeCard}>
        <YStack gap="$3">
          <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>
            Almost there
          </Text>
          {messages.map((message) => (
            <Text key={message} fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={22} color={PALETTE.onSurfaceVariant}>
              {message}
            </Text>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss split notice" style={screenStyles.splitNoticeButton} onPress={onDismiss}>
            <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.onPrimary}>
              Okay
            </Text>
          </Pressable>
        </YStack>
      </View>
    </View>
  );
}

export function PasteImportScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const importPastedList = useSplitStore((state) => state.importPastedList);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <PrimaryButton
            label="Apply import"
            icon={<ReceiptText color={PALETTE.onPrimary} size={18} />}
            onPress={async () => {
              const result = await importPastedList(input, mode);
              if (result.warningMessages.length > 0) {
                Alert.alert("Import notes", result.warningMessages.join("\n"));
              }
              router.back();
            }}
          />
        </FloatingFooter>
      }
    >
      <ScreenHeader
        title="Paste item list"
        trailing={
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => router.replace("/")}>
            <X color={PALETTE.primary} size={22} />
          </Pressable>
        }
      />

      <SectionCard>
        <FieldLabel>Import mode</FieldLabel>
        <XStack gap="$3">
          {(["append", "replace"] as const).map((option) => (
            <Pressable key={option} style={[screenStyles.togglePill, { backgroundColor: mode === option ? PALETTE.primary : PALETTE.surfaceContainerLow }]} onPress={() => setMode(option)}>
              <Text color={mode === option ? PALETTE.onPrimary : PALETTE.primary} fontFamily={FONTS.bodyBold}>
                {option === "append" ? "Append" : "Replace"}
              </Text>
            </Pressable>
          ))}
        </XStack>
      </SectionCard>

      <SectionCard>
        <FieldLabel>Pasted text</FieldLabel>
        <SoftInput value={input} onChangeText={setInput} multiline placeholder={"Bananas - 2.49\nTomatoes: 1.80\nMilk 3.40"} />
      </SectionCard>

      <SectionCard soft>
        <SectionEyebrow>Later milestones</SectionEyebrow>
        <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body}>
          OCR, PDF import, and the AI extraction handoff stay deferred in this build. The same documented parser contract still guides this pasted import flow.
        </Paragraph>
      </SectionCard>
    </AppScreen>
  );
}

export function AssignItemScreen({ draftId, itemId }: { draftId: string; itemId: string }) {
  const record = useRecord(draftId);
  const { createItem, removeItem, updateItemField } = useSplitStore(useShallow((state) => ({
    createItem: state.createItem,
    removeItem: state.removeItem,
    updateItemField: state.updateItemField,
  })));
  const [editorItem, setEditorItem] = useState<DraftRecord["values"]["items"][number] | null>(null);
  const [assignNoticeMessages, setAssignNoticeMessages] = useState<string[]>([]);
  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState(false);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!record) {
      return;
    }

    if (itemId === "new") {
      setEditorItem((current) => current ?? { ...createEmptyItem(record.values.participants), category: "General" });
      return;
    }

    const sourceItem = record.values.items.find((entry) => entry.id === itemId);
    if (sourceItem) {
      setEditorItem((current) => {
        if (current?.id === sourceItem.id) {
          return current;
        }
        return { ...sourceItem };
      });
      return;
    }
    setEditorItem(null);
  }, [itemId, record]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const sourceItem = itemId === "new" ? null : record.values.items.find((entry) => entry.id === itemId);
  const item = editorItem;
  if (!item) {
    return <AppScreen scroll={false}><EmptyState title="Item missing" description="This item no longer exists in the draft." /></AppScreen>;
  }

  const locale = getDeviceLocale();
  const zeroMoney = formatMoney(0, record.values.currency, locale);
  const isNewItem = itemId === "new";
  const effectiveCategory = item.category?.trim() || "General";
  const sourceCategory = sourceItem?.category?.trim() ?? "";
  const initialCategory = sourceCategory || "General";
  const isDirty =
    isNewItem
      ? item.name.trim().length > 0 || item.price.trim().length > 0
      : Boolean(sourceItem) && (
          sourceItem.name !== item.name ||
          sourceItem.price !== item.price ||
          initialCategory !== effectiveCategory
        );
  const parsedItemPriceCents = item.price.trim().length > 0 ? parseMoneyToCents(item.price) : null;
  const hasValidPrice = parsedItemPriceCents !== null && parsedItemPriceCents !== 0;
  const duplicateItemExists = record.values.items.some((existingItem) => {
    if (!isNewItem && existingItem.id === item.id) {
      return false;
    }

    return (
      existingItem.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
      existingItem.price.trim() === item.price.trim() &&
      (existingItem.category?.trim() || "General").toLowerCase() === effectiveCategory.toLowerCase()
    );
  });

  const updateWorkingItemField = async (field: "name" | "price" | "category", value: string) => {
    setAssignNoticeMessages([]);
    const nextValue = field === "name" ? value.slice(0, MAX_ITEM_NAME_LENGTH) : value;
    setEditorItem((current) => ({ ...current!, [field]: nextValue }));
  };

  const closeEditor = async () => {
    if (isDirty) {
      setShowDiscardChangesModal(true);
      return;
    }

    if (isNewItem) {
      router.back();
      return;
    }
    router.back();
  };

  const saveEditor = async () => {
    if (!hasValidPrice) {
      setAssignNoticeMessages(["Add a valid price before saving this item."]);
      return;
    }

    if (duplicateItemExists) {
      setAssignNoticeMessages(["This item already exists. Change the name, price, or category."]);
      return;
    }

    if (isNewItem) {
      await createItem({ ...item, category: effectiveCategory });
      router.back();
      return;
    }

    const persistedSourceItem = sourceItem as NonNullable<typeof sourceItem>;
    if (persistedSourceItem.name !== item.name) {
      await updateItemField(item.id, "name", item.name);
    }
    if (persistedSourceItem.price !== item.price) {
      await updateItemField(item.id, "price", item.price);
    }
    if ((persistedSourceItem.category?.trim() ?? "") !== effectiveCategory) {
      await updateItemField(item.id, "category", effectiveCategory);
    }

    router.back();
  };

  const deleteEditorItem = async () => {
    setShowDeleteItemModal(true);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <XStack gap="$3" alignItems="center">
            {!isNewItem ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete Item"
                style={screenStyles.itemDeleteButton}
                onPress={() => void deleteEditorItem()}
              >
                <Trash2 color={PALETTE.danger} size={18} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save Item"
              style={[
                isNewItem ? screenStyles.itemSaveButtonFull : screenStyles.itemSaveButton,
                screenStyles.itemsNextButton,
                !hasValidPrice ? screenStyles.participantsContinueButtonDisabled : null,
              ]}
              onPress={() => void saveEditor()}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={18}
                  color={!hasValidPrice ? PALETTE.onSurfaceVariant : PALETTE.onPrimary}
                >
                  Save Item
                </Text>
                <ArrowRight color={!hasValidPrice ? PALETTE.onSurfaceVariant : PALETTE.onPrimary} size={20} />
              </XStack>
            </Pressable>
          </XStack>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 164 + Math.max(insets.bottom, 14),
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title={isNewItem ? "Add Item" : "Edit Item"} onBack={() => void closeEditor()} />
        </View>

        <YStack gap="$5">
          <YStack gap="$3.5">
            <YStack gap="$2">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={2.1}
              >
                Item Description
              </Text>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  ref={nameInputRef}
                  accessibilityLabel="Item name"
                  value={item.name}
                  maxLength={MAX_ITEM_NAME_LENGTH}
                  onChangeText={(value) => void updateWorkingItemField("name", value)}
                  onSubmitEditing={() => priceInputRef.current?.focus()}
                  placeholder="e.g. Truffle Pasta"
                  placeholderTextColor="rgba(86, 67, 57, 0.28)"
                  style={screenStyles.assignInput}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>
            </YStack>

            <YStack gap="$2">
              <XStack alignItems="center" justifyContent="space-between">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  Price
                </Text>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.8}
                >
                  Currency: {record.values.currency}
                </Text>
              </XStack>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  ref={priceInputRef}
                  accessibilityLabel="Item price"
                  value={item.price}
                  onChangeText={(value) => void updateWorkingItemField("price", value)}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  placeholder={zeroMoney}
                  placeholderTextColor="rgba(86, 67, 57, 0.28)"
                  style={screenStyles.assignPriceInput}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </YStack>
          </YStack>

          <SectionCard>
            <FieldLabel>Category</FieldLabel>
            <XStack flexWrap="wrap" gap="$2.5">
              {ITEM_CATEGORY_OPTIONS.map((option) => {
                const selected = effectiveCategory === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose category ${option}`}
                    style={[
                      screenStyles.categoryChip,
                      selected ? screenStyles.categoryChipActive : null,
                    ]}
                    onPress={() => void updateWorkingItemField("category", option)}
                  >
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={12}
                      color={selected ? PALETTE.onPrimary : PALETTE.onSurfaceVariant}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </XStack>
          </SectionCard>
        </YStack>
      </ScrollView>
      {showDiscardChangesModal ? (
        <ConfirmChoiceModal
          title="Discard changes?"
          body="You started this item but have not saved it yet."
          confirmLabel="Discard changes"
          discardLabel="Keep editing"
          onConfirm={() => {
            setShowDiscardChangesModal(false);
            if (!isNewItem && sourceItem) {
              setEditorItem({ ...sourceItem });
            }
            if (isNewItem) {
              setEditorItem({ ...createEmptyItem(record.values.participants), category: "General" });
            }
            router.back();
          }}
          onDiscard={() => setShowDiscardChangesModal(false)}
        />
      ) : null}
      {showDeleteItemModal ? (
        <ConfirmChoiceModal
          title="Delete item?"
          body="This will remove the item from the bill."
          confirmLabel="Delete item"
          discardLabel="Keep item"
          onConfirm={() => {
            setShowDeleteItemModal(false);
            void removeItem(item.id).then(() => router.back());
          }}
          onDiscard={() => setShowDeleteItemModal(false)}
        />
      ) : null}
      <SplitNoticeModal messages={assignNoticeMessages} onDismiss={() => setAssignNoticeMessages([])} />
    </AppScreen>
  );
}

export function SplitItemScreen({ draftId, itemId }: { draftId: string; itemId: string }) {
  const record = useRecord(draftId);
  const { saveItemSplit, settings } = useSplitStore(useShallow((state) => ({
    saveItemSplit: state.saveItemSplit,
    settings: state.settings,
  })));
  const [workingItem, setWorkingItem] = useState<DraftRecord["values"]["items"][number] | null>(null);
  const [splitNoticeMessages, setSplitNoticeMessages] = useState<string[]>([]);
  const [percentSliderResetKey, setPercentSliderResetKey] = useState(0);
  const modeAllocationsRef = useRef<{
    even: DraftRecord["values"]["items"][number]["allocations"];
    shares: DraftRecord["values"]["items"][number]["allocations"];
    percent: DraftRecord["values"]["items"][number]["allocations"];
  } | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!record) {
      return;
    }

    const sourceItem = record.values.items.find((entry) => entry.id === itemId);
    if (sourceItem) {
      const sourceAllocations = cloneAllocations(sourceItem.allocations);
      modeAllocationsRef.current = {
        even:
          sourceItem.splitMode === "even"
            ? sourceAllocations
            : cloneAllocations(sourceItem.allocations),
        shares:
          sourceItem.splitMode === "shares"
            ? cloneAllocations(sourceItem.allocations)
            : resetShareAllocations(cloneAllocations(sourceItem.allocations)),
        percent:
          sourceItem.splitMode === "percent"
            ? cloneAllocations(sourceItem.allocations)
            : resetPercentAllocations(cloneAllocations(sourceItem.allocations)),
      };
      setWorkingItem(cloneItem(sourceItem));
      setSplitNoticeMessages([]);
      return;
    }
    modeAllocationsRef.current = null;
    setWorkingItem(null);
    setSplitNoticeMessages([]);
  }, [itemId, record]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const item = workingItem;
  if (!item) {
    return <AppScreen scroll={false}><EmptyState title="Item missing" description="This item no longer exists in the draft." /></AppScreen>;
  }

  const locale = getDeviceLocale();
  const splitErrors = validateStepThree({ ...record.values, items: [item] }).map((error) => error.message);
  const nextItemId = getNextVisibleItemId(record, item.id);
  const ctaLabel = nextItemId ? "Confirm & Split Next" : "Confirm & Review";
  const totalShares = item.allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.shares) || 0), 0);
  const shareValue = totalShares > 0 ? (parseMoneyToCents(item.price) ?? 0) / totalShares : 0;
  const assignedCount = getAssignedParticipantCount(item);
  const totalPercent = item.allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.percent) || 0), 0);
  const splitScrollBottomPadding =
    item.splitMode === "shares"
      ? 292 + Math.max(insets.bottom, 14)
      : item.splitMode === "percent"
        ? 220 + Math.max(insets.bottom, 14)
        : 176 + Math.max(insets.bottom, 14);
  const displayTotalPercent = Math.abs(totalPercent - 100) <= 0.01
    ? "100"
    : Number.isInteger(totalPercent)
      ? String(totalPercent)
      : totalPercent.toFixed(2).replace(/\.?0+$/, "");

  const getRemainingPercentForParticipant = (participantId: string) => {
    const otherTotal = item.allocations.reduce((sum, allocation) => {
      if (allocation.participantId === participantId) {
        return sum;
      }

      return sum + (parseFloat(allocation.percent) || 0);
    }, 0);

    return Math.max(0, Math.round((100 - otherTotal) * 100) / 100);
  };

  const setSplitMode = (splitMode: "even" | "shares" | "percent") => {
    setSplitNoticeMessages([]);
    setWorkingItem((current) => {
      const nextCurrent = current!;
      const currentMode = nextCurrent.splitMode;
      const modeAllocations = modeAllocationsRef.current!;
      modeAllocations[currentMode] = cloneAllocations(nextCurrent.allocations);
      const nextAllocations = cloneAllocations(modeAllocations[splitMode]);
      return { ...nextCurrent, splitMode, allocations: nextAllocations };
    });
  };

  const updateWorkingAllocations = (
    updater: (allocations: DraftRecord["values"]["items"][number]["allocations"]) => DraftRecord["values"]["items"][number]["allocations"]
  ) => {
    setWorkingItem((current) => {
      const nextCurrent = current!;
      const nextAllocations = updater(nextCurrent.allocations);
      modeAllocationsRef.current![nextCurrent.splitMode] = cloneAllocations(nextAllocations);
      return {
        ...nextCurrent,
        allocations: nextAllocations,
      };
    });
  };

  const toggleEvenIncluded = (participantId: string) => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) =>
        allocation.participantId === participantId
          ? { ...allocation, evenIncluded: !allocation.evenIncluded }
          : allocation
      )
    );
  };

  const incrementShares = (participantId: string, delta: number) => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) => {
        if (allocation.participantId !== participantId) {
          return allocation;
        }

        const nextShares = Math.max(0, (parseFloat(allocation.shares) || 0) + delta);
        return { ...allocation, shares: String(nextShares) };
      })
    );
  };

  const includeAllWorkingSplit = () => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) => {
      const nextCurrent = workingItem!;

      if (nextCurrent.splitMode === "even") {
        return allocations.map((allocation) => ({
          ...allocation,
          evenIncluded: true,
        }));
      }

      if (nextCurrent.splitMode === "shares") {
        return allocations.map((allocation) => ({
          ...allocation,
          shares: (parseFloat(allocation.shares) || 0) > 0 ? allocation.shares : "1",
        }));
      }

      const currentTotalBasisPoints = allocations.reduce((sum, allocation) => {
        return sum + Math.round((parseFloat(allocation.percent) || 0) * 100);
      }, 0);
      const missingBasisPoints = Math.max(0, 10000 - currentTotalBasisPoints);
      const zeroPercentParticipantIds = allocations
        .filter((allocation) => (parseFloat(allocation.percent) || 0) <= 0)
        .map((allocation) => allocation.participantId);

      if (missingBasisPoints === 0 || zeroPercentParticipantIds.length === 0) {
        return allocations;
      }

      const baseShare = Math.floor(missingBasisPoints / zeroPercentParticipantIds.length);
      let remainder = missingBasisPoints % zeroPercentParticipantIds.length;
      const additionByParticipantId = new Map<string, number>();
      zeroPercentParticipantIds.forEach((participantId) => {
        const addition = baseShare + (remainder > 0 ? 1 : 0);
        additionByParticipantId.set(participantId, addition);
        if (remainder > 0) {
          remainder -= 1;
        }
      });

      return allocations.map((allocation) => {
        const addition = additionByParticipantId.get(allocation.participantId);
        if (addition === undefined) {
          return allocation;
        }

        return {
          ...allocation,
          percent: formatPercentValue((addition / 100).toFixed(2)),
          percentLocked: false,
        };
      });
    });
  };

  const excludeAllWorkingSplit = () => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) => {
      const nextCurrent = workingItem!;

      if (nextCurrent.splitMode === "even") {
        return allocations.map((allocation) => ({
          ...allocation,
          evenIncluded: false,
        }));
      }

      if (nextCurrent.splitMode === "percent") {
        return allocations.map((allocation) => ({
          ...allocation,
          percent: "0",
          percentLocked: false,
        }));
      }

      return allocations.map((allocation) => ({
        ...allocation,
        shares: "0",
      }));
    });
  };

  const setWorkingPercentValue = async (
    participantId: string,
    nextValue: string,
    options?: { clampToRemaining?: boolean }
  ) => {
      if (nextValue.trim() === "") {
        setSplitNoticeMessages([]);
      updateWorkingAllocations((allocations) =>
        allocations.map((allocation) =>
          allocation.participantId === participantId
            ? { ...allocation, percent: nextValue }
            : allocation
        )
      );
      return;
    }

    const normalizedValue = normalizePercentInput(nextValue);
    if (hasTrailingPercentSeparator(nextValue)) {
      setSplitNoticeMessages([]);
      updateWorkingAllocations((allocations) =>
        allocations.map((allocation) =>
          allocation.participantId === participantId
            ? { ...allocation, percent: nextValue }
            : allocation
        )
      );
      return;
    }

    const percentInputMessage = getPercentInputMessage(normalizedValue);
    if (percentInputMessage) {
      Keyboard.dismiss();
      setPercentSliderResetKey((current) => current + 1);
      setSplitNoticeMessages([percentInputMessage]);
      return;
    }

    const nextAllocations = rebalanceEditablePercentAllocations(item.allocations, participantId, normalizedValue, options);
    if (!nextAllocations) {
      const remainingPercentForParticipant = getRemainingPercentForParticipant(participantId);
      const currentPercent = parseFloat(
        item.allocations.find((allocation) => allocation.participantId === participantId)!.percent
      ) || 0;
      const noPercentLeft = remainingPercentForParticipant <= currentPercent + 0.001;
      Keyboard.dismiss();
      setPercentSliderResetKey((current) => current + 1);
      setSplitNoticeMessages([
        noPercentLeft
          ? "This item is already fully split. Lower someone else's percent first."
          : "That number is too high. Lower it or add someone else to share the rest.",
      ]);
      return;
    }

    setSplitNoticeMessages([]);
    updateWorkingAllocations(() => nextAllocations);
  };

  const finalizeWorkingPercentValue = (participantId: string) => {
    setSplitNoticeMessages([]);
    updateWorkingAllocations((allocations) =>
      allocations.map((allocation) => {
        if (allocation.participantId !== participantId) {
          return allocation;
        }

        if (!hasTrailingPercentSeparator(allocation.percent)) {
          return allocation;
        }

        return {
          ...allocation,
          percent: normalizeCommittedPercentValue(allocation.percent),
        };
      })
    );
  };

  const confirmSplit = async () => {
    if (splitErrors.length > 0) {
      setSplitNoticeMessages([...new Set(splitErrors.map(getFriendlySplitMessage))]);
      return;
    }

    const committedItem =
      item.splitMode === "percent"
        ? {
            ...item,
            allocations: item.allocations.map((allocation) => ({
              ...allocation,
              percent: normalizeCommittedPercentValue(allocation.percent),
            })),
          }
        : item;

    await saveItemSplit(item.id, committedItem);
    if (nextItemId) {
      router.push(`/split/${draftId}/split/${nextItemId}`);
      return;
    }

    router.push(`/split/${draftId}/overview`);
  };

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3">
            {item.splitMode === "shares" ? (
              <View style={screenStyles.splitSummaryCard}>
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <YStack gap="$1">
                    <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.8}>
                      Total shares
                    </Text>
                    <Text fontFamily={FONTS.bodyMedium} fontSize={13} color={PALETTE.onSurfaceVariant}>
                      Each share is valued at {formatMoney(Math.round(shareValue), record.values.currency, locale)}
                    </Text>
                  </YStack>
                  <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.primary}>
                    {totalShares}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack gap="$1">
                    <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.6}>
                      Total shares
                    </Text>
                    <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                      {totalShares}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end" gap="$1">
                    <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.6}>
                      Price per share
                    </Text>
                    <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.primary}>
                      {formatMoney(Math.round(shareValue), record.values.currency, locale)}
                    </Text>
                  </YStack>
                </XStack>
              </View>
            ) : null}
            {item.splitMode === "percent" ? (
              <View style={screenStyles.splitSummaryCard}>
                <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.8}>
                  Split status
                </Text>
                <Text fontFamily={FONTS.headlineBold} fontSize={20} color={PALETTE.onSurface}>
                  Total: {displayTotalPercent}%
                </Text>
              </View>
            ) : null}
            <PrimaryButton
              label={ctaLabel}
              icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
              onPress={() => void confirmSplit()}
            />
          </YStack>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: splitScrollBottomPadding,
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Split Item" onBack={() => router.replace(`/split/${draftId}/overview`)} />
        </View>

        <YStack gap="$5">
          <YStack gap="$2" alignItems="center">
            <View style={screenStyles.splitCategoryPill}>
              <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.primary} textTransform="uppercase" letterSpacing={1.8}>
                {getItemCategoryLabel(item)}
              </Text>
            </View>
            <Text fontFamily={FONTS.headlineBlack} fontSize={34} color={PALETTE.onSurface} textAlign="center" letterSpacing={-1.4}>
              {item.name || "Untitled item"}
            </Text>
            <Text fontFamily={FONTS.headlineBold} fontSize={24} color={PALETTE.primary}>
              {formatMoney(parseMoneyToCents(item.price) ?? 0, record.values.currency, locale)}
            </Text>
          </YStack>

          <View style={screenStyles.splitModeShell}>
            <ModeToggle active={item.splitMode} onChange={setSplitMode} />
          </View>

          <YStack gap="$4">
            <XStack justifyContent="flex-end" alignItems="center">
              <View style={screenStyles.splitHeaderSegmentedControl}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Include all split participants"
                  onPress={includeAllWorkingSplit}
                  style={[screenStyles.splitHeaderSegment, screenStyles.splitHeaderSegmentLeft]}
                >
                  <Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.primary} textTransform="uppercase">
                    All
                  </Text>
                </Pressable>
                <View style={screenStyles.splitHeaderSegmentDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Exclude all split participants"
                  onPress={excludeAllWorkingSplit}
                  style={[screenStyles.splitHeaderSegment, screenStyles.splitHeaderSegmentRight]}
                >
                  <Text fontFamily={FONTS.bodyBold} fontSize={13} color={PALETTE.onSurface} textTransform="uppercase">
                    None
                  </Text>
                </Pressable>
              </View>
            </XStack>

            <YStack gap="$4">
              {record.values.participants.map((participant) => {
                const allocation = item.allocations.find((entry) => entry.participantId === participant.id);
                if (!allocation) {
                  return null;
                }

                const portionCents =
                  item.splitMode === "even" && assignedCount > 0 && allocation.evenIncluded
                    ? Math.floor((parseMoneyToCents(item.price) ?? 0) / Math.max(assignedCount, 1))
                    : 0;
                const shareCount = parseFloat(allocation.shares) || 0;
                const percentValue = parseFloat(allocation.percent) || 0;
                const remainingPercentForParticipant = getRemainingPercentForParticipant(participant.id);
                const canAssignRemaining =
                  item.splitMode === "percent" &&
                  remainingPercentForParticipant > percentValue + 0.001 &&
                  totalPercent < 99.99;

                return (
                  <View key={participant.id} style={screenStyles.splitParticipantCard}>
                    <XStack alignItems="center" justifyContent="space-between" gap="$3">
                    <XStack alignItems="center" gap="$3" flex={1}>
                        <ParticipantAvatar
                          name={participant.name}
                          ownerName={settings.ownerName}
                          ownerProfileImageUri={settings.ownerProfileImageUri}
                          style={screenStyles.splitAvatar}
                          label={`Split avatar ${participant.name}`}
                        />
                        <YStack flex={1} gap="$1">
                          <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                            {getParticipantDisplayName(participant.name, settings.ownerName)}
                          </Text>
                          {item.splitMode === "even" ? (
                            <Text fontFamily={FONTS.bodyMedium} fontSize={13} color={PALETTE.onSurfaceVariant}>
                              {allocation.evenIncluded ? `${formatMoney(portionCents, record.values.currency, locale)} portion` : "Tap to include"}
                            </Text>
                          ) : null}
                        </YStack>
                      </XStack>

                      {item.splitMode === "even" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Toggle even split for ${participant.name}`}
                          onPress={() => toggleEvenIncluded(participant.id)}
                          style={allocation.evenIncluded ? screenStyles.payerSelectedIndicator : screenStyles.payerUnselectedIndicator}
                        >
                          {allocation.evenIncluded ? <Check color={PALETTE.onPrimary} size={16} /> : null}
                        </Pressable>
                      ) : null}

                      {item.splitMode === "shares" ? (
                        <XStack alignItems="center" gap="$2.5">
                          <Pressable accessibilityRole="button" accessibilityLabel={`Decrease shares for ${participant.name}`} onPress={() => incrementShares(participant.id, -1)} style={screenStyles.splitStepperButton}>
                            <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.primary}>-</Text>
                          </Pressable>
                          <View style={screenStyles.splitStepperValue}>
                            <Text fontFamily={FONTS.headlineBold} fontSize={20} color={PALETTE.onSurface}>{shareCount}</Text>
                          </View>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Increase shares for ${participant.name}`} onPress={() => incrementShares(participant.id, 1)} style={[screenStyles.splitStepperButton, screenStyles.splitStepperButtonActive]}>
                            <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onPrimary}>+</Text>
                          </Pressable>
                        </XStack>
                      ) : null}

                      {item.splitMode === "percent" ? (
                        <View style={screenStyles.percentValueShell}>
                          {canAssignRemaining ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Use remaining percent for ${participant.name}`}
                              onPress={() => void setWorkingPercentValue(participant.id, String(remainingPercentForParticipant))}
                              style={screenStyles.percentRemainderIcon}
                            >
                              <Text fontFamily={FONTS.headlineBold} fontSize={15} color={PALETTE.primary}>
                                &gt;&gt;
                              </Text>
                            </Pressable>
                          ) : null}
                          <TextInput
                            accessibilityLabel={`Percent for ${participant.name}`}
                            value={allocation.percent}
                            onChangeText={(value) => void setWorkingPercentValue(participant.id, value)}
                            onBlur={() => finalizeWorkingPercentValue(participant.id)}
                            onSubmitEditing={() => finalizeWorkingPercentValue(participant.id)}
                            placeholder="0"
                            placeholderTextColor={PALETTE.primary}
                            keyboardType="number-pad"
                            style={screenStyles.percentValueInput}
                          />
                          <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.primary}>
                            %
                          </Text>
                        </View>
                      ) : null}
                    </XStack>

                    {item.splitMode === "percent" ? (
                      <YStack gap="$2.5" paddingTop="$2">
                        <Slider
                          key={`percent-slider-${participant.id}-${percentSliderResetKey}`}
                          accessibilityLabel={`Percent slider for ${participant.name}`}
                          minimumValue={0}
                          maximumValue={100}
                          step={1}
                          value={Math.max(0, Math.min(percentValue, 100))}
                          minimumTrackTintColor={PALETTE.primary}
                          maximumTrackTintColor="#e4e0dc"
                          thumbTintColor={PALETTE.primary}
                          onValueChange={(value) => void setWorkingPercentValue(participant.id, String(value), { clampToRemaining: true })}
                        />
                        <XStack justifyContent="space-between">
                          <Text fontFamily={FONTS.bodyMedium} fontSize={11} color={PALETTE.onSurfaceVariant}>
                            {formatMoney(0, record.values.currency, locale)}
                          </Text>
                          <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant}>
                            Allocated: {formatMoney(Math.round(((parseMoneyToCents(item.price) ?? 0) * percentValue) / 100), record.values.currency, locale)}
                          </Text>
                          <Text fontFamily={FONTS.bodyMedium} fontSize={11} color={PALETTE.onSurfaceVariant}>
                            {formatMoney(parseMoneyToCents(item.price) ?? 0, record.values.currency, locale)}
                          </Text>
                        </XStack>
                      </YStack>
                    ) : null}
                  </View>
                );
              })}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={splitNoticeMessages} onDismiss={() => setSplitNoticeMessages([])} />
    </AppScreen>
  );
}

export function OverviewScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const settings = useSplitStore((state) => state.settings);
  const settlement = useMemo(() => {
    if (!record) {
      return null;
    }

    return computeSettlement(record.values);
  }, [record]);
  const [showReviewHint, setShowReviewHint] = useState(false);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const visibleItems = record.values.items.filter(isVisibleItem);
  const assignedCount = visibleItems.filter(isItemAssigned).length;
  const progressPercent = visibleItems.length > 0 ? Math.round((assignedCount / visibleItems.length) * 100) : 0;
  const errors = [
    ...validateStepOne(record.values),
    ...validateStepTwo(record.values),
    ...validateStepThree(record.values),
  ].map((error) => error.message);

  const locale = getDeviceLocale();
  const insets = useSafeAreaInsets();

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <PrimaryButton
            label="Finalize Bill"
            icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
            onPress={() => {
              if (errors.length > 0 || !settlement?.ok) {
                setShowReviewHint(true);
                return;
              }
              router.push(`/split/${draftId}/results`);
            }}
          />
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.reviewScrollContent,
          {
            paddingTop: Math.max(insets.top + 8, 22),
            paddingBottom: 126 + Math.max(insets.bottom, 14),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
      <FlowScreenHeader title="Review Items" onBack={() => router.back()} />

      {settlement?.ok ? (
        <>
          <HeroCard eyebrow="Bill total" title={formatMoney(settlement.data.totalCents, settlement.data.currency, locale)} subtitle={`${record.values.participants.length} people Â· ${record.values.items.length} items`} />

          <SectionCard>
            <SectionEyebrow>People totals</SectionEyebrow>
            <YStack gap="$4">
              {settlement.data.people.map((person) => (
                <XStack key={person.participantId} justifyContent="space-between" alignItems="center">
                  <YStack>
                    <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSurface}>
                      {getParticipantDisplayName(person.name, settings.ownerName)}
                    </Text>
                    <Text fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurfaceVariant}>
                      {person.isPayer ? "Payer" : "Owes payer"}
                    </Text>
                  </YStack>
                  <Text fontFamily={FONTS.headlineBold} fontSize={18} color={person.isPayer ? PALETTE.secondary : PALETTE.primary}>
                    {formatMoney(person.netCents, settlement.data.currency, locale)}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </SectionCard>

          <SectionCard soft>
            <SectionEyebrow>Item breakdown</SectionEyebrow>
            <YStack gap="$4">
              {settlement.data.itemBreakdown.map((item) => (
                <YStack key={item.id} gap="$2">
                  <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSurface}>
                    {item.name}
                  </Text>
                  <Text fontFamily={FONTS.bodyMedium} fontSize={13} color={PALETTE.onSurfaceVariant}>
                    {buildShareSummary(item, settlement.data.people.map((person) => ({
                      id: person.participantId,
                      name: person.name,
                      isPayer: person.isPayer,
                    })), settlement.data.currency, locale)}
                  </Text>
                </YStack>
              ))}
            </YStack>
          </SectionCard>
        </>
      ) : null}

      <ErrorList messages={[...new Set(errors)]} />
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}

export function ReviewScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const insets = useSafeAreaInsets();
  const settlement = useMemo(() => {
    if (!record) {
      return null;
    }

    return computeSettlement(record.values);
  }, [record]);
  const [reviewNoticeMessages, setReviewNoticeMessages] = useState<string[]>([]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const visibleItems = record.values.items.filter(isVisibleItem);
  const assignedItems = visibleItems.filter(isItemAssigned);
  const assignedCount = assignedItems.length;
  const progressPercent = visibleItems.length > 0 ? Math.round((assignedCount / visibleItems.length) * 100) : 0;
  const errors = [
    ...validateStepOne(record.values),
    ...validateStepTwo(record.values),
    ...validateStepThree(record.values),
  ].map((error) => error.message);
  const locale = getDeviceLocale();

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <PrimaryButton
            label="Show Results"
            icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
            onPress={() => {
              if (errors.length > 0 || !settlement?.ok) {
                setReviewNoticeMessages(["There are still items left to split before you can see the results."]);
                return;
              }
              router.push(`/split/${draftId}/results`);
            }}
          />
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Review Items" onBack={() => router.replace(`/split/${draftId}/items`)} />
        </View>

        <YStack gap="$5">
          <View style={screenStyles.itemsImportCard}>
            <SectionEyebrow>Current progress</SectionEyebrow>
            <XStack alignItems="flex-end" justifyContent="space-between" gap="$3" marginTop="$2">
              <YStack>
                <Text fontFamily={FONTS.headlineBlack} fontSize={34} lineHeight={36} color={PALETTE.primary}>
                  {progressPercent}%
                </Text>
                <Text fontFamily={FONTS.headlineBlack} fontSize={26} lineHeight={28} color={PALETTE.primary}>
                  Split
                </Text>
              </YStack>
              <Text fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={21} color={PALETTE.onSurfaceVariant} textAlign="right">
                {assignedCount} of {visibleItems.length} items assigned
              </Text>
            </XStack>
            <View style={screenStyles.reviewProgressTrack}>
              <View style={[screenStyles.reviewProgressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <View style={screenStyles.itemsSectionSeparator} />

          <YStack gap="$3">
            {visibleItems.map((item) => {
              const assigned = isItemAssigned(item);
              const itemLabel = item.name.trim() || "Untitled item";

              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/split/${draftId}/split/${item.id}`)}
                  style={[screenStyles.itemsListCard, !assigned ? screenStyles.reviewItemCardPending : null]}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$4">
                    <YStack flex={1} gap="$1.5">
                      <XStack alignItems="center" gap="$2">
                        <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                          {itemLabel}
                        </Text>
                        {assigned ? <Check color={PALETTE.secondary} size={16} /> : <AlertTriangle color={PALETTE.primary} size={16} />}
                      </XStack>
                      <XStack alignItems="center" gap="$2.5" flexWrap="wrap">
                        <Text fontFamily={FONTS.headlineBold} fontSize={16} lineHeight={20} color={PALETTE.primary}>
                          {formatMoney(parseMoneyToCents(item.price) ?? 0, record.values.currency, locale)}
                        </Text>
                        {assigned ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={11}
                            lineHeight={14}
                            color={PALETTE.onSurfaceVariant}
                            textTransform="uppercase"
                            letterSpacing={1.5}
                            paddingTop={1}
                          >
                            {`Split by ${getAssignedParticipantCount(item)}`}
                          </Text>
                        ) : null}
                      </XStack>
                    </YStack>
                    {assigned ? (
                      <ArrowRight color={PALETTE.onSurfaceVariant} size={18} />
                    ) : (
                      <View style={screenStyles.reviewAssignButton}>
                        <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.2}>
                          Split
                        </Text>
                      </View>
                    )}
                  </XStack>
                </Pressable>
              );
            })}
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={reviewNoticeMessages} onDismiss={() => setReviewNoticeMessages([])} />
    </AppScreen>
  );
}
export function ResultsScreen({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const insets = useSafeAreaInsets();
  const { markCompleted, settings, markBillPaid, revertBillPaid, toggleParticipantPaid } = useSplitStore(useShallow((state) => ({
    markCompleted: state.markCompleted,
    settings: state.settings,
    markBillPaid: state.markBillPaid,
    revertBillPaid: state.revertBillPaid,
    toggleParticipantPaid: state.toggleParticipantPaid,
  })));
  const hasAutoCompletedRef = useRef<string | null>(null);

  useEffect(() => {
    if (record && record.status !== "completed" && hasAutoCompletedRef.current !== record.id) {
      hasAutoCompletedRef.current = record.id;
      void (async () => {
        await markCompleted();
      })();
    }
    if (record?.status === "completed") {
      hasAutoCompletedRef.current = record.id;
    }
  }, [markCompleted, record]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const settlement = getSettlementPreview(record);
  const summary = getClipboardSummaryPreview(record);
  const locale = getDeviceLocale();

  if (!settlement?.ok || !summary) {
    return (
      <AppScreen scroll={false}>
        <EmptyState title="Split invalid" description="The final results screen only opens when the current draft passes all settlement rules." />
      </AppScreen>
    );
  }

  const payer = settlement.data.people.find((person) => person.isPayer)!;
  const owingPeople = settlement.data.people.filter((person) => !person.isPayer && person.netCents < 0);
  const settledParticipantIds = getSettledParticipantIds(record);
  const pdfData = getPdfExportPreview(record);
  const payerConsumedCents = Math.max(0, payer.paidCents - payer.netCents);
  const totalOwedCents = owingPeople.reduce((sum, person) => sum + Math.abs(person.netCents), 0);
  const settledOwedCents = owingPeople.reduce(
    (sum, person) => sum + (settledParticipantIds.has(person.participantId) ? Math.abs(person.netCents) : 0),
    0
  );
  const unsettledPeople = owingPeople.filter((person) => !settledParticipantIds.has(person.participantId));
  const allPaid = owingPeople.length > 0 && unsettledPeople.length === 0;
  const settlementProgressPercent = totalOwedCents > 0 ? Math.round((settledOwedCents / totalOwedCents) * 100) : 0;

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share Results"
              style={screenStyles.resultsPrimaryButton}
              onPress={() => void Share.share({ message: summary })}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Share2 color={PALETTE.onPrimary} size={18} />
                <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onPrimary}>
                  Share Results
                </Text>
              </XStack>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export as PDF"
              style={screenStyles.resultsSecondaryButton}
              onPress={() => {
                if (pdfData) {
                  void Clipboard.setStringAsync(JSON.stringify(pdfData, null, 2));
                }
              }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <FileJson color={PALETTE.onSecondaryContainer} size={18} />
                <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSecondaryContainer}>
                  Export as PDF
                </Text>
                <View style={screenStyles.soonChip}>
                  <Text fontFamily={FONTS.bodyBold} fontSize={10} color={PALETTE.primary} textTransform="uppercase" letterSpacing={1.4}>
                    Soon
                  </Text>
                </View>
              </XStack>
            </Pressable>
          </YStack>
        </FloatingFooter>
      }
    >
      <ScrollView
        style={screenStyles.flex}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 186 + Math.max(insets.bottom, 14),
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <FlowScreenHeader title="Final Results" onBack={() => router.replace(`/split/${draftId}/overview`)} />
        </View>

        <YStack gap="$5">
          <View style={screenStyles.resultsHeroCard}>
            <View style={screenStyles.resultsHeroGlow} />
            <YStack gap="$2">
              <Text fontFamily={FONTS.bodyBold} fontSize={11} color="rgba(255,255,255,0.78)" textTransform="uppercase" letterSpacing={1.8}>
                {settings.balanceFeatureEnabled ? "Total settled" : "Total bill"}
              </Text>
              {settings.balanceFeatureEnabled ? (
                <XStack alignItems="flex-end" gap="$2.5" flexWrap="wrap">
                  <Text fontFamily={FONTS.headlineBlack} fontSize={32} color={PALETTE.onPrimary} letterSpacing={-1.2}>
                    {formatMoney(settledOwedCents, settlement.data.currency, locale)}
                  </Text>
                  <Text fontFamily={FONTS.headlineBold} fontSize={20} color="rgba(255,255,255,0.82)">
                    / {formatMoney(totalOwedCents, settlement.data.currency, locale)}
                  </Text>
                </XStack>
              ) : (
                <Text fontFamily={FONTS.headlineBlack} fontSize={32} color={PALETTE.onPrimary} letterSpacing={-1.2}>
                  {formatMoney(settlement.data.totalCents, settlement.data.currency, locale)}
                </Text>
              )}
            </YStack>
            {settings.balanceFeatureEnabled ? (
              <View style={screenStyles.resultsProgressTrack}>
                <View style={[screenStyles.resultsProgressFill, { width: `${settlementProgressPercent}%` }]} />
              </View>
            ) : null}
            <XStack alignItems="center" gap="$2.5" paddingTop="$3">
              {settings.balanceFeatureEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={allPaid ? "Revert Mark as Paid" : "Mark as Paid"}
                  style={screenStyles.resultsHeroChip}
                  onPress={() => void (allPaid ? revertBillPaid() : markBillPaid())}
                >
                  {allPaid ? <RotateCcw color={PALETTE.primary} size={12} /> : <Check color={PALETTE.primary} size={12} />}
                  <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.primary}>
                    {allPaid ? "Revert Mark as Paid" : "Mark as Paid"}
                  </Text>
                </Pressable>
              ) : null}
            </XStack>
          </View>

          <YStack gap="$3">
            <Text fontFamily={FONTS.headlineBold} fontSize={14} color={PALETTE.onSurface} letterSpacing={-0.2}>
              Paid by
            </Text>
            <View style={screenStyles.resultsPaidCard}>
              <XStack alignItems="center" justifyContent="space-between" gap="$3">
                <XStack alignItems="center" gap="$3" flex={1}>
                  <ParticipantAvatar
                    name={payer.name}
                    ownerName={settings.ownerName}
                    ownerProfileImageUri={settings.ownerProfileImageUri}
                    style={screenStyles.resultsAvatar}
                    label={`Results avatar ${payer.name}`}
                  />
                  <YStack flex={1}>
                    <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                      {getParticipantDisplayName(payer.name, settings.ownerName)}
                    </Text>
                  </YStack>
                </XStack>
                <Text fontFamily={FONTS.headlineBlack} fontSize={24} color={PALETTE.primary}>
                  {formatMoney(payerConsumedCents, settlement.data.currency, locale)}
                </Text>
              </XStack>
            </View>
          </YStack>

          <YStack gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontFamily={FONTS.headlineBold} fontSize={14} color={PALETTE.onSurface} letterSpacing={-0.2}>
                Breakdown
              </Text>
              <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.secondary}>
                {settlement.data.people.length} Contributors
              </Text>
            </XStack>
            <YStack gap="$3">
              {owingPeople.map((person) => (
                <View
                  key={person.participantId}
                  style={[
                    screenStyles.resultsBreakdownCard,
                    settings.balanceFeatureEnabled && settledParticipantIds.has(person.participantId) ? screenStyles.resultsBreakdownCardSettled : null,
                  ]}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$3">
                    <XStack alignItems="center" gap="$3" flex={1}>
                      <ParticipantAvatar
                        name={person.name}
                        ownerName={settings.ownerName}
                        ownerProfileImageUri={settings.ownerProfileImageUri}
                        style={screenStyles.resultsAvatar}
                        label={`Results avatar ${person.name}`}
                      />
                      <YStack flex={1}>
                        <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSurface}>
                          {getParticipantDisplayName(person.name, settings.ownerName)}
                        </Text>
                      </YStack>
                    </XStack>
                    <XStack alignItems="center" gap="$2.5">
                      <YStack alignItems="flex-end" gap="$1">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={20}
                          color={PALETTE.primary}
                          textDecorationLine={settings.balanceFeatureEnabled && settledParticipantIds.has(person.participantId) ? "line-through" : "none"}
                        >
                          {formatMoney(Math.abs(person.netCents), settlement.data.currency, locale)}
                        </Text>
                        {settings.balanceFeatureEnabled && settledParticipantIds.has(person.participantId) ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={12}
                            color={PALETTE.secondary}
                            textTransform="uppercase"
                            letterSpacing={1.6}
                          >
                            Settled
                          </Text>
                        ) : settings.balanceFeatureEnabled ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={12}
                            color={PALETTE.primary}
                            textTransform="uppercase"
                            letterSpacing={1.6}
                          >
                            Owed
                          </Text>
                        ) : null}
                      </YStack>
                      {settings.balanceFeatureEnabled ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            settledParticipantIds.has(person.participantId)
                              ? `Add ${person.name} back to owed`
                              : `Mark ${person.name} as paid`
                          }
                          style={[
                            screenStyles.resultsCheckBubble,
                            settledParticipantIds.has(person.participantId) ? screenStyles.resultsCheckBubbleSettled : null,
                          ]}
                          onPress={() => void toggleParticipantPaid(person.participantId)}
                        >
                          {settledParticipantIds.has(person.participantId) ? (
                            <Minus color={PALETTE.onPrimary} size={14} />
                          ) : (
                            <Check color={PALETTE.onPrimary} size={14} />
                          )}
                        </Pressable>
                      ) : null}
                    </XStack>
                  </XStack>
                </View>
              ))}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}

const screenStyles = StyleSheet.create({
  recordRow: {
    backgroundColor: PALETTE.surfaceContainerLowest,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  participantsScrollContent: {
    paddingHorizontal: 22,
  },
  reviewScrollContent: {
    paddingHorizontal: 24,
  },
  stickyFlowHeader: {
    backgroundColor: PALETTE.surface,
    paddingBottom: 18,
    zIndex: 5,
  },
  stickyHomeHeader: {
    backgroundColor: PALETTE.surface,
    paddingHorizontal: 20,
    paddingBottom: 18,
    zIndex: 5,
  },
  frequentFriendsRow: {
    gap: 18,
    paddingRight: 8,
  },
  frequentFriendItem: {
    alignItems: "center",
    gap: 8,
  },
  frequentFriendFrame: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  frequentFriendFrameSelected: {
    borderWidth: 2,
    borderColor: PALETTE.primaryContainer,
  },
  frequentFriendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  participantInputShell: {
    minHeight: 60,
    backgroundColor: PALETTE.surfaceContainerLow,
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  participantInput: {
    flex: 1,
    minHeight: 52,
    color: PALETTE.onSurface,
    fontFamily: FONTS.body,
    fontSize: 18,
  },
  participantAddButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  participantPill: {
    minHeight: 78,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: PALETTE.surfaceContainerLowest,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  payerOptionRow: {
    minHeight: 78,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: PALETTE.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "rgba(220,193,180,0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  payerOptionRowSelected: {
    borderColor: PALETTE.primary,
    borderWidth: 2,
  },
  payerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  payerSelectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  payerUnselectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(157,68,1,0.28)",
    backgroundColor: PALETTE.surfaceContainerLowest,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  participantRemoveButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  participantEmptyCard: {
    borderRadius: 28,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  errorPanel: {
    borderRadius: 28,
    backgroundColor: "#fff0ef",
    borderWidth: 1,
    borderColor: "#f4c5c0",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  itemsImportCard: {
    borderRadius: 28,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  itemsImportIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(249,137,72,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemsImportPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  itemsImportSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#baf1e8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  itemsImportButtonDisabled: {
    opacity: 0.68,
  },
  soonChip: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(249,137,72,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemsSectionSeparator: {
    height: 1,
    backgroundColor: "rgba(220,193,180,0.32)",
    marginTop: 4,
  },
  itemsListCard: {
    borderRadius: 24,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  itemsManualAddButton: {
    minHeight: 70,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(188, 110, 49, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  itemsManualAddIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.primary,
  },
  itemsNextButton: {
    minHeight: 62,
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  itemDeleteButton: {
    minHeight: 54,
    width: 54,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(186,26,26,0.24)",
    backgroundColor: "#fff4f3",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemSaveButton: {
    flex: 1,
  },
  itemSaveButtonFull: {
    width: "100%",
  },
  assignHeaderSpacer: {
    width: 22,
    height: 22,
  },
  assignInputShell: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: PALETTE.surfaceContainerLow,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  assignInputShellError: {
    borderWidth: 1.5,
    borderColor: "#cf3f38",
  },
  assignInput: {
    minHeight: 54,
    color: PALETTE.onSurface,
    fontFamily: FONTS.bodyMedium,
    fontSize: 18,
  },
  assignPriceInput: {
    minHeight: 54,
    color: PALETTE.onSurface,
    fontFamily: FONTS.headlineBlack,
    fontSize: 20,
  },
  categoryChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: PALETTE.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipActive: {
    backgroundColor: PALETTE.primary,
  },
  participantsContinueButton: {
    minHeight: 60,
    borderRadius: 999,
    backgroundColor: "#ff8a43",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  participantsContinueButtonDisabled: {
    backgroundColor: "#d8d4d1",
    shadowOpacity: 0,
    elevation: 0,
  },
  splitCategoryPill: {
    minHeight: 28,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(249,137,72,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  splitModeShell: {
    borderRadius: 999,
    backgroundColor: PALETTE.surfaceContainerLow,
    padding: 6,
  },
  splitParticipantCard: {
    borderRadius: 24,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  splitAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  splitStepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(188, 110, 49, 0.2)",
    backgroundColor: PALETTE.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  splitStepperButtonActive: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primary,
  },
  splitStepperValue: {
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  percentValueShell: {
    minWidth: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  percentValueInput: {
    minWidth: 46,
    paddingVertical: 0,
    color: PALETTE.primary,
    fontFamily: FONTS.headlineBold,
    fontSize: 28,
    textAlign: "right",
  },
  percentRemainderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(189,114,47,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  splitSummaryCard: {
    borderRadius: 24,
    backgroundColor: PALETTE.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "rgba(220,193,180,0.22)",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  splitHeaderSegmentedControl: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: PALETTE.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "rgba(220,193,180,0.7)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  splitHeaderSegment: {
    minWidth: 68,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  splitHeaderSegmentLeft: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  splitHeaderSegmentRight: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  splitHeaderSegmentDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(167,118,84,0.3)",
  },
  splitNoticeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 20,
  },
  splitNoticeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(57, 36, 18, 0.22)",
  },
  splitNoticeCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  actionSheetCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  splitNoticeButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  actionSheetButton: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: PALETTE.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  actionSheetButtonDanger: {
    backgroundColor: "rgba(207,63,56,0.12)",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e4e0dc",
    overflow: "hidden",
    marginTop: 18,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
  },
  reviewProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e4e0dc",
    overflow: "hidden",
    marginTop: 16,
  },
  reviewProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
  },
  reviewItemCardPending: {
    borderWidth: 1,
    borderColor: "rgba(249,137,72,0.35)",
  },
  reviewAssignButton: {
    minWidth: 92,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ff8a43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  resultsHeroCard: {
    borderRadius: 28,
    backgroundColor: PALETTE.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  resultsHeroGlow: {
    position: "absolute",
    top: -20,
    right: -14,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  resultsHeroChipMuted: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(58,35,12,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsHeroChip: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: PALETTE.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  resultsProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 16,
    overflow: "hidden",
  },
  resultsProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PALETTE.surfaceContainerLowest,
  },
  resultsPaidCard: {
    borderRadius: 24,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  resultsBreakdownCard: {
    borderRadius: 24,
    backgroundColor: PALETTE.surfaceContainerLowest,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  resultsBreakdownCardSettled: {
    opacity: 0.92,
  },
  resultsAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    overflow: "hidden",
  },
  resultsCheckBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsCheckBubbleSettled: {
    backgroundColor: PALETTE.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsPrimaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: PALETTE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  resultsSecondaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#baf1e8",
    alignItems: "center",
    justifyContent: "center",
  },
  selectRow: {
    backgroundColor: PALETTE.surfaceContainerLow,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectRowActive: {
    backgroundColor: "rgba(249,137,72,0.18)",
  },
  modePillShell: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modePillButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.surfaceContainerLow,
  },
  modePillButtonActive: {
    backgroundColor: "#f8eadf",
    borderWidth: 1,
    borderColor: "rgba(191,95,0,0.16)",
  },
  togglePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
  homeScrollContent: {
    paddingHorizontal: 20,
    gap: 28,
  },
  mainTabScrollContent: {
    paddingHorizontal: 20,
  },
  mainTabHeaderWrap: {
    paddingHorizontal: 20,
  },
  homeHeader: {
    minHeight: 48,
    justifyContent: "center",
  },
  ctaHalo: {
    backgroundColor: "rgba(0,106,96,0.06)",
    borderRadius: 34,
    padding: 8,
  },
  homeCta: {
    minHeight: 178,
    borderRadius: 30,
    backgroundColor: "#bd722f",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    overflow: "hidden",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  homeCtaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  recentRow: {
    paddingVertical: 0,
  },
  recentShadowWrap: {
    paddingBottom: 6,
    marginBottom: -6,
    overflow: "visible",
  },
  settingsInlineAction: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,137,72,0.12)",
  },
  settingsInlineActionActive: {
    backgroundColor: "rgba(249,137,72,0.2)",
  },
  recentSwipeDeleteAction: {
    minWidth: 92,
    marginLeft: 12,
    borderRadius: 24,
    backgroundColor: "#cf3f38",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  undoBanner: {
    backgroundColor: "#cf3f38",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  undoButton: {
    minWidth: 72,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  unpaidDotMuted: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#dcd8d6",
    borderWidth: 2,
    borderColor: PALETTE.surface,
  },
  unpaidDotSoft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ece7e2",
    borderWidth: 2,
    borderColor: PALETTE.surface,
  },
  homeTabShell: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: 36,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(220,193,180,0.28)",
    shadowColor: PALETTE.primary,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  homeTabButton: {
    flex: 1,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  homeTabButtonActive: {
    backgroundColor: "rgba(249,137,72,0.12)",
  },
  homeBalanceCardWrap: {
    flex: 1,
  },
  homeBalanceCardContent: {
    minHeight: 74,
    justifyContent: "flex-start",
    gap: 18,
  },
  settingsAvatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginTop: 24,
    backgroundColor: "rgba(249,137,72,0.16)",
    borderWidth: 1,
    borderColor: "rgba(249,137,72,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  settingsAvatarImage: {
    width: "100%",
    height: "100%",
  },
  settingsFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  settingsFeatureToggle: {
    minWidth: 70,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(189,114,47,0.24)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.surface,
  },
  settingsFeatureToggleActive: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primary,
  },
});
