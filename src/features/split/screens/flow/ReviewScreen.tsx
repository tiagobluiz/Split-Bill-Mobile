import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowRight, Check } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FloatingFooter,
  SectionEyebrow,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  type StepValidationError,
  computeSettlement,
  formatMoney,
  parseMoneyToCents,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { FlowContinueButton } from "../shared/components";
import {
  getFriendlySplitMessage,
  getAssignedParticipantCount,
  isItemAssigned,
  isVisibleItem,
} from "../shared/recordUtils";
import { SplitNoticeModal } from "../shared/modals";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function ReviewScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const insets = useSafeAreaInsets();
  const settlement = useMemo(() => {
    if (!record) {
      return null;
    }

    return computeSettlement(record.values);
  }, [record]);
  const [reviewNoticeMessages, setReviewNoticeMessages] = useState<string[]>(
    [],
  );
  const [reviewViewportHeight, setReviewViewportHeight] = useState(0);
  const [reviewContentHeight, setReviewContentHeight] = useState(0);

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

  const visibleItems = record.values.items.filter(isVisibleItem);
  const assignedItems = visibleItems.filter(isItemAssigned);
  const assignedCount = assignedItems.length;
  const progressPercent =
    visibleItems.length > 0
      ? Math.round((assignedCount / visibleItems.length) * 100)
      : 0;
  const errors: StepValidationError[] = [
    ...validateStepOne(record.values),
    ...validateStepTwo(record.values),
    ...validateStepThree(record.values),
  ];
  const locale = getDeviceLocale();
  const isReviewScrollable = reviewContentHeight > reviewViewportHeight + 1;

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <FlowContinueButton
            label={t("flow.review.showResults")}
            onPress={() => {
              if (errors.length > 0 || !settlement?.ok) {
                setReviewNoticeMessages([
                  ...new Set(
                    (errors.length > 0
                      ? errors
                      : [{ code: "items-min", message: t("friendly.itemsMin") } as Pick<
                          StepValidationError,
                          "code" | "message"
                        >]
                    ).map((error) => getFriendlySplitMessage(error)),
                  ),
                ]);
                return;
              }
              router.push(`/split/${draftId}/results`);
            }}
          />
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
          title={t("flow.review.title")}
          onBack={() => router.replace(`/split/${draftId}/items`)}
        />
      </View>
      <View style={screenStyles.participantsScrollContent}>
        <YStack gap="$5">
          <View
            style={[screenStyles.itemsImportCard, screenStyles.reviewProgressCard]}
          >
            <SectionEyebrow>{t("flow.review.progress")}</SectionEyebrow>
            <XStack
              alignItems="flex-end"
              justifyContent="space-between"
              gap="$3"
              marginTop="$2"
            >
              <YStack>
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={34}
                  lineHeight={36}
                  color={PALETTE.primary}
                >
                  {progressPercent}%
                </Text>
                <Text
                  fontFamily={FONTS.headlineBlack}
                  fontSize={26}
                  lineHeight={28}
                  color={PALETTE.primary}
                >
                  {t("flow.review.progressLabel")}
                </Text>
              </YStack>
              <Text
                fontFamily={FONTS.bodyMedium}
                fontSize={15}
                lineHeight={21}
                color={PALETTE.onSurfaceVariant}
                textAlign="right"
              >
                {t("flow.review.itemsAssigned", {
                  assigned: assignedCount,
                  total: visibleItems.length,
                })}
              </Text>
            </XStack>
            <View style={screenStyles.reviewProgressTrack}>
              <View
                style={[
                  screenStyles.reviewProgressFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          </View>
          <View style={screenStyles.reviewStickySeparator} />
        </YStack>
      </View>
      <ScrollView
        testID="review-scroll"
        style={screenStyles.flex}
        scrollEnabled={isReviewScrollable}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => {
          setReviewViewportHeight(event.nativeEvent.layout.height);
        }}
        onContentSizeChange={(_, height) => {
          setReviewContentHeight(height);
        }}
      >
        <View style={screenStyles.reviewListViewport}>
          <YStack gap="$3" style={screenStyles.reviewListContent}>
            {visibleItems.map((item) => {
              const assigned = isItemAssigned(item);
              const itemLabel = item.name.trim() || t("flow.splitItem.untitled");

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.review.openItemA11y", {
                    item: itemLabel,
                    status: assigned
                      ? t("flow.review.assigned")
                      : t("flow.review.unassigned"),
                  })}
                  onPress={() =>
                    router.push(`/split/${draftId}/split/${item.id}`)
                  }
                  style={[
                    screenStyles.itemsListCard,
                    !assigned ? screenStyles.reviewItemCardPending : null,
                  ]}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$4"
                  >
                    <YStack flex={1} gap="$1.5">
                      <XStack alignItems="center" gap="$2">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={18}
                          color={PALETTE.onSurface}
                        >
                          {itemLabel}
                        </Text>
                        {assigned ? (
                          <Check color={PALETTE.success} size={16} />
                        ) : (
                          <AlertTriangle color={PALETTE.primary} size={16} />
                        )}
                      </XStack>
                      <XStack alignItems="center" gap="$2.5" flexWrap="wrap">
                        <Text
                          fontFamily={FONTS.headlineBold}
                          fontSize={16}
                          lineHeight={20}
                          color={PALETTE.primary}
                        >
                          {formatMoney(
                            parseMoneyToCents(item.price) ?? 0,
                            record.values.currency,
                            locale,
                          )}
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
                            {t("flow.review.splitBy", {
                              count: getAssignedParticipantCount(item),
                            })}
                          </Text>
                        ) : null}
                      </XStack>
                    </YStack>
                    {assigned ? (
                      <ArrowRight color={PALETTE.onSurfaceVariant} size={18} />
                    ) : (
                      <View style={screenStyles.reviewAssignButton}>
                        <Text
                          fontFamily={FONTS.bodyBold}
                          fontSize={12}
                          color={PALETTE.onPrimary}
                          textTransform="uppercase"
                          letterSpacing={1.2}
                        >
                          Split
                        </Text>
                      </View>
                    )}
                  </XStack>
                </Pressable>
              );
            })}
          </YStack>
        </View>
      </ScrollView>
      <SplitNoticeModal
        messages={reviewNoticeMessages}
        onDismiss={() => setReviewNoticeMessages([])}
      />
    </AppScreen>
  );
}
