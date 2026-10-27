import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { EllipsisVertical, Pencil, Plus, Search, Trash2, Users, RotateCcw } from "lucide-react-native";
import { Text as TText, XStack as TXStack, YStack as TYStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppSettings } from "../../../../storage/settings";
import type { DraftRecord } from "../../../../storage/records";
import type { PersonSaveDetails, SavePersonResult } from "../../store";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { sortPeopleByName, type ParticipantGroup, type SavedPerson } from "../../people";
import { GroupEditor } from "./GroupEditor";
import { PersonEditor } from "./PersonEditor";
import { OwnerProfileEditor } from "./OwnerProfileEditor";
import { HomeMainHeader } from "./HomeMainHeader";
import { GroupAvatar } from "../shared/GroupAvatar";
import { ParticipantAvatar } from "../shared/participantComponents";
import { ConfirmChoiceModal } from "../shared/modals";
import { ActionListSheet } from "../shared/ActionListSheet";
import { screenStyles } from "../shared/styles";

const Text = TText as any;
const XStack = TXStack as any;
const YStack = TYStack as any;

export function HomeGroupsTabContent({ topInset, footerInsetBottom, settings, records, ownerProfileEditRequest = 0, onOwnerProfileEditRequestHandled, onOwnerProfileEditorOpen, onOwnerProfileEditorClose, onSavePerson, onUpdateSettings, onGetPersonDeletionImpact, onRemovePerson, onAddGroup, onUpdateGroup, onRemoveGroup }: {
  topInset: number; footerInsetBottom: number; settings: AppSettings;
  ownerProfileEditRequest?: number;
  onOwnerProfileEditRequestHandled?: () => void;
  onOwnerProfileEditorOpen?: () => void;
  onOwnerProfileEditorClose?: () => void;
  records: DraftRecord[];
  onSavePerson: (details: PersonSaveDetails) => Promise<SavePersonResult>;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onGetPersonDeletionImpact: (personId: string) => { used: boolean; splitCount: number; groupCount: number };
  onRemovePerson: (personId: string) => Promise<"deleted" | "archived" | "missing">;
  onAddGroup: (name: string, ids: string[], details?: Partial<Pick<ParticipantGroup, "description" | "photoUri" | "icon" | "color">>, newNames?: string[]) => Promise<boolean>;
  onUpdateGroup: (groupId: string, details: Partial<ParticipantGroup> & { name: string; memberPersonIds: string[] }) => Promise<boolean>;
  onRemoveGroup: (groupId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"groups" | "people">("people");
  const [search, setSearch] = useState("");
  const [editingGroup, setEditingGroup] = useState<ParticipantGroup | null | "new">(null);
  const [groupEditorStep, setGroupEditorStep] = useState<1 | 2>(1);
  const [groupActionMenu, setGroupActionMenu] = useState<ParticipantGroup | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<ParticipantGroup | null>(null);
  const [editingPerson, setEditingPerson] = useState<SavedPerson | null | "new">(null);
  const [editingOwner, setEditingOwner] = useState(ownerProfileEditRequest > 0);
  const [suggestedContactPhoto, setSuggestedContactPhoto] = useState<string | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<"active" | "archived">("active");
  const [personActionMenu, setPersonActionMenu] = useState<SavedPerson | null>(null);
  const [pendingDeletePerson, setPendingDeletePerson] = useState<SavedPerson | null>(null);
  const [deletionError, setDeletionError] = useState(false);
  const groupSaveInProgress = useRef(false);
  const personSaveInProgress = useRef(false);
  const longPressedGroupId = useRef<string | null>(null);
  const longPressedPersonId = useRef<string | null>(null);
  const allPeople = useMemo(() => sortPeopleByName((settings.people ?? []).filter((person) => person.id !== settings.ownerPersonId)), [settings.people, settings.ownerPersonId]);
  const people = useMemo(() => allPeople.filter((p) => !p.archivedAt), [allPeople]);
  const groups = useMemo(() => [...(settings.participantGroups ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })), [settings.participantGroups]);
  const filteredGroups = groups.filter((group) => group.name.toLowerCase().includes(search.trim().toLowerCase()));
  const showGroupsEmptyState = tab === "groups" && groups.length === 0 && !search.trim();
  const showPeopleEmptyState = tab === "people" && peopleFilter === "active" && people.length === 0 && !search.trim();
  const byId = useMemo(() => new Map((settings.people ?? []).map((p) => [p.id, p])), [settings.people]);
  const filteredPeople = allPeople.filter((p) => (peopleFilter === "archived") === Boolean(p.archivedAt) && p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const showOwner = peopleFilter === "active" && settings.ownerName.toLowerCase().includes(search.trim().toLowerCase());

  useEffect(() => {
    if (!groupActionMenu) longPressedGroupId.current = null;
  }, [groupActionMenu]);

  useEffect(() => {
    if (!personActionMenu) longPressedPersonId.current = null;
  }, [personActionMenu]);

  useEffect(() => {
    if (ownerProfileEditRequest > 0) {
      onOwnerProfileEditRequestHandled?.();
    }
  }, [onOwnerProfileEditRequestHandled, ownerProfileEditRequest]);

  useEffect(() => {
    if (!groupActionMenu) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setGroupActionMenu(null);
      return true;
    });
    return () => subscription.remove();
  }, [groupActionMenu]);

  useEffect(() => {
    if (!pendingDeleteGroup) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPendingDeleteGroup(null);
      return true;
    });
    return () => subscription.remove();
  }, [pendingDeleteGroup]);

  useEffect(() => {
    if (!personActionMenu && !pendingDeletePerson) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPersonActionMenu(null);
      setPendingDeletePerson(null);
      return true;
    });
    return () => subscription.remove();
  }, [personActionMenu, pendingDeletePerson]);

  useEffect(() => {
    if (!editingOwner) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!personSaveInProgress.current) {
        setEditingOwner(false);
        onOwnerProfileEditorClose?.();
      }
      return true;
    });
    return () => subscription.remove();
  }, [editingOwner, onOwnerProfileEditorClose]);

  if (editingGroup !== null) return <Modal visible animationType="slide" statusBarTranslucent={false} onRequestClose={() => { if (!groupSaveInProgress.current) setEditingGroup(null); }}><GroupEditor key={`${editingGroup === "new" ? "new" : editingGroup.id}:${groupEditorStep}`} group={editingGroup === "new" ? null : editingGroup} initialStep={groupEditorStep} people={people} allPeople={settings.people ?? []} groups={groups} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} onBusyChange={(busy) => { groupSaveInProgress.current = busy; }} onCancel={() => { if (!groupSaveInProgress.current) setEditingGroup(null); }} onSave={async (payload) => {
    const saved = editingGroup === "new"
      ? await onAddGroup(payload.name, payload.memberPersonIds, payload, payload.newPersonNames)
      : await onUpdateGroup(editingGroup.id, payload);
    if (saved) setEditingGroup(null);
    return saved;
  }} /></Modal>;

  if (editingPerson !== null) return <Modal visible animationType="slide" onRequestClose={() => { if (!personSaveInProgress.current) setEditingPerson(null); }}><PersonEditor key={`${editingPerson === "new" ? "new" : editingPerson.id}:${suggestedContactPhoto ?? ""}`} person={editingPerson === "new" ? null : editingPerson} people={allPeople} groups={groups} records={records} suggestedContactPhoto={suggestedContactPhoto} onBusyChange={(busy) => { personSaveInProgress.current = busy; }} onCancel={() => { if (!personSaveInProgress.current) { setEditingPerson(null); setSuggestedContactPhoto(null); } }} onOpenExisting={(existing, contactPhoto) => { setSuggestedContactPhoto(contactPhoto ?? null); setEditingPerson(existing); }} onSave={onSavePerson} /></Modal>;
  if (editingOwner) return <OwnerProfileEditor settings={settings} records={records} onSave={onUpdateSettings} onBusyChange={(busy) => { personSaveInProgress.current = busy; }} onClose={() => { if (!personSaveInProgress.current) { setEditingOwner(false); onOwnerProfileEditorClose?.(); } }} />;
  return <YStack flex={1}>
    <HomeMainHeader topInset={topInset} />
    <ScrollView style={screenStyles.flex} contentContainerStyle={[screenStyles.mainTabScrollContent, (showGroupsEmptyState || showPeopleEmptyState) && { flexGrow: 1 }, { paddingBottom: footerInsetBottom + 96 }]} showsVerticalScrollIndicator={false}>
      <YStack flex={1} gap="$3">
        <View style={screenStyles.modePillSegmentedShell}>{(["people", "groups"] as const).map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[screenStyles.modePillSegmentedButton, tab === key && screenStyles.modePillSegmentedButtonActive]} onPress={() => { setTab(key); setSearch(""); }}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={tab === key ? PALETTE.primary : PALETTE.onSurfaceVariant}>{t(key === "groups" ? "groups.tabGroups" : "groups.tabPeople", { count: key === "groups" ? groups.length : people.length + 1 })}</Text></Pressable>)}</View>
        <View style={screenStyles.groupSearchShell}><Search color={PALETTE.onSurfaceVariant} size={17} /><TextInput value={search} onChangeText={setSearch} placeholder={t(tab === "people" ? "people.searchPeoplePlaceholder" : "groups.searchGroupsPlaceholder")} placeholderTextColor={PALETTE.inputPlaceholder} style={screenStyles.groupSearchInput} /></View>
        {tab === "groups" ? showGroupsEmptyState ? <DirectoryEmptyState title={t("groups.emptyTitle")} description={t("groups.emptyDescription")} actionLabel={t("groups.createGroupAction")} onAction={() => { setGroupEditorStep(1); setEditingGroup("new"); }} /> : <YStack gap="$2.5">{filteredGroups.map((group) => {
          const members = group.memberPersonIds.map((id) => byId.get(id)).filter((p): p is SavedPerson => Boolean(p));
          return <View key={group.id} style={screenStyles.recentShadowWrap}>
            <Pressable accessibilityRole="button" accessibilityLabel={group.name} onLongPress={() => { longPressedGroupId.current = group.id; setGroupActionMenu(group); }} onPress={() => {
              if (longPressedGroupId.current === group.id) {
                longPressedGroupId.current = null;
                return;
              }
              openGroupEditor(group, 1);
            }} style={[screenStyles.groupsCompactRow, { flexDirection: "column", alignItems: "stretch", paddingHorizontal: 16, paddingVertical: 16, gap: 12 }]}>
              <XStack alignItems="flex-start" gap="$3">
                <GroupAvatar group={group} size={56} />
                <YStack flex={1} minHeight={56} minWidth={0} justifyContent={group.description ? "flex-start" : "center"}>
                <XStack alignItems={group.description ? "flex-start" : "center"} gap="$3">
                  <YStack flex={1} gap="$1" minWidth={0}>
                    <Text numberOfLines={1} fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>{group.name}</Text>
                    {group.description ? <Text numberOfLines={2} fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={20} color={PALETTE.onSurfaceVariant}>{group.description}</Text> : null}
                  </YStack>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("groups.openActionsA11y", { group: group.name })} accessibilityHint={t("groups.openActionsHint")} hitSlop={8} onPress={(event) => { event?.stopPropagation?.(); setGroupActionMenu(group); }}>
                    <EllipsisVertical size={20} color={PALETTE.onSurfaceVariant} />
                  </Pressable>
                </XStack>
                </YStack>
              </XStack>
              <XStack alignItems="center" gap="$2">
                <View style={{ flex: 1, minWidth: 0 }}><GroupMemberAvatars members={members} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} onPress={() => openGroupEditor(group, 2)} groupName={group.name} /></View>
                <XStack alignItems="center" gap="$1"><Users size={17} color={PALETTE.onSurfaceVariant} /><Text fontFamily={FONTS.bodyMedium} fontSize={13} color={PALETTE.onSurfaceVariant}>{t("people.memberCount", { count: members.length })}</Text></XStack>
              </XStack>
            </Pressable>
          </View>;
        })}{filteredGroups.length === 0 ? <Text fontFamily={FONTS.bodyMedium} fontSize={14} color={PALETTE.onSurfaceVariant}>{t("groups.noSearchMatches")}</Text> : null}</YStack> : <YStack>
          <View style={screenStyles.peopleFilterPills}>{(["active", "archived"] as const).map((filter) => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: peopleFilter === filter }} style={[screenStyles.peopleFilterPill, peopleFilter === filter && screenStyles.peopleFilterPillActive]} onPress={() => setPeopleFilter(filter)}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={peopleFilter === filter ? PALETTE.onPrimary : PALETTE.onSurfaceVariant}>{t(filter === "active" ? "people.filterActive" : "people.filterArchived", { count: filter === "active" ? people.length + 1 : allPeople.filter((entry) => Boolean(entry.archivedAt)).length })}</Text></Pressable>)}</View>
          <YStack flex={showPeopleEmptyState ? 1 : undefined} gap="$2.5">{showOwner ? <View style={[screenStyles.recentShadowWrap, { marginTop: 8 }]}><Pressable accessibilityRole="button" accessibilityLabel={t("people.yourProfile")} onPress={() => { onOwnerProfileEditorOpen?.(); setEditingOwner(true); }} style={[screenStyles.groupsCompactRow, { borderWidth: 1.5, borderColor: PALETTE.primaryContainer, backgroundColor: PALETTE.surfaceContainerLow }]}>
            <ParticipantAvatar name={settings.ownerName} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} person={byId.get(settings.ownerPersonId ?? "")} style={screenStyles.groupsPersonAvatar} label={`${settings.ownerName} avatar`} textSize={18} />
            <YStack flex={1} gap="$0.5"><Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface} numberOfLines={1}>{settings.ownerName}</Text><Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.primary}>{t("people.yourProfile")}</Text></YStack>
            <Pencil size={18} color={PALETTE.primary} />
          </Pressable></View> : null}{filteredPeople.map((person) => <View key={person.id} style={screenStyles.recentShadowWrap}><Pressable accessibilityRole="button" accessibilityLabel={t("people.editPersonA11y", { person: person.name })} onLongPress={() => { longPressedPersonId.current = person.id; setPersonActionMenu(person); }} onPress={() => { if (longPressedPersonId.current === person.id) { longPressedPersonId.current = null; return; } setEditingPerson(person); }} style={screenStyles.groupsCompactRow}>
            <ParticipantAvatar name={person.name} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} person={person} style={screenStyles.groupsPersonAvatar} label={`${person.name} avatar`} textSize={18} />
            <Text flex={1} fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface} numberOfLines={1}>{person.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("people.openPersonActionsA11y", { person: person.name })} hitSlop={8} onPress={(event) => { event?.stopPropagation?.(); setPersonActionMenu(person); }}><EllipsisVertical size={20} color={PALETTE.onSurfaceVariant} /></Pressable>
          </Pressable></View>)}
          {showPeopleEmptyState ? <DirectoryEmptyState title={t("people.emptyActiveTitle")} description={t("people.emptyActive")} actionLabel={t("people.addPerson")} topSpacing={18} onAction={() => { setSuggestedContactPhoto(null); setEditingPerson("new"); }} /> : filteredPeople.length === 0 && (!search.trim() || !showOwner) ? <Text paddingVertical="$3" paddingHorizontal="$2" textAlign="center" color={PALETTE.onSurfaceVariant}>{search.trim() ? t("people.noSearchMatches") : t("people.emptyArchived")}</Text> : null}</YStack>
        </YStack>}
      </YStack>
    </ScrollView>
    {!showGroupsEmptyState && !showPeopleEmptyState ? <Pressable accessibilityRole="button" accessibilityLabel={tab === "groups" ? t("people.addGroup") : t("people.addPerson")} style={[screenStyles.groupsFab, { bottom: footerInsetBottom + 18 }]} onPress={() => { if (tab === "groups") { setGroupEditorStep(1); setEditingGroup("new"); } else { setSuggestedContactPhoto(null); setEditingPerson("new"); } }}><Plus size={27} color={PALETTE.onPrimary} /></Pressable> : null}
    <HomeDirectoryOverlays
      personActionMenu={personActionMenu}
      pendingDeletePerson={pendingDeletePerson}
      groupActionMenu={groupActionMenu}
      pendingDeleteGroup={pendingDeleteGroup}
      deletionError={deletionError}
      onGetPersonDeletionImpact={onGetPersonDeletionImpact}
      onRemovePerson={onRemovePerson}
      onRemoveGroup={onRemoveGroup}
      onDismissPersonActions={() => { setPersonActionMenu(null); longPressedPersonId.current = null; }}
      onDismissGroupActions={() => { setGroupActionMenu(null); longPressedGroupId.current = null; }}
      onEditPerson={(person) => { setEditingPerson(person); setPersonActionMenu(null); longPressedPersonId.current = null; }}
      onPendingDeletePerson={setPendingDeletePerson}
      onPendingDeleteGroup={setPendingDeleteGroup}
      onEditGroup={(group, step) => { setGroupActionMenu(null); openGroupEditor(group, step); }}
      onDeletionError={setDeletionError}
    />
  </YStack>;

  function openGroupEditor(group: ParticipantGroup, step: 1 | 2) {
    setGroupEditorStep(step);
    setEditingGroup(group);
  }
}

