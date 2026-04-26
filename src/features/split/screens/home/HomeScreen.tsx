import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Filter,
  Plus,
  Settings,
} from "lucide-react-native";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

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
} from "../../../../components/ui";
import { createId, formatMoney, normalizeMoneyInput } from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import type { SplitListAmountDisplay } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getSettlementPreview, useSplitStore } from "../../store";
import {
  getCurrencyOptionLabel,
  getCurrencyOptions,
  getFrequentFriends,
  getInitials,
  getParticipantDisplayName,
  isOwnerReference,
} from "../shared/participantUtils";
import { getRecordTitle } from "../shared/recordUtils";
import {
  formatAppMoney,
  getHomeBalanceCards,
  getRecordMoneyPreview,
  getRecentRowMeta,
} from "../shared/settlementUtils";
import { HomeTabBar, RecordRow, type HomeTabKey } from "../shared/homeParts";
import {
  ActionSheetModal,
  ConfirmChoiceModal,
  SplitNoticeModal,
} from "../shared/modals";
import { ModePills } from "../shared/components";
import { ParticipantAvatar } from "../shared/participantComponents";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

type ActivityStateFilter = "all" | "settled" | "unsettled";
type ActivityDateFilter = "newest" | "oldest";
type ActivityBalanceFilter = "all" | "nothingDue" | "somethingDue";
const SPLIT_LIST_AMOUNT_DISPLAY_OPTIONS: Array<{
  key: SplitListAmountDisplay;
  label: string;
  description: string;
  summary: string;
}> = [
  {
    key: "remaining",
    label: "Outstanding balance",
    summary: "Show what is still unsettled for you",
    description:
      "Shows how much is still unsettled for you in that split. 'Owed' means they owe you, and 'Owe' means you owe them.",
  },
  {
    key: "total",
    label: "Total bill",
    summary: "Show the full split total",
    description:
      "Shows the full amount of the split, regardless of who paid or what is still unsettled.",
  },
  {
    key: "userPaid",
    label: "You consumed",
    summary: "Show how much of the bill was yours",
    description:
      "Shows how much of that split was assigned to you, regardless of who paid upfront.",
  },
  {
    key: "totalAndRemaining",
    label: "Total + outstanding",
    summary: "Show both the total and what is still unsettled",
    description:
      "Shows the full split total first, with your unsettled amount underneath for extra context.",
  },
];
const MAX_OWNER_NAME_LENGTH = 12;
export function HomeScreenView() {
  const { records, createDraft, removeRecord, settings, updateSettings } =
    useSplitStore(
      useShallow((state) => ({
        records: state.records,
        createDraft: state.createDraft,
        removeRecord: state.removeRecord,
        settings: state.settings,
        updateSettings: state.updateSettings,
      })),
    );
  const insets = useSafeAreaInsets();
  const locale = getDeviceLocale();
  const [activeTab, setActiveTab] = useState<HomeTabKey>("home");
  const [pendingDelete, setPendingDelete] = useState<null | {
    id: string;
    title: string;
  }>(null);
  const [activityStateFilter, setActivityStateFilter] =
    useState<ActivityStateFilter>("all");
  const [activityDateFilter, setActivityDateFilter] =
    useState<ActivityDateFilter>("newest");
  const [activityBalanceFilter, setActivityBalanceFilter] =
    useState<ActivityBalanceFilter>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [visibleSplitCount, setVisibleSplitCount] = useState(20);
  const [settingsNoticeMessages, setSettingsNoticeMessages] = useState<
    string[]
  >([]);
  const [settingsNoticeTitle, setSettingsNoticeTitle] =
    useState("Almost there");
  const [ownerNameDraft, setOwnerNameDraft] = useState(
    settings.ownerName ?? "",
  );
  const [ownerProfileImageUriDraft, setOwnerProfileImageUriDraft] = useState(
    settings.ownerProfileImageUri ?? "",
  );
  const [balanceFeatureEnabledDraft, setBalanceFeatureEnabledDraft] = useState(
    settings.balanceFeatureEnabled ?? true,
  );
  const [
    trackPaymentsFeatureEnabledDraft,
    setTrackPaymentsFeatureEnabledDraft,
  ] = useState(settings.trackPaymentsFeatureEnabled ?? true);
  const [defaultCurrencyDraft, setDefaultCurrencyDraft] = useState(
    settings.defaultCurrency ?? "",
  );
  const [splitListAmountDisplayDraft, setSplitListAmountDisplayDraft] =
    useState<SplitListAmountDisplay>(
      settings.splitListAmountDisplay ?? "remaining",
    );
  const [customCurrenciesDraft, setCustomCurrenciesDraft] = useState(
    settings.customCurrencies ?? [],
  );
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [splitListAmountDisplayMenuOpen, setSplitListAmountDisplayMenuOpen] =
    useState(false);
  const [profileActionMenuOpen, setProfileActionMenuOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [customCurrencyName, setCustomCurrencyName] = useState("");
  const [customCurrencySymbol, setCustomCurrencySymbol] = useState("");
  const [customCurrencyErrors, setCustomCurrencyErrors] = useState<{
    name: boolean;
    symbol: boolean;
  }>({ name: false, symbol: false });
  const [pendingTabChange, setPendingTabChange] = useState<HomeTabKey | null>(
    null,
  );
  const [isCreatingSplit, setIsCreatingSplit] = useState(false);
  const creatingSplitRef = useRef(false);
  const deleteTimeoutRef = useRef<any>(null);
  const pendingDeleteRef = useRef<null | { id: string; title: string }>(null);
  const customCurrencySymbolInputRef = useRef<TextInput | null>(null);
  useFocusEffect(
    useCallback(() => {
      creatingSplitRef.current = false;
      setIsCreatingSplit(false);
    }, []),
  );
  const visibleRecords = pendingDelete
    ? records.filter((record) => record.id !== pendingDelete.id)
    : records;
  const balances = getHomeBalanceCards(
    visibleRecords,
    settings.ownerName,
    settings.defaultCurrency,
    getSettlementPreview,
  );
  const recentRecords = [...visibleRecords]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);
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
    const byBalance = byState.filter((record) => {
      if (activityBalanceFilter === "all") {
        return true;
      }

      const preview = getRecordMoneyPreview(
        record,
        settings.ownerName,
        getSettlementPreview,
      );

      const ownerNetCents = preview?.ownerNetCents ?? 0;
      return activityBalanceFilter === "nothingDue"
        ? ownerNetCents === 0
        : ownerNetCents > 0;
    });

    return [...byBalance].sort((left, right) =>
      activityDateFilter === "newest"
        ? right.updatedAt.localeCompare(left.updatedAt)
        : left.updatedAt.localeCompare(right.updatedAt),
    );
  }, [
    activityBalanceFilter,
    activityDateFilter,
    activityStateFilter,
    settings.ownerName,
    visibleRecords,
  ]);
  const pagedSplitRecords = filteredSplitRecords.slice(0, visibleSplitCount);
  const draftCurrencyOptions = getCurrencyOptions({
    customCurrencies: customCurrenciesDraft,
  });
  const settingsDirty =
    ownerNameDraft.trim() !== (settings.ownerName ?? "") ||
    ownerProfileImageUriDraft.trim() !==
      (settings.ownerProfileImageUri ?? "") ||
    balanceFeatureEnabledDraft !== (settings.balanceFeatureEnabled ?? true) ||
    trackPaymentsFeatureEnabledDraft !==
      (settings.trackPaymentsFeatureEnabled ?? true) ||
    defaultCurrencyDraft.trim().toUpperCase() !==
      (settings.defaultCurrency ?? "") ||
    splitListAmountDisplayDraft !==
      (settings.splitListAmountDisplay ?? "remaining") ||
    JSON.stringify(customCurrenciesDraft) !==
      JSON.stringify(settings.customCurrencies ?? []);
  const commitPendingDelete = async (nextPending: {
    id: string;
    title: string;
  }) => {
    clearTimeout(deleteTimeoutRef.current);
    deleteTimeoutRef.current = null;
    await removeRecord(nextPending.id);
    setPendingDelete((current) =>
      current?.id === nextPending.id ? null : current,
    );
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
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);
  useEffect(() => {
    return () => {
      const pendingDeleteOnUnmount = pendingDeleteRef.current;
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      if (pendingDeleteOnUnmount) {
        void removeRecord(pendingDeleteOnUnmount.id);
      }
    };
  }, [removeRecord]);
  useEffect(() => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled ?? true);
    setTrackPaymentsFeatureEnabledDraft(
      settings.trackPaymentsFeatureEnabled ?? true,
    );
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setSplitListAmountDisplayDraft(
      settings.splitListAmountDisplay ?? "remaining",
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
  }, [
    settings.balanceFeatureEnabled,
    settings.trackPaymentsFeatureEnabled,
    settings.customCurrencies,
    settings.defaultCurrency,
    settings.splitListAmountDisplay,
    settings.ownerName,
    settings.ownerProfileImageUri,
  ]);
  useEffect(() => {
    setVisibleSplitCount(20);
  }, [activityBalanceFilter, activityDateFilter, activityStateFilter]);
  const saveSettings = async () => {
    const trimmedName = ownerNameDraft.trim();
    if (!trimmedName) {
      setSettingsNoticeTitle("Almost there");
      setSettingsNoticeMessages(["Please choose a short name for yourself."]);
      return false;
    }
    if (!defaultCurrencyDraft.trim()) {
      setSettingsNoticeTitle("Almost there");
      setSettingsNoticeMessages(["Please choose a default currency first."]);
      return false;
    }
    try {
      await updateSettings({
        ownerName: trimmedName,
        ownerProfileImageUri: ownerProfileImageUriDraft.trim(),
        balanceFeatureEnabled: balanceFeatureEnabledDraft,
        trackPaymentsFeatureEnabled: trackPaymentsFeatureEnabledDraft,
        defaultCurrency: defaultCurrencyDraft.trim().toUpperCase(),
        splitListAmountDisplay: splitListAmountDisplayDraft,
        customCurrencies: customCurrenciesDraft,
      });
      setCurrencyMenuOpen(false);
      setSplitListAmountDisplayMenuOpen(false);
      setSettingsNoticeTitle("Almost there");
      setSettingsNoticeMessages([]);
      return true;
    } catch (error) {
      setSettingsNoticeTitle("Could not save settings");
      setSettingsNoticeMessages([
        error instanceof Error && error.message
          ? error.message
          : "Please try again.",
      ]);
      return false;
    }
  };
  const discardSettingsDraft = () => {
    setOwnerNameDraft(settings.ownerName ?? "");
    setOwnerProfileImageUriDraft(settings.ownerProfileImageUri ?? "");
    setBalanceFeatureEnabledDraft(settings.balanceFeatureEnabled ?? true);
    setTrackPaymentsFeatureEnabledDraft(
      settings.trackPaymentsFeatureEnabled ?? true,
    );
    setDefaultCurrencyDraft(settings.defaultCurrency ?? "");
    setSplitListAmountDisplayDraft(
      settings.splitListAmountDisplay ?? "remaining",
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCurrencyMenuOpen(false);
    setSplitListAmountDisplayMenuOpen(false);
    setCurrencyModalOpen(false);
    setProfileActionMenuOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
    setPendingTabChange(null);
    setSettingsNoticeTitle("Almost there");
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
      setSettingsNoticeTitle("Almost there");
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
    setSettingsNoticeTitle("Almost there");
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
      setSettingsNoticeTitle("Almost there");
      if (!trimmedName) {
        setSettingsNoticeMessages(["Please add a currency name first."]);
      } else {
        setSettingsNoticeMessages(["Please add a currency symbol too."]);
      }
      return;
    }
    const normalizedCode =
      trimmedName
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase()
        .slice(0, 3) || "CUR";
    const existingCodes = new Set(
      getCurrencyOptions({ customCurrencies: customCurrenciesDraft }).map(
        (entry) => entry.code,
      ),
    );
    let nextCode = normalizedCode;
    let suffix = 2;
    while (existingCodes.has(nextCode) && suffix <= 999) {
      const suffixToken = String(suffix);
      nextCode = `${normalizedCode.slice(0, Math.max(0, 3 - suffixToken.length))}${suffixToken}`;
      suffix += 1;
    }
    if (existingCodes.has(nextCode)) {
      nextCode =
        createId()
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 3) || "CUR";
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
    setSettingsNoticeTitle("Almost there");
    setSettingsNoticeMessages([]);
  };
  const renderMainHeader = () => (
    <View style={screenStyles.mainTabHeaderWrap}>
      <View
        style={[
          screenStyles.stickyHomeHeader,
          { paddingTop: Math.max(insets.top + 8, 18) },
        ]}
      >
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
  );
  const renderHomeContent = () => (
    <YStack flex={1}>
      {renderMainHeader()}
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: 196 + Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <View style={screenStyles.ctaHalo}>
            <Pressable
              style={[screenStyles.homeCta, isCreatingSplit ? { opacity: 0.72 } : null]}
              disabled={isCreatingSplit}
              onPress={async () => {
                if (creatingSplitRef.current) {
                  return;
                }

                creatingSplitRef.current = true;
                setIsCreatingSplit(true);
                try {
                  const draft = await createDraft();
                  router.push(`/split/${draft.id}/setup`);
                } catch (error) {
                  creatingSplitRef.current = false;
                  setIsCreatingSplit(false);
                  console.warn("Failed to create split", error);
                  Alert.alert(
                    "Could not create split",
                    error instanceof Error && error.message
                      ? error.message
                      : "Please try again.",
                  );
                }
              }}
            >
              <View style={screenStyles.homeCtaIconWrap}>
                <Plus color={PALETTE.primary} size={20} />
              </View>
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={26}
                color={PALETTE.onPrimary}
                letterSpacing={-1}
              >
                Start New Split
              </Text>
            </Pressable>
          </View>
          {(settings.balanceFeatureEnabled ?? true) ? (
            <XStack gap="$4" alignItems="stretch">
              <View style={screenStyles.homeBalanceCardWrap}>
                <SectionCard>
                  <View style={screenStyles.homeBalanceCardContent}>
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={11}
                      color={PALETTE.secondary}
                      textTransform="uppercase"
                      letterSpacing={2}
                    >
                      You are owed
                    </Text>
                    <Text
                      fontFamily={FONTS.headlineBlack}
                      fontSize={34}
                      color={PALETTE.onSurface}
                      letterSpacing={-1.5}
                    >
                      {formatAppMoney(
                        balances.owedCents,
                        balances.currency,
                        locale,
                        settings,
                      )}
                    </Text>
                  </View>
                </SectionCard>
              </View>
              <View style={screenStyles.homeBalanceCardWrap}>
                <SectionCard>
                  <View style={screenStyles.homeBalanceCardContent}>
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={11}
                      color={PALETTE.primary}
                      textTransform="uppercase"
                      letterSpacing={2}
                    >
                      You owe
                    </Text>
                    <Text
                      fontFamily={FONTS.headlineBlack}
                      fontSize={34}
                      color={PALETTE.onSurface}
                      letterSpacing={-1.5}
                    >
                      {formatAppMoney(
                        balances.oweCents,
                        balances.currency,
                        locale,
                        settings,
                      )}
                    </Text>
                  </View>
                </SectionCard>
              </View>
            </XStack>
          ) : null}
          <YStack gap="$5">
            <XStack justifyContent="space-between" alignItems="flex-end">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={34}
                color={PALETTE.onSurfaceVariant}
                letterSpacing={-1.2}
              >
                Recent
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all splits"
                onPress={() => setActiveTab("splits")}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={16}
                  color={PALETTE.primary}
                >
                  View All
                </Text>
              </Pressable>
            </XStack>
            {recentRecords.length === 0 ? (
              <EmptyState
                title="No splits yet"
                description="Your most recent splits will be shown here."
              />
            ) : (
              <YStack gap="$3">
                {recentRecords.map((record) => (
                  <RecordRow
                    key={record.id}
                    record={record}
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
    </YStack>
  );
  const renderSplitsContent = () => (
    <YStack flex={1}>
      {renderMainHeader()}
      {(settings.balanceFeatureEnabled ?? true) ? (
        <YStack gap="$4" paddingHorizontal={20} paddingBottom="$4">
          <XStack gap="$4" alignItems="stretch">
            <View style={screenStyles.homeBalanceCardWrap}>
              <SectionCard>
                <View style={screenStyles.homeBalanceCardContent}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={11}
                    color={PALETTE.secondary}
                    textTransform="uppercase"
                    letterSpacing={2}
                  >
                    You are owed
                  </Text>
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={34}
                    color={PALETTE.onSurface}
                    letterSpacing={-1.5}
                  >
                    {formatAppMoney(
                      balances.owedCents,
                      balances.currency,
                      locale,
                      settings,
                    )}
                  </Text>
                </View>
              </SectionCard>
            </View>
            <View style={screenStyles.homeBalanceCardWrap}>
              <SectionCard>
                <View style={screenStyles.homeBalanceCardContent}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={11}
                    color={PALETTE.primary}
                    textTransform="uppercase"
                    letterSpacing={2}
                  >
                    You owe
                  </Text>
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={34}
                    color={PALETTE.onSurface}
                    letterSpacing={-1.5}
                  >
                    {formatAppMoney(
                      balances.oweCents,
                      balances.currency,
                      locale,
                      settings,
                    )}
                  </Text>
                </View>
              </SectionCard>
            </View>
          </XStack>
          <View style={screenStyles.itemsSectionSeparator} />
        </YStack>
      ) : null}
      <ScrollView
        style={screenStyles.flex}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const distanceFromBottom =
            nativeEvent.contentSize.height -
            (nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height);
          if (
            distanceFromBottom < 240 &&
            visibleSplitCount < filteredSplitRecords.length
          ) {
            setVisibleSplitCount((current) => current + 20);
          }
        }}
        contentContainerStyle={[
          screenStyles.homeScrollContent,
          { paddingBottom: 148 + Math.max(insets.bottom, 12) },
        ]}
      >
        <YStack gap="$5">
          <XStack justifyContent="flex-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                filtersExpanded ? "Hide filters" : "Show filters"
              }
              style={[
                screenStyles.settingsInlineAction,
                filtersExpanded
                  ? screenStyles.settingsInlineActionActive
                  : null,
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
                    onChange={(value: string) =>
                      setActivityStateFilter(value as ActivityStateFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>Balance</FieldLabel>
                  <ModePills
                    active={activityBalanceFilter}
                    options={[
                      { key: "all", label: "All" },
                      { key: "nothingDue", label: "Nothing due" },
                      { key: "somethingDue", label: "Something due" },
                    ]}
                    onChange={(value: string) =>
                      setActivityBalanceFilter(value as ActivityBalanceFilter)
                    }
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
                    onChange={(value: string) =>
                      setActivityDateFilter(value as ActivityDateFilter)
                    }
                  />
                </YStack>
              </YStack>
            </SectionCard>
          ) : null}
          {pagedSplitRecords.length === 0 ? (
            <EmptyState
              title="No splits here"
              description="Try a different filter or start a new split."
            />
          ) : (
            <YStack gap="$3">
              {pagedSplitRecords.map((item) => (
                <RecordRow
                  key={item.id}
                  record={item}
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
    <YStack flex={1}>
      {renderMainHeader()}
      <ScrollView
        style={screenStyles.flex}
        nestedScrollEnabled
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: 360 + Math.max(insets.bottom, 32) },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
                  <Image
                    source={{ uri: ownerProfileImageUriDraft }}
                    style={screenStyles.settingsAvatarImage}
                  />
                ) : (
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={22}
                    color={PALETTE.primary}
                  >
                    {getInitials(ownerNameDraft || settings.ownerName)}
                  </Text>
                )}
              </Pressable>
              <YStack flex={1} gap="$2">
                <FieldLabel>Your name</FieldLabel>
                <View style={screenStyles.assignInputShell}>
                  <TextInput
                    value={ownerNameDraft}
                    onChangeText={(value) =>
                      setOwnerNameDraft(value.slice(0, MAX_OWNER_NAME_LENGTH))
                    }
                    placeholder="e.g. Tiago"
                    placeholderTextColor="rgba(86,67,57,0.35)"
                    style={screenStyles.assignInput}
                    maxLength={MAX_OWNER_NAME_LENGTH}
                  />
                </View>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  This is the name the app uses for your own spot in a split,
                  like `Tiago (You)`.
                </Text>
              </YStack>
            </XStack>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>Default currency</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              New splits start with this money type, but you can still change it
              for one split when you begin.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose default currency"
              style={screenStyles.selectRow}
              onPress={() => setCurrencyMenuOpen((value) => !value)}
            >
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={17}
                  color={PALETTE.onSurface}
                >
                  {getCurrencyOptionLabel(defaultCurrencyDraft, {
                    customCurrencies: customCurrenciesDraft,
                  })}
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
                      style={[
                        screenStyles.selectRow,
                        active ? screenStyles.selectRowActive : null,
                      ]}
                      onPress={() => {
                        setDefaultCurrencyDraft(option.code);
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose other currency"
                  style={screenStyles.selectRow}
                  onPress={() => {
                    setCurrencyMenuOpen(false);
                    setCurrencyModalOpen(true);
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={16}
                    color={PALETTE.primary}
                  >
                    Other
                  </Text>
                </Pressable>
              </YStack>
            ) : null}
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>Split rows</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              Choose which amount each split card shows in Home and Splits.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose split row amount"
              style={screenStyles.selectRow}
              onPress={() => setSplitListAmountDisplayMenuOpen(true)}
            >
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <YStack flex={1} gap="$1">
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={16}
                    color={PALETTE.onSurface}
                  >
                    {
                      SPLIT_LIST_AMOUNT_DISPLAY_OPTIONS.find(
                        (option) => option.key === splitListAmountDisplayDraft,
                      )?.label
                    }
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={13}
                    lineHeight={18}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {
                      SPLIT_LIST_AMOUNT_DISPLAY_OPTIONS.find(
                        (option) => option.key === splitListAmountDisplayDraft,
                      )?.summary
                    }
                  </Text>
                </YStack>
                <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
              </XStack>
            </Pressable>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>Features</SectionEyebrow>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  Track payments
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  Turn this on if you want to mark people as paid inside one
                  split after money has been settled.
                </Text>
              </YStack>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Toggle track payments"
                accessibilityState={{
                  checked: trackPaymentsFeatureEnabledDraft,
                }}
                style={[
                  screenStyles.settingsFeatureToggle,
                  trackPaymentsFeatureEnabledDraft
                    ? screenStyles.settingsFeatureToggleActive
                    : null,
                ]}
                onPress={() => {
                  const nextTrackPayments = !trackPaymentsFeatureEnabledDraft;
                  setTrackPaymentsFeatureEnabledDraft(nextTrackPayments);
                  setBalanceFeatureEnabledDraft((value) =>
                    nextTrackPayments ? value : false,
                  );
                }}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={
                    trackPaymentsFeatureEnabledDraft
                      ? PALETTE.onPrimary
                      : PALETTE.primary
                  }
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {trackPaymentsFeatureEnabledDraft ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  Balance helper
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  Turn this on if you want to track how much you owe and are
                  owed.
                </Text>
              </YStack>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Toggle balance helper"
                accessibilityState={{ checked: balanceFeatureEnabledDraft }}
                style={[
                  screenStyles.settingsFeatureToggle,
                  balanceFeatureEnabledDraft
                    ? screenStyles.settingsFeatureToggleActive
                    : null,
                ]}
                onPress={() => {
                  const nextBalance = !balanceFeatureEnabledDraft;
                  setBalanceFeatureEnabledDraft(nextBalance);
                  setTrackPaymentsFeatureEnabledDraft((value) =>
                    nextBalance ? true : value,
                  );
                }}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={
                    balanceFeatureEnabledDraft
                      ? PALETTE.onPrimary
                      : PALETTE.primary
                  }
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {balanceFeatureEnabledDraft ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  Backup data
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  Keep your splits safe in the cloud so you can recover them if
                  you lose this phone.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Why do I need backup data"
                  onPress={() => {
                    setSettingsNoticeTitle("Under development");
                    setSettingsNoticeMessages([
                      "We do not save any data onto the cloud. Whatever you create on this app stays on this device. Without backup, losing the phone means losing the data too.",
                    ]);
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.primary}
                  >
                    Why do I need this?
                  </Text>
                </Pressable>
              </YStack>
              <View style={screenStyles.settingsFeatureToggle}>
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  Soon
                </Text>
              </View>
            </View>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$3">
            {activeTab === "settings" ? (
              <PrimaryButton
                label="Save Settings"
                onPress={() => void saveSettings()}
                disabled={!settingsDirty}
              />
            ) : null}
            {pendingDelete ? (
              <View style={screenStyles.undoBanner}>
                <YStack flex={1} gap="$1">
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.onPrimary}
                  >
                    Split deleted
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={12}
                    color="rgba(255,255,255,0.82)"
                  >
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
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={12}
                    color={PALETTE.onPrimary}
                    textTransform="uppercase"
                    letterSpacing={1.6}
                  >
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
      <SplitNoticeModal
        title={settingsNoticeTitle}
        messages={settingsNoticeMessages}
        onDismiss={() => {
          setSettingsNoticeTitle("Almost there");
          setSettingsNoticeMessages([]);
        }}
      />
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
            {
              label: "Take photo",
              onPress: () => void pickProfileImage("camera"),
            },
            {
              label: "Upload photo",
              onPress: () => void pickProfileImage("library"),
            },
            { label: "Cancel", onPress: () => setProfileActionMenuOpen(false) },
          ]}
        />
      ) : null}
      {splitListAmountDisplayMenuOpen ? (
        <ActionSheetModal
          title="Choose what split rows show"
          options={SPLIT_LIST_AMOUNT_DISPLAY_OPTIONS.map((option) => ({
            label: option.label,
            description: option.description,
            selected: option.key === splitListAmountDisplayDraft,
            onPress: () => {
              setSplitListAmountDisplayDraft(option.key);
              setSplitListAmountDisplayMenuOpen(false);
            },
          }))}
          onDismiss={() => setSplitListAmountDisplayMenuOpen(false)}
        />
      ) : null}
      {currencyModalOpen ? (
        <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
          <View style={screenStyles.splitNoticeBackdrop} />
          <View style={screenStyles.splitNoticeCard}>
            <YStack gap="$3">
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={22}
                color={PALETTE.onSurface}
              >
                Add a currency
              </Text>
              <View
                style={[
                  screenStyles.assignInputShell,
                  customCurrencyErrors.name
                    ? screenStyles.assignInputShellError
                    : null,
                ]}
              >
                <TextInput
                  value={customCurrencyName}
                  onChangeText={(value) => {
                    setCustomCurrencyName(value.slice(0, 15));
                    if (customCurrencyErrors.name) {
                      setCustomCurrencyErrors((current) => ({
                        ...current,
                        name: false,
                      }));
                    }
                  }}
                  placeholder="Currency name"
                  placeholderTextColor="rgba(86,67,57,0.35)"
                  style={screenStyles.assignInput}
                  returnKeyType="next"
                  onSubmitEditing={() =>
                    customCurrencySymbolInputRef.current?.focus()
                  }
                  maxLength={15}
                />
              </View>
              <View
                style={[
                  screenStyles.assignInputShell,
                  customCurrencyErrors.symbol
                    ? screenStyles.assignInputShellError
                    : null,
                ]}
              >
                <TextInput
                  ref={customCurrencySymbolInputRef}
                  value={customCurrencySymbol}
                  onChangeText={(value) => {
                    setCustomCurrencySymbol(value.slice(0, 3));
                    if (customCurrencyErrors.symbol) {
                      setCustomCurrencyErrors((current) => ({
                        ...current,
                        symbol: false,
                      }));
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save custom currency"
                style={screenStyles.splitNoticeButton}
                onPress={() => void addCustomCurrency()}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onPrimary}
                >
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
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onSurfaceVariant}
                >
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
