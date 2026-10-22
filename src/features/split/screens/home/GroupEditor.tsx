import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { ArrowLeft, Camera, Check, ChevronRight, ImagePlus, Pencil, Plus, Search, Users } from "lucide-react-native";
import { SystemEmojiPicker, useEmojiKeyboard } from "react-native-system-emoji-picker";
import ColorPicker from "react-native-wheel-color-picker";
import { Text as TText, XStack as TXStack, YStack as TYStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FieldLabel } from "../../../../components/ui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { normalizeGroupName, normalizePersonName, sortPeopleByName, type ParticipantGroup, type SavedPerson } from "../../people";
import { createCustomTagIcon, type SplitTagColor, type SplitTagIcon } from "../../tags";
import { screenStyles } from "../shared/styles";
import { PhotoOptionsSheet } from "../shared/PhotoOptionsSheet";
import { GroupAvatar } from "../shared/GroupAvatar";
import { discardTemporaryGroupPhoto, persistGroupPhoto, removeGroupPhoto } from "../../groupPhotos";
import { getTagIcon } from "../shared/TagChips";
import { ParticipantAvatar, ParticipantRow } from "../shared/participantComponents";
import { loadContacts } from "../../contacts";

const Text = TText as any; const XStack = TXStack as any; const YStack = TYStack as any;
type Draft = { name: string; description: string; photoUri: string | null; icon: SplitTagIcon | null; color: SplitTagColor; memberPersonIds: string[]; newPersonNames: string[] };
const COLORS: Array<[SplitTagColor, string]> = [["orange", "#ff8a45"], ["mint", "#8ee8dd"], ["clay", "#d99868"], ["gray", "#dedede"], ["#ffd166", "#ffd166"], ["#5aa9e6", "#5aa9e6"], ["#c77dff", "#c77dff"]];