function HomeDirectoryOverlays({ personActionMenu, pendingDeletePerson, groupActionMenu, pendingDeleteGroup, deletionError, onGetPersonDeletionImpact, onRemovePerson, onRemoveGroup, onDismissPersonActions, onDismissGroupActions, onEditPerson, onPendingDeletePerson, onPendingDeleteGroup, onEditGroup, onDeletionError }: {
  personActionMenu: SavedPerson | null; pendingDeletePerson: SavedPerson | null;
  groupActionMenu: ParticipantGroup | null; pendingDeleteGroup: ParticipantGroup | null;
  deletionError: boolean;
  onGetPersonDeletionImpact: (personId: string) => { used: boolean; splitCount: number; groupCount: number };
  onRemovePerson: (personId: string) => Promise<"deleted" | "archived" | "missing">;
  onRemoveGroup: (groupId: string) => Promise<void>;
  onDismissPersonActions: () => void; onDismissGroupActions: () => void;
  onEditPerson: (person: SavedPerson) => void;
  onPendingDeletePerson: (person: SavedPerson | null) => void;
  onPendingDeleteGroup: (group: ParticipantGroup | null) => void;
  onEditGroup: (group: ParticipantGroup, step: 1 | 2) => void;
  onDeletionError: (hasError: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const actionImpact = personActionMenu ? onGetPersonDeletionImpact(personActionMenu.id) : null;
  const confirmImpact = pendingDeletePerson ? onGetPersonDeletionImpact(pendingDeletePerson.id) : null;
  const destructiveAction = actionImpact?.used ? "people.archivePersonAction" : "people.deletePersonAction";
  const destructiveA11y = actionImpact?.used ? "people.archivePersonA11y" : "people.deletePersonA11y";
  return <>
    {personActionMenu ? <ActionListSheet visible title={t("people.personActionsTitle", { person: personActionMenu.name })} cancelLabel={t("common.cancel")} bottomInset={insets.bottom} onDismiss={onDismissPersonActions} options={personActionMenu.archivedAt ? [
      { label: t("people.restorePerson"), accessibilityLabel: t("people.restorePersonA11y", { person: personActionMenu.name }), description: t("people.restorePersonDescription"), icon: <RotateCcw size={25} color={PALETTE.primary} />, onPress: () => onEditPerson(personActionMenu) },
      ...(!actionImpact?.used ? [{ label: t("people.deletePersonAction"), accessibilityLabel: t("people.deletePersonA11y", { person: personActionMenu.name }), description: t("people.deletePermanentlyDescription"), icon: <Trash2 size={25} color={PALETTE.danger} />, tone: "danger" as const, onPress: () => { onPendingDeletePerson(personActionMenu); onDismissPersonActions(); } }] : []),
    ] : [
      { label: t("people.editPersonAction"), accessibilityLabel: t("people.editPersonA11y", { person: personActionMenu.name }), description: t("people.editPersonDescription"), icon: <Pencil size={25} color={PALETTE.primary} />, onPress: () => onEditPerson(personActionMenu) },
      { label: t(destructiveAction), accessibilityLabel: t(destructiveA11y, { person: personActionMenu.name }), description: t(actionImpact?.used ? "people.deletePersonArchiveDescription" : "people.deletePermanentlyDescription"), icon: <Trash2 size={25} color={PALETTE.danger} />, tone: "danger", onPress: () => { onPendingDeletePerson(personActionMenu); onDismissPersonActions(); } },
    ]} /> : null}
    {pendingDeletePerson && confirmImpact ? <ConfirmChoiceModal title={t(confirmImpact.used ? "people.archivePersonTitle" : "people.deletePersonTitle")} body={`${t(confirmImpact.used ? "people.deletePersonArchivePrompt" : "people.deletePersonPermanentPrompt", { person: pendingDeletePerson.name })}${deletionError ? `\n${t("common.couldNotSaveSettings")}` : ""}`} confirmLabel={t(confirmImpact.used ? "people.archivePersonAction" : "people.deletePersonAction")} confirmButtonVariant="danger" discardLabel={t("common.cancel")} onConfirm={() => { onDeletionError(false); void onRemovePerson(pendingDeletePerson.id).then(() => { onDeletionError(false); onPendingDeletePerson(null); }).catch(() => onDeletionError(true)); }} onDiscard={() => { onPendingDeletePerson(null); onDeletionError(false); }} /> : null}
    {groupActionMenu ? <ActionListSheet visible title={t("groups.actionsTitle")} cancelLabel={t("common.cancel")} bottomInset={insets.bottom} onDismiss={onDismissGroupActions} options={[
      { label: t("groups.editDetails"), accessibilityLabel: t("groups.openDetailsA11y", { group: groupActionMenu.name }), description: t("groups.editDetailsDescription"), icon: <Pencil color={PALETTE.primary} size={25} />, onPress: () => onEditGroup(groupActionMenu, 1) },
      { label: t("groups.editMembers"), accessibilityLabel: t("groups.openMembersA11y", { group: groupActionMenu.name }), description: t("groups.editMembersDescription"), icon: <Users color={PALETTE.primary} size={25} />, onPress: () => onEditGroup(groupActionMenu, 2) },
      { label: t("groups.deleteAction"), accessibilityLabel: t("people.deleteGroupA11y", { group: groupActionMenu.name }), description: t("groups.deleteDescription"), icon: <Trash2 color={PALETTE.danger} size={25} />, tone: "danger", onPress: () => { onPendingDeleteGroup(groupActionMenu); onDismissGroupActions(); } },
    ]} /> : null}
    {pendingDeleteGroup ? <ConfirmChoiceModal title={t("groups.deleteTitle")} body={`${t("groups.deletePrompt", { group: pendingDeleteGroup.name })}${deletionError ? `\n${t("common.couldNotSaveSettings")}` : ""}`} confirmLabel={t("groups.deleteAction")} confirmButtonVariant="danger" discardLabel={t("common.cancel")} onConfirm={() => { onDeletionError(false); void onRemoveGroup(pendingDeleteGroup.id).then(() => { onDeletionError(false); onPendingDeleteGroup(null); }).catch(() => onDeletionError(true)); }} onDiscard={() => { onPendingDeleteGroup(null); onDeletionError(false); }} /> : null}
  </>;
}

function DirectoryEmptyState({ title, description, actionLabel, topSpacing = 0, onAction }: { title: string; description: string; actionLabel: string; topSpacing?: number; onAction: () => void }) {
  return <View style={[screenStyles.groupsEmptyState, topSpacing > 0 ? { marginTop: topSpacing } : null]}>
    <View style={screenStyles.groupsEmptyIcon}><Users size={42} color={PALETTE.primary} /></View>
    <Text fontFamily={FONTS.headlineBold} fontSize={22} color={PALETTE.onSurface} textAlign="center">{title}</Text>
    <Text fontFamily={FONTS.body} fontSize={16} lineHeight={24} color={PALETTE.onSurfaceVariant} textAlign="center" maxWidth={300}>{description}</Text>
    <Pressable accessibilityRole="button" onPress={onAction} style={screenStyles.groupsEmptyCreateButton}>
      <Plus size={22} color={PALETTE.onPrimary} /><Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onPrimary}>{actionLabel}</Text>
    </Pressable>
  </View>;
}

function GroupMemberAvatars({ members, ownerName, ownerProfileImageUri, onPress, groupName }: { members: SavedPerson[]; ownerName: string; ownerProfileImageUri: string; onPress: () => void; groupName: string }) {
  const [width, setWidth] = useState(0);
  const diameter = 30;
  const overlap = 2;
  const capacity = width > 0 ? Math.max(1, Math.floor((width - overlap) / (diameter - overlap))) : 3;
  const visibleCount = members.length > capacity ? Math.max(0, capacity - 1) : capacity;
  const visibleMembers = members.slice(0, visibleCount);
  const overflow = members.length - visibleMembers.length;

  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ minHeight: 32, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
    {visibleMembers.map((person, index) => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`${person.name}, edit members of ${groupName}`} hitSlop={4} onPress={(event) => { event?.stopPropagation?.(); onPress(); }} style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: visibleMembers.length - index }}><ParticipantAvatar name={person.name} ownerName={ownerName} ownerProfileImageUri={ownerProfileImageUri} person={person} style={[screenStyles.participantAvatar, { width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 2, borderColor: PALETTE.surfaceContainerLowest }]} label={`${person.name} avatar`} textSize={11} /></Pressable>)}
    {overflow > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`${overflow} more members of ${groupName}, edit group members`} onPress={(event) => { event?.stopPropagation?.(); onPress(); }} style={{ width: diameter, height: diameter, marginLeft: visibleMembers.length ? -overlap : 0, zIndex: 0, borderRadius: diameter / 2, borderWidth: 2, borderColor: PALETTE.surfaceContainerLowest, alignItems: "center", justifyContent: "center", backgroundColor: PALETTE.surfaceContainerHighest }}><Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant}>+{overflow}</Text></Pressable> : null}
  </View>;
}
