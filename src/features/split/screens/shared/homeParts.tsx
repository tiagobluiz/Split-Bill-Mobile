import { useRef, useState } from "react";
import { Pressable, View, Text as NativeText } from "react-native";
import { router } from "expo-router";
import { Bell, EllipsisVertical, Home, ReceiptText, Settings, Users } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import type { DraftRecord } from "../../../../storage/records";
import type { SplitTag } from "../../tags";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { t } from "../../../../i18n";
import { buildRecordRoute } from "../../routes";
import {
  createRecordRowModel,
  type RecordRowModel,
  type RecordRowSettings,
} from "./recordRowModel";
import { screenStyles } from "./styles";
import { TagChipRow } from "./TagChips";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;
const AMOUNT_FONT_SIZE = 18;

const HOME_TABS = [
  { key: "home", labelKey: "home.tab.home", icon: Home },
  { key: "splits", labelKey: "home.tab.splits", icon: ReceiptText },
  { key: "groups", labelKey: "home.tab.groups", icon: Users },
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
                    : tab.key === "groups"
                      ? "home.openGroups"
                      : "home.openSettings",
              )}
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(tab.key)}
              style={[
                screenStyles.homeTabButton,
                isActive ? screenStyles.homeTabButtonActive : null,
              ]}
            >
              <YStack width="100%" alignItems="center" gap="$1.5">
                <Icon
                  color={isActive ? PALETTE.primary : "#b1aba7"}
                  size={20}
                />
                <Text
                  width="100%"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  textTransform="uppercase"
                  textAlign="center"
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
  onOpenRecord,
  reminderLabel,
}: {
  record: DraftRecord | RecordRowModel;
  ownerName: string;
  settings: RecordRowSettings & {
    tags?: SplitTag[];
  };
  onOpenActions: (target: { id: string; title: string }) => void;
  onOpenRecord?: (id: string) => void;
  reminderLabel?: string;
}) {
  const view =
    "values" in record
      ? createRecordRowModel(record, ownerName, settings)
      : record;
  const { meta, title } = view;
  const didLongPressRef = useRef(false);
  const [statusWidths, setStatusWidths] = useState<Record<string, number>>({});
  const [statusRowWidth, setStatusRowWidth] = useState(0);
  const statusOptions = [t("record.status.settled")];
  const measuredStatusWidth = statusWidths[statusOptions[0]];
  const statusWidth = measuredStatusWidth == null ? undefined : measuredStatusWidth + 2;
  const stackAmount = statusRowWidth > 0 && statusWidth != null && statusWidth + 168 > statusRowWidth;
  const isCompleted = view.status === "completed";
  const showSingleZeroState =
    meta.amountDisplay.variant === "remaining" &&
    meta.amountDisplay.primaryKind === "nothingDue" &&
    !meta.amountDisplay.secondaryValue;
  const showCombinedAmount =
    meta.amountDisplay.variant === "totalAndRemaining" &&
    Boolean(meta.amountDisplay.secondaryValue);
  const showCombinedZeroState =
    showCombinedAmount && meta.amountDisplay.secondaryKind === "nothingDue";
  const renderNothingDueRows = (alignItems: "flex-start" | "flex-end" = "flex-end") => (
    <YStack alignItems={alignItems}>
      <Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant} textTransform="uppercase" letterSpacing={1.3} numberOfLines={1}>
        {t("record.amount.nothingDue")}
      </Text>
    </YStack>
  );

  const renderAmountValue = (
    value: string,
    color: string = PALETTE.onSurface,
  ) => (
    <Text
      fontFamily={FONTS.headlineBlack}
      fontSize={AMOUNT_FONT_SIZE}
      color={color}
      textAlign="right"
      marginLeft="auto"
      flexShrink={1}
    >
      {value}
    </Text>
  );

  const renderExpandedAmount = () => (
    <>
      <View
        style={{
          height: 1,
          width: "100%",
          backgroundColor: PALETTE.outlineVariant,
          marginTop: 12,
          marginBottom: 10,
        }}
      />
      <XStack testID="split-card-status-row" alignItems="stretch" width="100%" flexDirection={stackAmount && isCompleted ? "column" : "row"} onLayout={(event: { nativeEvent: { layout: { width: number } } }) => setStatusRowWidth(event.nativeEvent.layout.width)}>
        <View style={isCompleted && !stackAmount ? { width: statusWidth, justifyContent: "center", marginRight: 10 } : { justifyContent: "center" }}>
          <Text fontFamily={FONTS.bodyBold} fontSize={12} color={meta.statusColor} textTransform="uppercase" letterSpacing={1.8} numberOfLines={stackAmount ? undefined : 1}>
            {meta.statusLabel}
          </Text>
        </View>
        {isCompleted ? <YStack testID="split-card-amount" flex={1} minWidth={0} justifyContent="center" borderLeftWidth={stackAmount ? 0 : 1} borderTopWidth={stackAmount ? 1 : 0} borderColor={PALETTE.outlineVariant} paddingLeft={stackAmount ? 0 : "$2"} paddingTop={stackAmount ? 8 : 0} marginTop={stackAmount ? 8 : 0} gap="$1">
        {showSingleZeroState ? (
          <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
            {renderNothingDueRows("flex-start")}
          </XStack>
        ) : showCombinedAmount ? (
          <>
            <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={11}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={1.3}
                numberOfLines={1}
              >
                {meta.amountDisplay.primaryLabel}
              </Text>
              {renderAmountValue(meta.amountDisplay.primaryValue)}
            </XStack>
            {showCombinedZeroState ? (
              <XStack alignItems="center" justifyContent="space-between">
                {renderNothingDueRows("flex-start")}
              </XStack>
            ) : (
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
                flexWrap="wrap"
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={11}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={1.3}
                  numberOfLines={1}
                >
                  {meta.amountDisplay.secondaryLabel}
                </Text>
                {renderAmountValue(
                  meta.amountDisplay.secondaryValue!,
                  PALETTE.onSurfaceVariant,
                )}
              </XStack>
            )}
          </>
        ) : (
          <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
            <Text
              fontFamily={FONTS.bodyBold}
              fontSize={11}
              color={PALETTE.onSurfaceVariant}
              textTransform="uppercase"
              letterSpacing={1.3}
              numberOfLines={1}
            >
              {meta.amountDisplay.primaryLabel}
            </Text>
            {renderAmountValue(meta.amountDisplay.primaryValue)}
          </XStack>
        )}
        </YStack> : null}
      </XStack>
    </>
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
          if ("values" in record) router.push(buildRecordRoute(record));
          else onOpenRecord?.(record.id);
        }}
        style={[screenStyles.recentRow, screenStyles.itemsListCard]}
      >
        <YStack width="100%">
          <XStack alignItems="stretch" justifyContent="space-between" gap="$3">
            <YStack flex={1} justifyContent="center" gap="$1" minWidth={0}>
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={18}
                color={PALETTE.onSurface}
                numberOfLines={2}
                flexShrink={1}
                paddingRight={44}
              >
                {title}
              </Text>
              <TagChipRow
                tags={settings.tags ?? []}
                selectedIds={view.tagIds}
              />
              {reminderLabel ? (
                <XStack alignItems="center" gap="$1.5" marginTop={4}>
                  <Bell color="#706b68" size={12} />
                  <Text fontFamily={FONTS.bodyBold} fontSize={11} color="#706b68" numberOfLines={1}>{reminderLabel}</Text>
                </XStack>
              ) : null}
            </YStack>
          </XStack>
          {renderExpandedAmount()}
          {isCompleted ? <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: -10000, width: 10000, opacity: 0 }}>
            {statusOptions.map((label) => (
              <NativeText key={label} testID="split-card-status-measure" accessible={false} numberOfLines={1} style={{ alignSelf: "flex-start", fontFamily: FONTS.bodyBold, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.8 }} onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width != null) setStatusWidths((current) => current[label] === width ? current : { ...current, [label]: width });
              }}>{label}</NativeText>
            ))}
          </View> : null}
        </YStack>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.splitActionsA11y", { title })}
        onPress={() => onOpenActions({ id: record.id, title })}
        style={{ position: "absolute", right: 12, top: 6, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <EllipsisVertical color={PALETTE.onSurfaceVariant} size={20} />
      </Pressable>
    </View>
  );
}
