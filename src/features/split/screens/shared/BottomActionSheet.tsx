import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export type BottomAction = {
  label: string;
  accessibilityLabel?: string;
  description?: string;
  icon: ReactNode;
  onPress: () => void;
  tone?: "default" | "danger";
};

export function BottomActionSheet({ visible, title, cancelLabel, bottomInset, options, onDismiss }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  bottomInset: number;
  options: BottomAction[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  if (!visible) return null;

  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
    <View style={screenStyles.personPhotoSheetOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissActionSheet")} style={screenStyles.personPhotoSheetBackdrop} onPress={onDismiss} />
      <View style={[screenStyles.personPhotoSheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <View style={screenStyles.personPhotoSheetHandle} />
        <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>{title}</Text>
        <YStack gap="$2">
          {options.map((option) => {
            const danger = option.tone === "danger";
            return <Pressable key={option.label} accessibilityRole="button" accessibilityLabel={option.accessibilityLabel ?? option.label} onPress={option.onPress} style={[screenStyles.personPhotoSheetRow, danger && screenStyles.personPhotoSheetDangerRow, option.description ? { minHeight: 82 } : null]}>
              {option.icon}
              <View style={{ flex: 1, gap: option.description ? 2 : 0 }}>
                <Text fontFamily={FONTS.bodySemiBold} fontSize={17} color={danger ? PALETTE.danger : PALETTE.onSurface}>{option.label}</Text>
                {option.description ? <Text fontFamily={FONTS.body} fontSize={13} color={danger ? PALETTE.danger : PALETTE.onSurfaceVariant}>{option.description}</Text> : null}
              </View>
              <ChevronRight size={21} color={danger ? PALETTE.danger : PALETTE.onSurfaceVariant} />
            </Pressable>;
          })}
        </YStack>
        <View style={screenStyles.personPhotoSheetDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onDismiss} style={screenStyles.personPhotoSheetCancel}>
          <Text fontFamily={FONTS.bodySemiBold} fontSize={17} color={PALETTE.onSurface}>{cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
