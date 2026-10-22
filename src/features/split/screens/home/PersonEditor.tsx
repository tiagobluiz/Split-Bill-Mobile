import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { ArrowLeft, Camera, Check, ImagePlus, Search, Users } from "lucide-react-native";
import ColorPicker from "react-native-wheel-color-picker";
import { Text as TText, XStack as TXStack, YStack as TYStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FieldLabel } from "../../../../components/ui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { normalizePersonName, sortPeopleByName, type ParticipantGroup, type SavedPerson } from "../../people";
import type { SplitTagColor } from "../../tags";
import { screenStyles } from "../shared/styles";
import { PhotoOptionsSheet } from "../shared/PhotoOptionsSheet";
import { GroupAvatar } from "../shared/GroupAvatar";
import { getTagColorStyle } from "../shared/TagChips";
import { getAvatarTone } from "../shared/participantUtils";
import { discardTemporaryPersonPhoto, persistPersonPhoto, removePersonPhoto } from "../../personPhotos";
import type { PersonSaveDetails, SavePersonResult } from "../../store";
import type { DraftRecord } from "../../../../storage/records";
import { loadContacts } from "../../contacts";

const Text = TText as any;
const XStack = TXStack as any;
const YStack = TYStack as any;
const COLORS: Array<[SplitTagColor, string]> = [["orange", "#ff8a45"], ["mint", "#8ee8dd"], ["clay", "#d99868"], ["gray", "#dedede"], ["#ffd166", "#ffd166"], ["#5aa9e6", "#5aa9e6"], ["#c77dff", "#c77dff"]];

function normalizePickedColor(value: string): `#${string}` | null {
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(color) ? color as `#${string}` : null;
}

type ContactOption = { id: string; name: string; photoUri: string | null };
type Draft = { name: string; photoUri: string | null; color: SplitTagColor; groupIds: string[] };

