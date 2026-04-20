import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Home, ReceiptText, Settings, Trash2 } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { AvatarBadge } from "../../../../components/ui";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getSettlementPreview } from "../../store";
import { getInitials } from "./participantUtils";
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
  index,
  ownerName,
  settings,
  onDelete,
}: {
  record: DraftRecord;
  index: number;
  ownerName: string;
  settings: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  };
  onDelete: (recordId: string, title: string) => void;
}) {
  const meta = getRecentRowMeta(record, ownerName, settings, getSettlementPreview);
  const title = getRecordTitle(record);

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete draft ${title}`}
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
            <XStack alignItems="center" gap="$4" flex={1}>
              <AvatarBadge label={getInitials(title)} accent={index % 2 === 0} />
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
            </XStack>
            <YStack alignItems="flex-end" justifyContent="center">
              <Text fontFamily={FONTS.headlineBlack} fontSize={18} color={PALETTE.onSurface}>
                {meta.amount}
              </Text>
            </YStack>
          </XStack>
        </Pressable>
      </View>
    </Swipeable>
  );
}
