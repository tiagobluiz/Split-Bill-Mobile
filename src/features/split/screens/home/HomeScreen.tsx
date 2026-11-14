import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";

import {
  AppScreen,
  StackedFloatingFooter,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { getDeviceLocale, prefers24HourTime } from "../../../../lib/device";
import {
  trackSplitFlowStarted,
  trackSplitTagsUsed,
} from "../../../../lib/telemetry";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { useSplitStore } from "../../store";
import { HomeTabBar, type HomeTabKey } from "../shared/homeParts";
import { HomeHomeTabContent } from "./HomeHomeTabContent";
import { HomeGroupsTabContent } from "./HomeGroupsTabContent";
import { HomeOverlayStack } from "./HomeOverlayStack";
import { HomeSettingsTabContent } from "./HomeSettingsTabContent";
import { HomeSplitsTabContent } from "./HomeSplitsTabContent";
import type {
  ActivityBalanceFilter,
  ActivityDateFilter,
  ActivityStateFilter,
  ActivityTagFilterMode,
  HomeRecord,
  RecordActionTarget,
} from "./homeTypes";
import { useHomeSettingsDraftController } from "./useHomeSettingsDraftController";
import { useArchiveBalances } from "./useArchiveBalances";
import { useSplitListPages } from "./useSplitListPages";
import { usePageRowModels } from "./usePageRowModels";
import { countSplitTagUsage } from "../../../../storage/splitList";
import { buildRecordRoute } from "../../routes";
import type { ReminderEntry } from "../../reminders";
import { useTimedUndoNotice } from "../shared/useTimedUndoNotice";
import { screenStyles } from "../shared/styles";
import {
  isDefaultSplitTag,
  type SplitTagColor,
  type SplitTagIcon,
} from "../../tags";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

type SplitReminderUndoItem = { recordId: string; scheduledForIso: string };

export function HomeScreenView() {
  const { t } = useTranslation();
  const {
    records,
    ownerNameWritesPending,
    createDraft,
    openRecord,
    loadRecord,
    releaseInactiveRecords,
    removeRecord,
    settings,
    updateSettings,
    updateRecordDetails,
    setSplitReminder,
    clearSplitReminder,
    addTag,
    removeTag,
    savePerson,
    getPersonDeletionImpact,
    removePerson,
    addParticipantGroup,
    updateParticipantGroup,
    removeParticipantGroup,
  } = useSplitStore(
    useShallow((state) => ({
      records: state.records,
      ownerNameWritesPending: state.ownerNameWritesPending,
      createDraft: state.createDraft,
      openRecord: state.openRecord,
      loadRecord: state.loadRecord,
      releaseInactiveRecords: state.releaseInactiveRecords,
      removeRecord: state.removeRecord,
      settings: state.settings,
      updateSettings: state.updateSettings,
      updateRecordDetails: state.updateRecordDetails,
      setSplitReminder: state.setSplitReminder,
      clearSplitReminder: state.clearSplitReminder,
      addTag: state.addTag,
      removeTag: state.removeTag,
      savePerson: state.savePerson,
      getPersonDeletionImpact: state.getPersonDeletionImpact,
      removePerson: state.removePerson,
      addParticipantGroup: state.addParticipantGroup,
      updateParticipantGroup: state.updateParticipantGroup,
      removeParticipantGroup: state.removeParticipantGroup,
    })),
  );

  const insets = useSafeAreaInsets();
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 260 });

  const locale = getDeviceLocale();
  const use24HourClock = prefers24HourTime();

  const [activeTab, setActiveTab] = useState<HomeTabKey>("home");
  const [ownerProfileEditRequest, setOwnerProfileEditRequest] = useState(0);
  const [ownerProfileEditorActive, setOwnerProfileEditorActive] = useState(false);
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
  const [activityTagFilterIds, setActivityTagFilterIds] = useState<string[]>(
    [],
  );
  const [activityTagFilterMode, setActivityTagFilterMode] =
    useState<ActivityTagFilterMode>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [splitReminderPickerRecordId, setSplitReminderPickerRecordId] =
    useState("");
  const [quickEditRecordId, setQuickEditRecordId] = useState("");
  const [splitReminderPickerHasExisting, setSplitReminderPickerHasExisting] =
    useState(false);
  const [splitReminderErrorMessage, setSplitReminderErrorMessage] =
    useState("");
  const reminderUndo = useTimedUndoNotice<SplitReminderUndoItem>(
    async (item) => {
      const currentRecord = records.find((record) => record.id === item.recordId) ?? await loadRecord(item.recordId);
      if (!currentRecord || currentRecord.reminderState?.splitReminder) {
        throw new Error("split-reminder-not-restorable");
      }
      await setSplitReminder(item.recordId, item.scheduledForIso);
    },
    t("reminders.restored"),
    t("reminders.restoreFailed"),
  );
  const [pendingTagDeleteId, setPendingTagDeleteId] = useState("");
  const [tagUsage, setTagUsage] = useState<{ id: string; records: typeof records; count: number } | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);

  const [isCreatingSplit, setIsCreatingSplit] = useState(false);
  const creatingSplitRef = useRef(false);
  const deleteTimeoutRef = useRef<any>(null);
  const pendingDeleteRef = useRef<RecordActionTarget | null>(null);
  const homeFocusedRef = useRef(false);
  const actionRequestRef = useRef(0);

  useEffect(() => {
    if ((activeTab === "home" || activeTab === "splits") && !selectedRecordActionTarget && !quickEditRecordId && !splitReminderPickerRecordId) {
      releaseInactiveRecords();
    }
  }, [activeTab, selectedRecordActionTarget, quickEditRecordId, splitReminderPickerRecordId, releaseInactiveRecords]);

  const settingsController = useHomeSettingsDraftController({
    settings,
    updateSettings,
  });

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      releaseInactiveRecords();
      creatingSplitRef.current = false;
      setIsCreatingSplit(false);
      return () => { homeFocusedRef.current = false; actionRequestRef.current += 1; };
    }, [releaseInactiveRecords]),
  );

  useEffect(() => {
    if (!pendingTagDeleteId) { setTagUsage(null); return; }
    let cancelled = false;
    const loadedCount = records.filter((record) => (record.values.tagIds ?? []).includes(pendingTagDeleteId)).length;
    void countSplitTagUsage(pendingTagDeleteId, records.map((record) => record.id)).then((storedCount) => {
      if (!cancelled) setTagUsage({ id: pendingTagDeleteId, records, count: storedCount + loadedCount });
    }).catch(() => {
      if (!cancelled) {
        setPendingTagDeleteId("");
        Alert.alert(t("home.splitsLoadFailed"), t("common.tryAgain"));
      }
    });
    return () => { cancelled = true; };
  }, [pendingTagDeleteId, records, t]);

  const balanceIndex = useArchiveBalances(
    records,
    settings.ownerName,
    settings.defaultCurrency,
    ownerNameWritesPending === 0 && (settings.balanceFeatureEnabled !== false || (activeTab === "splits" && activityBalanceFilter !== "all")),
    pendingDelete?.id,
  );
  const balances = balanceIndex.balances;

  const recentPages = useSplitListPages(activeTab === "home" ? { order: "newest", excludedId: pendingDelete?.id } : null, null, 5);
  const recentRows = usePageRowModels(recentPages.records, records, settings.ownerName, settings, activeTab === "home", `${settings.language}:${settings.humour}:${locale}`);

  const balanceEligibleIds = useMemo(() => {
    if (activeTab !== "splits" || activityBalanceFilter === "all") return undefined;
    return balanceIndex.entries?.filter((entry) => {
      const ownerNetCents = entry.filterOwnerNetCents;
      return activityBalanceFilter === "nothingDue"
        ? ownerNetCents === 0
        : ownerNetCents > 0;
    }).map((entry) => entry.id);
  }, [activeTab, activityBalanceFilter, balanceIndex.entries]);
  const balanceFilterWaiting = activityBalanceFilter !== "all" && !balanceIndex.entries;
  const splitPages = useSplitListPages(activeTab === "splits" && !balanceFilterWaiting ? {
    order: activityDateFilter,
    status: activityStateFilter,
    tagIds: activityTagFilterIds,
    tagMode: activityTagFilterMode,
    eligibleIds: balanceEligibleIds,
    excludedId: pendingDelete?.id,
  } : null, null);
  const splitRows = usePageRowModels(splitPages.records, records, settings.ownerName, settings, activeTab === "splits", `${settings.language}:${settings.humour}:${locale}`);
  const splitReminderPickerRecord = records.find(
    (record) => record.id === splitReminderPickerRecordId,
  );
  const quickEditRecord = records.find((record) => record.id === quickEditRecordId);

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
      !settingsController.canLeaveSettings()
    ) {
      return;
    }

    setActiveTab(nextTab);
  };

  const editProfileFromSettings = () => {
    if (!settingsController.canLeaveSettings()) return;
    setOwnerProfileEditRequest((current) => current + 1);
    setOwnerProfileEditorActive(true);
    setActiveTab("groups");
  };

  const hideHomeFooter =
    (activeTab === "settings" && tagEditorOpen) || Boolean(quickEditRecord) || ownerProfileEditorActive;

  const getReminderLabel = (reminder?: ReminderEntry) => {
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
  const getSplitReminderLabel = (record: HomeRecord) => getReminderLabel(record.reminderState?.splitReminder);
  const getModelReminderLabel = (id: string) => {
    const loaded = records.find((record) => record.id === id);
    return loaded ? getSplitReminderLabel(loaded) : getReminderLabel((activeTab === "home" ? recentPages.records : splitPages.records).find((record) => record.id === id)?.splitReminder);
  };
  const openListRecord = (id: string) => {
    const request = ++actionRequestRef.current;
    const stillFocused = () => homeFocusedRef.current && actionRequestRef.current === request;
    void openRecord(id, stillFocused).then((record) => {
      if (!stillFocused()) return;
      if (record) router.push(buildRecordRoute(record));
      else Alert.alert(t("home.splitsLoadFailed"), t("common.tryAgain"));
    }).catch(() => { if (stillFocused()) Alert.alert(t("home.splitsLoadFailed"), t("common.tryAgain")); });
  };
  const openListActions = (target: RecordActionTarget) => {
    const request = ++actionRequestRef.current;
    if (records.some((record) => record.id === target.id)) { setSelectedRecordActionTarget(target); return; }
    const stillCurrent = () => homeFocusedRef.current && actionRequestRef.current === request;
    void loadRecord(target.id, stillCurrent).then((record) => {
      if (!stillCurrent()) return;
      if (record) setSelectedRecordActionTarget(target);
      else Alert.alert(t("home.splitsLoadFailed"), t("common.tryAgain"));
    }).catch(() => { if (stillCurrent()) Alert.alert(t("home.splitsLoadFailed"), t("common.tryAgain")); });
  };

  const handleSaveSplitReminder = async (
    recordId: string,
    scheduledForIso: string,
  ) => {
    try {
      await setSplitReminder(recordId, scheduledForIso);
      reminderUndo.notify(t("reminders.saved"));
      setSplitReminderPickerHasExisting(false);
      setSplitReminderPickerRecordId("");
      setSplitReminderErrorMessage("");
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
    const removedReminder = splitReminderPickerRecord.reminderState?.splitReminder;
    if (!removedReminder?.scheduledForIso) {
      return;
    }

    void clearSplitReminder(splitReminderPickerRecord.id)
      .then(() => {
        setSplitReminderErrorMessage("");
        setSplitReminderPickerHasExisting(false);
        setSplitReminderPickerRecordId("");
        reminderUndo.notify(t("reminders.removed"), {
          recordId: splitReminderPickerRecord.id,
          scheduledForIso: removedReminder.scheduledForIso,
        });
      })
      .catch(() => {
        setSplitReminderErrorMessage(t("reminders.removeFailed"));
      });
  };

  const handleAddQuickEditTag = async (
    label: string,
    icon?: SplitTagIcon | null,
    color?: SplitTagColor,
  ) => {
    return addTag(label, icon, color);
  };

  const handleSaveQuickEdit = async (details: {
    splitName: string;
    tagIds: string[];
    splitDate?: string;
    invoicePhotoUri?: string | null;
    invoicePhotoName?: string | null;
    invoicePhotoSize?: number | null;
  }) => {
    const record = quickEditRecord;
    if (!record) {
      return;
    }
    const previousTagIds = record.values.tagIds ?? [];
    await updateRecordDetails(record.id, details);
    const tagSetChanged =
      previousTagIds.length !== details.tagIds.length ||
      previousTagIds.some((tagId) => !details.tagIds.includes(tagId));
    if (tagSetChanged && details.tagIds.length > 0) {
      const selectedTags = (settings.tags ?? []).filter((tag) =>
        details.tagIds.includes(tag.id),
      );
      void trackSplitTagsUsed({
        tagCount: selectedTags.length,
        builtInTagCount: selectedTags.filter(isDefaultSplitTag).length,
        customTagCount: selectedTags.filter((tag) => !isDefaultSplitTag(tag))
          .length,
      });
    }
    setQuickEditRecordId("");
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
          selectedRecordHasReminder={Boolean(records.find((record) => record.id === selectedRecordActionTarget?.id)?.reminderState?.splitReminder)}
          selectedRecordReminderDate={(() => {
            const iso = records.find((record) => record.id === selectedRecordActionTarget?.id)?.reminderState?.splitReminder?.scheduledForIso;
            const date = iso ? new Date(iso) : null;
            return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, {
              year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: !use24HourClock,
            }).format(date) : undefined;
          })()}
          onDismissRecordActionTarget={() =>
            setSelectedRecordActionTarget(null)
          }
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
          onRecordActionEditDetails={() => {
            const target = selectedRecordActionTarget;
            if (!target) {
              return;
            }
            setSelectedRecordActionTarget(null);
            setQuickEditRecordId(target.id);
          }}
          onRecordActionDelete={() => {
            const target = selectedRecordActionTarget;
            if (!target) {
              return;
            }

            setSelectedRecordActionTarget(null);
            queueDelete(target.id, target.title);
          }}
          quickEditRecord={quickEditRecord}
          tags={settings.tags ?? []}
          onCancelQuickEdit={() => setQuickEditRecordId("")}
          onSaveQuickEdit={handleSaveQuickEdit}
          onAddQuickEditTag={handleAddQuickEditTag}
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
          reminderToastMessage={reminderUndo.message}
          reminderUndoAvailable={reminderUndo.canUndo}
          onUndoReminderRemoval={() => void reminderUndo.undo()}
          footerInsetBottom={footerInsetBottom}
          safeAreaBottomInset={insets.bottom}
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
        />
      }
      footer={
        hideHomeFooter ? null : (
          <StackedFloatingFooter attached onMeasuredHeight={onMeasuredHeight}>
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
        )
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
          recentRecords={recentRows.rows}
          onViewAllSplits={() => setActiveTab("splits")}
          getSplitReminderLabel={getSplitReminderLabel}
          getModelReminderLabel={getModelReminderLabel}
          onOpenRecord={openListRecord}
          onOpenActions={openListActions}
          listLoading={recentPages.loading || recentRows.loading}
          listError={recentPages.error || recentRows.error}
          onRetry={recentRows.error ? recentRows.retry : recentPages.reload}
          balanceError={balanceIndex.error}
          onRetryBalances={balanceIndex.retry}
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
          activityTagFilterIds={activityTagFilterIds}
          setActivityTagFilterIds={setActivityTagFilterIds}
          activityTagFilterMode={activityTagFilterMode}
          setActivityTagFilterMode={setActivityTagFilterMode}
          visibleSplitCount={splitRows.rows.length}
          filteredSplitRecordsLength={splitRows.rows.length}
          onIncreaseVisibleCount={splitPages.loadMore}
          pagedSplitRecords={splitRows.rows}
          getSplitReminderLabel={getSplitReminderLabel}
          getModelReminderLabel={getModelReminderLabel}
          onOpenRecord={openListRecord}
          onOpenActions={openListActions}
          listLoading={splitPages.loading || splitRows.loading || (balanceFilterWaiting && !balanceIndex.error)}
          listError={splitPages.error || splitRows.error || (balanceFilterWaiting && balanceIndex.error)}
          hasMore={Boolean(splitPages.nextCursor)}
          onRetry={balanceFilterWaiting && balanceIndex.error ? balanceIndex.retry : splitRows.error ? splitRows.retry : splitPages.nextCursor ? splitPages.loadMore : splitPages.reload}
          balanceError={balanceIndex.error}
          onRetryBalances={balanceIndex.retry}
        />
      ) : null}
      {activeTab === "groups" ? (
        <HomeGroupsTabContent
          topInset={insets.top}
          footerInsetBottom={footerInsetBottom}
          settings={settings}
          ownerProfileEditRequest={ownerProfileEditRequest}
          onOwnerProfileEditRequestHandled={() => setOwnerProfileEditRequest(0)}
          onOwnerProfileEditorOpen={() => setOwnerProfileEditorActive(true)}
          onOwnerProfileEditorClose={() => setOwnerProfileEditorActive(false)}
          records={records}
          onSavePerson={savePerson}
          onUpdateSettings={updateSettings}
          onGetPersonDeletionImpact={getPersonDeletionImpact}
          onRemovePerson={removePerson}
          onAddGroup={addParticipantGroup}
          onUpdateGroup={updateParticipantGroup}
          onRemoveGroup={removeParticipantGroup}
        />
      ) : null}
      {activeTab === "settings" ? (
        <HomeSettingsTabContent
          topInset={insets.top}
          footerInsetBottom={footerInsetBottom}
          settings={settings}
          onEditProfile={editProfileFromSettings}
          balanceFeatureEnabledDraft={
            settingsController.balanceFeatureEnabledDraft
          }
          setBalanceFeatureEnabledDraft={
            settingsController.setBalanceFeatureEnabledDraft
          }
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
          tags={settings.tags ?? []}
          onAddTag={addTag}
          tagEditorOpen={tagEditorOpen}
          setTagEditorOpen={setTagEditorOpen}
          pendingTagDeleteId={pendingTagDeleteId}
          setPendingTagDeleteId={setPendingTagDeleteId}
          getTagUsageCount={(tagId) => tagUsage?.id === tagId && tagUsage.records === records ? tagUsage.count : null}
          onConfirmDeleteTag={(tagId) => {
            void removeTag(tagId).then(() => setPendingTagDeleteId("")).catch(() => {
              Alert.alert(t("common.couldNotSaveSettings"), t("common.tryAgain"));
            });
          }}
        />
      ) : null}
    </AppScreen>
  );
}
