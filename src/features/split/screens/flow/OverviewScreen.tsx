import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";
import { Text as TamaguiText, XStack as TamaguiXStack, YStack as TamaguiYStack } from "tamagui";

import {
  AppScreen,
  EmptyState,
  FloatingFooter,
  HeroCard,
  PrimaryButton,
  SectionCard,
  SectionEyebrow,
} from "../../../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  formatMoney,
  validateStepOne,
  validateStepThree,
  validateStepTwo,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";
import { ErrorList } from "../shared/components";
import { FlowScreenHeader } from "../shared/flowComponents";
import { SplitNoticeModal } from "../shared/modals";
import { useRecord } from "../shared/hooks";
import { getParticipantDisplayName } from "../shared/participantUtils";
import { isVisibleItem } from "../shared/recordUtils";
import { getOverviewSettlementLabel } from "../shared/settlementUtils";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function OverviewScreenView({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const settings = useSplitStore((state) => state.settings);
  const insets = useSafeAreaInsets();
  const [reviewNoticeMessages, setReviewNoticeMessages] = useState<string[]>([]);
  const settlement = useMemo(() => {
    if (!record) {
      return null;
    }
    return computeSettlement(record.values);
  }, [record]);

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  const errors = [
    ...validateStepOne(record.values),
    ...validateStepTwo(record.values),
    ...validateStepThree(record.values),
  ].map((error) => error.message);
  const locale = getDeviceLocale();

  return (
    <AppScreen
      scroll={false}
      footer={(
        <FloatingFooter>
          <PrimaryButton
            label="Finalize Bill"
            icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
            onPress={() => {
              if (errors.length > 0 || !settlement?.ok) {
                setReviewNoticeMessages([...new Set(errors)]);
                return;
              }
              router.push(`/split/${draftId}/results`);
            }}
          />
        </FloatingFooter>
      )}
    >
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.reviewScrollContent,
          {
            paddingTop: Math.max(insets.top + 8, 22),
            paddingBottom: 126 + Math.max(insets.bottom, 14),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <FlowScreenHeader title="Review Items" onBack={() => router.back()} />

          {settlement?.ok ? (
            <>
              <HeroCard
                eyebrow="Bill total"
                title={formatMoney(settlement.data.totalCents, settlement.data.currency, locale)}
                subtitle={`${record.values.participants.length} people \u00B7 ${record.values.items.filter(isVisibleItem).length} items`}
              />

              <SectionCard>
                <SectionEyebrow>People totals</SectionEyebrow>
                <YStack gap="$4">
                  {settlement.data.people.map((person) => (
                    <XStack key={person.participantId} justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSurface}>
                          {getParticipantDisplayName(person.name, settings.ownerName)}
                        </Text>
                        <Text fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurfaceVariant}>
                          {getOverviewSettlementLabel(person)}
                        </Text>
                      </YStack>
                      <Text
                        fontFamily={FONTS.headlineBold}
                        fontSize={18}
                        color={person.isPayer ? PALETTE.secondary : PALETTE.primary}
                      >
                        {formatMoney(person.netCents, settlement.data.currency, locale)}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </SectionCard>

              <SectionCard soft>
                <SectionEyebrow>Item breakdown</SectionEyebrow>
                <YStack gap="$4">
                  {settlement.data.itemBreakdown.map((item) => (
                    <YStack key={item.id} gap="$2">
                      <Text fontFamily={FONTS.headlineBold} fontSize={17} color={PALETTE.onSurface}>
                        {item.name}
                      </Text>
                      <Text fontFamily={FONTS.bodyMedium} fontSize={13} color={PALETTE.onSurfaceVariant}>
                        {buildShareSummary(
                          item,
                          settlement.data.people.map((person) => ({
                            id: person.participantId,
                            name: person.name,
                            isPayer: person.isPayer,
                          })),
                          settlement.data.currency,
                          locale
                        )}
                      </Text>
                    </YStack>
                  ))}
                </YStack>
              </SectionCard>
            </>
          ) : null}

          <ErrorList messages={[...new Set(errors)]} />
        </YStack>
      </ScrollView>
      <SplitNoticeModal messages={reviewNoticeMessages} onDismiss={() => setReviewNoticeMessages([])} />
    </AppScreen>
  );
}
