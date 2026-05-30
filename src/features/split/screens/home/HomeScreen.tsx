import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import {
  Text as TamaguiText,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  PrimaryButton,
  StackedFloatingFooter,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { getDeviceLocale, prefers24HourTime } from "../../../../lib/device";
import { trackSplitFlowStarted } from "../../../../lib/telemetry";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { getSettlementPreview, useSplitStore } from "../../store";
import { getRecordMoneyPreview, getHomeBalanceCards } from "../shared/settlementUtils";
import { HomeTabBar, type HomeTabKey } from "../shared/homeParts";
import { HomeHomeTabContent } from "./HomeHomeTabContent";
import { HomeOverlayStack } from "./HomeOverlayStack";
import { HomeSettingsTabContent } from "./HomeSettingsTabContent";
import { HomeSplitsTabContent } from "./HomeSplitsTabContent";
import type {
  ActivityBalanceFilter,
  ActivityDateFilter,
  ActivityStateFilter,
  HomeRecord,
  RecordActionTarget,
} from "./homeTypes";
import { useHomeSettingsDraftController } from "./useHomeSettingsDraftController";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export function HomeScreenView() {
  const { t } = useTranslation();
  const {
    records,
    createDraft,
    removeRecord,
    settings,
    updateSettings,
    setSplitReminder,
    clearSplitReminder,
  } =
    useSplitStore(
      useShallow((state) => ({
        records: state.records,
        createDraft: state.createDraft,
        removeRecord: state.removeRecord,
        settings: state.settings,
        updateSettings: state.updateSettings,
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
  const [pendingTabChange, setPendingTabChange] = useState<HomeTabKey | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<RecordActionTarget | null>(
    null,
  );
  const [selectedRecordActionTarget, setSelectedRecordActionTarget] =
    useState<RecordActionTarget | null>(null);
  const [activityStateFilter, setActivityStateFilter] =
    useState<ActivityStateFilter>("all");
  const [activityDateFilter, setActivityDateFilter] =
    useState<ActivityDateFilter>("newest");
  const [activityBalanceFilter, setActivityBalanceFilter] =
    useState<ActivityBalanceFilter>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [visibleSplitCount, setVisibleSplitCount] = useState(20);

  const [splitReminderPickerRecordId, setSplitReminderPickerRecordId] = useState("");
  const [splitReminderPickerHasExisting, setSplitReminderPickerHasExisting] =
    useState(false);
  const [splitReminderErrorMessage, setSplitReminderErrorMessage] = useState("");
  const [reminderToastMessage, setReminderToastMessage] = useState("");

  const [isCreatingSplit, setIsCreatingSplit] = useState(false);
  const creatingSplitRef = useRef(false);
  const deleteTimeoutRef = useRef<any>(null);
  const pendingDeleteRef = useRef<RecordActionTarget | null>(null);

  const settingsController = useHomeSettingsDraftController({
    settings,
    updateSettings,
    onDiscardExtraState: () => {
      setSelectedRecordActionTarget(null);
      setSplitReminderPickerRecordId("");
      setSplitReminderPickerHasExisting(false);
      setSplitReminderErrorMessage("");
      setPendingTabChange(null);
    },
  });

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

  const commitPendingDelete = async (nextPending: RecordActionTarget) => {
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

  const startSplit = async () => {
    if (creatingSplitRef.current) {
      return;
    }

    creatingSplitRef.current = true;
    setIsCreatingSplit(true);
    try {
      const draft = await createDraft();
      await trackSplitFlowStarted({
        source: "home",
        hasDefaultCurrency: Boolean(settings.defaultCurrency.trim()),
      });
      router.push(`/split/${draft.id}/setup`);
    } catch (error) {
      creatingSplitRef.current = false;
      setIsCreatingSplit(false);
      throw error;
    }
  };

  const attemptTabChange = (nextTab: HomeTabKey) => {
    if (
      activeTab === "settings" &&
      nextTab !== "settings" &&
      settingsController.settingsDirty
    ) {
      setPendingTabChange(nextTab);
      return;
    }

    setActiveTab(nextTab);
  };

  const getSplitReminderLabel = (record: HomeRecord) => {
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

  const handleSaveSplitReminder = async (
    recordId: string,
    scheduledForIso: string,
  ) => {
    try {
      await setSplitReminder(recordId, scheduledForIso);
      setSplitReminderPickerHasExisting(false);
      setSplitReminderPickerRecordId("");
      setSplitReminderErrorMessage("");
      setReminderToastMessage(t("reminders.saved"));
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message === "notification-permission-denied"
          ? t("reminders.permissionDenied")
          : error instanceof Error && error.message === "past-reminder-date"
            ? t("reminders.errors.futureOnly")
            : t("reminders.saveFailed");
      setSplitReminderErrorMessage(message);
    }
  };

  const handleRemoveSplitReminder = () => {
    if (!splitReminderPickerRecord) {
      return;
    }

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
  };

  return (
    <AppScreen
      scroll={false}
      overlay={
        <HomeOverlayStack
          settingsNoticeTitle={settingsController.settingsNoticeTitle}
          settingsNoticeMessages={settingsController.settingsNoticeMessages}
          onDismissSettingsNotice={settingsController.clearSettingsNotice}
          selectedRecordActionTarget={selectedRecordActionTarget}
          onDismissRecordActionTarget={() => setSelectedRecordActionTarget(null)}
          onRecordActionReminder={() => {
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
          }}
          onRecordActionDelete={() => {
            const target = selectedRecordActionTarget;
            if (!target) {
              return;
            }

            setSelectedRecordActionTarget(null);
            queueDelete(target.id, target.title);
          }}
          splitReminderPickerRecord={splitReminderPickerRecord}
          splitReminderPickerHasExisting={splitReminderPickerHasExisting}
          splitReminderErrorMessage={splitReminderErrorMessage}
          onClearSplitReminderError={() => setSplitReminderErrorMessage("")}
          onCancelSplitReminder={() => {
            setSplitReminderErrorMessage("");
            setSplitReminderPickerHasExisting(false);
            setSplitReminderPickerRecordId("");
          }}
          onRemoveSplitReminder={handleRemoveSplitReminder}
          onSaveSplitReminder={(scheduledForIso) => {
            if (!splitReminderPickerRecord) {
              return;
            }

            void handleSaveSplitReminder(
              splitReminderPickerRecord.id,
              scheduledForIso,
            );
          }}
          reminderToastMessage={reminderToastMessage}
          footerInsetBottom={footerInsetBottom}
          profileActionMenuOpen={settingsController.profileActionMenuOpen}
          setProfileActionMenuOpen={settingsController.setProfileActionMenuOpen}
          ownerProfileImageUriDraft={settingsController.ownerProfileImageUriDraft}
          setOwnerProfileImageUriDraft={
            settingsController.setOwnerProfileImageUriDraft
          }
          onPickProfileImage={settingsController.pickProfileImage}
          currencyMenuOpen={settingsController.currencyMenuOpen}
          setCurrencyMenuOpen={settingsController.setCurrencyMenuOpen}
          draftCurrencyOptions={settingsController.draftCurrencyOptions}
          defaultCurrencyDraft={settingsController.defaultCurrencyDraft}
          setDefaultCurrencyDraft={settingsController.setDefaultCurrencyDraft}
          setCurrencyModalOpen={settingsController.setCurrencyModalOpen}
          languageMenuOpen={settingsController.languageMenuOpen}
          setLanguageMenuOpen={settingsController.setLanguageMenuOpen}
          languageDraft={settingsController.languageDraft}
          setLanguageDraft={settingsController.setLanguageDraft}
          humourMenuOpen={settingsController.humourMenuOpen}
          setHumourMenuOpen={settingsController.setHumourMenuOpen}
          humourDraft={settingsController.humourDraft}
          setHumourDraft={settingsController.setHumourDraft}
          splitListAmountDisplayMenuOpen={
            settingsController.splitListAmountDisplayMenuOpen
          }
          setSplitListAmountDisplayMenuOpen={
            settingsController.setSplitListAmountDisplayMenuOpen
          }
          availableSplitListAmountDisplayOptions={
            settingsController.availableSplitListAmountDisplayOptions
          }
          splitListAmountDisplayDraft={
            settingsController.splitListAmountDisplayDraft
          }
          setSplitListAmountDisplayDraft={
            settingsController.setSplitListAmountDisplayDraft
          }
          currencyModalOpen={settingsController.currencyModalOpen}
          customCurrencyErrors={settingsController.customCurrencyErrors}
          customCurrencyName={settingsController.customCurrencyName}
          setCustomCurrencyName={settingsController.setCustomCurrencyName}
          customCurrencySymbol={settingsController.customCurrencySymbol}
          setCustomCurrencySymbol={settingsController.setCustomCurrencySymbol}
          setCustomCurrencyErrors={settingsController.setCustomCurrencyErrors}
          customCurrencySymbolInputRef={
            settingsController.customCurrencySymbolInputRef
          }
          addCustomCurrency={settingsController.addCustomCurrency}
          closeCustomCurrencyModal={settingsController.closeCustomCurrencyModal}
          pendingTabChange={pendingTabChange}
          onConfirmPendingTabChange={() => {
            void settingsController.saveSettings().then((saved) => {
              if (saved && pendingTabChange) {
                setActiveTab(pendingTabChange);
                setPendingTabChange(null);
              }
            });
          }}
          onDiscardPendingTabChange={() => {
            settingsController.discardSettingsDraft();
            if (!pendingTabChange) {
              return;
            }

            setActiveTab(pendingTabChange);
            setPendingTabChange(null);
          }}
        />
      }
      footer={
        <StackedFloatingFooter onMeasuredHeight={onMeasuredHeight}>
          {activeTab === "settings" ? (
            <PrimaryButton
              label={t("settings.save")}
              onPress={() => void settingsController.saveSettings()}
              disabled={!settingsController.settingsDirty}
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
      {activeTab === "home" ? (
        <HomeHomeTabContent
          topInset={insets.top}
          footerInsetBottom={footerInsetBottom}
          isCreatingSplit={isCreatingSplit}
          onStartSplit={startSplit}
          settings={settings}
          balances={balances}
          locale={locale}
          recentRecords={recentRecords}
          onViewAllSplits={() => setActiveTab("splits")}
          getSplitReminderLabel={getSplitReminderLabel}
          onOpenActions={(target) => setSelectedRecordActionTarget(target)}
        />
      ) : null}
      {activeTab === "splits" ? (
        <HomeSplitsTabContent
          topInset={insets.top}
          footerInsetBottom={footerInsetBottom}
          settings={settings}
          balances={balances}
          locale={locale}
          filtersExpanded={filtersExpanded}
          setFiltersExpanded={setFiltersExpanded}
          activityStateFilter={activityStateFilter}
          setActivityStateFilter={setActivityStateFilter}
          activityBalanceFilter={activityBalanceFilter}
          setActivityBalanceFilter={setActivityBalanceFilter}
          activityDateFilter={activityDateFilter}
          setActivityDateFilter={setActivityDateFilter}
          visibleSplitCount={visibleSplitCount}
          filteredSplitRecordsLength={filteredSplitRecords.length}
          onIncreaseVisibleCount={() =>
            setVisibleSplitCount((current) => current + 20)
          }
          pagedSplitRecords={pagedSplitRecords}
          getSplitReminderLabel={getSplitReminderLabel}
          onOpenActions={(target) => setSelectedRecordActionTarget(target)}
        />
      ) : null}
      {activeTab === "settings" ? (
        <HomeSettingsTabContent
          topInset={insets.top}
          footerInsetBottom={footerInsetBottom}
          settings={settings}
          ownerNameDraft={settingsController.ownerNameDraft}
          setOwnerNameDraft={settingsController.setOwnerNameDraft}
          ownerProfileImageUriDraft={settingsController.ownerProfileImageUriDraft}
          balanceFeatureEnabledDraft={settingsController.balanceFeatureEnabledDraft}
          setBalanceFeatureEnabledDraft={settingsController.setBalanceFeatureEnabledDraft}
          trackPaymentsFeatureEnabledDraft={
            settingsController.trackPaymentsFeatureEnabledDraft
          }
          setTrackPaymentsFeatureEnabledDraft={
            settingsController.setTrackPaymentsFeatureEnabledDraft
          }
          defaultCurrencyDraft={settingsController.defaultCurrencyDraft}
          setLanguageMenuOpen={settingsController.setLanguageMenuOpen}
          setHumourMenuOpen={settingsController.setHumourMenuOpen}
          setCurrencyMenuOpen={settingsController.setCurrencyMenuOpen}
          setSplitListAmountDisplayMenuOpen={
            settingsController.setSplitListAmountDisplayMenuOpen
          }
          setProfileActionMenuOpen={settingsController.setProfileActionMenuOpen}
          languageDraft={settingsController.languageDraft}
          humourDraft={settingsController.humourDraft}
          splitListAmountDisplayOptions={
            settingsController.splitListAmountDisplayOptions
          }
          splitListAmountDisplayDraft={
            settingsController.splitListAmountDisplayDraft
          }
          setSplitListAmountDisplayDraft={
            settingsController.setSplitListAmountDisplayDraft
          }
          customCurrenciesDraft={settingsController.customCurrenciesDraft}
        />
      ) : null}
    </AppScreen>
  );
}
