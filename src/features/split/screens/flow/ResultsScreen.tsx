import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { Check, FileJson, Minus, RotateCcw, Share2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FloatingFooter,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import { formatMoney } from "../../../../domain";
import { exportSettlementPdf } from "../../../../pdf/exportSettlementPdf";
import { getDeviceLocale } from "../../../../lib/device";
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
} from "../shared/settlementUtils";
import { SplitNoticeModal } from "../shared/modals";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

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
  } = useSplitStore(
    useShallow((state) => ({
      markCompleted: state.markCompleted,
      settings: state.settings,
      markBillPaid: state.markBillPaid,
      revertBillPaid: state.revertBillPaid,
      toggleParticipantPaid: state.toggleParticipantPaid,
    })),
  );
  const hasAutoCompletedRef = useRef<string | null>(null);
  const [exportPdfPending, setExportPdfPending] = useState(false);
  const [pdfNoticeMessages, setPdfNoticeMessages] = useState<string[]>([]);
  const settlement = getSettlementPreview(record);
  const summary = getClipboardSummaryPreview(record);
  const locale = getDeviceLocale();

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
        hasAutoCompletedRef.current = record.id;
      } catch (error) {
        console.warn(
          "Failed to auto-complete split before results render",
          error,
        );
      }
    })();
  }, [markCompleted, record, settlement, summary]);

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
        <EmptyState
          title={t("flow.results.invalidTitle")}
          description={t("flow.results.invalidDescription")}
        />
      </AppScreen>
    );
  }

  const payer = settlement.data.people.find((person) => person.isPayer)!;
  const owingPeople = getOwingPeople(settlement.data.people);
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

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <XStack gap="$3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("flow.results.exportPdfA11y")}
              style={screenStyles.resultsSecondaryButton}
              disabled={exportPdfPending}
              onPress={async () => {
                if (!pdfData) {
                  setPdfNoticeMessages([
                    t("flow.results.pdfUnavailable"),
                  ]);
                  return;
                }

                try {
                  setExportPdfPending(true);
                  await exportSettlementPdf(record.values, locale);
                } catch (error) {
                  console.warn("Failed to export split PDF", error);
                  setPdfNoticeMessages([t("flow.results.pdfFailed")]);
                } finally {
                  setExportPdfPending(false);
                }
              }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <FileJson color={PALETTE.onSecondaryContainer} size={18} />
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={15}
                  color={PALETTE.onSecondaryContainer}
                >
                  PDF
                </Text>
              </XStack>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("flow.results.shareA11y")}
              style={screenStyles.resultsPrimaryButton}
              onPress={async () => {
                try {
                  await Share.share({ message: summary });
                } catch (error) {
                  console.warn("Failed to share split results", error);
                  Alert.alert(
                    t("flow.results.shareFailedTitle"),
                    t("flow.results.shareFailedBody"),
                  );
                }
              }}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2.5">
                <Share2 color={PALETTE.onPrimary} size={18} />
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={15}
                  color={PALETTE.onPrimary}
                >
                  {t("flow.results.shareA11y")}
                </Text>
              </XStack>
            </Pressable>
          </XStack>
        </FloatingFooter>
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
                  {formatMoney(
                    settledOwedCents,
                    settlement.data.currency,
                    locale,
                  )}
                </Text>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={20}
                  color="rgba(255,255,255,0.82)"
                >
                  /
                  {formatMoney(
                    totalOwedCents,
                    settlement.data.currency,
                    locale,
                  )}
                </Text>
              </XStack>
            ) : (
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={32}
                color={PALETTE.onPrimary}
                letterSpacing={-1.2}
              >
                {formatMoney(
                  settlement.data.totalCents,
                  settlement.data.currency,
                  locale,
                )}
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
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingTop: 14,
            paddingBottom: 186 + Math.max(insets.bottom, 14),
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
                  {formatMoney(
                    payerConsumedCents,
                    settlement.data.currency,
                    locale,
                  )}
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
              {owingPeople.map((person) => (
                <View
                  key={person.participantId}
                  style={[
                    screenStyles.resultsBreakdownCard,
                    trackPaymentsEnabled &&
                    settledParticipantIds.has(person.participantId)
                      ? screenStyles.resultsBreakdownCardSettled
                      : null,
                  ]}
                >
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
                      </YStack>
                    </XStack>
                    <XStack alignItems="center" gap="$2.5">
                      <YStack alignItems="flex-end" gap="$1">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={20}
                          color={PALETTE.primary}
                          textDecorationLine={
                            trackPaymentsEnabled &&
                            settledParticipantIds.has(person.participantId)
                              ? "line-through"
                              : "none"
                          }
                        >
                          {formatMoney(
                            Math.abs(person.netCents),
                            settlement.data.currency,
                            locale,
                          )}
                        </Text>
                        {trackPaymentsEnabled &&
                        settledParticipantIds.has(person.participantId) ? (
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
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            settledParticipantIds.has(person.participantId)
                              ? t("flow.results.togglePaidAddBackA11y", { name: person.name })
                              : t("flow.results.togglePaidSettleA11y", { name: person.name })
                          }
                          style={[
                            screenStyles.resultsCheckBubble,
                            settledParticipantIds.has(person.participantId)
                              ? screenStyles.resultsCheckBubbleSettled
                              : null,
                          ]}
                          onPress={() =>
                            void runPaymentAction(
                              () => toggleParticipantPaid(person.participantId),
                              t("flow.results.togglePaidFailed", { name: person.name }),
                            )
                          }
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
      <SplitNoticeModal
        messages={pdfNoticeMessages}
        onDismiss={() => setPdfNoticeMessages([])}
      />
    </AppScreen>
  );
}
