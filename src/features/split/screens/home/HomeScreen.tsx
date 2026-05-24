import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
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
  Bell,
  AlertTriangle,
  Camera,
  ChevronDown,
  Filter,
  Plus,
  Settings,
  Trash2,
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
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  StackedFloatingFooter,
  SoftInput,
  StatPill,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { createId, formatMoney, normalizeMoneyInput } from "../../../../domain";
import { getDeviceLocale, prefers24HourTime } from "../../../../lib/device";
import type {
  BackupFrequency,
  SplitListAmountDisplay,
} from "../../../../storage/settings";
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
  ActionIconGridModal,
  ActionSheetModal,
  ConfirmChoiceModal,
  ReminderDateTimeModal,
  SplitNoticeModal,
  ToastNotice,
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
  const {
    records,
    createDraft,
    removeRecord,
    settings,
    backupPassphrase,
    updateSettings,
    setBackupPassphrase,
    clearBackupPassphrase,
    runManualBackup,
    runScheduledBackupIfDue,
    importBackupFromFile,
    connectGoogleDrive,
    disconnectGoogleDrive,
    setSplitReminder,
    clearSplitReminder,
  } =
    useSplitStore(
      useShallow((state) => ({
        records: state.records,
        createDraft: state.createDraft,
        removeRecord: state.removeRecord,
        settings: state.settings,
        backupPassphrase: state.backupPassphrase,
        updateSettings: state.updateSettings,
        setBackupPassphrase: state.setBackupPassphrase,
        clearBackupPassphrase: state.clearBackupPassphrase,
        runManualBackup: state.runManualBackup,
        runScheduledBackupIfDue: state.runScheduledBackupIfDue,
        importBackupFromFile: state.importBackupFromFile,
        connectGoogleDrive: state.connectGoogleDrive,
        disconnectGoogleDrive: state.disconnectGoogleDrive,
        setSplitReminder: state.setSplitReminder,
        clearSplitReminder: state.clearSplitReminder,
      })),
    );
  const insets = useSafeAreaInsets();
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 260 });
  const locale = getDeviceLocale();
  const use24HourClock = prefers24HourTime();
  const [activeTab, setActiveTab] = useState<HomeTabKey>("home");
  const [pendingDelete, setPendingDelete] = useState<null | {
    id: string;
    title: string;
  }>(null);
  const [selectedRecordActionTarget, setSelectedRecordActionTarget] =
    useState<null | { id: string; title: string }>(null);
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
  const [backupEnabledDraft, setBackupEnabledDraft] = useState(
    settings.backup?.enabled ?? false,
  );
  const [backupFrequencyDraft, setBackupFrequencyDraft] =
    useState<BackupFrequency>(settings.backup?.frequency ?? "daily");
  const [backupEncryptionEnabledDraft, setBackupEncryptionEnabledDraft] =
    useState(settings.backup?.encryptionEnabled ?? false);
  const [customCurrenciesDraft, setCustomCurrenciesDraft] = useState(
    settings.customCurrencies ?? [],
  );
  const persistedBackupSettings = settings.backup ?? {
    enabled: false,
    frequency: "daily" as BackupFrequency,
    encryptionEnabled: false,
    manualQuota: {
      dayKey: "",
      used: 0,
    },
    googleDrive: {
      connected: false,
    },
  };
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
  const backupFrequencyOptions: Array<{
    key: BackupFrequency;
    label: string;
    description: string;
  }> = [
    {
      key: "daily",
      label: t("settings.backup.frequency.daily"),
      description: t("settings.backup.frequency.daily.description"),
    },
    {
      key: "weekly",
      label: t("settings.backup.frequency.weekly"),
      description: t("settings.backup.frequency.weekly.description"),
    },
    {
      key: "monthly",
      label: t("settings.backup.frequency.monthly"),
      description: t("settings.backup.frequency.monthly.description"),
    },
  ];
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [humourMenuOpen, setHumourMenuOpen] = useState(false);
  const [splitListAmountDisplayMenuOpen, setSplitListAmountDisplayMenuOpen] =
    useState(false);
  const [profileActionMenuOpen, setProfileActionMenuOpen] = useState(false);
  const [backupFrequencyMenuOpen, setBackupFrequencyMenuOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [backupPasswordModalOpen, setBackupPasswordModalOpen] = useState(false);
  const [backupPasswordDraft, setBackupPasswordDraft] = useState("");
  const [backupPasswordConfirmDraft, setBackupPasswordConfirmDraft] = useState("");
  const [splitReminderPickerRecordId, setSplitReminderPickerRecordId] = useState("");
  const [splitReminderPickerHasExisting, setSplitReminderPickerHasExisting] = useState(false);
  const [splitReminderErrorMessage, setSplitReminderErrorMessage] = useState("");
  const [reminderToastMessage, setReminderToastMessage] = useState("");
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
  const closeCustomCurrencyModal = useCallback(() => {
    setCurrencyModalOpen(false);
    setCustomCurrencyErrors({ name: false, symbol: false });
  }, []);
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
  const splitReminderPickerRecord = records.find(
    (record) => record.id === splitReminderPickerRecordId,
  );
  const draftCurrencyOptions = getCurrencyOptions({
    customCurrencies: customCurrenciesDraft,
  });
  const nowForBackupUi = new Date();
  const backupDayKey = `${nowForBackupUi.getFullYear()}-${`${nowForBackupUi.getMonth() + 1}`.padStart(2, "0")}-${`${nowForBackupUi.getDate()}`.padStart(2, "0")}`;
  const backupUsedToday =
    persistedBackupSettings.manualQuota.dayKey === backupDayKey
      ? Math.max(0, persistedBackupSettings.manualQuota.used)
      : 0;
  const normalizedStoredSplitListAmountDisplay =
    normalizeSplitListAmountDisplaySetting(
      settings.splitListAmountDisplay,
      settings.balanceFeatureEnabled,
    );
  const hasLegacySplitListAmountDisplayMismatch =
    (settings.balanceFeatureEnabled ?? true) === false &&
    (settings.splitListAmountDisplay ?? "remaining") !==
      normalizedStoredSplitListAmountDisplay;
  const backupSettingsDirty =
    backupEnabledDraft !== (settings.backup?.enabled ?? false) ||
    backupFrequencyDraft !== (settings.backup?.frequency ?? "daily") ||
    backupEncryptionEnabledDraft !==
      (settings.backup?.encryptionEnabled ?? false);
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
    backupSettingsDirty ||
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
    setBackupEnabledDraft(settings.backup?.enabled ?? false);
    setBackupFrequencyDraft(settings.backup?.frequency ?? "daily");
    setBackupEncryptionEnabledDraft(settings.backup?.encryptionEnabled ?? false);
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
    settings.backup?.enabled,
    settings.backup?.frequency,
    settings.backup?.encryptionEnabled,
    settings.splitListAmountDisplay,
    settings.ownerName,
    settings.ownerProfileImageUri,
  ]);
  useEffect(() => {
    setVisibleSplitCount(20);
  }, [activityBalanceFilter, activityDateFilter, activityStateFilter]);
  useEffect(() => {
    if (!reminderToastMessage) {
      return;
    }
    const timeout = setTimeout(() => {
      setReminderToastMessage("");
    }, 2200);
    return () => clearTimeout(timeout);
  }, [reminderToastMessage]);
  useEffect(() => {
    if (!currencyModalOpen && !currencyMenuOpen) {
      return;
    }
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (currencyModalOpen) {
          closeCustomCurrencyModal();
          return true;
        }
        if (currencyMenuOpen) {
          setCurrencyMenuOpen(false);
          return true;
        }
        return false;
      },
    );
    return () => backSubscription.remove();
  }, [closeCustomCurrencyModal, currencyMenuOpen, currencyModalOpen]);
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
        backup: {
          ...persistedBackupSettings,
          enabled: backupEnabledDraft,
          frequency: backupFrequencyDraft,
          encryptionEnabled: backupEncryptionEnabledDraft,
        },
        customCurrencies: customCurrenciesDraft,
      });
      setCurrencyMenuOpen(false);
      setLanguageMenuOpen(false);
      setHumourMenuOpen(false);
      setSplitListAmountDisplayMenuOpen(false);
      setBackupFrequencyMenuOpen(false);
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
    setBackupEnabledDraft(settings.backup?.enabled ?? false);
    setBackupFrequencyDraft(settings.backup?.frequency ?? "daily");
    setBackupEncryptionEnabledDraft(settings.backup?.encryptionEnabled ?? false);
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
    setBackupFrequencyMenuOpen(false);
    setCurrencyModalOpen(false);
    setBackupPasswordModalOpen(false);
    setBackupPasswordDraft("");
    setBackupPasswordConfirmDraft("");
    setProfileActionMenuOpen(false);
    setSelectedRecordActionTarget(null);
    setSplitReminderPickerRecordId("");
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
  const getBackupErrorMessage = (error: unknown) => {
    if (!(error instanceof Error)) {
      return t("settings.backup.error.generic");
    }
    if (error.message === "manual-backup-limit-reached") {
      return t("settings.backup.error.limitReached");
    }
    if (error.message === "missing-backup-passphrase") {
      return t("settings.backup.error.passphraseRequired");
    }
    if (error.message === "import-cancelled") {
      return t("settings.backup.error.importCancelled");
    }
    if (error.message === "invalid-backup-file") {
      return t("settings.backup.error.invalidFile");
    }
    if (error.message === "invalid-backup-passphrase") {
      return t("settings.backup.error.invalidPassphrase");
    }
    if (error.message === "google-drive-client-id-missing") {
      return t("settings.backup.error.googleClientIdMissing");
    }
    return t("settings.backup.error.generic");
  };
  const showBackupNotice = (title: string, message: string) => {
    setSettingsNoticeTitle(title);
    setSettingsNoticeMessages([message]);
  };
  const handleRunManualBackup = async () => {
    if (backupSettingsDirty) {
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.saveSettingsFirst"),
      );
      return;
    }
    try {
      await runManualBackup();
      await runScheduledBackupIfDue("foreground");
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.manualSuccess"),
      );
    } catch (error) {
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        getBackupErrorMessage(error),
      );
    }
  };
  const handleImportBackup = async () => {
    if (backupSettingsDirty) {
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.saveSettingsFirst"),
      );
      return;
    }
    Alert.alert(
      t("settings.backup.importConfirmTitle"),
      t("settings.backup.importConfirmBody"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("settings.backup.importConfirmAction"),
          style: "destructive",
          onPress: () => {
            void importBackupFromFile()
              .then(() => {
                showBackupNotice(
                  t("settings.backup.noticeTitle"),
                  t("settings.backup.importSuccess"),
                );
              })
              .catch((error) => {
                showBackupNotice(
                  t("settings.backup.noticeTitle"),
                  getBackupErrorMessage(error),
                );
              });
          },
        },
      ],
    );
  };
  const handleConnectGoogleDrive = async () => {
    try {
      await connectGoogleDrive();
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.googleDriveConnectedMessage"),
      );
    } catch (error) {
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        getBackupErrorMessage(error),
      );
    }
  };
  const handleDisconnectGoogleDrive = async () => {
    try {
      await disconnectGoogleDrive();
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.googleDriveDisconnectedMessage"),
      );
    } catch (error) {
      showBackupNotice(
        t("settings.backup.noticeTitle"),
        t("settings.backup.error.generic"),
      );
    }
  };
  const getSplitReminderLabel = (record: (typeof records)[number]) => {
    const reminder = record.reminderState?.splitReminder;
    if (!reminder?.scheduledForIso) {
      return undefined;
    }
    const reminderDate = new Date(reminder.scheduledForIso);
    if (!Number.isFinite(reminderDate.getTime())) {
      return t("reminders.rowSet");
    }
    if (reminderDate.getTime() <= Date.now()) {
      return undefined;
    }
    const formattedDate = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourClock,
      hourCycle: use24HourClock ? "h23" : "h12",
    }).format(reminderDate);
    return t("reminders.rowSetAt", { date: formattedDate });
  };
  const handleSaveSplitReminder = async (recordId: string, scheduledForIso: string) => {
    try {
      await setSplitReminder(recordId, scheduledForIso);
      setSplitReminderPickerHasExisting(false);
      setSplitReminderPickerRecordId("");
      setSplitReminderErrorMessage("");
      setReminderToastMessage(t("reminders.saved"));
    } catch (error) {
      const message =
        error instanceof Error && error.message === "notification-permission-denied"
          ? t("reminders.permissionDenied")
          : error instanceof Error && error.message === "past-reminder-date"
            ? t("reminders.errors.futureOnly")
            : t("reminders.saveFailed");
      setSplitReminderErrorMessage(message);
    }
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
    closeCustomCurrencyModal();
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
        testID="home-tab-scroll"
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: footerInsetBottom },
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
                    reminderLabel={getSplitReminderLabel(record)}
                    onOpenActions={(target) =>
                      setSelectedRecordActionTarget(target)
                    }
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
        testID="splits-tab-scroll"
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
          { paddingBottom: footerInsetBottom },
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
                  reminderLabel={getSplitReminderLabel(item)}
                  onOpenActions={(target) =>
                    setSelectedRecordActionTarget(target)
                  }
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
        testID="settings-tab-scroll"
        style={screenStyles.flex}
        nestedScrollEnabled
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: footerInsetBottom },
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
              onPress={() => setCurrencyMenuOpen(true)}
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
                {!backupEnabledDraft ? (
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={13}
                    lineHeight={18}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {t("settings.backup.inactiveSummary")}
                  </Text>
                ) : (
                  <YStack gap="$2.5">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.backup.manual")}
                      style={screenStyles.selectRow}
                      onPress={() => void handleRunManualBackup()}
                    >
                      <YStack gap="$1">
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={15}
                          color={PALETTE.onSurface}
                        >
                          {t("settings.backup.manual")}
                        </Text>
                        <Text
                          fontFamily={FONTS.bodyMedium}
                          fontSize={12}
                          color={PALETTE.onSurfaceVariant}
                        >
                          {t("settings.backup.manualUsage", {
                            used: Math.min(backupUsedToday, 3),
                            limit: 3,
                          })}
                        </Text>
                      </YStack>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.backup.frequencyPicker")}
                      style={screenStyles.selectRow}
                      onPress={() => setBackupFrequencyMenuOpen(true)}
                    >
                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$3"
                      >
                        <YStack flex={1} gap="$1">
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={15}
                            color={PALETTE.onSurface}
                          >
                            {
                              backupFrequencyOptions.find(
                                (option) => option.key === backupFrequencyDraft,
                              )?.label
                            }
                          </Text>
                          <Text
                            fontFamily={FONTS.bodyMedium}
                            fontSize={12}
                            color={PALETTE.onSurfaceVariant}
                          >
                            {
                              backupFrequencyOptions.find(
                                (option) => option.key === backupFrequencyDraft,
                              )?.description
                            }
                          </Text>
                        </YStack>
                        <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                      </XStack>
                    </Pressable>
                    <View style={screenStyles.settingsFeatureRow}>
                      <YStack gap="$1.5" flex={1}>
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={15}
                          color={PALETTE.onSurface}
                        >
                          {t("settings.backup.encryption")}
                        </Text>
                        <Text
                          fontFamily={FONTS.bodyMedium}
                          fontSize={12}
                          color={PALETTE.onSurfaceVariant}
                        >
                          {backupPassphrase.trim()
                            ? t("settings.backup.passwordSet")
                            : t("settings.backup.passwordNotSet")}
                        </Text>
                      </YStack>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityLabel={t("settings.backup.encryption")}
                        accessibilityState={{
                          checked: backupEncryptionEnabledDraft,
                        }}
                        style={[
                          screenStyles.settingsFeatureToggle,
                          backupEncryptionEnabledDraft
                            ? screenStyles.settingsFeatureToggleActive
                            : null,
                        ]}
                        onPress={() => {
                          const nextEnabled = !backupEncryptionEnabledDraft;
                          setBackupEncryptionEnabledDraft(nextEnabled);
                          if (!nextEnabled) {
                            clearBackupPassphrase();
                          }
                        }}
                      >
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={12}
                          color={
                            backupEncryptionEnabledDraft
                              ? PALETTE.onPrimary
                              : PALETTE.primary
                          }
                          textTransform="uppercase"
                          letterSpacing={1.6}
                        >
                          {backupEncryptionEnabledDraft
                            ? t("common.on")
                            : t("common.off")}
                        </Text>
                      </Pressable>
                    </View>
                    {backupEncryptionEnabledDraft ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("settings.backup.passwordAction")}
                        style={screenStyles.selectRow}
                        onPress={() => setBackupPasswordModalOpen(true)}
                      >
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={14}
                          color={PALETTE.primary}
                        >
                          {t("settings.backup.passwordAction")}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.backup.import")}
                      style={screenStyles.selectRow}
                      onPress={() => void handleImportBackup()}
                    >
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={14}
                        color={PALETTE.onSurface}
                      >
                        {t("settings.backup.import")}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.backup.googleDriveAction")}
                      style={screenStyles.selectRow}
                      onPress={() =>
                        persistedBackupSettings.googleDrive.connected
                          ? void handleDisconnectGoogleDrive()
                          : void handleConnectGoogleDrive()
                      }
                    >
                      <YStack gap="$1">
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={14}
                          color={PALETTE.onSurface}
                        >
                          {persistedBackupSettings.googleDrive.connected
                            ? t("settings.backup.googleDriveDisconnect")
                            : t("settings.backup.googleDriveConnect")}
                        </Text>
                        <Text
                          fontFamily={FONTS.bodyMedium}
                          fontSize={12}
                          color={PALETTE.onSurfaceVariant}
                        >
                          {persistedBackupSettings.googleDrive.connected
                            ? t("settings.backup.googleDriveConnectedAs", {
                                email:
                                  persistedBackupSettings.googleDrive
                                    .accountEmail ??
                                  t("settings.backup.googleDriveConnectedStatus"),
                              })
                            : t("settings.backup.googleDriveNotConnected")}
                        </Text>
                      </YStack>
                    </Pressable>
                  </YStack>
                )}
              </YStack>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={t("settings.backup.title")}
                accessibilityState={{ checked: backupEnabledDraft }}
                style={[
                  screenStyles.settingsFeatureToggle,
                  backupEnabledDraft
                    ? screenStyles.settingsFeatureToggleActive
                    : null,
                ]}
                onPress={() => setBackupEnabledDraft((value) => !value)}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={
                    backupEnabledDraft ? PALETTE.onPrimary : PALETTE.primary
                  }
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {backupEnabledDraft ? t("common.on") : t("common.off")}
                </Text>
              </Pressable>
            </View>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
  return (
    <AppScreen
      scroll={false}
      overlay={(
        <>
          <SplitNoticeModal
            title={settingsNoticeTitle}
            messages={settingsNoticeMessages}
            onDismiss={() => {
              setSettingsNoticeTitle(t("common.almostThere"));
              setSettingsNoticeMessages([]);
            }}
          />
          {selectedRecordActionTarget ? (
            <ActionIconGridModal
              title={t("home.rowActions.title")}
              options={[
                {
                  label: t("reminders.actionsTitle"),
                  icon: <Bell color={PALETTE.primary} size={18} />,
                  onPress: () => {
                    const target = selectedRecordActionTarget;
                    if (!target) {
                      return;
                    }
                    const selectedRecord = records.find(
                      (record) => record.id === target.id,
                    );
                    setSelectedRecordActionTarget(null);
                    setSplitReminderErrorMessage("");
                    setSplitReminderPickerHasExisting(
                      Boolean(selectedRecord?.reminderState?.splitReminder),
                    );
                    setSplitReminderPickerRecordId(target.id);
                  },
                },
                {
                  label: t("home.rowActions.delete"),
                  accessibilityLabel: t("home.rowActions.deleteA11y", {
                    title: selectedRecordActionTarget.title,
                  }),
                  icon: <Trash2 color={PALETTE.danger} size={18} />,
                  tone: "danger",
                  onPress: () => {
                    const target = selectedRecordActionTarget;
                    setSelectedRecordActionTarget(null);
                    queueDelete(target.id, target.title);
                  },
                },
              ]}
              onDismiss={() => setSelectedRecordActionTarget(null)}
            />
          ) : null}
          {splitReminderPickerRecord ? (
            <ReminderDateTimeModal
              title={t("reminders.picker.title")}
              initialIso={splitReminderPickerRecord.reminderState?.splitReminder?.scheduledForIso}
              saveLabel={
                splitReminderPickerHasExisting
                  ? t("reminders.update")
                  : t("reminders.set")
              }
              errorMessage={splitReminderErrorMessage}
              onClearError={() => setSplitReminderErrorMessage("")}
              onCancel={() => {
                setSplitReminderErrorMessage("");
                setSplitReminderPickerHasExisting(false);
                setSplitReminderPickerRecordId("");
              }}
              onRemove={
                splitReminderPickerHasExisting
                  ? () => {
                      void clearSplitReminder(splitReminderPickerRecord.id)
                        .then(() => {
                          setSplitReminderErrorMessage("");
                          setSplitReminderPickerHasExisting(false);
                          setSplitReminderPickerRecordId("");
                          setReminderToastMessage(t("reminders.removed"));
                        })
                        .catch(() => {
                          setSplitReminderErrorMessage(t("reminders.removeFailed"));
                        });
                    }
                  : undefined
              }
              onSave={(scheduledForIso) => {
                void handleSaveSplitReminder(
                  splitReminderPickerRecord.id,
                  scheduledForIso,
                );
              }}
            />
          ) : null}
          <ToastNotice
            message={reminderToastMessage}
            bottomOffset={footerInsetBottom + 12}
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
                {
                  label: t("common.cancel"),
                  onPress: () => setProfileActionMenuOpen(false),
                },
              ]}
            />
          ) : null}
          {currencyMenuOpen ? (
            <ActionSheetModal
              title={t("settings.defaultCurrency")}
              scrollableOptions
              options={[
                ...draftCurrencyOptions.map((option) => ({
                  label: option.label,
                  selected: defaultCurrencyDraft === option.code,
                  onPress: () => {
                    setDefaultCurrencyDraft(option.code);
                    setCurrencyMenuOpen(false);
                  },
                })),
                {
                  label: t("common.other"),
                  accessibilityLabel: t("settings.currencyPickerOther"),
                  onPress: () => {
                    setCurrencyMenuOpen(false);
                    setCurrencyModalOpen(true);
                  },
                },
              ]}
              onDismiss={() => setCurrencyMenuOpen(false)}
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
          {backupFrequencyMenuOpen ? (
            <ActionSheetModal
              title={t("settings.backup.frequencyPickerTitle")}
              options={backupFrequencyOptions.map((option) => ({
                label: option.label,
                description: option.description,
                selected: option.key === backupFrequencyDraft,
                onPress: () => {
                  setBackupFrequencyDraft(option.key);
                  setBackupFrequencyMenuOpen(false);
                },
              }))}
              onDismiss={() => setBackupFrequencyMenuOpen(false)}
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
                    accessibilityLabel={t("settings.currencySave")}
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
                    accessibilityLabel={t("common.cancel")}
                    style={screenStyles.confirmChoiceSecondaryButton}
                    onPress={closeCustomCurrencyModal}
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
          {backupPasswordModalOpen ? (
            <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
              <View style={screenStyles.splitNoticeBackdrop} />
              <View style={screenStyles.splitNoticeCard}>
                <YStack gap="$3">
                  <Text
                    fontFamily={FONTS.headlineBold}
                    fontSize={22}
                    color={PALETTE.onSurface}
                  >
                    {t("settings.backup.passwordTitle")}
                  </Text>
                  <View style={screenStyles.assignInputShell}>
                    <TextInput
                      value={backupPasswordDraft}
                      onChangeText={setBackupPasswordDraft}
                      placeholder={t("settings.backup.passwordPlaceholder")}
                      placeholderTextColor={PALETTE.inputPlaceholder}
                      style={screenStyles.assignInput}
                      secureTextEntry
                      returnKeyType="next"
                      onSubmitEditing={() => undefined}
                    />
                  </View>
                  <View style={screenStyles.assignInputShell}>
                    <TextInput
                      value={backupPasswordConfirmDraft}
                      onChangeText={setBackupPasswordConfirmDraft}
                      placeholder={t("settings.backup.passwordConfirmPlaceholder")}
                      placeholderTextColor={PALETTE.inputPlaceholder}
                      style={screenStyles.assignInput}
                      secureTextEntry
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (
                          backupPasswordDraft.trim().length < 6 ||
                          backupPasswordDraft !== backupPasswordConfirmDraft
                        ) {
                          return;
                        }
                        setBackupPassphrase(backupPasswordDraft);
                        setBackupPasswordDraft("");
                        setBackupPasswordConfirmDraft("");
                        setBackupPasswordModalOpen(false);
                      }}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.backup.passwordSave")}
                    style={screenStyles.splitNoticeButton}
                    onPress={() => {
                      if (backupPasswordDraft.trim().length < 6) {
                        showBackupNotice(
                          t("settings.backup.noticeTitle"),
                          t("settings.backup.error.passphraseTooShort"),
                        );
                        return;
                      }
                      if (backupPasswordDraft !== backupPasswordConfirmDraft) {
                        showBackupNotice(
                          t("settings.backup.noticeTitle"),
                          t("settings.backup.error.passphraseMismatch"),
                        );
                        return;
                      }
                      setBackupPassphrase(backupPasswordDraft);
                      setBackupPasswordDraft("");
                      setBackupPasswordConfirmDraft("");
                      setBackupPasswordModalOpen(false);
                      showBackupNotice(
                        t("settings.backup.noticeTitle"),
                        t("settings.backup.passwordSaved"),
                      );
                    }}
                  >
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={14}
                      color={PALETTE.onPrimary}
                    >
                      {t("settings.backup.passwordSave")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.cancel")}
                    style={screenStyles.confirmChoiceSecondaryButton}
                    onPress={() => {
                      setBackupPasswordModalOpen(false);
                      setBackupPasswordDraft("");
                      setBackupPasswordConfirmDraft("");
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
        </>
      )}
      footer={
        <StackedFloatingFooter onMeasuredHeight={onMeasuredHeight}>
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
        </StackedFloatingFooter>
      }
    >
      {activeTab === "home" ? renderHomeContent() : null}
      {activeTab === "splits" ? renderSplitsContent() : null}
      {activeTab === "settings" ? renderSettingsContent() : null}
    </AppScreen>
  );
}
