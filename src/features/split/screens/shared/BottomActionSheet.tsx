import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { BottomSheetFrame } from "./BottomSheetFrame";
import { SheetCancelButton } from "./SheetCancelButton";

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

export function BottomActionSheet({ visible, title, cancelLabel, bottomInset, options, onDismiss, onDismissComplete, selectionMode = false }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  bottomInset: number;
  options: BottomAction[];
  onDismiss: () => void;
  onDismissComplete?: () => void;
  selectionMode?: boolean;
}) {
  const { height: windowHeight } = useWindowDimensions();

  const wasVisible = useRef(visible);
  const completedDismissal = useRef(false);
  const onDismissCompleteRef = useRef(onDismissComplete);
  onDismissCompleteRef.current = onDismissComplete;
  const completeDismissal = useCallback(() => {
    if (completedDismissal.current) return;
    completedDismissal.current = true;
    onDismissCompleteRef.current?.();
  }, []);
  useEffect(() => {
    const justDismissed = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (visible) completedDismissal.current = false;
    if (!justDismissed) return;
    const timeout = setTimeout(completeDismissal, 350);
    return () => clearTimeout(timeout);
  }, [completeDismissal, visible]);

  return <BottomSheetFrame visible={visible} title={title} bottomInset={bottomInset} onDismiss={onDismiss} onDismissComplete={completeDismissal}
    swipeToDismiss
    overlayStyle={{ paddingHorizontal: 0 }}
    cardStyle={{ maxWidth: undefined, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 22, gap: 12 }}>
        <ScrollView style={{ maxHeight: windowHeight * 0.55 }} keyboardShouldPersistTaps="handled">
        <YStack gap={0}>
          {options.map((option) => {
            const danger = option.tone === "danger";
            return <View key={option.label}>
              <View style={{ height: 1, backgroundColor: PALETTE.divider, marginHorizontal: 8 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={option.accessibilityLabel ?? option.label} accessibilityState={{ selected: Boolean(option.selected), disabled: Boolean(option.disabled) }} disabled={option.disabled} onPress={option.onPress} style={{ minHeight: 76, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, paddingHorizontal: option.icon ? 0 : 8, opacity: option.disabled ? 0.55 : 1 }}>
                {option.icon ? <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: danger ? PALETTE.dangerSurface : "transparent" }}>{option.icon}</View> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text fontFamily={FONTS.bodySemiBold} fontSize={16} color={danger ? PALETTE.danger : option.selected ? PALETTE.primary : PALETTE.onSurface}>{option.label}</Text>
                  {option.description ? <Text fontFamily={FONTS.body} fontSize={13} color={PALETTE.onSurfaceVariant}>{option.description}</Text> : null}
                </View>
                {selectionMode ? <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: option.selected ? 0 : 1.5, borderColor: PALETTE.onSurfaceVariant, backgroundColor: option.selected ? PALETTE.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{option.selected ? <Check size={17} color={PALETTE.onPrimary} strokeWidth={3} /> : null}</View> : null}
              </Pressable>
            </View>;

          })}
          <View style={{ height: 1, backgroundColor: PALETTE.divider, marginHorizontal: 8 }} />
        </YStack>
        </ScrollView>
        <SheetCancelButton label={cancelLabel} onPress={onDismiss} />
  </BottomSheetFrame>;
}
