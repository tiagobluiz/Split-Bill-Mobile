import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowRight, Check } from "lucide-react-native";
import { Text as TamaguiText, XStack as TamaguiXStack, YStack as TamaguiYStack } from "tamagui";

import { AppScreen, EmptyState, FloatingFooter, PrimaryButton, SectionEyebrow } from "../../../../components/ui";
import {
  computeSettlement,
  formatMoney,
  parseMoneyToCents,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getAssignedParticipantCount, isItemAssigned, isVisibleItem } from "../shared/recordUtils";
import { SplitNoticeModal } from "../shared/modals";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function ReviewScreenView({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const insets = useSafeAreaInsets();
  const settlement = useMemo(() => {
    if (!record) {
      return null;
    }

    return computeSettlement(record.values);
  }, [record]);
  const [reviewNoticeMessages, setReviewNoticeMessages] = useState<string[]>([]);
  const [reviewViewportHeight, setReviewViewportHeight] = useState(0);
  const [reviewContentHeight, setReviewContentHeight] = useState(0);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const visibleItems = record.values.items.filter(isVisibleItem);
  const assignedItems = visibleItems.filter(isItemAssigned);
  const assignedCount = assignedItems.length;
  const progressPercent = visibleItems.length > 0 ? Math.round((assignedCount / visibleItems.length) * 100) : 0;
  const errors = [
    ...validateStepOne(record.values),
    ...validateStepTwo(record.values),
    ...validateStepThree(record.values),
  ].map((error) => error.message);
  const locale = getDeviceLocale();
  const isReviewScrollable = reviewContentHeight > reviewViewportHeight + 1;

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <PrimaryButton
            label="Show Results"
            icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
            onPress={() => {
              if (errors.length > 0 || !settlement?.ok) {
                setReviewNoticeMessages(["There are still items left to split before you can see the results."]);
                return;
              }
              router.push(`/split/${draftId}/results`);
            }}
          />
        </FloatingFooter>
      }
    >
      <ScrollView
        testID="review-scroll"
        style={screenStyles.flex}
        scrollEnabled={isReviewScrollable}
        stickyHeaderIndices={[0]}
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
        <View style={[screenStyles.stickyReviewHeaderWrap, { paddingTop: Math.max(insets.top + 10, 28) }]}>
          <YStack gap="$5">
            <FlowScreenHeader title="Review Items" onBack={() => router.replace(`/split/${draftId}/items`)} />
            <View style={screenStyles.itemsImportCard}>
              <SectionEyebrow>Current progress</SectionEyebrow>
              <XStack alignItems="flex-end" justifyContent="space-between" gap="$3" marginTop="$2">
                <YStack>
                  <Text fontFamily={FONTS.headlineBlack} fontSize={34} lineHeight={36} color={PALETTE.primary}>
                    {progressPercent}%
                  </Text>
                  <Text fontFamily={FONTS.headlineBlack} fontSize={26} lineHeight={28} color={PALETTE.primary}>
                    Split
                  </Text>
                </YStack>
                <Text fontFamily={FONTS.bodyMedium} fontSize={15} lineHeight={21} color={PALETTE.onSurfaceVariant} textAlign="right">
                  {assignedCount} of {visibleItems.length} items assigned
                </Text>
              </XStack>
              <View style={screenStyles.reviewProgressTrack}>
                <View style={[screenStyles.reviewProgressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
            <View style={screenStyles.reviewStickySeparator} />
          </YStack>
        </View>

        <View style={screenStyles.reviewListViewport}>
          <YStack gap="$3" style={screenStyles.reviewListContent}>
            {visibleItems.map((item) => {
              const assigned = isItemAssigned(item);
              const itemLabel = item.name.trim() || "Untitled item";

              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/split/${draftId}/split/${item.id}`)}
                  style={[screenStyles.itemsListCard, !assigned ? screenStyles.reviewItemCardPending : null]}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$4">
                    <YStack flex={1} gap="$1.5">
                      <XStack alignItems="center" gap="$2">
                        <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                          {itemLabel}
                        </Text>
                        {assigned ? <Check color={PALETTE.secondary} size={16} /> : <AlertTriangle color={PALETTE.primary} size={16} />}
                      </XStack>
                      <XStack alignItems="center" gap="$2.5" flexWrap="wrap">
                        <Text fontFamily={FONTS.headlineBold} fontSize={16} lineHeight={20} color={PALETTE.primary}>
                          {formatMoney(parseMoneyToCents(item.price) ?? 0, record.values.currency, locale)}
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
                            {`Split by ${getAssignedParticipantCount(item)}`}
                          </Text>
                        ) : null}
                      </XStack>
                    </YStack>
                    {assigned ? (
                      <ArrowRight color={PALETTE.onSurfaceVariant} size={18} />
                    ) : (
                      <View style={screenStyles.reviewAssignButton}>
                        <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.2}>
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
      <SplitNoticeModal messages={reviewNoticeMessages} onDismiss={() => setReviewNoticeMessages([])} />
    </AppScreen>
  );
}
