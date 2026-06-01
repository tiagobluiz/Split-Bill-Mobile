import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import {
  Bell,
  Check,
  FileJson,
  FileText,
  MessageCircle,
  Minus,
  RotateCcw,
  Share2,
} from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  MeasuredFloatingFooter,
  useFloatingFooterInset,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  downloadSettlementPdfToDevice,
  exportSettlementPdf,
  isDirectoryPickerCancelledError,
} from "../../../../pdf/exportSettlementPdf";
import { getDeviceLocale, prefers24HourTime } from "../../../../lib/device";
import { trackSplitStepCompleted } from "../../../../lib/telemetry";
import { FONTS, PALETTE } from "../../../../theme/palette";
import {
  getClipboardSummaryPreview,
  getPdfExportPreview,
  getSettlementPreview,
  useSplitStore,
} from "../../store";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { getParticipantDisplayName } from "../shared/participantUtils";
import { ParticipantAvatar } from "../shared/participantComponents";
import {
  getOwingPeople,
  getSettledParticipantIds,
  convertCents,
  formatAppMoney,
} from "../shared/settlementUtils";
import { SplitNoticeModal } from "../shared/modals";
import {
  ActionIconGridModal,
  ReminderDateTimeModal,
  ToastNotice,
} from "../shared/modals";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;
// Save/download is intentionally hidden from the results actions UX.
// Re-enable by flipping this flag back to true.
const ENABLE_SAVE_PDF_ACTION = false;

