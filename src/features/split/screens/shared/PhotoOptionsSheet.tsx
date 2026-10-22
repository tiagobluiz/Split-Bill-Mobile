import { Modal, Pressable, View } from "react-native";
import { Camera, ChevronRight, ImagePlus, Trash2 } from "lucide-react-native";
import { Text as TamaguiText, YStack as TamaguiYStack } from "tamagui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export function PhotoOptionsSheet({ visible, title, cancelLabel, uploadLabel, cameraLabel, removeLabel, bottomInset, hasPhoto, onDismiss, onUpload, onTakePhoto, onRemove }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  uploadLabel: string;
  cameraLabel: string;
  removeLabel: string;
  bottomInset: number;
  hasPhoto: boolean;
  onDismiss: () => void;
  onUpload: () => void;
  onTakePhoto: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  if (!visible) return null;
  const rows = [
    { label: uploadLabel, Icon: ImagePlus, onPress: onUpload, danger: false },
    { label: cameraLabel, Icon: Camera, onPress: onTakePhoto, danger: false },
    ...(hasPhoto ? [{ label: removeLabel, Icon: Trash2, onPress: onRemove, danger: true }] : []),
  ];

  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
    <View style={screenStyles.personPhotoSheetOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("modal.dismissActionSheet")} style={screenStyles.personPhotoSheetBackdrop} onPress={onDismiss} />
      <View style={[screenStyles.personPhotoSheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <View style={screenStyles.personPhotoSheetHandle} />
        <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface}>{title}</Text>
        <YStack gap="$2">
          {rows.map(({ label, Icon, onPress, danger }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[screenStyles.personPhotoSheetRow, danger && screenStyles.personPhotoSheetDangerRow]}>
            <Icon size={25} color={danger ? PALETTE.danger : PALETTE.primary} />
            <Text flex={1} fontFamily={FONTS.bodySemiBold} fontSize={17} color={danger ? PALETTE.danger : PALETTE.onSurface}>{label}</Text>
            <ChevronRight size={21} color={danger ? PALETTE.danger : PALETTE.onSurfaceVariant} />
          </Pressable>)}
        </YStack>
        <View style={screenStyles.personPhotoSheetDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onDismiss} style={screenStyles.personPhotoSheetCancel}>
          <Text fontFamily={FONTS.bodySemiBold} fontSize={17} color={PALETTE.onSurface}>{cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