export function PersonEditor({ person, people, groups, records, suggestedContactPhoto, onCancel, onOpenExisting, onSave, onBusyChange }: {
  person: SavedPerson | null;
  people: SavedPerson[];
  groups: ParticipantGroup[];
  records: DraftRecord[];
  suggestedContactPhoto?: string | null;
  onCancel: () => void;
  onOpenExisting: (person: SavedPerson, contactPhoto?: string | null) => void;
  onSave: (details: PersonSaveDetails) => Promise<SavePersonResult>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>({
    name: person?.name ?? "",
    photoUri: person?.photoUri ?? null,
    color: person?.color ?? getAvatarTone(person?.name ?? "").background as `#${string}`,
    groupIds: groups.filter((group) => group.memberPersonIds.includes(person?.id ?? "")).map((group) => group.id),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changeBusy = (value: boolean) => { setBusy(value); onBusyChange?.(value); };
  const [contactOpen, setContactOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [usedContactPhoto, setUsedContactPhoto] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => () => {
    if (draftRef.current.photoUri !== person?.photoUri) void discardTemporaryPersonPhoto(draftRef.current.photoUri);
  }, [person?.photoUri]);

  const normalizedName = normalizePersonName(draft.name);
  const duplicate = useMemo(() => normalizedName
    ? people.find((entry) => entry.id !== person?.id && normalizePersonName(entry.name).toLowerCase() === normalizedName.toLowerCase())
    : undefined, [normalizedName, people, person?.id]);

  const importContact = async () => {
    try {
      const Contacts = await loadContacts();
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("groups.contactsDenied"), t("groups.contactsDeniedDescription"), permission.canAskAgain
          ? [{ text: t("common.ok") }]
          : [{ text: t("common.cancel"), style: "cancel" }, { text: t("groups.openSettings"), onPress: () => void Linking.openSettings() }]);
        return;
      }
      const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.Image] });
      setContacts(result.data.map((contact) => ({
        id: contact.id ?? contact.name ?? "",
        name: normalizePersonName(contact.name ?? ""),
        photoUri: contact.image?.uri ?? null,
      })).filter((contact) => contact.id && contact.name));
      setContactQuery("");
      setSelectedContact(null);
      setContactOpen(true);
    } catch {
      Alert.alert(t("groups.contactsError"), t("groups.contactsErrorDescription"), [{ text: t("common.tryAgain"), onPress: () => void importContact() }, { text: t("common.cancel"), style: "cancel" }]);
    }
  };

  if (contactOpen) {
    const filtered = contacts.filter((contact) => contact.name.toLowerCase().includes(contactQuery.trim().toLowerCase()));
    return <YStack flex={1} backgroundColor={PALETTE.surface} paddingTop={insets.top + 12} paddingBottom={insets.bottom + 8} paddingHorizontal="$4" gap="$3">
      <XStack alignItems="center" justifyContent="space-between"><Pressable accessibilityLabel={t("common.back")} onPress={() => setContactOpen(false)}><ArrowLeft color={PALETTE.onSurface} /></Pressable><Text fontFamily={FONTS.headlineBold} fontSize={18}>{t("people.importContactTitle")}</Text><Pressable disabled={!selectedContact} onPress={() => {
        if (!selectedContact) return;
        setDraft((current) => ({ ...current, name: selectedContact.name, photoUri: selectedContact.photoUri ?? current.photoUri }));
        setUsedContactPhoto(Boolean(selectedContact.photoUri));
        setContactOpen(false);
      }}><Text color={selectedContact ? PALETTE.primary : PALETTE.onSurfaceVariant} fontFamily={FONTS.bodyBold}>{t("common.done")}</Text></Pressable></XStack>
      <View style={screenStyles.groupSearchShell}><Search size={17} color={PALETTE.onSurfaceVariant} /><TextInput value={contactQuery} onChangeText={setContactQuery} placeholder={t("people.searchContacts")} style={screenStyles.groupSearchInput} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>{filtered.map((contact) => <Pressable key={contact.id} onPress={() => setSelectedContact(contact)} style={[screenStyles.groupsCompactRow, { backgroundColor: PALETTE.surfaceContainerLowest }]}>
        {contact.photoUri ? <Image source={{ uri: contact.photoUri }} style={screenStyles.participantAvatar} /> : <View style={[screenStyles.groupsPersonAvatar, { backgroundColor: getTagColorStyle("orange").background }]}><Text fontFamily={FONTS.bodyBold}>{contact.name.slice(0, 1).toUpperCase()}</Text></View>}
        <Text flex={1} fontFamily={FONTS.bodyBold}>{contact.name}</Text>{selectedContact?.id === contact.id ? <Check color={PALETTE.primary} /> : null}
      </Pressable>)}{contacts.length === 0 ? <Text paddingTop="$5" textAlign="center" color={PALETTE.onSurfaceVariant}>{t("people.noContacts")}</Text> : null}{contacts.length > 0 && filtered.length === 0 ? <Text paddingTop="$5" textAlign="center" color={PALETTE.onSurfaceVariant}>{t("people.noContactMatches")}</Text> : null}</ScrollView>
    </YStack>;
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PALETTE.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <YStack flex={1} paddingTop={insets.top + 8}>
      <XStack paddingHorizontal="$4" height={48} alignItems="center" justifyContent="space-between"><Pressable disabled={busy} accessibilityLabel={t("common.back")} onPress={() => { if (!busy) onCancel(); }}><ArrowLeft color={PALETTE.onSurface} /></Pressable><Text fontFamily={FONTS.headlineBold} fontSize={17}>{t(person ? "people.editPersonTitle" : "people.createPersonTitle")}</Text><Pressable disabled={busy} onPress={() => { if (!busy) onCancel(); }}><Text fontFamily={FONTS.bodyBold} color={PALETTE.primary}>{t("common.cancel")}</Text></Pressable></XStack>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <YStack gap="$1"><Text fontFamily={FONTS.headlineBlack} fontSize={28}>{t("people.personDetailsTitle")}</Text><Text color={PALETTE.onSurfaceVariant} fontFamily={FONTS.bodyMedium}>{t("people.personDetailsDescription")}</Text>{person?.archivedAt ? <Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("people.archivedEditorHint")}</Text> : null}</YStack>
        {!person && !duplicate ? <Pressable onPress={importContact} style={screenStyles.groupsImportButton}><ImagePlus color={PALETTE.primary} size={19} /><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("people.importContact")}</Text></Pressable> : null}
        <PersonAppearancePanel person={person} draft={draft} setDraft={setDraft} suggestedContactPhoto={suggestedContactPhoto} setUsedContactPhoto={setUsedContactPhoto} />
        <YStack gap="$2" style={screenStyles.groupFormPanel}>
          <FieldLabel>{t("people.personName")}</FieldLabel>
          <View style={screenStyles.assignInputShell}><TextInput value={draft.name} onChangeText={(name) => { setDraft((current) => ({ ...current, name })); setError(""); }} placeholder={t("people.personPlaceholder")} maxLength={25} autoCapitalize="words" style={screenStyles.assignInput} /></View>
          {duplicate ? <YStack gap="$2" paddingTop="$1"><Text color={PALETTE.danger} fontFamily={FONTS.bodyMedium}>{t(duplicate.archivedAt ? "people.archivedDuplicate" : "people.activeDuplicate", { person: duplicate.name })}</Text><Pressable accessibilityRole="button" onPress={() => onOpenExisting(duplicate, usedContactPhoto ? draft.photoUri : null)} style={screenStyles.groupsImportButton}><Users size={17} color={PALETTE.primary} /><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t(duplicate.archivedAt ? "people.restoreAndEdit" : "people.editExisting")}</Text></Pressable></YStack> : null}
          {usedContactPhoto && draft.photoUri ? <Pressable onPress={() => setUsedContactPhoto(false)}><Text color={PALETTE.onSurfaceVariant} fontFamily={FONTS.bodyMedium}>{t("people.contactPhotoImported")}</Text></Pressable> : null}
        </YStack>
        <PersonGroupsSection person={person} groups={groups} groupIds={draft.groupIds} setDraft={setDraft} />
        {error ? <Text accessibilityRole="alert" color={PALETTE.danger} fontFamily={FONTS.bodyBold}>{error}</Text> : null}
      </ScrollView>
      <View style={[screenStyles.groupEditorFooter, { paddingBottom: insets.bottom + 8 }]}><Pressable disabled={busy || Boolean(duplicate)} style={[screenStyles.splitNoticeButton, (busy || duplicate) && { opacity: .55 }]} onPress={async () => {
        setError("");
        if (!normalizedName || duplicate) { setError(t(duplicate ? "people.activeDuplicate" : "people.validationPerson", duplicate ? { person: duplicate.name } : undefined)); return; }
        changeBusy(true);
        let photoUri = draft.photoUri;
        let copiedPhoto = false;
        try {
          if (photoUri && photoUri !== person?.photoUri) {
            const persisted = await persistPersonPhoto(photoUri);
            copiedPhoto = persisted !== photoUri;
            photoUri = persisted;
          }
      const result = await onSave({ personId: person?.id ?? null, name: normalizedName, photoUri, color: draft.color, groupIds: draft.groupIds, restore: Boolean(person?.archivedAt) });
          if (!result.ok) {
            if (copiedPhoto) await removePersonPhoto(photoUri);
            if (result.reason === "split-name-conflict") setError(t("people.splitNameConflict", { split: records.find((record) => record.id === result.recordId)?.values.splitName || t("people.unnamedSplit") }));
            else if (result.reason === "last-group-member") setError(t("people.lastGroupMemberError"));
            else if (result.reason === "duplicate") setError(t(result.personId && people.find((entry) => entry.id === result.personId)?.archivedAt ? "people.archivedDuplicate" : "people.activeDuplicate", { person: people.find((entry) => entry.id === result.personId)?.name ?? normalizedName }));
            else if (result.reason === "persistence") setError(t("common.couldNotSaveSettings"));
            else setError(t("people.validationPerson"));
            changeBusy(false);
            return;
          }
          if (draft.photoUri !== person?.photoUri) await discardTemporaryPersonPhoto(draft.photoUri);
          changeBusy(false);
          onCancel();
        } catch {
          if (copiedPhoto) await removePersonPhoto(photoUri);
          setError(t("common.couldNotSaveSettings"));
        } finally { changeBusy(false); }
      }}><Text textAlign="center" color={PALETTE.onPrimary} fontFamily={FONTS.bodyBold} fontSize={15}>{t(person?.archivedAt ? "people.restoreAndSave" : "settings.currencySave")}</Text></Pressable></View>
    </YStack>
  </KeyboardAvoidingView>;
}

