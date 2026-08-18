import type { ComponentProps } from "react";
import { Animated, Pressable, ScrollView, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { ArrowRight, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  FooterBubble,
  MeasuredFloatingFooter,
} from "../../../../components/ui";
import { formatMoney, parseMoneyToCents } from "../../../../domain";
import { useTranslation } from "../../../../i18n/provider";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { FlowContinueButton, ModeToggle } from "../shared/components";
import { FlowScreenHeader } from "../shared/flowComponents";
import { SplitNoticeModal } from "../shared/modals";
import { ParticipantAvatar } from "../shared/participantComponents";
import {
  getParticipantDisplayName,
  sortParticipantsByName,
} from "../shared/participantUtils";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const SPLIT_COMPACT_HEADER_SHOW_OFFSET = 6;
const SPLIT_COMPACT_HEADER_HIDE_OFFSET = 18;

type DraftItem = DraftRecord["values"]["items"][number];

type SplitItemViewProps = {
  record: DraftRecord;
  item: DraftItem;
  settings: {
    ownerName: string;
    ownerProfileImageUri?: string;
  };
  splitNoticeMessages: string[];
  onDismissSplitNotice: () => void;
  onMeasuredHeight: ComponentProps<typeof MeasuredFloatingFooter>["onMeasuredHeight"];
  splitFooterInsetBottom: number;
  headerHeight: number;
  onHeaderHeightMeasured: (nextHeaderHeight: number) => void;
  summaryBottomY: number;
  onSummaryBottomMeasured: (nextSummaryBottom: number) => void;
  compactHeaderAnimatedValue: Animated.Value;
  isCompactHeaderVisible: boolean;
  onCompactHeaderVisibilityChange: (
    updater: (current: boolean) => boolean,
  ) => void;
  onCompactHeaderHidden: () => void;
  itemNameLabel: string;
  itemPriceLabel: string;
  itemCategoryLabel: string;
  ctaLabel: string;
  isSplitReady: boolean;
  onConfirmSplit: () => void;
  canSkipItem: boolean;
  onSkipItem: () => void;
  onBack: () => void;
  locale: string;
  assignedCount: number;
  evenShareDisplayCents: number;
  totalShares: number;
  shareValue: number;
  totalPercent: number;
  displayTotalPercent: string;
  percentSliderResetKey: number;
  setSplitMode: (splitMode: "even" | "shares" | "percent") => void;
  includeAllWorkingSplit: () => void;
  excludeAllWorkingSplit: () => void;
  incrementShares: (participantId: string, delta: number) => void;
  toggleEvenIncluded: (participantId: string) => void;
  setWorkingPercentValue: (
    participantId: string,
    nextValue: string,
    options?: { clampToRemaining?: boolean },
  ) => Promise<void>;
  finalizeWorkingPercentValue: (participantId: string) => void;
  getRemainingPercentForParticipant: (participantId: string) => number;
};

export function SplitItemView({
  record,
  item,
  settings,
  splitNoticeMessages,
  onDismissSplitNotice,
  onMeasuredHeight,
  splitFooterInsetBottom,
  headerHeight,
  onHeaderHeightMeasured,
  summaryBottomY,
  onSummaryBottomMeasured,
  compactHeaderAnimatedValue,
  isCompactHeaderVisible,
  onCompactHeaderVisibilityChange,
  onCompactHeaderHidden,
  itemNameLabel,
  itemPriceLabel,
  itemCategoryLabel,
  ctaLabel,
  isSplitReady,
  onConfirmSplit,
  canSkipItem,
  onSkipItem,
  onBack,
  locale,
  assignedCount,
  evenShareDisplayCents,
  totalShares,
  shareValue,
  totalPercent,
  displayTotalPercent,
  percentSliderResetKey,
  setSplitMode,
  includeAllWorkingSplit,
  excludeAllWorkingSplit,
  incrementShares,
  toggleEvenIncluded,
  setWorkingPercentValue,
  finalizeWorkingPercentValue,
  getRemainingPercentForParticipant,
}: SplitItemViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sortedParticipants = sortParticipantsByName(record.values.participants);

  return (
    <AppScreen
      scroll={false}
      overlay={(
        <SplitNoticeModal
          messages={splitNoticeMessages}
          onDismiss={onDismissSplitNotice}
        />
      )}
      footer={
        <MeasuredFloatingFooter onMeasuredHeight={onMeasuredHeight}>
          <FooterBubble>
            <YStack gap="$3" style={screenStyles.splitFooterContent}>
              {canSkipItem ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.splitItem.skipA11y")}
                  onPress={onSkipItem}
                  style={screenStyles.splitSkipCornerButton}
                >
                  <XStack alignItems="center" justifyContent="center" gap="$1">
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={12}
                      color={PALETTE.primary}
                      textAlign="center"
                    >
                      {t("flow.splitItem.skip")}
                    </Text>
                    <ArrowRight color={PALETTE.primary} size={14} />
                  </XStack>
                </Pressable>
              ) : null}
              {item.splitMode === "even" ? (
                <YStack style={screenStyles.splitFooterInlineSummary}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={10}
                    color={PALETTE.onSurfaceVariant}
                    textTransform="uppercase"
                    letterSpacing={2.1}
                  >
                    {t("flow.splitItem.splitBy")}
                  </Text>
                  <XStack alignItems="flex-end" justifyContent="space-between" gap="$3">
                    <Text
                      fontFamily={FONTS.headlineBlack}
                      fontSize={30}
                      color={PALETTE.onSurface}
                      letterSpacing={-1.1}
                    >
                      {assignedCount}
                    </Text>
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={14}
                      color={PALETTE.onSurfaceVariant}
                    >
                      {t("flow.splitItem.shareRate", {
                        amount: formatMoney(
                          evenShareDisplayCents,
                          record.values.currency,
                          locale,
                        ),
                      })}
                    </Text>
                  </XStack>
                </YStack>
              ) : null}
              {item.splitMode === "shares" ? (
                <YStack style={screenStyles.splitFooterInlineSummary}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={10}
                    color={PALETTE.onSurfaceVariant}
                    textTransform="uppercase"
                    letterSpacing={2.1}
                  >
                    {t("flow.splitItem.totalShares")}
                  </Text>
                  <XStack alignItems="flex-end" justifyContent="space-between" gap="$3">
                    <Text
                      fontFamily={FONTS.headlineBlack}
                      fontSize={30}
                      color={PALETTE.onSurface}
                      letterSpacing={-1.1}
                    >
                      {totalShares}
                    </Text>
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={14}
                      color={PALETTE.onSurfaceVariant}
                    >
                      {t("flow.splitItem.shareRate", {
                        amount: formatMoney(
                          Math.round(shareValue),
                          record.values.currency,
                          locale,
                        ),
                      })}
                    </Text>
                  </XStack>
                </YStack>
              ) : null}
              {item.splitMode === "percent" ? (
                <YStack style={screenStyles.splitFooterInlineSummary}>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={10}
                    color={PALETTE.onSurfaceVariant}
                    textTransform="uppercase"
                    letterSpacing={2.1}
                  >
                    {t("flow.splitItem.mode.percent")}
                  </Text>
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={30}
                    color={PALETTE.onSurface}
                    letterSpacing={-1.1}
                  >
                    {t("flow.splitItem.totalPercent", { percent: displayTotalPercent })}
                  </Text>
                </YStack>
              ) : null}
              <FlowContinueButton
                label={ctaLabel}
                disabled={!isSplitReady}
                onPress={onConfirmSplit}
              />
            </YStack>
          </FooterBubble>
        </MeasuredFloatingFooter>
      }
    >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
        onLayout={({ nativeEvent }) => {
          onHeaderHeightMeasured(nativeEvent.layout.height);
        }}
      >
        <FlowScreenHeader
          title={t("flow.splitItem.title")}
          onBack={onBack}
        />
      </View>
      <Animated.View
        testID="split-item-compact-header"
        pointerEvents={isCompactHeaderVisible ? "auto" : "none"}
        accessibilityElementsHidden={!isCompactHeaderVisible}
        importantForAccessibility={
          isCompactHeaderVisible ? "auto" : "no-hide-descendants"
        }
        style={[
          screenStyles.splitCompactHeaderOverlay,
          {
            top: headerHeight,
            opacity: compactHeaderAnimatedValue,
            transform: [
              {
                translateY: compactHeaderAnimatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={screenStyles.splitCompactHeaderCard}>
          <View style={screenStyles.splitCompactHeaderRow} testID="split-item-compact-header-row-1">
            <Text
              testID="split-item-compact-header-name"
              fontFamily={FONTS.headlineBold}
              fontSize={16}
              color={PALETTE.onSurface}
              numberOfLines={2}
              ellipsizeMode="tail"
              flex={1}
            >
              {itemNameLabel}
            </Text>
            <Text
              testID="split-item-compact-header-price"
              fontFamily={FONTS.headlineBold}
              fontSize={16}
              color={PALETTE.primary}
            >
              {itemPriceLabel}
            </Text>
          </View>
          <View
            style={screenStyles.splitCompactHeaderRow}
            testID="split-item-compact-header-row-2"
          >
            <Text
              testID="split-item-compact-header-category"
              fontFamily={FONTS.bodyBold}
              fontSize={11}
              color={PALETTE.onSurfaceVariant}
              textTransform="uppercase"
              letterSpacing={1.6}
              numberOfLines={1}
            >
              {itemCategoryLabel}
            </Text>
          </View>
        </View>
      </Animated.View>
      <View style={screenStyles.splitScrollViewport}>
        <ScrollView
          testID="split-item-scroll"
          style={screenStyles.flex}
          keyboardShouldPersistTaps="handled"
          onScroll={({ nativeEvent }) => {
            if (summaryBottomY <= 0) {
              if (isCompactHeaderVisible) {
                onCompactHeaderHidden();
              }
              return;
            }

            const scrollY = nativeEvent.contentOffset.y;
            const showThreshold =
              summaryBottomY + SPLIT_COMPACT_HEADER_SHOW_OFFSET;
            const hideThreshold = Math.max(
              0,
              summaryBottomY - SPLIT_COMPACT_HEADER_HIDE_OFFSET,
            );

            onCompactHeaderVisibilityChange((current) => {
              if (current) {
                return scrollY > hideThreshold;
              }

              return scrollY >= showThreshold;
            });
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            screenStyles.participantsScrollContent,
            {
              paddingBottom: splitFooterInsetBottom,
              gap: 22,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <YStack gap="$5">
            <YStack
              testID="split-item-summary"
              gap="$2"
              alignItems="center"
              onLayout={(event: any) => {
                const { nativeEvent } = event;
                const nextSummaryBottom =
                  nativeEvent.layout.y + nativeEvent.layout.height;
                onSummaryBottomMeasured(nextSummaryBottom);
              }}
            >
              <View style={screenStyles.splitCategoryPill}>
                <Text
                  testID="split-item-summary-category"
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.8}
                >
                  {itemCategoryLabel}
                </Text>
              </View>
              <Text
                testID="split-item-summary-name"
                fontFamily={FONTS.headlineBlack}
                fontSize={34}
                color={PALETTE.onSurface}
                textAlign="center"
                letterSpacing={-1.4}
                numberOfLines={3}
              >
                {itemNameLabel}
              </Text>
              <Text
                testID="split-item-summary-price"
                fontFamily={FONTS.headlineBold}
                fontSize={24}
                color={PALETTE.primary}
              >
                {itemPriceLabel}
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
                    accessibilityLabel={t("flow.splitItem.includeAllA11y")}
                    onPress={includeAllWorkingSplit}
                    style={[
                      screenStyles.splitHeaderSegment,
                      screenStyles.splitHeaderSegmentLeft,
                    ]}
                  >
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={13}
                      color={PALETTE.primary}
                      textTransform="uppercase"
                    >
                      {t("flow.splitItem.all")}
                    </Text>
                  </Pressable>
                  <View style={screenStyles.splitHeaderSegmentDivider} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("flow.splitItem.excludeAllA11y")}
                    onPress={excludeAllWorkingSplit}
                    style={[
                      screenStyles.splitHeaderSegment,
                      screenStyles.splitHeaderSegmentRight,
                    ]}
                  >
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={13}
                      color={PALETTE.onSurface}
                      textTransform="uppercase"
                    >
                      {t("flow.splitItem.none")}
                    </Text>
                  </Pressable>
                </View>
              </XStack>

              <YStack gap="$4">
                {sortedParticipants.map((participant) => {
                  const allocation = item.allocations.find(
                    (entry) => entry.participantId === participant.id,
                  );
                  if (!allocation) {
                    return null;
                  }

                  const portionCents =
                    item.splitMode === "even" &&
                    assignedCount > 0 &&
                    allocation.evenIncluded
                      ? Math.floor(
                          (parseMoneyToCents(item.price) ?? 0) /
                            Math.max(assignedCount, 1),
                        )
                      : 0;
                  const shareCount = parseFloat(allocation.shares) || 0;
                  const percentValue = parseFloat(allocation.percent) || 0;
                  const remainingPercentForParticipant =
                    getRemainingPercentForParticipant(participant.id);
                  const canAssignRemaining =
                    item.splitMode === "percent" &&
                    remainingPercentForParticipant > percentValue + 0.001 &&
                    totalPercent < 99.99;

                  const participantControls = (
                    <>
                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$3"
                      >
                        <XStack alignItems="center" gap="$3" flex={1}>
                          <ParticipantAvatar
                            name={participant.name}
                            ownerName={settings.ownerName}
                            ownerProfileImageUri={settings.ownerProfileImageUri}
                            style={screenStyles.splitAvatar}
                            label={`Split avatar ${participant.name}`}
                          />
                          <YStack flex={1} gap="$1">
                            <Text
                              fontFamily={FONTS.headlineBold}
                              fontSize={18}
                              color={PALETTE.onSurface}
                              numberOfLines={2}
                            >
                              {getParticipantDisplayName(
                                participant.name,
                                settings.ownerName,
                              )}
                            </Text>
                            {item.splitMode === "even" ? (
                              <Text
                                fontFamily={FONTS.bodyMedium}
                                fontSize={13}
                                color={PALETTE.onSurfaceVariant}
                              >
                                {allocation.evenIncluded
                                  ? t("flow.splitItem.portion", {
                                      amount: formatMoney(
                                        portionCents,
                                        record.values.currency,
                                        locale,
                                      ),
                                    })
                                  : t("flow.splitItem.tapToInclude")}
                              </Text>
                            ) : item.splitMode === "shares" ? (
                              <Text
                                fontFamily={FONTS.bodyMedium}
                                fontSize={13}
                                color={PALETTE.onSurfaceVariant}
                              >
                                {t("flow.splitItem.portion", {
                                  amount: formatMoney(
                                    Math.round(
                                      totalShares > 0
                                        ? ((parseMoneyToCents(item.price) ?? 0) *
                                            shareCount) /
                                            totalShares
                                        : 0,
                                    ),
                                    record.values.currency,
                                    locale,
                                  ),
                                })}
                              </Text>
                            ) : null}
                          </YStack>
                        </XStack>

                        {item.splitMode === "even" ? (
                          <View
                            style={[
                              allocation.evenIncluded
                                ? screenStyles.payerSelectedIndicator
                                : screenStyles.payerUnselectedIndicator,
                              { pointerEvents: "none" },
                            ]}
                          >
                            {allocation.evenIncluded ? (
                              <Check color={PALETTE.onPrimary} size={16} />
                            ) : null}
                          </View>
                        ) : null}

                        {item.splitMode === "shares" ? (
                          <XStack alignItems="center" gap="$2.5">
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                "flow.splitItem.decreaseSharesA11y",
                                { name: participant.name },
                              )}
                              onPress={() => incrementShares(participant.id, -1)}
                              style={screenStyles.splitStepperButton}
                            >
                              <Text
                                fontFamily={FONTS.headlineBold}
                                fontSize={18}
                                color={PALETTE.primary}
                              >
                                -
                              </Text>
                            </Pressable>
                            <View style={screenStyles.splitStepperValue}>
                              <Text
                                fontFamily={FONTS.headlineBold}
                                fontSize={20}
                                color={PALETTE.onSurface}
                              >
                                {shareCount}
                              </Text>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                "flow.splitItem.increaseSharesA11y",
                                { name: participant.name },
                              )}
                              onPress={() => incrementShares(participant.id, 1)}
                              style={[
                                screenStyles.splitStepperButton,
                                screenStyles.splitStepperButtonActive,
                              ]}
                            >
                              <Text
                                fontFamily={FONTS.headlineBold}
                                fontSize={18}
                                color={PALETTE.onPrimary}
                              >
                                +
                              </Text>
                            </Pressable>
                          </XStack>
                        ) : null}

                        {item.splitMode === "percent" ? (
                          <View style={screenStyles.percentValueShell}>
                            {canAssignRemaining ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                  "flow.splitItem.useRemainingPercentA11y",
                                  { name: participant.name },
                                )}
                                onPress={() =>
                                  void setWorkingPercentValue(
                                    participant.id,
                                    String(remainingPercentForParticipant),
                                  )
                                }
                                style={screenStyles.percentRemainderIcon}
                              >
                                <Text
                                  fontFamily={FONTS.headlineBold}
                                  fontSize={15}
                                  color={PALETTE.primary}
                                >
                                  &gt;&gt;
                                </Text>
                              </Pressable>
                            ) : null}
                            <TextInput
                              accessibilityLabel={t(
                                "flow.splitItem.percentA11y",
                                { name: participant.name },
                              )}
                              value={allocation.percent}
                              onChangeText={(value) =>
                                void setWorkingPercentValue(participant.id, value)
                              }
                              onBlur={() =>
                                finalizeWorkingPercentValue(participant.id)
                              }
                              onSubmitEditing={() =>
                                finalizeWorkingPercentValue(participant.id)
                              }
                              placeholder="0"
                              placeholderTextColor={PALETTE.primary}
                              keyboardType="decimal-pad"
                              style={screenStyles.percentValueInput}
                            />
                            <Text
                              fontFamily={FONTS.headlineBold}
                              fontSize={18}
                              color={PALETTE.primary}
                            >
                              %
                            </Text>
                          </View>
                        ) : null}
                      </XStack>

                      {item.splitMode === "percent" ? (
                        <YStack gap="$2.5" paddingTop="$2">
                          <Slider
                            key={`percent-slider-${participant.id}-${percentSliderResetKey}`}
                            accessibilityLabel={t(
                              "flow.splitItem.percentSliderA11y",
                              { name: participant.name },
                            )}
                            minimumValue={0}
                            maximumValue={100}
                            step={1}
                            value={Math.max(0, Math.min(percentValue, 100))}
                            minimumTrackTintColor={PALETTE.primary}
                            maximumTrackTintColor={PALETTE.track}
                            thumbTintColor={PALETTE.primary}
                            onValueChange={(value) =>
                              void setWorkingPercentValue(
                                participant.id,
                                String(value),
                                { clampToRemaining: true },
                              )
                            }
                          />
                          <XStack justifyContent="space-between">
                            <Text
                              fontFamily={FONTS.bodyMedium}
                              fontSize={11}
                              color={PALETTE.onSurfaceVariant}
                            >
                              {formatMoney(0, record.values.currency, locale)}
                            </Text>
                            <Text
                              fontFamily={FONTS.bodyBold}
                              fontSize={11}
                              color={PALETTE.onSurfaceVariant}
                            >
                              {t("flow.splitItem.allocated", {
                                amount: formatMoney(
                                  Math.round(
                                    ((parseMoneyToCents(item.price) ?? 0) *
                                      percentValue) /
                                      100,
                                  ),
                                  record.values.currency,
                                  locale,
                                ),
                              })}
                            </Text>
                            <Text
                              fontFamily={FONTS.bodyMedium}
                              fontSize={11}
                              color={PALETTE.onSurfaceVariant}
                            >
                              {formatMoney(
                                parseMoneyToCents(item.price) ?? 0,
                                record.values.currency,
                                locale,
                              )}
                            </Text>
                          </XStack>
                        </YStack>
                      ) : null}
                    </>
                  );

                  return (
                    <View
                      key={participant.id}
                      style={screenStyles.splitParticipantCard}
                    >
                      {participantControls}
                      {item.splitMode === "even" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("flow.splitItem.toggleEvenA11y", {
                            name: participant.name,
                          })}
                          onPress={() => toggleEvenIncluded(participant.id)}
                          style={screenStyles.splitParticipantOverlayPressable}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </YStack>
            </YStack>
          </YStack>
        </ScrollView>
      </View>
    </AppScreen>
  );
}
