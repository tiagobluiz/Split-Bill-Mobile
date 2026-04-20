import { useEffect, useRef } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { Check, FileJson, Minus, RotateCcw, Share2 } from "lucide-react-native";
import { Text as TamaguiText, XStack as TamaguiXStack, YStack as TamaguiYStack } from "tamagui";

import { AppScreen, EmptyState, FloatingFooter } from "../../../../components/ui";
import { formatMoney } from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getClipboardSummaryPreview, getPdfExportPreview, getSettlementPreview, useSplitStore } from "../../store";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { getParticipantDisplayName } from "../shared/participantUtils";
import { ParticipantAvatar } from "../shared/participantComponents";
import { getOwingPeople, getSettledParticipantIds } from "../shared/settlementUtils";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function ResultsScreenView({ draftId }: { draftId: string }) {
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
  const settlement = getSettlementPreview(record);
  const summary = getClipboardSummaryPreview(record);
  const locale = getDeviceLocale();

  useEffect(() => {
    if (!record || !settlement?.ok || !summary || record.status === "completed" || hasAutoCompletedRef.current === record.id) {
      return;
    }
    void (async () => {
      try {
        await markCompleted();
        hasAutoCompletedRef.current = record.id;
      } catch (error) {
        console.warn("Failed to auto-complete draft before results render", error);
      }
    })();
  }, [markCompleted, record, settlement, summary]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  if (!settlement?.ok || !summary) {
    return (
      <AppScreen scroll={false}>
        <EmptyState title="Split invalid" description="The final results screen only opens when the current draft passes all settlement rules." />
      </AppScreen>
    );
  }

  const payer = settlement.data.people.find((person) => person.isPayer)!;
  const owingPeople = getOwingPeople(settlement.data.people);
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
  const trackPaymentsEnabled = settings.trackPaymentsFeatureEnabled ?? true;
  const runPaymentAction = async (action: () => Promise<void>, failureMessage: string) => {
    try {
      await action();
    } catch (error) {
      console.warn(failureMessage, error);
      Alert.alert("Update failed", failureMessage);
    }
  };

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
              onPress={async () => {
                if (pdfData) {
                  try {
                    await Clipboard.setStringAsync(JSON.stringify(pdfData, null, 2));
                    Alert.alert("Copied", "PDF preview JSON copied to clipboard.");
                  } catch {
                    Alert.alert("Copy failed", "Could not copy PDF preview JSON.");
                  }
                  return;
                }
                Alert.alert("Unavailable", "PDF preview data is not available for this split.");
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
                {trackPaymentsEnabled ? "Total settled" : "Total bill"}
              </Text>
              {trackPaymentsEnabled ? (
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
            {trackPaymentsEnabled ? (
              <View style={screenStyles.resultsProgressTrack}>
                <View style={[screenStyles.resultsProgressFill, { width: `${settlementProgressPercent}%` }]} />
              </View>
            ) : null}
            <XStack alignItems="center" gap="$2.5" paddingTop="$3">
              {trackPaymentsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={allPaid ? "Revert Mark as Paid" : "Mark as Paid"}
                  style={screenStyles.resultsHeroChip}
                  onPress={() =>
                    void runPaymentAction(
                      allPaid ? revertBillPaid : markBillPaid,
                      "Could not update the bill payment status."
                    )
                  }
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
                    trackPaymentsEnabled && settledParticipantIds.has(person.participantId) ? screenStyles.resultsBreakdownCardSettled : null,
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
                          textDecorationLine={trackPaymentsEnabled && settledParticipantIds.has(person.participantId) ? "line-through" : "none"}
                        >
                          {formatMoney(Math.abs(person.netCents), settlement.data.currency, locale)}
                        </Text>
                        {trackPaymentsEnabled && settledParticipantIds.has(person.participantId) ? (
                          <Text
                            fontFamily={FONTS.bodyBold}
                            fontSize={12}
                            color={PALETTE.secondary}
                            textTransform="uppercase"
                            letterSpacing={1.6}
                          >
                            Settled
                          </Text>
                        ) : trackPaymentsEnabled ? (
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
                      {trackPaymentsEnabled ? (
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
                          onPress={() =>
                            void runPaymentAction(
                              () => toggleParticipantPaid(person.participantId),
                              `Could not update ${person.name}'s payment status.`
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
    </AppScreen>
  );
}
