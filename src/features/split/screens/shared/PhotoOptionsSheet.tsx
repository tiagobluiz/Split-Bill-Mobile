import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import { PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { BottomActionSheet, type BottomAction } from "./BottomActionSheet";

export function PhotoOptionsSheet({ visible, title, cancelLabel, bottomInset, hasPhoto, onDismiss, onDismissComplete, onUpload, onTakePhoto, onRemove }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  bottomInset: number;
  hasPhoto: boolean;
  onDismiss: () => void;
  onDismissComplete?: () => void;
  onUpload: () => void;
  onTakePhoto: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const options: BottomAction[] = [
    { label: t("photoOptions.chooseFromLibrary"), icon: <ImagePlus size={25} color={PALETTE.primary} />, onPress: onUpload },
    { label: t("photoOptions.takePhoto"), icon: <Camera size={25} color={PALETTE.primary} />, onPress: onTakePhoto },
    ...(hasPhoto ? [{ label: t("photoOptions.removePhoto"), icon: <Trash2 size={25} color={PALETTE.danger} />, onPress: onRemove, tone: "danger" as const }] : []),
  ];
  return <BottomActionSheet visible={visible} title={title} cancelLabel={cancelLabel} bottomInset={bottomInset} options={options} onDismiss={onDismiss} onDismissComplete={onDismissComplete} />;
}
