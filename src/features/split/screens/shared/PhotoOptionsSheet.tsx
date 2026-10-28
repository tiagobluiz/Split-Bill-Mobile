import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import { PALETTE } from "../../../../theme/palette";
import { BottomActionSheet, type BottomAction } from "./BottomActionSheet";

export function PhotoOptionsSheet({ visible, title, cancelLabel, uploadLabel, cameraLabel, removeLabel, bottomInset, hasPhoto, onDismiss, onDismissComplete, onUpload, onTakePhoto, onRemove }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  uploadLabel: string;
  cameraLabel: string;
  removeLabel: string;
  bottomInset: number;
  hasPhoto: boolean;
  onDismiss: () => void;
  onDismissComplete?: () => void;
  onUpload: () => void;
  onTakePhoto: () => void;
  onRemove: () => void;
}) {
  const options: BottomAction[] = [
    { label: uploadLabel, icon: <ImagePlus size={25} color={PALETTE.primary} />, onPress: onUpload },
    { label: cameraLabel, icon: <Camera size={25} color={PALETTE.primary} />, onPress: onTakePhoto },
    ...(hasPhoto ? [{ label: removeLabel, icon: <Trash2 size={25} color={PALETTE.danger} />, onPress: onRemove, tone: "danger" as const }] : []),
  ];
  return <BottomActionSheet visible={visible} title={title} cancelLabel={cancelLabel} bottomInset={bottomInset} options={options} onDismiss={onDismiss} onDismissComplete={onDismissComplete} />;
}