function PersonAppearancePanel({ person, draft, setDraft, suggestedContactPhoto, setUsedContactPhoto }: {
  person: SavedPerson | null;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  suggestedContactPhoto?: string | null;
  setUsedContactPhoto: Dispatch<SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [customColor, setCustomColor] = useState<`#${string}`>(() => person?.color?.startsWith("#") ? person.color as `#${string}` : "#ef476f");
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const name = normalizePersonName(draft.name);

  const choosePhoto = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(camera ? t("settings.profileCameraPermission") : t("settings.profileLibraryPermission"), "", [{ text: t("common.ok") }]);
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: .85 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: .85 });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;
    if (draft.photoUri !== person?.photoUri) await discardTemporaryPersonPhoto(draft.photoUri);
    setDraft((current) => ({ ...current, photoUri: uri }));
    setUsedContactPhoto(false);
  };

  const removePhoto = () => {
      if (draft.photoUri !== person?.photoUri) void discardTemporaryPersonPhoto(draft.photoUri);
      setDraft((current) => ({ ...current, photoUri: null }));
      setUsedContactPhoto(false);
  };

  return <>
    <View style={screenStyles.groupIdentityPanel}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("people.choosePhoto")} onPress={() => setPhotoOptionsOpen(true)}>
      <View style={screenStyles.groupLargeAvatar}>
        {draft.photoUri ? <Image source={{ uri: draft.photoUri }} style={screenStyles.groupLargeAvatarImage} /> : <View style={[screenStyles.groupLargeAvatar, { width: 104, height: 104, backgroundColor: getTagColorStyle(draft.color).background }]}><Text fontFamily={FONTS.bodyBold} fontSize={38} color={getTagColorStyle(draft.color).foreground}>{name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"}</Text></View>}
        <View style={screenStyles.groupCameraBadge}><Camera size={17} color={PALETTE.onPrimary} /></View>
      </View>
    </Pressable>
    {suggestedContactPhoto && person && suggestedContactPhoto !== person.photoUri && draft.photoUri !== suggestedContactPhoto ? <Pressable onPress={() => { setDraft((current) => ({ ...current, photoUri: suggestedContactPhoto })); setUsedContactPhoto(true); }}><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("people.useContactPhoto")}</Text></Pressable> : null}
    {!draft.photoUri ? <>
      <FieldLabel>{t("groups.backgroundColor")}</FieldLabel>
      <View style={screenStyles.groupIdentityColorRow}>{COLORS.map(([color, swatch]) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={t("people.selectColorA11y", { color: color.startsWith("#") ? color : t(`groups.colors.${color}` as any) })} accessibilityState={{ selected: draft.color === color }} style={[screenStyles.groupColorSwatch, { backgroundColor: swatch }, draft.color === color && screenStyles.groupColorSelected]} onPress={() => { setCustomColorOpen(false); setDraft((current) => ({ ...current, color })); }}>{draft.color === color ? <Check size={15} color={getTagColorStyle(color).foreground} /> : null}</Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={t("tags.addCustomColor")} style={[screenStyles.groupCustomColorButton, draft.color.startsWith("#") && screenStyles.tagEditorColorButtonSelected]} onPress={() => { const next = draft.color.startsWith("#") ? draft.color : customColor; setCustomColor(next as `#${string}`); setDraft((current) => ({ ...current, color: next })); setCustomColorOpen((open) => !open); }}><Text color={PALETTE.primary} fontSize={20}>+</Text></Pressable></View>
      {customColorOpen ? <View style={[screenStyles.tagColorPickerPanel, { maxWidth: 360, width: "100%", alignSelf: "center" }]}><ColorPicker color={customColor} onColorChange={(value) => { const next = normalizePickedColor(value); if (next) { setCustomColor(next); setDraft((current) => ({ ...current, color: next })); } }} onColorChangeComplete={(value) => { const next = normalizePickedColor(value); if (next) { setCustomColor(next); setDraft((current) => ({ ...current, color: next })); } }} thumbSize={28} sliderSize={22} noSnap row={false} swatches={false} useNativeDriver={false} useNativeLayout /></View> : null}
    </> : null}
    </View>
    <PhotoOptionsSheet
      visible={photoOptionsOpen}
      title={t("people.photoOptions")}
      cancelLabel={t("common.cancel")}
      uploadLabel={t("settings.profilePictureUpload")}
      cameraLabel={t("settings.profilePictureTake")}
      removeLabel={t("groups.removePhoto")}
      bottomInset={insets.bottom}
      hasPhoto={Boolean(draft.photoUri)}
      onDismiss={() => setPhotoOptionsOpen(false)}
      onUpload={() => { setPhotoOptionsOpen(false); void choosePhoto(false); }}
      onTakePhoto={() => { setPhotoOptionsOpen(false); void choosePhoto(true); }}
      onRemove={() => { setPhotoOptionsOpen(false); removePhoto(); }}
    />
  </>;
}

function PersonGroupsSection({ person, groups, groupIds, setDraft }: {
  person: SavedPerson | null;
  groups: ParticipantGroup[];
  groupIds: string[];
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const { t } = useTranslation();
  return <YStack gap="$2" style={screenStyles.groupFormPanel}>
    <FieldLabel>{t("people.assignGroups")}</FieldLabel>
    {groups.length === 0 ? <Text color={PALETTE.onSurfaceVariant}>{t("people.noGroupsAvailable")}</Text> : sortGroups(groups).map((group) => {
      const selected = groupIds.includes(group.id);
      const lastMember = Boolean(person && group.memberPersonIds.length === 1 && group.memberPersonIds.includes(person.id));
      return <Pressable key={group.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: lastMember }} disabled={lastMember} onPress={() => setDraft((current) => ({ ...current, groupIds: selected ? current.groupIds.filter((id) => id !== group.id) : [...current.groupIds, group.id] }))} style={[screenStyles.groupsCompactRow, { minHeight: 58, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: PALETTE.surfaceContainerLow, opacity: lastMember ? .68 : 1 }]}>
        <GroupAvatar group={group} size={38} /><Text flex={1} fontFamily={FONTS.bodyBold} numberOfLines={1}>{group.name}</Text>{lastMember ? <Text fontSize={11} color={PALETTE.onSurfaceVariant}>{t("people.lastGroupMember")}</Text> : selected ? <Check size={18} color={PALETTE.primary} /> : <View style={screenStyles.groupCustomColorButton} />}
      </Pressable>;
    })}
  </YStack>;
}

function sortGroups(groups: ParticipantGroup[]) {
  return [...groups].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }));
}
