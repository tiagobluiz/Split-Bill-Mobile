import { Pressable } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import { Text as TamaguiText, XStack as TamaguiXStack } from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;

export function FlowScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$3">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack}>
          <ArrowLeft color={PALETTE.primary} size={22} />
        </Pressable>
        <Text fontFamily={FONTS.headlineBlack} fontSize={24} color={PALETTE.primary} letterSpacing={-1.1}>
          {title}
        </Text>
      </XStack>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => router.replace("/")}>
        <X color={PALETTE.primary} size={22} />
      </Pressable>
    </XStack>
  );
}
