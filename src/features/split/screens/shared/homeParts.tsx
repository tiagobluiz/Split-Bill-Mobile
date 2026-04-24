import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Home, ReceiptText, Settings, Trash2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import type { DraftRecord } from "../../../../storage/records";
import type { SplitListAmountDisplay } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getSettlementPreview } from "../../store";
import { buildRecordRoute, getRecordTitle } from "./recordUtils";
import { getRecentRowMeta } from "./settlementUtils";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const HOME_TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "splits", label: "Splits", icon: ReceiptText },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

export type HomeTabKey = (typeof HOME_TABS)[number]["key"];

export function HomeTabBar({
  activeTab,
  onChange,
}: {
  activeTab: HomeTabKey;
  onChange: (tab: HomeTabKey) => void;
}) {
  return (
    <View style={screenStyles.homeTabShell}>
      <XStack justifyContent="space-between" alignItems="center">
        {HOME_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tab.label}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(tab.key)}
              style={[screenStyles.homeTabButton, isActive ? screenStyles.homeTabButtonActive : null]}
            >
              <YStack alignItems="center" gap="$1.5">
                <Icon color={isActive ? PALETTE.primary : "#b1aba7"} size={20} />
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  textTransform="uppercase"
                  letterSpacing={1.5}
                  color={isActive ? PALETTE.primary : "#b1aba7"}
                >
                  {tab.label}
                </Text>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>
    </View>
  );
}

export function RecordRow({
  record,
  ownerName,
  settings,
  onDelete,
}: {
  record: DraftRecord;
  ownerName: string;
  settings: {
    splitListAmountDisplay?: SplitListAmountDisplay;
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  };
  onDelete: (recordId: string, title: string) => void;
}) {
  const meta = getRecentRowMeta(record, ownerName, settings, getSettlementPreview);
  const title = getRecordTitle(record);
  const showAmountBlock = record.status === "completed";
  const showSingleZeroState =
    showAmountBlock &&
    meta.amountDisplay.primaryLabel === "Nothing due" &&
    !meta.amountDisplay.secondaryValue;
  const showCombinedAmount =
    showAmountBlock &&
    Boolean(meta.amountDisplay.secondaryValue) &&
    meta.amountDisplay.primaryLabel === "Total";
  const showCombinedZeroState =
    showCombinedAmount && meta.amountDisplay.secondaryLabel === "Nothing due";

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete split ${title}`}
          style={screenStyles.recentSwipeDeleteAction}
          onPress={() => onDelete(record.id, title)}
        >
          <Trash2 color={PALETTE.onPrimary} size={18} />
          <Text fontFamily={FONTS.bodyBold} fontSize={12} color={PALETTE.onPrimary} textTransform="uppercase" letterSpacing={1.6}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      <View style={screenStyles.recentShadowWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open split ${title}`}
          onPress={() => router.push(buildRecordRoute(record))}
          style={[screenStyles.recentRow, screenStyles.itemsListCard]}
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <YStack flex={1} gap="$1">
              <Text fontFamily={FONTS.headlineBold} fontSize={18} color={PALETTE.onSurface}>
                {title}
              </Text>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={12}
                color={meta.statusColor}
                textTransform="uppercase"
                letterSpacing={1.8}
              >
                {meta.statusLabel}
              </Text>
            </YStack>
            {showAmountBlock ? (
              <YStack alignItems="flex-end" justifyContent="center" minWidth={72}>
                {showCombinedAmount ? (
                <XStack alignItems="flex-end" gap="$4">
                  <YStack alignItems="flex-end" gap="$0.5">
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={10}
                      color={PALETTE.onSurfaceVariant}
                      textTransform="uppercase"
                      letterSpacing={1.3}
                      textAlign="right"
                    >
                      {showCombinedZeroState ? "Nothing" : meta.amountDisplay.secondaryLabel}
                    </Text>
                    {showCombinedZeroState ? (
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={10}
                        color={PALETTE.onSurfaceVariant}
                        textTransform="uppercase"
                        letterSpacing={1.3}
                        textAlign="right"
                      >
                        Due
                      </Text>
                    ) : (
                      <Text
                        fontFamily={FONTS.headlineBlack}
                        fontSize={18}
                        color={PALETTE.onSurfaceVariant}
                        textAlign="right"
                      >
                        {meta.amountDisplay.secondaryValue}
                      </Text>
                    )}
                  </YStack>
                  <YStack alignItems="flex-end" gap="$0.5">
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={10}
                      color={PALETTE.onSurfaceVariant}
                      textTransform="uppercase"
                      letterSpacing={1.3}
                      textAlign="right"
                    >
                      {meta.amountDisplay.primaryLabel}
                    </Text>
                    <Text
                      fontFamily={FONTS.headlineBlack}
                      fontSize={18}
                      color={PALETTE.onSurface}
                      textAlign="right"
                    >
                      {meta.amountDisplay.primaryValue}
                    </Text>
                  </YStack>
                </XStack>
                ) : showSingleZeroState ? (
                  <YStack alignItems="flex-end" gap="$0.5">
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={10}
                      color={PALETTE.onSurfaceVariant}
                      textTransform="uppercase"
                      letterSpacing={1.3}
                      textAlign="right"
                    >
                      Nothing
                    </Text>
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={10}
                      color={PALETTE.onSurfaceVariant}
                      textTransform="uppercase"
                      letterSpacing={1.3}
                      textAlign="right"
                    >
                      Due
                    </Text>
                  </YStack>
                ) : (
                  <>
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={11}
                    color={PALETTE.onSurfaceVariant}
                    textTransform="uppercase"
                    letterSpacing={1.4}
                    textAlign="right"
                    width="100%"
                  >
                    {meta.amountDisplay.primaryLabel}
                  </Text>
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={18}
                    color={PALETTE.onSurface}
                    textAlign="right"
                    width="100%"
                  >
                    {meta.amountDisplay.primaryValue}
                  </Text>
                  {meta.amountDisplay.secondaryValue ? (
                    <YStack alignItems="flex-end" marginTop="$1" width="100%">
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={10}
                        color={PALETTE.onSurfaceVariant}
                        textTransform="uppercase"
                        letterSpacing={1.3}
                        textAlign="right"
                        width="100%"
                      >
                        {meta.amountDisplay.secondaryLabel}
                      </Text>
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={13}
                        color={PALETTE.onSurfaceVariant}
                        textAlign="right"
                        width="100%"
                      >
                        {meta.amountDisplay.secondaryValue}
                      </Text>
                    </YStack>
                  ) : null}
                  </>
                )}
              </YStack>
            ) : null}
          </XStack>
        </Pressable>
      </View>
    </Swipeable>
  );
}
