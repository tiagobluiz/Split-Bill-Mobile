import { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Camera, ImagePlus, Pencil } from "lucide-react-native";
import { Text as TText, XStack as TXStack, YStack as TYStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "../../../../i18n/provider";
import { useSplitStore } from "../../store";
import { getPersonNameValidationMessage, normalizePersonNameInput, PERSON_NAME_MAX_LENGTH, validatePersonName } from "../../people";
import { discardTemporaryPersonPhoto, persistPersonPhoto, removePersonPhoto } from "../../personPhotos";
import { FONTS, PALETTE } from "../../../../theme/palette";

const Text = TText as any;
const XStack = TXStack as any;
const YStack = TYStack as any;
type Step = "welcome" | "name" | "photo";

export function ProfileSetupGate() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const settings = useSplitStore((state) => state.settings);
  const updateSettings = useSplitStore((state) => state.updateSettings);
  const [dismissed, setDismissed] = useState(settings.profileSetupCompleted === true);
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState(settings.ownerName.toLowerCase() === "you" ? "" : settings.ownerName);
  const [photoUri, setPhotoUri] = useState<string | null>(settings.ownerProfileImageUri || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const normalizedName = normalizePersonNameInput(name);
  const nameValidation = useMemo(() => validatePersonName(name, settings.people, settings.ownerPersonId), [name, settings.ownerPersonId, settings.people]);
  const invalidName = Boolean(nameValidation);

  const pickPhoto = async (camera: boolean) => {
    setError("");
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t(camera ? "settings.profileCameraPermission" : "settings.profileLibraryPermission"));
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      const uri = result.canceled ? null : result.assets[0]?.uri;
      if (!uri) return;
      if (photoUri !== settings.ownerProfileImageUri) await discardTemporaryPersonPhoto(photoUri);
      setPhotoUri(uri);
    } catch {
      setError(t("common.couldNotSaveSettings"));
    }
  };

  const finish = async () => {
    if (invalidName || busy) {
      setError(getPersonNameValidationMessage(nameValidation, t));
      return;
    }
    setBusy(true);
    setError("");
    let savedPhotoUri = photoUri;
    let copiedPhoto = false;
    try {
      if (savedPhotoUri && savedPhotoUri !== settings.ownerProfileImageUri) {
        const persisted = await persistPersonPhoto(savedPhotoUri);
        copiedPhoto = persisted !== savedPhotoUri;
        savedPhotoUri = persisted;
      }
      await updateSettings({
        ownerName: normalizedName,
        ownerProfileImageUri: savedPhotoUri ?? "",
        profileSetupCompleted: true,
      });
      if (settings.ownerProfileImageUri && settings.ownerProfileImageUri !== savedPhotoUri) {
        await removePersonPhoto(settings.ownerProfileImageUri);
      }
      if (photoUri && photoUri !== savedPhotoUri && photoUri !== settings.ownerProfileImageUri) {
        await discardTemporaryPersonPhoto(photoUri);
      }
      setDismissed(true);
    } catch {
      if (copiedPhoto) await removePersonPhoto(savedPhotoUri);
      setError(t("common.couldNotSaveSettings"));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError("");
    if (step === "photo") setStep("name");
    else if (step === "name") setStep("welcome");
  };

  return <Modal visible={!dismissed} animationType="fade" presentationStyle="fullScreen" onRequestClose={back}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PALETTE.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
        {step === "welcome" ? <View style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <YStack alignItems="center" justifyContent="center" paddingHorizontal={28} paddingTop={12} style={{ height: "40%" }}>
            <Text color={PALETTE.primary} fontFamily={FONTS.headlineBlack} fontSize={36} fontStyle="italic" letterSpacing={-1.2}>{t("app.name").toUpperCase()}</Text>
            <Text marginTop={46} color={PALETTE.onSurface} fontFamily={FONTS.headlineBlack} fontSize={48} textAlign="center">{t("profileSetup.welcomeTitle")}</Text>
            <Text marginTop={16} maxWidth={300} color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={21} lineHeight={30} textAlign="center">{t("profileSetup.welcomeDescription")}</Text>
          </YStack>
          <View style={{ position: "absolute", bottom: "17.5%", left: "-9%", width: "118%", aspectRatio: 1.6 }}>
            <Image source={require("../../../../../assets/onboarding-friends-transparent.png")} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: "21%", paddingHorizontal: 24, paddingTop: 66, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: PALETTE.surface }}>
            <PrimaryButton label={t("profileSetup.letsGo")} onPress={() => setStep("name")} />
          </View>
        </View> : <>
          <XStack alignItems="center" paddingHorizontal={24} paddingTop={18} height={52}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} onPress={back} style={{ width: 40 }}><ArrowLeft size={25} color={PALETTE.secondary} /></Pressable>
            <XStack flex={1} justifyContent="center" gap={7} paddingRight={40}>{[0, 1, 2].map((item) => <View key={item} style={{ width: 54, height: 8, borderRadius: 8, backgroundColor: item <= (step === "name" ? 0 : 1) ? PALETTE.tertiary : PALETTE.surfaceContainer }} />)}</XStack>
          </XStack>
          {step === "name" ? <>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 82 }}>
              <Text color={PALETTE.onSurface} fontFamily={FONTS.headlineBlack} fontSize={30} textAlign="center">{t("profileSetup.nameTitle")}</Text>
              <Text marginTop={10} color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={17} lineHeight={25} textAlign="center">{t("profileSetup.nameDescription")}</Text>
              <TextInput value={name} onChangeText={(value) => { setName(value); setError(""); }} placeholder={t("settings.ownerNamePlaceholder")} placeholderTextColor={PALETTE.inputPlaceholder} maxLength={PERSON_NAME_MAX_LENGTH} autoCapitalize="words" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => { if (!invalidName) setStep("photo"); }} style={{ minHeight: 68, borderRadius: 20, borderWidth: 1.5, borderColor: PALETTE.surfaceContainer, backgroundColor: PALETTE.surfaceContainerLowest, marginTop: 56, paddingHorizontal: 18, fontFamily: FONTS.body, fontSize: 17, color: PALETTE.onSurface }} />
              {nameValidation ? <Text marginTop={10} color={PALETTE.danger} fontFamily={FONTS.bodyMedium} textAlign="center">{getPersonNameValidationMessage(nameValidation, t)}</Text> : null}
              {error ? <Text marginTop={10} color={PALETTE.danger} fontFamily={FONTS.bodyMedium} textAlign="center">{error}</Text> : null}
            </ScrollView>
            <View style={{ paddingHorizontal: 24, gap: 10 }}><PrimaryButton label={t("profileSetup.next")} disabled={invalidName || busy} onPress={() => { setError(""); setStep("photo"); }} /></View>
          </> : <>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 78, alignItems: "center" }} keyboardShouldPersistTaps="handled">
              <Text color={PALETTE.onSurface} fontFamily={FONTS.headlineBlack} fontSize={29} textAlign="center">{t("profileSetup.photoTitle")}</Text>
              <Text marginTop={10} color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={17} lineHeight={25} textAlign="center">{t("profileSetup.photoDescription")}</Text>
              <View style={{ width: 150, height: 150, marginTop: 28, borderRadius: 75, backgroundColor: PALETTE.surfaceContainerLow, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                {photoUri ? <Image source={{ uri: photoUri }} style={{ width: 150, height: 150, borderRadius: 75 }} /> : <YStack alignItems="center" justifyContent="center"><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: PALETTE.secondary, marginTop: 15 }} /><View style={{ width: 76, height: 39, borderTopLeftRadius: 42, borderTopRightRadius: 42, backgroundColor: PALETTE.secondary, marginTop: 7 }} /></YStack>}
              </View>
              <YStack width="100%" gap={10} marginTop={28}>
                <Pressable accessibilityRole="button" onPress={() => void pickPhoto(false)} style={{ minHeight: 66, borderRadius: 24, backgroundColor: PALETTE.tertiary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}><ImagePlus color={PALETTE.onPrimary} size={22} /><Text color={PALETTE.onPrimary} fontFamily={FONTS.bodyBold} fontSize={17}>{t("profileSetup.choosePhoto")}</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => void pickPhoto(true)} style={{ minHeight: 62, borderRadius: 23, backgroundColor: PALETTE.surfaceContainerLow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}><Camera color={PALETTE.secondary} size={22} /><Text color={PALETTE.secondary} fontFamily={FONTS.bodyBold} fontSize={16}>{t("settings.profilePictureTake")}</Text></Pressable>
              </YStack>
              {photoUri ? <Pressable accessibilityRole="button" onPress={() => { if (photoUri !== settings.ownerProfileImageUri) void discardTemporaryPersonPhoto(photoUri); setPhotoUri(null); }} style={{ padding: 12 }}><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("settings.profilePictureRemove")}</Text></Pressable> : null}
              {error ? <Text marginTop={8} color={PALETTE.danger} fontFamily={FONTS.bodyMedium} textAlign="center">{error}</Text> : null}
            </ScrollView>
            <View style={{ marginHorizontal: 24, marginTop: 8, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: PALETTE.surfaceContainerLow, flexDirection: "row", alignItems: "center", gap: 14 }}><Pencil color={PALETTE.primary} size={26} /><Text flex={1} color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={14} lineHeight={21}>{t("profileSetup.reminder")}</Text></View>
            {photoUri ? <View style={{ paddingHorizontal: 24 }}><PrimaryButton label={busy ? t("profileSetup.saving") : t("profileSetup.finishSetup")} disabled={busy} onPress={() => void finish()} /></View> : <View style={{ paddingHorizontal: 24 }}><PrimaryButton label={busy ? t("profileSetup.saving") : t("profileSetup.skipPhoto")} disabled={busy} onPress={() => void finish()} /></View>}
          </>}
        </>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  // Supply a bounded Android focus state instead of the default square highlight.
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} android_ripple={{ color: "rgba(255,250,246,0.24)", borderless: false }} style={{ minHeight: 68, borderRadius: 25, overflow: "hidden", backgroundColor: PALETTE.tertiary, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}><Text color={PALETTE.onPrimary} fontFamily={FONTS.bodyBold} fontSize={18}>{label}</Text></Pressable>;
}
