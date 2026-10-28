import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
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
  icon?: ReactNode;
  onPress: () => void;
  tone?: "default" | "danger";
  selected?: boolean;
  disabled?: boolean;
};

export function BottomActionSheet({ visible, title, cancelLabel, bottomInset, options, onDismiss, selectionMode = false, showCancel = true }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  bottomInset: number;
  options: BottomAction[];
  onDismiss: () => void;
  selectionMode?: boolean;
  showCancel?: boolean;
}) {
  const { t } = useTranslation();
  if (!visible) return null;

  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
    <View style={screenStyles.personPhotoSheetOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissActionSheet")} style={screenStyles.personPhotoSheetBackdrop} onPress={onDismiss} />
      <View style={[screenStyles.personPhotoSheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <View style={screenStyles.personPhotoSheetHandle} />
        <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>{title}</Text>
        <YStack gap={selectionMode ? "$1.5" : "$2"}>
          {options.map((option) => {
            const danger = option.tone === "danger";
            return <Pressable key={option.label} accessibilityRole="button" accessibilityLabel={option.accessibilityLabel ?? option.label} accessibilityState={{ selected: Boolean(option.selected), disabled: Boolean(option.disabled) }} disabled={option.disabled} onPress={option.disabled ? undefined : option.onPress} style={[screenStyles.personPhotoSheetRow, selectionMode ? { minHeight: 64, borderRadius: 18, paddingHorizontal: 18 } : null, danger && screenStyles.personPhotoSheetDangerRow, option.selected ? { backgroundColor: PALETTE.secondaryContainer, borderWidth: 1, borderColor: PALETTE.primary } : null, option.disabled ? { opacity: 0.55 } : null, option.description ? { minHeight: 82 } : null]}>
              {option.icon}
              <View style={{ flex: 1, gap: option.description ? 2 : 0 }}>
                <Text fontFamily={FONTS.bodySemiBold} fontSize={17} color={danger ? PALETTE.danger : option.selected ? PALETTE.primary : PALETTE.onSurface}>{option.label}</Text>
                {option.description ? <Text fontFamily={FONTS.body} fontSize={13} color={danger ? PALETTE.danger : PALETTE.onSurfaceVariant}>{option.description}</Text> : null}
              </View>
              {selectionMode ? (
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: option.selected ? 0 : 1.5, borderColor: PALETTE.onSurfaceVariant, backgroundColor: option.selected ? PALETTE.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {option.selected ? <Check size={17} color={PALETTE.onPrimary} strokeWidth={3} /> : null}
                </View>
              ) : option.selected ? <Check size={22} color={PALETTE.primary} /> : <ChevronRight size={21} color={danger ? PALETTE.danger : PALETTE.onSurfaceVariant} />}
            </Pressable>;
          })}
        </YStack>
        {showCancel ? <>
          <View style={screenStyles.personPhotoSheetDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onDismiss} style={screenStyles.personPhotoSheetCancel}>
            <Text fontFamily={FONTS.bodySemiBold} fontSize={17} color={PALETTE.onSurface}>{cancelLabel}</Text>
          </Pressable>
        </> : null}
      </View>
    </View>
  </Modal>;
}
