import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { EllipsisVertical, Pencil, Plus, Search, Trash2, Users, RotateCcw } from "lucide-react-native";
import { Text as TText, XStack as TXStack, YStack as TYStack } from "tamagui";
import { SectionEyebrow } from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import type { DraftRecord } from "../../../../storage/records";
import type { PersonSaveDetails, SavePersonResult } from "../../store";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { sortPeopleByName, type ParticipantGroup, type SavedPerson } from "../../people";
import { GroupEditor } from "./GroupEditor";
import { PersonEditor } from "./PersonEditor";
import { HomeMainHeader } from "./HomeMainHeader";
import { GroupAvatar } from "../shared/GroupAvatar";
import { ParticipantAvatar } from "../shared/participantComponents";
import { ActionIconGridModal, ConfirmChoiceModal } from "../shared/modals";
import { screenStyles } from "../shared/styles";

const Text = TText as any;
const XStack = TXStack as any;
const YStack = TYStack as any;

export function HomeGroupsTabContent({ topInset, footerInsetBottom, settings, records, onSavePerson, onGetPersonDeletionImpact, onRemovePerson, onAddGroup, onUpdateGroup, onRemoveGroup }: {
  topInset: number; footerInsetBottom: number; settings: AppSettings;
  records: DraftRecord[];
  onSavePerson: (details: PersonSaveDetails) => Promise<SavePersonResult>;
  onGetPersonDeletionImpact: (personId: string) => { used: boolean; splitCount: number; groupCount: number };
  onRemovePerson: (personId: string) => Promise<"deleted" | "archived" | "missing">;
  onAddGroup: (name: string, ids: string[], details?: Partial<Pick<ParticipantGroup, "description" | "photoUri" | "icon" | "color">>, newNames?: string[]) => Promise<boolean>;
  onUpdateGroup: (groupId: string, details: Partial<ParticipantGroup> & { name: string; memberPersonIds: string[] }) => Promise<boolean>;
  onRemoveGroup: (groupId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"groups" | "people">("groups");
  const [search, setSearch] = useState("");
  const [editingGroup, setEditingGroup] = useState<ParticipantGroup | null | "new">(null);
  const [groupEditorStep, setGroupEditorStep] = useState<1 | 2>(1);
  const [groupActionMenu, setGroupActionMenu] = useState<ParticipantGroup | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<ParticipantGroup | null>(null);
  const [editingPerson, setEditingPerson] = useState<SavedPerson | null | "new">(null);
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
  const byId = useMemo(() => new Map((settings.people ?? []).map((p) => [p.id, p])), [settings.people]);
  const filteredPeople = allPeople.filter((p) => (peopleFilter === "archived") === Boolean(p.archivedAt) && p.name.toLowerCase().includes(search.trim().toLowerCase()));

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

  if (editingGroup !== null) return <Modal visible animationType="slide" statusBarTranslucent={false} onRequestClose={() => { if (!groupSaveInProgress.current) setEditingGroup(null); }}><GroupEditor key={`${editingGroup === "new" ? "new" : editingGroup.id}:${groupEditorStep}`} group={editingGroup === "new" ? null : editingGroup} initialStep={groupEditorStep} people={people} allPeople={settings.people ?? []} groups={groups} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} onBusyChange={(busy) => { groupSaveInProgress.current = busy; }} onCancel={() => { if (!groupSaveInProgress.current) setEditingGroup(null); }} onSave={async (payload) => {
    const saved = editingGroup === "new"
      ? await onAddGroup(payload.name, payload.memberPersonIds, payload, payload.newPersonNames)
      : await onUpdateGroup(editingGroup.id, payload);
    if (saved) setEditingGroup(null);
    return saved;
  }} /></Modal>;

  if (editingPerson !== null) return <Modal visible animationType="slide" onRequestClose={() => { if (!personSaveInProgress.current) setEditingPerson(null); }}><PersonEditor key={`${editingPerson === "new" ? "new" : editingPerson.id}:${suggestedContactPhoto ?? ""}`} person={editingPerson === "new" ? null : editingPerson} people={allPeople} groups={groups} records={records} suggestedContactPhoto={suggestedContactPhoto} onBusyChange={(busy) => { personSaveInProgress.current = busy; }} onCancel={() => { if (!personSaveInProgress.current) { setEditingPerson(null); setSuggestedContactPhoto(null); } }} onOpenExisting={(existing, contactPhoto) => { setSuggestedContactPhoto(contactPhoto ?? null); setEditingPerson(existing); }} onSave={onSavePerson} /></Modal>;

  return <YStack flex={1}>
    <HomeMainHeader topInset={topInset} />
    <ScrollView style={screenStyles.flex} contentContainerStyle={[screenStyles.mainTabScrollContent, { paddingBottom: footerInsetBottom + 96 }]} showsVerticalScrollIndicator={false}>
      <YStack gap="$4">
        <YStack gap="$1.5"><SectionEyebrow>{t("groups.directoryEyebrow")}</SectionEyebrow><Text fontFamily={FONTS.headlineBlack} fontSize={32} color={PALETTE.onSurface}>{t("home.tab.groups")}</Text></YStack>
        <View style={screenStyles.modePillSegmentedShell}>{(["groups", "people"] as const).map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[screenStyles.modePillSegmentedButton, tab === key && screenStyles.modePillSegmentedButtonActive]} onPress={() => { setTab(key); setSearch(""); }}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={tab === key ? PALETTE.primary : PALETTE.onSurfaceVariant}>{t(key === "groups" ? "groups.tabGroups" : "groups.tabPeople", { count: key === "groups" ? groups.length : people.length })}</Text></Pressable>)}</View>
        <View style={screenStyles.groupSearchShell}><Search color={PALETTE.onSurfaceVariant} size={17} /><TextInput value={search} onChangeText={setSearch} placeholder={t("people.searchPlaceholder")} placeholderTextColor={PALETTE.inputPlaceholder} style={screenStyles.groupSearchInput} /></View>
        {tab === "groups" ? <YStack gap="$2.5">{filteredGroups.map((group) => {
          const members = group.memberPersonIds.map((id) => byId.get(id)).filter((p): p is SavedPerson => Boolean(p));
          return <View key={group.id} style={screenStyles.recentShadowWrap}>
            <Pressable accessibilityRole="button" accessibilityLabel={group.name} onLongPress={() => { longPressedGroupId.current = group.id; setGroupActionMenu(group); }} onPress={() => {
              if (longPressedGroupId.current === group.id) {
                longPressedGroupId.current = null;
                return;
              }
              openGroupEditor(group, 1);
            }} style={screenStyles.groupsCompactRow}>
              <GroupAvatar group={group} size={48} />
              <YStack flex={1} gap="$2">
                <XStack alignItems="flex-start" gap="$2">
                  <YStack flex={1} gap="$0.5">
                    <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>{group.name}</Text>
                    {group.description ? <Text numberOfLines={1} fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurfaceVariant}>{group.description}</Text> : null}
                  </YStack>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("groups.openActionsA11y", { group: group.name })} accessibilityHint={t("groups.openActionsHint")} hitSlop={8} onPress={(event) => { event?.stopPropagation?.(); setGroupActionMenu(group); }}>
                    <EllipsisVertical size={20} color={PALETTE.onSurfaceVariant} />
                  </Pressable>
                </XStack>
                <GroupMemberAvatars members={members} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} onPress={() => openGroupEditor(group, 2)} groupName={group.name} />
              </YStack>
            </Pressable>
          </View>;
        })}{filteredGroups.length === 0 ? <Text fontFamily={FONTS.bodyMedium} fontSize={14} color={PALETTE.onSurfaceVariant}>{search.trim() ? t("groups.noSearchMatches") : t("groups.emptyGroups")}</Text> : null}</YStack> : <YStack gap="$3">
          <View style={screenStyles.modePillSegmentedShell}>{(["active", "archived"] as const).map((filter) => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: peopleFilter === filter }} style={[screenStyles.modePillSegmentedButton, peopleFilter === filter && screenStyles.modePillSegmentedButtonActive]} onPress={() => setPeopleFilter(filter)}><Text fontFamily={FONTS.bodyBold} fontSize={13} color={peopleFilter === filter ? PALETTE.primary : PALETTE.onSurfaceVariant}>{t(filter === "active" ? "people.filterActive" : "people.filterArchived", { count: allPeople.filter((entry) => (filter === "archived") === Boolean(entry.archivedAt)).length })}</Text></Pressable>)}</View>
          <YStack gap="$2">{filteredPeople.map((person) => <View key={person.id} style={screenStyles.recentShadowWrap}><Pressable accessibilityRole="button" accessibilityLabel={t("people.editPersonA11y", { person: person.name })} onLongPress={() => { longPressedPersonId.current = person.id; setPersonActionMenu(person); }} onPress={() => { if (longPressedPersonId.current === person.id) { longPressedPersonId.current = null; return; } setEditingPerson(person); }} style={screenStyles.groupsCompactRow}>
            <ParticipantAvatar name={person.name} ownerName={settings.ownerName} ownerProfileImageUri={settings.ownerProfileImageUri} person={person} style={screenStyles.groupsPersonAvatar} label={`${person.name} avatar`} textSize={18} />
            <Text flex={1} fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface} numberOfLines={1}>{person.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("people.openPersonActionsA11y", { person: person.name })} hitSlop={8} onPress={(event) => { event?.stopPropagation?.(); setPersonActionMenu(person); }}><EllipsisVertical size={20} color={PALETTE.onSurfaceVariant} /></Pressable>
          </Pressable></View>)}
          {filteredPeople.length === 0 ? <Text paddingVertical="$3" color={PALETTE.onSurfaceVariant}>{search.trim() ? t("people.noSearchMatches") : t(peopleFilter === "active" ? "people.emptyActive" : "people.emptyArchived")}</Text> : null}</YStack>
        </YStack>}
      </YStack>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={tab === "groups" ? t("people.addGroup") : t("people.addPerson")} style={[screenStyles.groupsFab, { bottom: footerInsetBottom + 18 }]} onPress={() => { if (tab === "groups") { setGroupEditorStep(1); setEditingGroup("new"); } else { setSuggestedContactPhoto(null); setEditingPerson("new"); } }}><Plus size={27} color={PALETTE.onPrimary} /></Pressable>
    {personActionMenu ? <ActionIconGridModal title={t("people.personActionsTitle", { person: personActionMenu.name })} onDismiss={() => { setPersonActionMenu(null); longPressedPersonId.current = null; }} options={personActionMenu.archivedAt ? [
      { label: t("people.restorePerson"), accessibilityLabel: t("people.restorePersonA11y", { person: personActionMenu.name }), icon: <RotateCcw size={18} color={PALETTE.primary} />, onPress: () => { setEditingPerson(personActionMenu); setPersonActionMenu(null); longPressedPersonId.current = null; } },
      ...(!onGetPersonDeletionImpact(personActionMenu.id).used ? [{ label: t("people.deletePersonAction"), accessibilityLabel: t("people.deletePersonA11y", { person: personActionMenu.name }), icon: <Trash2 size={18} color={PALETTE.danger} />, tone: "danger" as const, onPress: () => { setPendingDeletePerson(personActionMenu); setPersonActionMenu(null); longPressedPersonId.current = null; } }] : []),
    ] : [
      { label: t("people.editPersonAction"), accessibilityLabel: t("people.editPersonA11y", { person: personActionMenu.name }), icon: <Pencil size={18} color={PALETTE.primary} />, onPress: () => { setEditingPerson(personActionMenu); setPersonActionMenu(null); longPressedPersonId.current = null; } },
      { label: t("people.deletePersonAction"), accessibilityLabel: t("people.deletePersonA11y", { person: personActionMenu.name }), icon: <Trash2 size={18} color={PALETTE.danger} />, tone: "danger", onPress: () => { setPendingDeletePerson(personActionMenu); setPersonActionMenu(null); longPressedPersonId.current = null; } },
    ]} /> : null}
    {pendingDeletePerson ? <ConfirmChoiceModal title={t("people.deletePersonTitle")} body={`${(() => { const impact = onGetPersonDeletionImpact(pendingDeletePerson.id); return t(impact.used ? "people.deletePersonArchivePrompt" : "people.deletePersonPermanentPrompt", { person: pendingDeletePerson.name }); })()}${deletionError ? `\n${t("common.couldNotSaveSettings")}` : ""}`} confirmLabel={t("people.deletePersonAction")} confirmButtonVariant="danger" discardLabel={t("common.cancel")} onConfirm={() => { void onRemovePerson(pendingDeletePerson.id).then(() => setPendingDeletePerson(null)).catch(() => setDeletionError(true)); }} onDiscard={() => { setPendingDeletePerson(null); setDeletionError(false); }} /> : null}
    {groupActionMenu ? <ActionIconGridModal title={t("groups.actionsTitle", { group: groupActionMenu.name })} onDismiss={() => setGroupActionMenu(null)} options={[
      { label: t("groups.editDetails"), accessibilityLabel: t("groups.openDetailsA11y", { group: groupActionMenu.name }), icon: <Pencil color={PALETTE.primary} size={18} />, onPress: () => { setGroupActionMenu(null); openGroupEditor(groupActionMenu, 1); } },
      { label: t("groups.editMembers"), accessibilityLabel: t("groups.openMembersA11y", { group: groupActionMenu.name }), icon: <Users color={PALETTE.primary} size={18} />, onPress: () => { setGroupActionMenu(null); openGroupEditor(groupActionMenu, 2); } },
      { label: t("groups.deleteAction"), accessibilityLabel: t("people.deleteGroupA11y", { group: groupActionMenu.name }), icon: <Trash2 color={PALETTE.danger} size={18} />, tone: "danger", onPress: () => {
          const selectedGroup = groupActionMenu;
          setGroupActionMenu(null);
          setPendingDeleteGroup(selectedGroup);
        } },
    ]} /> : null}
    {pendingDeleteGroup ? <ConfirmChoiceModal
      title={t("groups.deleteTitle")}
      body={`${t("groups.deletePrompt", { group: pendingDeleteGroup.name })}${deletionError ? `\n${t("common.couldNotSaveSettings")}` : ""}`}
      confirmLabel={t("groups.deleteAction")}
      confirmButtonVariant="danger"
      discardLabel={t("common.cancel")}
      onConfirm={() => { void onRemoveGroup(pendingDeleteGroup.id).then(() => setPendingDeleteGroup(null)).catch(() => setDeletionError(true)); }}
      onDiscard={() => { setPendingDeleteGroup(null); setDeletionError(false); }}
    /> : null}
  </YStack>;

  function openGroupEditor(group: ParticipantGroup, step: 1 | 2) {
    setGroupEditorStep(step);
    setEditingGroup(group);
  }
}
function GroupMemberAvatars({ members, ownerName, ownerProfileImageUri, onPress, groupName }: { members: SavedPerson[]; ownerName: string; ownerProfileImageUri: string; onPress: () => void; groupName: string }) {
  const [width, setWidth] = useState(0);
  const diameter = 32;
  const overlap = 9;
  const capacity = width > 0 ? Math.max(1, Math.floor((width + overlap) / (diameter - overlap))) : 3;
  const visibleCount = members.length > capacity ? Math.max(0, capacity - 1) : capacity;
  const visibleMembers = members.slice(0, visibleCount);
  const overflow = members.length - visibleMembers.length;

  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ minHeight: 32, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
    {visibleMembers.map((person, index) => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`${person.name}, edit members of ${groupName}`} hitSlop={4} onPress={(event) => { event?.stopPropagation?.(); onPress(); }} style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: visibleMembers.length - index }}><ParticipantAvatar name={person.name} ownerName={ownerName} ownerProfileImageUri={ownerProfileImageUri} person={person} style={[screenStyles.participantAvatar, { width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 2, borderColor: PALETTE.surfaceContainerLowest }]} label={`${person.name} avatar`} textSize={11} /></Pressable>)}
    {overflow > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`${overflow} more members of ${groupName}, edit group members`} onPress={(event) => { event?.stopPropagation?.(); onPress(); }} style={{ width: diameter, height: diameter, marginLeft: visibleMembers.length ? -overlap : 0, zIndex: 0, borderRadius: diameter / 2, borderWidth: 2, borderColor: PALETTE.surfaceContainerLowest, alignItems: "center", justifyContent: "center", backgroundColor: PALETTE.surfaceContainerHighest }}><Text fontFamily={FONTS.bodyBold} fontSize={11} color={PALETTE.onSurfaceVariant}>+{overflow}</Text></Pressable> : null}
  </View>;
}