function normalizePickedColor(value: string): `#${string}` | null {
  const colorValue = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(colorValue) ? colorValue as `#${string}` : null;
}
function findArchivedNameMatch(people: SavedPerson[], value: string) {
  const normalized = normalizePersonName(value).toLowerCase();
  return people.find((person) => person.archivedAt && normalizePersonName(person.name).toLowerCase() === normalized);
}
function discardGroupPhotoDraft(photoUri: string | null, savedPhotoUri?: string | null) {
  if (photoUri !== savedPhotoUri) void discardTemporaryGroupPhoto(photoUri);
}
export function GroupEditor({ group, initialStep = 1, people, allPeople, groups, ownerName = "", ownerProfileImageUri, onCancel, onSave, onBusyChange }: { group: ParticipantGroup | null; initialStep?: 1 | 2; people: SavedPerson[]; allPeople: SavedPerson[]; groups: ParticipantGroup[]; ownerName?: string; ownerProfileImageUri?: string; onCancel: () => void; onSave: (draft: Draft) => Promise<boolean>; onBusyChange?: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [draft, setDraft] = useState<Draft>({ name: group?.name ?? "", description: group?.description ?? "", photoUri: group?.photoUri ?? null, icon: group?.icon ?? "home", color: group?.color ?? "orange", memberPersonIds: group?.memberPersonIds ?? [], newPersonNames: [] });
  const [customColor, setCustomColor] = useState<`#${string}`>(() => group?.color && group.color.startsWith("#") ? group.color as `#${string}` : "#ef476f");
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [query, setQuery] = useState(""); const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]); const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactOpen, setContactOpen] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const changeBusy = (value: boolean) => { setBusy(value); onBusyChange?.(value); };
  const emojiKeyboard = useEmojiKeyboard();
  const editorScrollRef = useRef<ScrollView>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    editorScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  useEffect(() => () => {
    const uri = draftRef.current.photoUri;
    if (uri !== group?.photoUri) void discardTemporaryGroupPhoto(uri);
  }, [group?.photoUri]);
  const normalized = normalizeGroupName(draft.name);
  const archivedQueryMatch = findArchivedNameMatch(allPeople, query);
  const addByNameKey = archivedQueryMatch ? "groups.addAndRestorePersonByName" : "groups.addPersonByName";
  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const stagedNames = new Set(draft.newPersonNames.map((name) => normalizePersonName(name).toLowerCase()));
    return sortPeopleByName(people.filter((person) => !draft.memberPersonIds.includes(person.id) && !stagedNames.has(normalizePersonName(person.name).toLowerCase()) && person.name.toLowerCase().includes(normalizedQuery)));
  }, [draft.memberPersonIds, draft.newPersonNames, people, query]);
  const rosterMembers = useMemo(() => {
    const byId = new Map(allPeople.map((person) => [person.id, person]));
    const savedMembers = draft.memberPersonIds.map((id) => byId.get(id)).filter((person): person is SavedPerson => Boolean(person));
    return [
      ...sortPeopleByName(savedMembers).map((person) => ({ id: person.id, name: person.name, kind: people.some((active) => active.id === person.id) ? "saved" as const : "archived" as const })),
      ...draft.newPersonNames.map((name) => {
        const archived = allPeople.find((person) => person.archivedAt && normalizePersonName(person.name).toLowerCase() === normalizePersonName(name).toLowerCase());
        return { id: archived?.id ?? `draft:${name}`, name: archived?.name ?? name, kind: archived ? "restore" as const : "draft" as const };
      }),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [allPeople, draft.memberPersonIds, draft.newPersonNames, people]);
  const nameExists = (name: string) => [...people.map((p) => p.name), ...draft.newPersonNames].some((value) => normalizePersonName(value).toLowerCase() === normalizePersonName(name).toLowerCase());
  const addName = (value: string) => { const name = normalizePersonName(value); if (!name) return; const normalizedName = normalizePersonName(name).toLowerCase(); const existing = people.find((p) => normalizePersonName(p.name).toLowerCase() === normalizedName); setDraft((d) => existing ? { ...d, memberPersonIds: [...new Set([...d.memberPersonIds, existing.id])] } : nameExists(name) ? d : { ...d, newPersonNames: [...d.newPersonNames, name] }); setQuery(""); };
  const toggleMember = (id: string) => setDraft((d) => ({ ...d, memberPersonIds: d.memberPersonIds.includes(id) ? d.memberPersonIds.filter((current) => current !== id) : [...d.memberPersonIds, id] }));
  const pickPhoto = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = camera ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: .85 }) : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: .85 });
    if (!result.canceled) {
      const nextPhoto = result.assets[0]?.uri ?? null;
      if (draft.photoUri !== group?.photoUri) await discardTemporaryGroupPhoto(draft.photoUri);
      setDraft((d) => ({ ...d, photoUri: nextPhoto }));
    }
  };
  const importContacts = async () => {
    try {
      const Contacts = await loadContacts();
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert(t("groups.contactsDenied"), t("groups.contactsDeniedDescription"), permission.canAskAgain ? [{ text: t("common.ok") }] : [{ text: t("common.cancel"), style: "cancel" }, { text: t("groups.openSettings"), onPress: () => void Linking.openSettings() }]); return; }
      const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name] }); setContacts(result.data.map((contact) => ({ id: contact.id ?? contact.name ?? "", name: normalizePersonName(contact.name ?? "") })).filter((contact) => contact.id && contact.name)); setSelectedContacts([]); setContactOpen(true);
    }
    catch { Alert.alert(t("groups.contactsError"), t("groups.contactsErrorDescription")); }
  };
  const saveContacts = () => { const selected = contacts.filter((contact) => selectedContacts.includes(contact.id)); const uniqueNames = [...new Map(selected.map((contact) => [normalizePersonName(contact.name).toLowerCase(), normalizePersonName(contact.name)])).values()]; for (const name of uniqueNames) addName(name); setContactOpen(false); };
  const cancelDraft = async () => { if (draft.photoUri !== group?.photoUri) await discardTemporaryGroupPhoto(draft.photoUri); onCancel(); };

  if (contactOpen) return <YStack flex={1} backgroundColor={PALETTE.surface} paddingTop={insets.top + 12} paddingBottom={insets.bottom + 8} paddingHorizontal="$4" gap="$3"><XStack alignItems="center" justifyContent="space-between"><Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => setContactOpen(false)}><ArrowLeft color={PALETTE.primary} /></Pressable><Text fontFamily={FONTS.headlineBold} fontSize={18}>{t("groups.importContacts")}</Text><Pressable accessibilityRole="button" onPress={saveContacts}><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("common.done")}</Text></Pressable></XStack><View style={screenStyles.groupSearchShell}><Search size={17} color={PALETTE.onSurfaceVariant} /><TextInput value={contactQuery} onChangeText={setContactQuery} placeholder={t("people.searchPlaceholder")} style={screenStyles.groupSearchInput} /></View><ScrollView keyboardShouldPersistTaps="handled">{contacts.filter((c) => c.name.toLowerCase().includes(contactQuery.toLowerCase())).map((contact) => <View key={contact.id} style={screenStyles.recentShadowWrap}><Pressable onPress={() => setSelectedContacts((ids) => ids.includes(contact.id) ? ids.filter((id) => id !== contact.id) : [...ids, contact.id])} style={screenStyles.groupsCompactRow}><Text flex={1} fontFamily={FONTS.bodyBold}>{contact.name}</Text>{selectedContacts.includes(contact.id) ? <Check color={PALETTE.primary} /> : null}</Pressable></View>)}{contacts.length === 0 ? <Text paddingTop="$5" textAlign="center" color={PALETTE.onSurfaceVariant}>{t("groups.noContacts")}</Text> : null}</ScrollView></YStack>;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PALETTE.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <YStack flex={1} paddingTop={insets.top + 8}>
      <XStack paddingHorizontal="$4" height={48} alignItems="center" justifyContent="space-between"><Pressable disabled={busy} accessibilityLabel={t("common.back")} onPress={() => step === 2 ? setStep(1) : void cancelDraft()}><ArrowLeft color={PALETTE.onSurface} /></Pressable><YStack alignItems="center"><Text fontFamily={FONTS.headlineBold} fontSize={17}>{t(group ? "people.editGroupTitle" : "people.createGroupTitle")}</Text><Text fontFamily={FONTS.bodyBold} fontSize={10} color={PALETTE.primary}>{t("groups.stepOf", { step, total: 2 })}</Text></YStack><Pressable disabled={busy} onPress={() => void cancelDraft()}><Text fontFamily={FONTS.bodyBold} color={PALETTE.primary}>{t("common.cancel")}</Text></Pressable></XStack>
      <XStack marginHorizontal="$4" marginTop="$3" gap="$1"><View style={[screenStyles.groupProgressTrack, { backgroundColor: step >= 1 ? PALETTE.primary : PALETTE.outlineVariant }]} /><View style={[screenStyles.groupProgressTrack, { backgroundColor: step >= 2 ? PALETTE.primary : PALETTE.outlineVariant }]} /></XStack>
      <ScrollView ref={editorScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 20, gap: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 1 ? <>
          <YStack gap="$1"><Text fontFamily={FONTS.headlineBlack} fontSize={28}>{t("groups.detailsTitle")}</Text><Text color={PALETTE.onSurfaceVariant} fontFamily={FONTS.bodyMedium}>{t("groups.detailsDescription")}</Text></YStack>
          <View style={screenStyles.groupIdentityPanel}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("groups.choosePhoto")} onPress={() => setPhotoOptionsOpen(true)}>
              <View style={screenStyles.groupLargeAvatar}>
                {draft.photoUri ? <Image source={{ uri: draft.photoUri }} style={screenStyles.groupLargeAvatarImage} /> : <GroupAvatar group={draft} size={104} />}
                <View style={screenStyles.groupCameraBadge}><Camera size={17} color={PALETTE.onPrimary} /></View>
              </View>
            </Pressable>
            <PhotoOptionsSheet
              visible={photoOptionsOpen}
              title={t("groups.choosePhoto")}
              cancelLabel={t("common.cancel")}
              uploadLabel={t("groups.photoLibrary")}
              cameraLabel={t("groups.photoCamera")}
              removeLabel={t("groups.removePhoto")}
              bottomInset={insets.bottom}
              hasPhoto={Boolean(draft.photoUri)}
              onDismiss={() => setPhotoOptionsOpen(false)}
              onUpload={() => { setPhotoOptionsOpen(false); void pickPhoto(false); }}
              onTakePhoto={() => { setPhotoOptionsOpen(false); void pickPhoto(true); }}
              onRemove={() => {
                setPhotoOptionsOpen(false);
                discardGroupPhotoDraft(draft.photoUri, group?.photoUri);
                setDraft((current) => ({ ...current, photoUri: null }));
              }}
            />
            {!draft.photoUri ? <>
              <FieldLabel>{t("groups.chooseIcon")}</FieldLabel>
              <View style={screenStyles.groupIdentityOptionsRow}>
                {(["home", "plane", "utensils", "cup", "heart", "briefcase", "receipt", "cart"] as SplitTagIcon[]).map((icon) => {
                  const Icon = getTagIcon(icon);
                  return <Pressable key={icon} accessibilityState={{ selected: draft.icon === icon }} style={[screenStyles.tagEditorIconButton, draft.icon === icon && screenStyles.tagEditorIconButtonSelected]} onPress={() => setDraft((d) => ({ ...d, icon }))}>
                    {Icon ? <Icon color={draft.icon === icon ? PALETTE.primary : PALETTE.onSurfaceVariant} size={18} /> : <Users size={18} />}
                  </Pressable>;
                })}
                <Pressable style={screenStyles.tagEditorIconButton} onPress={() => emojiKeyboard.open()}><Text>{draft.icon?.startsWith("custom:") ? draft.icon.slice(7) : "+"}</Text></Pressable>
              </View>
              <SystemEmojiPicker ref={emojiKeyboard.ref} autoHideAfterSelection dismissOnTapOutside keyboardAppearance="light" onEmojiSelected={(emoji) => {
                const icon = createCustomTagIcon(emoji);
                if (icon) setDraft((d) => ({ ...d, icon }));
              }} />
              <FieldLabel>{t("groups.backgroundColor")}</FieldLabel>
              <View style={screenStyles.groupIdentityColorRow}>
                {COLORS.map(([color, swatch]) => <Pressable key={color} accessibilityState={{ selected: draft.color === color }} style={[screenStyles.groupColorSwatch, { backgroundColor: swatch }, draft.color === color && screenStyles.groupColorSelected]} onPress={() => { setCustomColorOpen(false); setDraft((d) => ({ ...d, color })); }}>{draft.color === color ? <Check size={15} color={PALETTE.onPrimary} /> : null}</Pressable>)}
                <Pressable accessibilityRole="button" accessibilityLabel={t("tags.addCustomColor")} style={[screenStyles.groupCustomColorButton, draft.color.startsWith("#") && screenStyles.tagEditorColorButtonSelected]} onPress={() => {
                  if (customColorOpen) { setCustomColorOpen(false); return; }
                  const nextColor = draft.color.startsWith("#") ? draft.color : customColor;
                  setCustomColor(nextColor as `#${string}`);
                  setDraft((d) => ({ ...d, color: nextColor }));
                  setCustomColorOpen(true);
                }}><Plus color={draft.color.startsWith("#") ? PALETTE.primary : PALETTE.onSurfaceVariant} size={18} /></Pressable>
              </View>
              {customColorOpen ? <View style={[screenStyles.tagColorPickerPanel, { maxWidth: 360, alignSelf: "center" }]}><ColorPicker color={customColor} onColorChange={(value) => {
                const nextColor = normalizePickedColor(value);
                if (nextColor) { setCustomColor(nextColor); setDraft((d) => ({ ...d, color: nextColor })); }
              }} onColorChangeComplete={(value) => {
                const nextColor = normalizePickedColor(value);
                if (nextColor) { setCustomColor(nextColor); setDraft((d) => ({ ...d, color: nextColor })); }
              }} thumbSize={28} sliderSize={22} noSnap row={false} swatches={false} useNativeDriver={false} useNativeLayout /></View> : null}
            </> : null}
          </View>
          <YStack gap="$3" style={screenStyles.groupFormPanel}><YStack gap="$1"><FieldLabel>{t("people.groupName")}</FieldLabel><View style={screenStyles.assignInputShell}><TextInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder={t("people.groupPlaceholder")} maxLength={32} style={screenStyles.assignInput} /></View></YStack><YStack gap="$1"><FieldLabel>{t("groups.descriptionLabel")}</FieldLabel><View style={screenStyles.assignInputShell}><TextInput value={draft.description} onChangeText={(description) => setDraft((d) => ({ ...d, description }))} placeholder={t("groups.descriptionPlaceholder")} maxLength={300} multiline style={[screenStyles.assignInput, { minHeight: 86, textAlignVertical: "top" }]} /></View></YStack></YStack>
        </> : <>
          <YStack gap="$1"><Text fontFamily={FONTS.headlineBlack} fontSize={26}>{t("groups.membersTitle")}</Text><Text color={PALETTE.onSurfaceVariant}>{t("groups.membersDescription")}</Text></YStack>
          <View style={screenStyles.recentShadowWrap}><View style={screenStyles.groupsCompactRow}><GroupAvatar group={draft} size={44} /><YStack flex={1}><Text fontFamily={FONTS.bodyBold}>{normalized || t("people.groupPlaceholder")}</Text><Text color={PALETTE.onSurfaceVariant} numberOfLines={1}>{draft.description}</Text></YStack><Pressable onPress={() => setStep(1)}><Pencil color={PALETTE.primary} size={17} /></Pressable></View></View>
          <View style={screenStyles.groupSearchShell}><Search color={PALETTE.onSurfaceVariant} size={17} /><TextInput value={query} onChangeText={setQuery} placeholder={t("groups.searchPeople")} style={screenStyles.groupSearchInput} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("groups.importContacts")} onPress={importContacts} style={screenStyles.groupsImportButton}><ImagePlus color={PALETTE.primary} size={19} /><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("groups.importContacts")}</Text></Pressable>
          {query.trim() && !nameExists(query) ? <View style={screenStyles.recentShadowWrap}><Pressable accessibilityRole="button" accessibilityLabel={t(addByNameKey, { name: normalizePersonName(query) })} onPress={() => addName(query)} style={screenStyles.groupsCompactRow}><Text flex={1} fontFamily={FONTS.bodyBold}>{t(addByNameKey, { name: normalizePersonName(query) })}</Text><ChevronRight color={PALETTE.primary} /></Pressable></View> : null}
          {searchResults.length ? <YStack gap="$2">{searchResults.map((person) => <View key={person.id} style={screenStyles.recentShadowWrap}><Pressable accessibilityRole="button" accessibilityLabel={t("groups.addMemberA11y", { name: person.name })} onPress={() => toggleMember(person.id)} style={screenStyles.groupsCompactRow}>
            <ParticipantAvatar name={person.name} ownerName={ownerName} ownerProfileImageUri={ownerProfileImageUri} person={person} style={screenStyles.groupsPersonAvatar} label={`${person.name} avatar`} />
            <Text flex={1} fontFamily={FONTS.bodyBold}>{person.name}</Text>
            <Plus color={PALETTE.primary} size={19} />
          </Pressable></View>)}</YStack> : null}
          <YStack gap="$2">
            <FieldLabel>{t("groups.membersInGroup", { count: rosterMembers.length })}</FieldLabel>
            {rosterMembers.length === 0 ? <Text color={PALETTE.onSurfaceVariant}>{t("groups.noMembers")}</Text> : null}
            {rosterMembers.map((person) => <ParticipantRow
              key={`${person.kind}:${person.id}`}
              participant={person}
              person={person.kind === "draft" ? undefined : allPeople.find((saved) => saved.id === person.id)}
              ownerName={ownerName}
              ownerProfileImageUri={ownerProfileImageUri}
              subtitle={person.kind === "draft" ? t("groups.newPersonTag") : person.kind === "archived" ? t("people.archived") : person.kind === "restore" ? t("groups.restorePersonTag") : undefined}
              removeLabel={t("groups.removeMemberA11y", { name: person.name })}
              onRemove={() => person.kind === "draft" || person.kind === "restore" ? setDraft((d) => ({ ...d, newPersonNames: d.newPersonNames.filter((name) => normalizePersonName(name).toLowerCase() !== normalizePersonName(person.name).toLowerCase()) })) : toggleMember(person.id)}
            />)}
          </YStack>
        </>}
        {error ? <Text color={PALETTE.danger} fontFamily={FONTS.bodyBold}>{error}</Text> : null}
      </ScrollView>
      <View style={[screenStyles.groupEditorFooter, { paddingBottom: insets.bottom + 8 }]}><Pressable disabled={busy} style={[screenStyles.splitNoticeButton, busy && { opacity: .55 }]} onPress={async () => {
        setError("");
        if (step === 1) { if (!normalized || groups.some((g) => g.id !== group?.id && g.name.toLowerCase() === normalized.toLowerCase())) { setError(t("people.validationGroup")); return; } setStep(2); return; }
        if (!draft.memberPersonIds.length && !draft.newPersonNames.length) { setError(t("people.validationGroup")); return; }
        changeBusy(true);
        const previousPhoto = group?.photoUri ?? null;
        let durablePhoto = draft.photoUri;
        let copiedPhoto = false;
        try {
          if (durablePhoto && durablePhoto !== previousPhoto) {
            const source = durablePhoto;
            durablePhoto = await persistGroupPhoto(source);
            copiedPhoto = durablePhoto !== source;
          }
          const saved = await onSave({ ...draft, photoUri: durablePhoto, name: normalized });
          if (!saved) {
            if (copiedPhoto) await removeGroupPhoto(durablePhoto);
            setError(t("people.validationGroup"));
          } else if (previousPhoto && previousPhoto !== durablePhoto) {
            await removeGroupPhoto(previousPhoto);
          }
        } catch {
          if (copiedPhoto) await removeGroupPhoto(durablePhoto);
          setError(t("common.couldNotSaveSettings"));
        } finally { changeBusy(false); }
      }}><Text textAlign="center" color={PALETTE.onPrimary} fontFamily={FONTS.bodyBold} fontSize={15}>{t(step === 1 ? "groups.continueMembers" : "groups.finishGroup")}</Text></Pressable>{step === 2 ? <Pressable onPress={() => setStep(1)}><Text textAlign="center" color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("groups.backToDetails")}</Text></Pressable> : null}</View>
    </YStack>
  </KeyboardAvoidingView>;
}