export function ResultsScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const insets = useSafeAreaInsets();
  const {
    markCompleted,
    settings,
    markBillPaid,
    revertBillPaid,
    toggleParticipantPaid,
    updateSettings,
    setParticipantDebtReminder,
    clearParticipantDebtReminder,
  } = useSplitStore(
    useShallow((state) => ({
      markCompleted: state.markCompleted,
      settings: state.settings,
      markBillPaid: state.markBillPaid,
      revertBillPaid: state.revertBillPaid,
      toggleParticipantPaid: state.toggleParticipantPaid,
      updateSettings: state.updateSettings,
      setParticipantDebtReminder: state.setParticipantDebtReminder,
      clearParticipantDebtReminder: state.clearParticipantDebtReminder,
    })),
  );
  const hasAutoCompletedRef = useRef<string | null>(null);
  const [exportPdfPending, setExportPdfPending] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<{
    title?: string;
    messages: string[];
  }>({ messages: [] });
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 196 });
  const [showResultsActions, setShowResultsActions] = useState(false);
  const [debtReminderPickerParticipantId, setDebtReminderPickerParticipantId] = useState("");
  const [debtReminderPickerHasExisting, setDebtReminderPickerHasExisting] = useState(false);
  const [debtReminderErrorMessage, setDebtReminderErrorMessage] = useState("");
  const [reminderToastMessage, setReminderToastMessage] = useState("");
  const settlement = getSettlementPreview(record);
  const summary = getClipboardSummaryPreview(record, settings.defaultCurrency);
  const locale = getDeviceLocale();
  const use24HourClock = prefers24HourTime();

  useEffect(() => {
    if (
      !record ||
      !settlement?.ok ||
      !summary ||
      record.status === "completed" ||
      hasAutoCompletedRef.current === record.id
    ) {
      return;
    }
    void (async () => {
      try {
        await markCompleted();
        await trackSplitStepCompleted({
          step: "results",
          draftStatus: "completed",
        });
        hasAutoCompletedRef.current = record.id;
      } catch (error) {
        console.warn(
          "Failed to auto-complete split before results render",
          error,
        );
      }
    })();
  }, [markCompleted, record, settlement, summary]);
  useEffect(() => {
    if (!reminderToastMessage) {
      return;
    }
    const timeout = setTimeout(() => {
      setReminderToastMessage("");
    }, 2200);
    return () => clearTimeout(timeout);
  }, [reminderToastMessage]);

  if (!record) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title={t("common.loadingSplitTitle")}
          description={t("common.loadingSplitDescription")}
        />
      </AppScreen>
    );
  }

  if (!settlement?.ok || !summary) {
    return (
      <AppScreen scroll={false}>
        <View style={screenStyles.participantsScrollContent}>
          <View style={screenStyles.resultsInvalidCard}>
            <View style={screenStyles.resultsInvalidIconWrap}>
              <Minus color={PALETTE.primary} size={18} />
            </View>
            <YStack gap="$2">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={28}
                color={PALETTE.onSurface}
                letterSpacing={-0.8}
              >
                {t("flow.results.invalidTitle")}
              </Text>
              <Text
                fontFamily={FONTS.bodyMedium}
                fontSize={15}
                lineHeight={22}
                color={PALETTE.onSurfaceVariant}
              >
                {t("flow.results.invalidDescription")}
              </Text>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={13}
                lineHeight={20}
                color={PALETTE.primary}
              >
                {t("flow.results.invalidHint")}
              </Text>
            </YStack>
            <YStack gap="$2.5" marginTop="$2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("flow.results.invalidFixA11y")}
                style={screenStyles.resultsInvalidPrimaryButton}
                onPress={() => router.replace(`/split/${draftId}/overview`)}
              >
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={15}
                  color={PALETTE.onPrimary}
                >
                  {t("flow.results.invalidFix")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("flow.results.invalidBackHomeA11y")}
                style={screenStyles.resultsInvalidSecondaryButton}
                onPress={() => router.replace("/")}
              >
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={15}
                  color={PALETTE.primary}
                >
                  {t("flow.results.invalidBackHome")}
                </Text>
              </Pressable>
            </YStack>
          </View>
        </View>
      </AppScreen>
    );
  }

  const payer = settlement.data.people.find((person) => person.isPayer)!;
  const appCurrency = settings.defaultCurrency?.trim().toUpperCase() || settlement.data.currency;
  const fx = record.values.exchangeRate;
  const sourceCurrency = record.values.currency.trim().toUpperCase();
  const targetCurrency = appCurrency.trim().toUpperCase();
  const hasMatchingFx =
    sourceCurrency === targetCurrency ||
    (Boolean(fx) &&
      fx!.sourceCurrency.trim().toUpperCase() === sourceCurrency &&
      fx!.targetCurrency.trim().toUpperCase() === targetCurrency &&
      Number.isFinite(fx!.rate) &&
      fx!.rate > 0);
  const exchangeRate =
    hasMatchingFx && sourceCurrency !== targetCurrency ? fx!.rate : 1;
  const displayCurrency = hasMatchingFx ? appCurrency : settlement.data.currency;
  const money = (amountCents: number) =>
    formatAppMoney(convertCents(amountCents, exchangeRate), displayCurrency, locale, settings);
  const owingPeople = getOwingPeople(settlement.data.people);
  const debtReminderPickerPerson = owingPeople.find(
    (person) => person.participantId === debtReminderPickerParticipantId,
  );
  const settledParticipantIds = getSettledParticipantIds(record);
  const pdfData = getPdfExportPreview(record);
  const payerConsumedCents = Math.max(0, payer.paidCents - payer.netCents);
  const totalOwedCents = owingPeople.reduce(
    (sum, person) => sum + Math.abs(person.netCents),
    0,
  );
  const settledOwedCents = owingPeople.reduce(
    (sum, person) =>
      sum +
      (settledParticipantIds.has(person.participantId)
        ? Math.abs(person.netCents)
        : 0),
    0,
  );
  const unsettledPeople = owingPeople.filter(
    (person) => !settledParticipantIds.has(person.participantId),
  );
  const allPaid = owingPeople.length > 0 && unsettledPeople.length === 0;
  const settlementProgressPercent =
    totalOwedCents > 0
      ? Math.round((settledOwedCents / totalOwedCents) * 100)
      : 0;
  const trackPaymentsEnabled = settings.trackPaymentsFeatureEnabled ?? true;
  const getDebtReminderLabel = (participantId: string) => {
    const reminder =
      record.reminderState?.participantDebtReminders?.[participantId];
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
    return t("reminders.rowSetAt", {
      date: new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: !use24HourClock,
        hourCycle: use24HourClock ? "h23" : "h12",
      }).format(reminderDate),
    });
  };
  const runPaymentAction = async (
    action: () => Promise<void>,
    failureMessage: string,
  ) => {
    try {
      await action();
    } catch (error) {
      console.warn(failureMessage, error);
      Alert.alert(t("common.tryAgain"), failureMessage);
    }
  };
  const shareResults = async () => {
    try {
      await Share.share({ message: summary });
    } catch (error) {
      console.warn("Failed to share split results", error);
      Alert.alert(
        t("flow.results.shareFailedTitle"),
        t("flow.results.shareFailedBody"),
      );
    }
  };
  const handleSaveDebtReminder = async (
    participantId: string,
    scheduledForIso: string,
  ) => {
    try {
      await setParticipantDebtReminder(record.id, participantId, scheduledForIso);
      setDebtReminderPickerHasExisting(false);
      setDebtReminderPickerParticipantId("");
      setDebtReminderErrorMessage("");
      setReminderToastMessage(t("reminders.saved"));
    } catch (error) {
      const message =
        error instanceof Error && error.message === "notification-permission-denied"
          ? t("reminders.permissionDenied")
          : error instanceof Error && error.message === "past-reminder-date"
            ? t("reminders.errors.futureOnly")
            : t("reminders.saveFailed");
      setDebtReminderErrorMessage(message);
    }
  };
  const savePdfAction = {
    label: t("flow.results.pdfActionSaveMultiline"),
    accessibilityLabel: t("flow.results.pdfActionSave"),
    icon: <FileJson color={PALETTE.primary} size={18} />,
    disabled: exportPdfPending,
    onPress: () => {
      setShowResultsActions(false);
      if (!pdfData) {
        setPdfNotice({
          title: undefined,
          messages: [t("flow.results.pdfUnavailable")],
        });
        return;
      }
      void (async () => {
        try {
          setExportPdfPending(true);
          await downloadSettlementPdfToDevice(record.values, locale, {
            preferredDirectoryUri: settings.pdfDownloadDirectoryUri,
            onDirectoryPicked: (directoryUri) =>
              updateSettings({
                pdfDownloadDirectoryUri: directoryUri,
              }),
          });
          setPdfNotice({
            title: t("flow.results.pdfDownloadedTitle"),
            messages: [t("flow.results.pdfDownloaded")],
          });
        } catch (error) {
          if (isDirectoryPickerCancelledError(error)) {
            return;
          }
          console.warn("Failed to download split PDF", error);
          setPdfNotice({
            title: undefined,
            messages: [t("flow.results.pdfDownloadFailed")],
          });
        } finally {
          setExportPdfPending(false);
        }
      })();
    },
  };
  const actionOptions = [
    {
      label: t("flow.results.pdfActionShareMultiline"),
      accessibilityLabel: t("flow.results.pdfActionShare"),
      icon: <FileText color={PALETTE.primary} size={18} />,
      disabled: exportPdfPending,
      onPress: () => {
        setShowResultsActions(false);
        if (!pdfData) {
          setPdfNotice({
            title: undefined,
            messages: [t("flow.results.pdfUnavailable")],
          });
          return;
        }
        void (async () => {
          try {
            setExportPdfPending(true);
            await exportSettlementPdf(record.values, locale);
          } catch (error) {
            console.warn("Failed to export split PDF", error);
            setPdfNotice({
              title: undefined,
              messages: [t("flow.results.pdfFailed")],
            });
          } finally {
            setExportPdfPending(false);
          }
        })();
      },
    },
    {
      label: t("flow.results.shareResultsMultiline"),
      accessibilityLabel: t("flow.results.shareA11y"),
      icon: <MessageCircle color={PALETTE.primary} size={18} />,
      disabled: exportPdfPending,
      onPress: () => {
        setShowResultsActions(false);
        void shareResults();
      },
    },
  ];
  // Reviewed/approved save flow is preserved here and can be restored by toggling the flag.
  if (ENABLE_SAVE_PDF_ACTION) {
    actionOptions.unshift(savePdfAction);
  }

  return (
    <AppScreen
      scroll={false}
      overlay={(
        <>
          <SplitNoticeModal
            title={pdfNotice.title}
            messages={pdfNotice.messages}
            onDismiss={() => {
              setPdfNotice({ messages: [] });
            }}
          />
          {debtReminderPickerPerson ? (
            <ReminderDateTimeModal
              title={t("reminders.picker.title")}
              initialIso={
                record.reminderState?.participantDebtReminders?.[
                  debtReminderPickerPerson.participantId
                ]?.scheduledForIso
              }
              saveLabel={
                debtReminderPickerHasExisting
                  ? t("reminders.update")
                  : t("reminders.set")
              }
              errorMessage={debtReminderErrorMessage}
              onClearError={() => setDebtReminderErrorMessage("")}
              onCancel={() => {
                setDebtReminderErrorMessage("");
                setDebtReminderPickerHasExisting(false);
                setDebtReminderPickerParticipantId("");
              }}
              onRemove={
                debtReminderPickerHasExisting
                  ? () => {
                      void clearParticipantDebtReminder(
                        record.id,
                        debtReminderPickerPerson.participantId,
                      )
                        .then(() => {
                          setDebtReminderErrorMessage("");
                          setDebtReminderPickerHasExisting(false);
                          setDebtReminderPickerParticipantId("");
                          setReminderToastMessage(t("reminders.removed"));
                        })
                        .catch(() => {
                          setDebtReminderErrorMessage(t("reminders.removeFailed"));
                        });
                    }
                  : undefined
              }
              onSave={(scheduledForIso) => {
                void handleSaveDebtReminder(
                  debtReminderPickerPerson.participantId,
                  scheduledForIso,
                );
              }}
            />
          ) : null}
          <ToastNotice
            message={reminderToastMessage}
            bottomOffset={footerInsetBottom + 12}
          />
          {showResultsActions ? (
            <ActionIconGridModal
              title={t("flow.results.actionsTitle")}
              options={actionOptions}
              onDismiss={() => {
                setShowResultsActions(false);
              }}
            />
          ) : null}
        </>
      )}
      footer={
          <MeasuredFloatingFooter onMeasuredHeight={onMeasuredHeight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("flow.results.actionsCtaA11y")}
              style={screenStyles.resultsPrimaryButton}
              onPress={() => setShowResultsActions(true)}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Share2 color={PALETTE.onPrimary} size={18} />
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={15}
                  color={PALETTE.onPrimary}
                >
                  {t("flow.results.actionsCta")}
                </Text>
              </XStack>
            </Pressable>
          </MeasuredFloatingFooter>
        }
      >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
      >
        <FlowScreenHeader
          title={t("flow.results.title")}
          onBack={() => router.replace(`/split/${draftId}/overview`)}
        />
      </View>
      <View style={screenStyles.participantsScrollContent}>
        <YStack gap="$5">
          <View style={screenStyles.resultsHeroCard}>
            <View style={screenStyles.resultsHeroGlow} />
            <YStack gap="$2">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color="rgba(255,255,255,0.78)"
                textTransform="uppercase"
                letterSpacing={1.8}
              >
                {trackPaymentsEnabled ? t("flow.results.totalSettled") : t("flow.results.totalBill")}
              </Text>
              {trackPaymentsEnabled ? (
                <XStack alignItems="flex-end" gap="$2.5" flexWrap="wrap">
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={32}
                    color={PALETTE.onPrimary}
                    letterSpacing={-1.2}
                  >
                    {money(settledOwedCents)}
                  </Text>
                  <Text
                    fontFamily={FONTS.headlineBold}
                    fontSize={20}
                    color="rgba(255,255,255,0.82)"
                  >
                    /
                    {money(totalOwedCents)}
                  </Text>
                </XStack>
              ) : (
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={32}
                  color={PALETTE.onPrimary}
                  letterSpacing={-1.2}
                >
                  {money(settlement.data.totalCents)}
                </Text>
              )}
            </YStack>
            {trackPaymentsEnabled ? (
              <View style={screenStyles.resultsProgressTrack}>
                <View
                  style={[
                    screenStyles.resultsProgressFill,
                    { width: `${settlementProgressPercent}%` },
                  ]}
                />
              </View>
            ) : null}
            <XStack alignItems="center" gap="$2.5" paddingTop="$3">
              {trackPaymentsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    allPaid ? t("flow.results.revertMarkPaidA11y") : t("flow.results.markPaidA11y")
                  }
                  style={screenStyles.resultsHeroChip}
                  onPress={() =>
                    void runPaymentAction(
                      allPaid ? revertBillPaid : markBillPaid,
                      t("flow.results.markPaidFailed"),
                    )
                  }
                >
                  {allPaid ? (
                    <RotateCcw color={PALETTE.primary} size={12} />
                  ) : (
                    <Check color={PALETTE.primary} size={12} />
                  )}
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={11}
                    color={PALETTE.primary}
                  >
                    {allPaid ? t("flow.results.revertMarkPaid") : t("flow.results.markPaid")}
                  </Text>
                </Pressable>
              ) : null}
            </XStack>
          </View>
          <View style={screenStyles.reviewStickySeparator} />
        </YStack>
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingTop: 14,
            paddingBottom: footerInsetBottom,
            gap: 22,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <YStack gap="$3">
            <Text
              fontFamily={FONTS.headlineBold}
              fontSize={14}
              color={PALETTE.onSurface}
              letterSpacing={-0.2}
            >
              {t("flow.results.paidBy")}
            </Text>
            <View style={screenStyles.resultsPaidCard}>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <XStack alignItems="center" gap="$3" flex={1}>
                  <ParticipantAvatar
                    name={payer.name}
                    ownerName={settings.ownerName}
                    ownerProfileImageUri={settings.ownerProfileImageUri}
                    style={screenStyles.resultsAvatar}
                    label={`Results avatar ${payer.name}`}
                  />
                  <YStack flex={1}>
                    <Text
                      fontFamily={FONTS.headlineBold}
                      fontSize={18}
                      color={PALETTE.onSurface}
                    >
                      {getParticipantDisplayName(
                        payer.name,
                        settings.ownerName,
                      )}
                    </Text>
                  </YStack>
                </XStack>
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={24}
                  color={PALETTE.primary}
                >
                  {money(payerConsumedCents)}
                </Text>
              </XStack>
            </View>
          </YStack>

          <YStack gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={14}
                color={PALETTE.onSurface}
                letterSpacing={-0.2}
              >
                {t("flow.results.breakdown")}
              </Text>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={12}
                color={PALETTE.onSurfaceVariant}
              >
                {t("flow.results.contributors", { count: settlement.data.people.length })}
              </Text>
            </XStack>
            <YStack gap="$3">
              {owingPeople.map((person) => {
                const isSettled = settledParticipantIds.has(person.participantId);
                const togglePaidA11yLabel = isSettled
                  ? t("flow.results.togglePaidAddBackA11y", { name: person.name })
                  : t("flow.results.togglePaidSettleA11y", { name: person.name });
                const reminderLabel = getDebtReminderLabel(person.participantId);
                const rowContent = (
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <XStack alignItems="center" gap="$3" flex={1}>
                      <ParticipantAvatar
                        name={person.name}
                        ownerName={settings.ownerName}
                        ownerProfileImageUri={settings.ownerProfileImageUri}
                        style={screenStyles.resultsAvatar}
                        label={`Results avatar ${person.name}`}
                      />
                      <YStack flex={1}>
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={17}
                          color={PALETTE.onSurface}
                        >
                          {getParticipantDisplayName(
                            person.name,
                            settings.ownerName,
                          )}
                        </Text>
                        {reminderLabel ? (
                          <XStack alignItems="center" gap="$1.5" marginTop="$1">
                            <Bell color={PALETTE.primary} size={11} />
                            <Text
                              fontFamily={FONTS.bodyBold}
                              fontSize={11}
                              color={PALETTE.primary}
                            >
                              {reminderLabel}
                            </Text>
                          </XStack>
                        ) : null}
                      </YStack>
                    </XStack>
                    <XStack alignItems="center" gap="$2.5">
                      <YStack alignItems="flex-end" gap="$1">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={20}
                          color={PALETTE.primary}
                          textDecorationLine={
                            trackPaymentsEnabled && isSettled
                              ? "line-through"
                              : "none"
                          }
                        >
                          {money(Math.abs(person.netCents))}
                        </Text>
                        {trackPaymentsEnabled && isSettled ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={12}
                            color={PALETTE.success}
                            textTransform="uppercase"
                            letterSpacing={1.6}
                          >
                            {t("flow.results.settled")}
                          </Text>
                        ) : trackPaymentsEnabled ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={12}
                            color={PALETTE.primary}
                            textTransform="uppercase"
                            letterSpacing={1.6}
                          >
                            {t("flow.results.owed")}
                          </Text>
                        ) : null}
                      </YStack>
                      {trackPaymentsEnabled ? (
                        <View
                          style={[
                            screenStyles.resultsCheckBubble,
                            isSettled
                              ? screenStyles.resultsCheckBubbleSettled
                              : null,
                          ]}
                        >
                          {isSettled ? (
                            <Minus color={PALETTE.onPrimary} size={14} />
                          ) : (
                            <Check color={PALETTE.onPrimary} size={14} />
                          )}
                        </View>
                      ) : null}
                    </XStack>
                  </XStack>
                );

                if (!trackPaymentsEnabled) {
                  return (
                    <Pressable
                      key={person.participantId}
                      accessibilityRole="button"
                      accessibilityHint={t("reminders.actionsTitle")}
                      style={[
                        screenStyles.resultsBreakdownCard,
                        isSettled
                          ? screenStyles.resultsBreakdownCardSettled
                          : null,
                      ]}
                      onLongPress={() => {
                        setDebtReminderErrorMessage("");
                        setDebtReminderPickerHasExisting(
                          Boolean(
                            record.reminderState?.participantDebtReminders?.[
                              person.participantId
                            ],
                          ),
                        );
                        setDebtReminderPickerParticipantId(person.participantId);
                      }}
                    >
                      {rowContent}
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={person.participantId}
                    accessibilityRole="button"
                    accessibilityHint={togglePaidA11yLabel}
                    style={[
                      screenStyles.resultsBreakdownCard,
                      isSettled
                        ? screenStyles.resultsBreakdownCardSettled
                        : null,
                    ]}
                    onPress={() =>
                      void runPaymentAction(
                        () => toggleParticipantPaid(person.participantId),
                        t("flow.results.togglePaidFailed", { name: person.name }),
                      )
                    }
                    onLongPress={() => {
                      setDebtReminderErrorMessage("");
                      setDebtReminderPickerHasExisting(
                        Boolean(
                          record.reminderState?.participantDebtReminders?.[
                            person.participantId
                          ],
                        ),
                      );
                      setDebtReminderPickerParticipantId(person.participantId);
                    }}
                  >
                    {rowContent}
                  </Pressable>
                );
              })}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}
