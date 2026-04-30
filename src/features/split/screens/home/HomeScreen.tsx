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
import {
  type AppHumour,
  type AppLanguage,
} from "../../../../i18n";
import { useTranslation } from "../../../../i18n/provider";
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
const MAX_OWNER_NAME_LENGTH = 12;

function isBalanceDependentSplitListAmountDisplay(
  value: SplitListAmountDisplay,
) {
  return value === "remaining" || value === "totalAndRemaining";
}

function normalizeSplitListAmountDisplaySetting(
  value: SplitListAmountDisplay | undefined,
  balanceFeatureEnabled: boolean | undefined,
): SplitListAmountDisplay {
  const resolvedValue = value ?? "remaining";
  if (
    balanceFeatureEnabled === false &&
    isBalanceDependentSplitListAmountDisplay(resolvedValue)
  ) {
    return "total";
  }

  return resolvedValue;
}

export function HomeScreenView() {
  const { t } = useTranslation();
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
  const [languageDraft, setLanguageDraft] = useState<AppLanguage>(
    settings.language ?? "en",
  );
  const [humourDraft, setHumourDraft] = useState<AppHumour>(
    settings.humour ?? "plain",
  );
  const [splitListAmountDisplayDraft, setSplitListAmountDisplayDraft] =
    useState<SplitListAmountDisplay>(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
  const [customCurrenciesDraft, setCustomCurrenciesDraft] = useState(
    settings.customCurrencies ?? [],
  );
  const splitListAmountDisplayOptions: Array<{
    key: SplitListAmountDisplay;
    label: string;
    description: string;
    summary: string;
  }> = [
    {
      key: "remaining",
      label: t("settings.splitRows.remaining.label"),
      summary: t("settings.splitRows.remaining.summary"),
      description: t("settings.splitRows.remaining.description"),
    },
    {
      key: "total",
      label: t("settings.splitRows.total.label"),
      summary: t("settings.splitRows.total.summary"),
      description: t("settings.splitRows.total.description"),
    },
    {
      key: "userPaid",
      label: t("settings.splitRows.userPaid.label"),
      summary: t("settings.splitRows.userPaid.summary"),
      description: t("settings.splitRows.userPaid.description"),
    },
    {
      key: "totalAndRemaining",
      label: t("settings.splitRows.totalAndRemaining.label"),
      summary: t("settings.splitRows.totalAndRemaining.summary"),
      description: t("settings.splitRows.totalAndRemaining.description"),
    },
  ];
  const availableSplitListAmountDisplayOptions =
    splitListAmountDisplayOptions.map((option) => {
      const disabled =
        !balanceFeatureEnabledDraft &&
        isBalanceDependentSplitListAmountDisplay(option.key);

      return {
        ...option,
        disabled,
        description: disabled
          ? `${option.description} ${t("settings.splitRows.requiresBalanceSuffix")}`
          : option.description,
      };
    });
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [humourMenuOpen, setHumourMenuOpen] = useState(false);
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
  const normalizedStoredSplitListAmountDisplay =
    normalizeSplitListAmountDisplaySetting(
      settings.splitListAmountDisplay,
      settings.balanceFeatureEnabled,
    );
  const hasLegacySplitListAmountDisplayMismatch =
    (settings.balanceFeatureEnabled ?? true) === false &&
    (settings.splitListAmountDisplay ?? "remaining") !==
      normalizedStoredSplitListAmountDisplay;
  const settingsDirty =
    ownerNameDraft.trim() !== (settings.ownerName ?? "") ||
    ownerProfileImageUriDraft.trim() !==
      (settings.ownerProfileImageUri ?? "") ||
    balanceFeatureEnabledDraft !== (settings.balanceFeatureEnabled ?? true) ||
    trackPaymentsFeatureEnabledDraft !==
      (settings.trackPaymentsFeatureEnabled ?? true) ||
    defaultCurrencyDraft.trim().toUpperCase() !==
      (settings.defaultCurrency ?? "") ||
    languageDraft !== (settings.language ?? "en") ||
    humourDraft !== (settings.humour ?? "plain") ||
    hasLegacySplitListAmountDisplayMismatch ||
    splitListAmountDisplayDraft !== normalizedStoredSplitListAmountDisplay ||
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
    setLanguageDraft(settings.language ?? "en");
    setHumourDraft(settings.humour ?? "plain");
    setSplitListAmountDisplayDraft(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
  }, [
    settings.balanceFeatureEnabled,
    settings.trackPaymentsFeatureEnabled,
    settings.customCurrencies,
    settings.defaultCurrency,
    settings.humour,
    settings.language,
    settings.splitListAmountDisplay,
    settings.ownerName,
    settings.ownerProfileImageUri,
  ]);
  useEffect(() => {
    setVisibleSplitCount(20);
  }, [activityBalanceFilter, activityDateFilter, activityStateFilter]);
  const saveSettings = async () => {
    const trimmedName = ownerNameDraft.trim();
    const persistedSplitListAmountDisplay =
      !balanceFeatureEnabledDraft &&
      isBalanceDependentSplitListAmountDisplay(splitListAmountDisplayDraft)
        ? "total"
        : splitListAmountDisplayDraft;
    if (!trimmedName) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([t("settings.ownerNameRequired")]);
      return false;
    }
    if (!defaultCurrencyDraft.trim()) {
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([t("settings.defaultCurrencyRequired")]);
      return false;
    }
    try {
      await updateSettings({
        ownerName: trimmedName,
        ownerProfileImageUri: ownerProfileImageUriDraft.trim(),
        balanceFeatureEnabled: balanceFeatureEnabledDraft,
        trackPaymentsFeatureEnabled: trackPaymentsFeatureEnabledDraft,
        defaultCurrency: defaultCurrencyDraft.trim().toUpperCase(),
        language: languageDraft,
        humour: humourDraft,
        splitListAmountDisplay: persistedSplitListAmountDisplay,
        customCurrencies: customCurrenciesDraft,
      });
      setCurrencyMenuOpen(false);
      setLanguageMenuOpen(false);
      setHumourMenuOpen(false);
      setSplitListAmountDisplayMenuOpen(false);
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([]);
      return true;
    } catch (error) {
      setSettingsNoticeTitle(t("common.couldNotSaveSettings"));
      setSettingsNoticeMessages([
        error instanceof Error && error.message
          ? error.message
          : t("common.tryAgain"),
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
    setLanguageDraft(settings.language ?? "en");
    setHumourDraft(settings.humour ?? "plain");
    setSplitListAmountDisplayDraft(
      normalizeSplitListAmountDisplaySetting(
        settings.splitListAmountDisplay,
        settings.balanceFeatureEnabled,
      ),
    );
    setCustomCurrenciesDraft(settings.customCurrencies ?? []);
    setCustomCurrencyName("");
    setCustomCurrencySymbol("");
    setCurrencyMenuOpen(false);
    setLanguageMenuOpen(false);
    setHumourMenuOpen(false);
    setSplitListAmountDisplayMenuOpen(false);
    setCurrencyModalOpen(false);
    setProfileActionMenuOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
    setPendingTabChange(null);
    setSettingsNoticeTitle(t("common.almostThere"));
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
      setSettingsNoticeTitle(t("common.almostThere"));
      setSettingsNoticeMessages([
        mode === "camera"
          ? t("settings.profileCameraPermission")
          : t("settings.profileLibraryPermission"),
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
    setSettingsNoticeTitle(t("common.almostThere"));
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
      setSettingsNoticeTitle(t("common.almostThere"));
      if (!trimmedName) {
        setSettingsNoticeMessages([t("settings.currencyValidationName")]);
      } else {
        setSettingsNoticeMessages([t("settings.currencyValidationSymbol")]);
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
    setSettingsNoticeTitle(t("common.almostThere"));
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
                    t("common.couldNotSaveSettings"),
                    error instanceof Error && error.message
                      ? error.message
                      : t("common.tryAgain"),
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
                {t("home.startSplit", undefined, { maxLength: 22 })}
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
                      color={PALETTE.success}
                      textTransform="uppercase"
                      letterSpacing={2}
                    >
                      {t("home.youAreOwed")}
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
                      {t("home.youOwe")}
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
                {t("home.recent")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.viewAllSplits")}
                onPress={() => setActiveTab("splits")}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={16}
                  color={PALETTE.primary}
                >
                  {t("home.viewAll")}
                </Text>
              </Pressable>
            </XStack>
            {recentRecords.length === 0 ? (
              <EmptyState
                title={t("home.noSplitsTitle")}
                description={t("home.noSplitsDescription")}
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
                    color={PALETTE.success}
                    textTransform="uppercase"
                    letterSpacing={2}
                  >
                    {t("home.youAreOwed")}
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
                    {t("home.youOwe")}
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
                filtersExpanded ? t("home.hideFilters") : t("home.showFilters")
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
                <SectionEyebrow>{t("home.filters")}</SectionEyebrow>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.status")}</FieldLabel>
                  <ModePills
                    active={activityStateFilter}
                    options={[
                      { key: "all", label: t("home.filter.all") },
                      { key: "settled", label: t("home.filter.settled") },
                      { key: "unsettled", label: t("home.filter.unsettled") },
                    ]}
                    onChange={(value: string) =>
                      setActivityStateFilter(value as ActivityStateFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.balance")}</FieldLabel>
                  <ModePills
                    active={activityBalanceFilter}
                    options={[
                      { key: "all", label: t("home.filter.all") },
                      { key: "nothingDue", label: t("home.filter.nothingDue") },
                      { key: "somethingDue", label: t("home.filter.somethingDue") },
                    ]}
                    onChange={(value: string) =>
                      setActivityBalanceFilter(value as ActivityBalanceFilter)
                    }
                  />
                </YStack>
                <YStack gap="$2.5">
                  <FieldLabel>{t("home.filter.date")}</FieldLabel>
                  <ModePills
                    active={activityDateFilter}
                    options={[
                      { key: "newest", label: t("home.filter.newest") },
                      { key: "oldest", label: t("home.filter.oldest") },
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
              title={t("home.noSplitsFilteredTitle")}
              description={t("home.noSplitsDescription")}
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
            <SectionEyebrow>{t("settings.userProfile")}</SectionEyebrow>
            <XStack gap="$4" alignItems="flex-start">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.profilePictureOptions")}
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
                    placeholder={t("settings.ownerNamePlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
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
            <SectionEyebrow>{t("settings.defaultCurrency")}</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("settings.defaultCurrencyDescription")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.currencyPicker")}
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
                  accessibilityLabel={t("settings.currencyPickerOther")}
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
                    {t("common.other")}
                  </Text>
                </Pressable>
              </YStack>
            ) : null}
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.voice")}</SectionEyebrow>
            <YStack gap="$3">
              <FieldLabel>{t("settings.language")}</FieldLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.pickLanguage")}
                style={screenStyles.selectRow}
                onPress={() => setLanguageMenuOpen(true)}
              >
                <XStack alignItems="center" justifyContent="space-between" gap="$3">
                  <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                    {t(languageDraft === "pt" ? "settings.language.pt" : "settings.language.en")}
                  </Text>
                  <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                </XStack>
              </Pressable>
            </YStack>
            <YStack gap="$3">
              <FieldLabel>{t("settings.tone")}</FieldLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.pickTone")}
                style={screenStyles.selectRow}
                onPress={() => setHumourMenuOpen(true)}
              >
                <XStack alignItems="center" justifyContent="space-between" gap="$3">
                  <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                    {t(
                      humourDraft === "sassy"
                        ? "settings.humour.sassy"
                        : humourDraft === "unhinged"
                          ? "settings.humour.unhinged"
                          : "settings.humour.plain",
                    )}
                  </Text>
                  <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                </XStack>
              </Pressable>
            </YStack>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.splitRows")}</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("settings.splitRowsDescription")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.splitRowsPicker")}
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
                      splitListAmountDisplayOptions.find(
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
                      splitListAmountDisplayOptions.find(
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
            <SectionEyebrow>{t("settings.features")}</SectionEyebrow>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  {t("settings.trackPayments.title")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("settings.trackPayments.description")}
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
                  {trackPaymentsFeatureEnabledDraft ? t("common.on") : t("common.off")}
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
                  {t("settings.balanceHelper.title")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("settings.balanceHelper.description")}
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
                  if (
                    !nextBalance &&
                    isBalanceDependentSplitListAmountDisplay(
                      splitListAmountDisplayDraft,
                    )
                  ) {
                    setSplitListAmountDisplayDraft("total");
                  }
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
                  {balanceFeatureEnabledDraft ? t("common.on") : t("common.off")}
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
                  {t("settings.backup.title")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("settings.backup.description")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.backup.why")}
                  onPress={() => {
                    setSettingsNoticeTitle(t("settings.backup.underDevelopment"));
                    setSettingsNoticeMessages([
                      t("settings.backup.notice"),
                    ]);
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={13}
                    color={PALETTE.primary}
                  >
                    {t("settings.backup.why")}
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
                  {t("common.soon")}
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
                label={t("settings.save")}
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
                    {t("home.undoSplitDeleted")}
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
                    {t("common.undo")}
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
          setSettingsNoticeTitle(t("common.almostThere"));
          setSettingsNoticeMessages([]);
        }}
      />
      {profileActionMenuOpen ? (
        <ActionSheetModal
          title={t("settings.profilePicture")}
          onDismiss={() => setProfileActionMenuOpen(false)}
          options={[
            ...(ownerProfileImageUriDraft
              ? [
                  {
                    label: t("settings.profilePictureRemove"),
                    tone: "danger" as const,
                    onPress: () => {
                      setOwnerProfileImageUriDraft("");
                      setProfileActionMenuOpen(false);
                    },
                  },
                ]
              : []),
            {
              label: t("settings.profilePictureTake"),
              onPress: () => void pickProfileImage("camera"),
            },
            {
              label: t("settings.profilePictureUpload"),
              onPress: () => void pickProfileImage("library"),
            },
            { label: t("common.cancel"), onPress: () => setProfileActionMenuOpen(false) },
          ]}
        />
      ) : null}
      {languageMenuOpen ? (
        <ActionSheetModal
          title={t("settings.pickLanguage")}
          options={[
            {
              label: t("settings.language.en"),
              selected: languageDraft === "en",
              onPress: () => {
                setLanguageDraft("en");
                setLanguageMenuOpen(false);
              },
            },
            {
              label: t("settings.language.pt"),
              selected: languageDraft === "pt",
              onPress: () => {
                setLanguageDraft("pt");
                setLanguageMenuOpen(false);
              },
            },
          ]}
          onDismiss={() => setLanguageMenuOpen(false)}
        />
      ) : null}
      {humourMenuOpen ? (
        <ActionSheetModal
          title={t("settings.pickTone")}
          options={[
            {
              label: t("settings.humour.plain"),
              selected: humourDraft === "plain",
              onPress: () => {
                setHumourDraft("plain");
                setHumourMenuOpen(false);
              },
            },
            {
              label: t("settings.humour.sassy"),
              selected: humourDraft === "sassy",
              onPress: () => {
                setHumourDraft("sassy");
                setHumourMenuOpen(false);
              },
            },
            {
              label: t("settings.humour.unhinged"),
              selected: humourDraft === "unhinged",
              onPress: () => {
                setHumourDraft("unhinged");
                setHumourMenuOpen(false);
              },
            },
          ]}
          onDismiss={() => setHumourMenuOpen(false)}
        />
      ) : null}
      {splitListAmountDisplayMenuOpen ? (
        <ActionSheetModal
          title={t("settings.splitRowsPickerTitle")}
          options={availableSplitListAmountDisplayOptions.map((option) => ({
            label: option.label,
            description: option.description,
            selected: option.key === splitListAmountDisplayDraft,
            disabled: option.disabled,
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
                {t("settings.currencyAddTitle")}
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
                  placeholder={t("settings.currencyNamePlaceholder")}
                  placeholderTextColor={PALETTE.inputPlaceholder}
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
                  placeholder={t("settings.currencySymbolPlaceholder")}
                    placeholderTextColor={PALETTE.inputPlaceholder}
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
                  {t("settings.currencySave")}
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
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </YStack>
          </View>
        </View>
      ) : null}
      {pendingTabChange ? (
        <ConfirmChoiceModal
          title={t("settings.confirmSave.title")}
          body={t("settings.confirmSave.body")}
          confirmLabel={t("settings.confirmSave.confirm")}
          discardLabel={t("settings.confirmSave.discard")}
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
