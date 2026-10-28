import { useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, Text, View } from "react-native";
import { Camera, Eye, Plus, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FieldLabel } from "../../../../components/ui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { chooseInvoicePhoto, type InvoicePhotoSelection } from "../../invoicePhotos";
import { PhotoOptionsSheet } from "./PhotoOptionsSheet";

function formatFileSize(size: number | null | undefined, unavailableLabel: string) {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return unavailableLabel;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function InvoicePhotoField({
  value,
  fileSize,
  onChange,
}: {
  value: string | null;
  fileSize?: number | null;
  onChange: (photo: InvoicePhotoSelection | null) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const queuedPhotoPicker = useRef<boolean | null>(null);

  const selectSource = (camera: boolean) => {
    if (Platform.OS !== "web") {
      queuedPhotoPicker.current = camera;
      setSourceOpen(false);
      return;
    }
    setSourceOpen(false);
    void chooseInvoicePhoto(camera, onChange, t("splitDetails.cameraDenied"), t("common.tryAgain"));
  };

  const launchQueuedPhotoPicker = () => {
    const camera = queuedPhotoPicker.current;
    queuedPhotoPicker.current = null;
    if (camera === null) return;
    void chooseInvoicePhoto(camera, onChange, t("splitDetails.cameraDenied"), t("common.tryAgain"));
  };

  return (
    <View style={{ gap: 10 }}>
      <FieldLabel>{t("splitDetails.invoice")}</FieldLabel>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("splitDetails.preview")}
          onPress={() => setPreviewOpen(true)}
          style={{ minHeight: 104, borderRadius: 18, backgroundColor: PALETTE.surfaceContainerLow, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Image source={{ uri: value }} resizeMode="cover" style={{ width: 72, height: 78, borderRadius: 10, backgroundColor: PALETTE.surfaceContainer }} />
          <View style={{ flex: 1, minHeight: 70, justifyContent: "center", gap: 8 }}>
            <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.bodySemiBold, fontSize: 15, lineHeight: 20 }}>{t("pdf.invoice")}</Text>
            <Text style={{ color: PALETTE.onSurfaceVariant, fontFamily: FONTS.body, fontSize: 13 }}>{formatFileSize(fileSize, t("splitDetails.fileSizeUnknown"))}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 34, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Eye color={PALETTE.primary} size={22} />
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: PALETTE.outlineVariant }} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("splitDetails.removePhoto")} onPress={(event) => { event?.stopPropagation?.(); onChange(null); }} style={{ width: 34, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Trash2 color={PALETTE.primary} size={21} />
            </Pressable>
          </View>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={t("splitDetails.addInvoicePhoto")} onPress={() => setSourceOpen(true)} style={{ minHeight: 94, borderRadius: 18, backgroundColor: PALETTE.surfaceContainerLow, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: PALETTE.secondaryContainer, alignItems: "center", justifyContent: "center" }}>
            <Camera color={PALETTE.primary} size={24} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: PALETTE.onSurface, fontFamily: FONTS.bodySemiBold, fontSize: 15 }}>{t("splitDetails.attachInvoice")}</Text>
            <Text numberOfLines={1} style={{ color: PALETTE.onSurfaceVariant, fontFamily: FONTS.body, fontSize: 12, lineHeight: 16 }}>{t("splitDetails.photoSourceHint")}</Text>
          </View>
          <Plus color={PALETTE.primary} size={24} strokeWidth={1.8} />
        </Pressable>
      )}

      {value ? (
        <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(31,26,23,0.92)", padding: 22, justifyContent: "center", gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text numberOfLines={1} style={{ flex: 1, color: PALETTE.onPrimary, fontFamily: FONTS.bodySemiBold, fontSize: 15 }}>{t("pdf.invoice")}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => setPreviewOpen(false)} style={{ padding: 8 }}>
                <Text style={{ color: PALETTE.onPrimary, fontFamily: FONTS.bodyBold, fontSize: 18 }}>×</Text>
              </Pressable>
            </View>
            <Image source={{ uri: value }} resizeMode="contain" style={{ width: "100%", height: "82%" }} />
          </View>
        </Modal>
      ) : null}

      <PhotoOptionsSheet
        visible={sourceOpen}
        title={t("splitDetails.addInvoicePhoto")}
        cancelLabel={t("common.cancel")}
        uploadLabel={t("splitDetails.choosePhoto")}
        cameraLabel={t("splitDetails.takePhoto")}
        removeLabel={t("splitDetails.removePhoto")}
        bottomInset={insets.bottom}
        hasPhoto={Boolean(value)}
        onDismiss={() => setSourceOpen(false)}
        onDismissComplete={launchQueuedPhotoPicker}
        onUpload={() => selectSource(false)}
        onTakePhoto={() => selectSource(true)}
        onRemove={() => { setSourceOpen(false); onChange(null); }}
      />
    </View>
  );
}
