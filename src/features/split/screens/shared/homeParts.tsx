import { useRef } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Bell, Home, ReceiptText, Settings } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import type { DraftRecord } from "../../../../storage/records";
import type { SplitListAmountDisplay } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { t } from "../../../../i18n";
import { getSettlementPreview } from "../../store";
import { buildRecordRoute, getRecordTitle } from "../../routes";
import { getRecentRowMeta } from "./settlementUtils";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const HOME_TABS = [
  { key: "home", labelKey: "home.tab.home", icon: Home },
  { key: "splits", labelKey: "home.tab.splits", icon: ReceiptText },
  { key: "settings", labelKey: "home.tab.settings", icon: Settings },
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
          const label = t(tab.labelKey, undefined, { maxLength: 10 });

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={t(
                tab.key === "home"
                  ? "home.openHome"
                  : tab.key === "splits"
                    ? "home.openSplits"
                    : "home.openSettings",
              )}
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
                  {label}
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
  onOpenActions,
  reminderLabel,
}: {
  record: DraftRecord;
  ownerName: string;
  settings: {
    defaultCurrency?: string;
    splitListAmountDisplay?: SplitListAmountDisplay;
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  };
  onOpenActions: (target: { id: string; title: string }) => void;
  reminderLabel?: string;
}) {
  const meta = getRecentRowMeta(record, ownerName, settings, getSettlementPreview);
  const title = getRecordTitle(record);
  const didLongPressRef = useRef(false);
  const showAmountBlock = record.status === "completed";
  const showSingleZeroState =
    showAmountBlock &&
    meta.amountDisplay.variant === "remaining" &&
    meta.amountDisplay.primaryKind === "nothingDue" &&
    !meta.amountDisplay.secondaryValue;
  const showCombinedAmount =
    showAmountBlock &&
    meta.amountDisplay.variant === "totalAndRemaining" &&
    Boolean(meta.amountDisplay.secondaryValue);
  const showCombinedZeroState =
    showCombinedAmount &&
    meta.amountDisplay.secondaryKind === "nothingDue";
  const nothingDueWords = t("record.amount.nothingDue").split(" ");
  const nothingDueLineOne = nothingDueWords[0] ?? t("record.amount.nothingDue");
  const nothingDueLineTwo = nothingDueWords.slice(1).join(" ");
  const renderNothingDueRows = () => (
    <YStack alignItems="flex-end" gap="$0">
      <Text
        fontFamily={FONTS.bodyBold}
        fontSize={10}
        color={PALETTE.onSurfaceVariant}
        textTransform="uppercase"
        letterSpacing={1.3}
        textAlign="right"
      >
        {nothingDueLineOne}
      </Text>
      {nothingDueLineTwo ? (
        <Text
          fontFamily={FONTS.bodyBold}
          fontSize={10}
          color={PALETTE.onSurfaceVariant}
          textTransform="uppercase"
          letterSpacing={1.3}
          textAlign="right"
        >
          {nothingDueLineTwo}
        </Text>
      ) : null}
    </YStack>
  );

  return (
    <View style={screenStyles.recentShadowWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.openSplitA11y", { title })}
        onLongPress={() => {
          didLongPressRef.current = true;
          onOpenActions({ id: record.id, title });
        }}
        onPress={() => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false;
            return;
          }
          router.push(buildRecordRoute(record));
        }}
        style={[screenStyles.recentRow, screenStyles.itemsListCard]}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} gap="$1">
            <Text
              fontFamily={FONTS.headlineBold}
              fontSize={18}
              color={PALETTE.onSurface}
              numberOfLines={2}
            >
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
            {reminderLabel ? (
              <XStack alignItems="center" gap="$1.5">
                <Bell color={PALETTE.primary} size={12} />
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.primary}
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {reminderLabel}
                </Text>
              </XStack>
            ) : null}
          </YStack>
          {showAmountBlock ? (
            <YStack alignItems="flex-end" justifyContent="center" minWidth={72}>
              {showCombinedAmount ? (
                <XStack alignItems="flex-end" gap="$4">
                  <YStack alignItems="flex-end" gap="$0.5">
                    {showCombinedZeroState ? (
                      renderNothingDueRows()
                    ) : (
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={10}
                        color={PALETTE.onSurfaceVariant}
                        textTransform="uppercase"
                        letterSpacing={1.3}
                        textAlign="right"
                      >
                        {meta.amountDisplay.secondaryLabel}
                      </Text>
                    )}
                    {showCombinedZeroState ? null : (
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
                  {renderNothingDueRows()}
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
  );
}
