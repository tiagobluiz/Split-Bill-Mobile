import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Check, Plus, Sparkles, Users } from "lucide-react-native";
import { Text as TamaguiText } from "tamagui";
import type { DraftRecord } from "../../../../storage/records";
import type { AppSettings } from "../../../../storage/settings";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { FREQUENT_ENTRY_LIMIT, type SavedPerson } from "../../people";
import { GroupAvatar } from "../shared/GroupAvatar";
import { ParticipantAvatar } from "../shared/participantComponents";
import {
  getFrequentFriends,
  getFrequentGroups,
  isOwnerReference,
  sortParticipantsByName,
} from "../shared/participantUtils";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const nameKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

export function ParticipantSuggestions({
  records,
  record,
  settings,
  onAddFriend,
  onAddGroup,
}: {
  records: DraftRecord[];
  record: DraftRecord;
  settings: AppSettings;
  onAddFriend: (name: string, personId?: string) => void;
  onAddGroup: (groupId: string, personIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const [mode, setMode] = useState<"frequent" | "groups">("frequent");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [panelWidth, setPanelWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const actionInProgress = useRef(false);
  const people = settings.people ?? [];
  const groups = getFrequentGroups(settings.participantGroups ?? [], people);
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const currentIds = new Set(
    record.values.participants.map((entry) => entry.personId).filter(Boolean),
  );
  const participantNames = new Set(
    record.values.participants.map((entry) => nameKey(entry.name)),
  );
  const isAdded = (person: Pick<SavedPerson, "id" | "name">) =>
    currentIds.has(person.id) || participantNames.has(nameKey(person.name));
  const frequentFriends = getFrequentFriends(records, record.id, settings.ownerName, {
    people,
    limit: FREQUENT_ENTRY_LIMIT,
    ownerPersonId: settings.ownerPersonId,
  });
  const hasHistoricalFrequentPeople = frequentFriends.some(
    (friend) => !isOwnerReference(friend.name, settings.ownerName),
  );
  const friends = frequentFriends.filter(
    (friend) =>
      !isAdded({
        id:
          friend.personId ??
          (friend.selected ? (settings.ownerPersonId ?? "") : ""),
        name: friend.name,
      }),
  );
  const members = selectedGroup
    ? people.filter(
        (person) =>
          selectedGroup.memberPersonIds.includes(person.id) &&
          !person.archivedAt,
      )
    : [];
  const missing = sortParticipantsByName(
    members.filter((person) => !isAdded(person)),
  );
  const added = sortParticipantsByName(members.filter(isAdded));
  const contentWidth = panelWidth || Math.max(0, width - 44);
  const columns = contentWidth >= 320 && fontScale <= 1.2 ? 2 : 1;
  const addMembers = async (ids: string[]) => {
    if (!selectedGroup || !ids.length || actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    try {
      await onAddGroup(selectedGroup.id, ids);
    } finally {
      actionInProgress.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.suggestions}>
      <View accessibilityRole="tablist" style={screenStyles.modePillSegmentedShell}>
        {(["frequent", "groups"] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={t(
              tab === "frequent"
                ? "flow.participants.frequentTab"
                : "flow.participants.groupsTab",
            )}
            accessibilityState={{ selected: mode === tab }}
            onPress={() => setMode(tab)}
            style={[
              screenStyles.modePillSegmentedButton,
              mode === tab && screenStyles.modePillSegmentedButtonActive,
            ]}
          >
            <Text
              fontFamily={mode === tab ? FONTS.bodyBold : FONTS.bodyMedium}
              fontSize={12}
              color={
                mode === tab ? PALETTE.primary : PALETTE.onSurface
              }
              textAlign="center"
            >
              {t(
                tab === "frequent"
                  ? "flow.participants.frequentTab"
                  : "flow.participants.groupsTab",
              )}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === "frequent" ? (
        <View style={styles.frequentContent}>
          {friends.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={screenStyles.frequentFriendsRow}
            >
              {friends.map((friend) => (
                <Pressable
                  key={friend.personId ?? friend.name}
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.participants.addFrequentA11y", {
                    name: friend.name,
                  })}
                  style={styles.friend}
                  onPress={() => onAddFriend(friend.name, friend.personId)}
                >
                  <View
                    style={[
                      screenStyles.frequentFriendFrame,
                      friend.selected &&
                        screenStyles.frequentFriendFrameSelected,
                    ]}
                  >
                    <ParticipantAvatar
                      name={friend.name}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      style={screenStyles.frequentFriendAvatar}
                      label={t("flow.participants.frequentAvatarA11y", {
                        name: friend.name,
                      })}
                      person={friend.person}
                      textSize={18}
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    textAlign="center"
                    fontFamily={FONTS.bodyMedium}
                    fontSize={12}
                    color={PALETTE.onSurface}
                  >
                    {friend.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View testID="frequent-empty-card" style={styles.frequentEmptyCard}>
              <View
                testID={
                  hasHistoricalFrequentPeople
                    ? "frequent-empty-icon-complete"
                    : "frequent-empty-icon-new"
                }
                style={styles.frequentEmptyIcon}
              >
                {hasHistoricalFrequentPeople ? (
                  <>
                    <Users color={PALETTE.primary} size={22} />
                    <View style={styles.frequentEmptyIconBadge}>
                      <Check color={PALETTE.onPrimary} size={10} strokeWidth={3} />
                    </View>
                  </>
                ) : (
                  <Sparkles color={PALETTE.primary} size={22} />
                )}
              </View>
              <View style={styles.frequentEmptyCopy}>
                <Text style={styles.frequentEmptyTitle}>
                  {t(
                    hasHistoricalFrequentPeople
                      ? "flow.participants.allFrequentPeopleAddedTitle"
                      : "flow.participants.noFrequentPeopleTitle",
                  )}
                </Text>
                <Text style={styles.frequentEmptyDescription}>
                  {t(
                    hasHistoricalFrequentPeople
                      ? "flow.participants.allFrequentPeopleAddedDescription"
                      : "flow.participants.noFrequentPeopleDescription",
                  )}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.groupsContent}>
          {groups.length ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.groupRail}
              >
                {groups.map((group) => {
                  const selected = selectedGroup?.id === group.id;
                  return (
                    <Pressable
                      key={group.id}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "flow.participants.selectGroupA11y",
                        { group: group.name },
                      )}
                      accessibilityState={{ selected }}
                      style={[
                        styles.groupChoice,
                        { width: Math.ceil(84 * Math.max(1, fontScale)) },
                      ]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <View
                        style={[
                          styles.groupFrame,
                          selected && styles.groupFrameSelected,
                        ]}
                      >
                        <GroupAvatar group={group} size={48} />
                      </View>
                      <Text
                        numberOfLines={2}
                        textAlign="center"
                        height={Math.ceil(32 * fontScale)}
                        lineHeight={16}
                        fontFamily={
                          selected ? FONTS.bodyBold : FONTS.bodyMedium
                        }
                        fontSize={12}
                        color={
                          selected ? PALETTE.primary : PALETTE.onSurfaceVariant
                        }
                      >
                        {group.name}
                      </Text>
                      <View
                        style={[
                          styles.groupIndicator,
                          { opacity: selected ? 1 : 0 },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedGroup ? (
                <View
                  style={styles.memberPanel}
                  onLayout={(event) =>
                    setPanelWidth(event.nativeEvent.layout.width)
                  }
                >
                  <View style={styles.groupHeading}>
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={13}
                      color={PALETTE.onSurfaceVariant}
                      accessibilityLiveRegion="polite"
                    >
                      {t("flow.participants.groupProgress", {
                        added: added.length,
                        total: members.length,
                      })}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "flow.participants.addRemainingA11y",
                        { count: missing.length, group: selectedGroup.name },
                      )}
                      accessibilityState={{
                        disabled: !missing.length || busy,
                        busy,
                      }}
                      disabled={!missing.length || busy}
                      style={[styles.addAll, busy && { opacity: 0.5 }]}
                      onPress={() => {
                        void addMembers(missing.map((person) => person.id));
                      }}
                    >
                      {missing.length ? (
                        <Plus size={17} color={PALETTE.primary} />
                      ) : (
                        <Check size={17} color={PALETTE.onSurfaceVariant} />
                      )}
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={13}
                        color={
                          missing.length
                            ? PALETTE.primary
                            : PALETTE.onSurfaceVariant
                        }
                      >
                        {missing.length
                          ? t("flow.participants.addRemaining", {
                              count: missing.length,
                            })
                          : t("flow.participants.allAdded")}
                      </Text>
                    </Pressable>
                  </View>
                  <View testID="group-member-grid" style={styles.memberGrid}>
                    {[...missing, ...added].map((person) => {
                      const alreadyAdded = isAdded(person);
                      return (
                        <Pressable
                          key={person.id}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            alreadyAdded
                              ? "flow.participants.memberAddedA11y"
                              : "flow.participants.addMemberA11y",
                            { name: person.name, group: selectedGroup.name },
                          )}
                          accessibilityState={{
                            disabled: alreadyAdded || busy,
                          }}
                          disabled={alreadyAdded || busy}
                          style={[
                            styles.member,
                            {
                              width:
                                columns === 1
                                  ? "100%"
                                  : (contentWidth - 10) / 2,
                            },
                            alreadyAdded && styles.memberAdded,
                          ]}
                          onPress={() => {
                            void addMembers([person.id]);
                          }}
                        >
                          <ParticipantAvatar
                            name={person.name}
                            ownerName={settings.ownerName}
                            ownerProfileImageUri={settings.ownerProfileImageUri}
                            style={styles.memberAvatar}
                            label={t("flow.participants.memberAvatarA11y", {
                              name: person.name,
                            })}
                            person={person}
                            textSize={14}
                          />
                          <View style={styles.memberName}>
                            <Text
                              numberOfLines={2}
                              fontFamily={FONTS.bodyBold}
                              fontSize={14}
                              color={
                                alreadyAdded
                                  ? PALETTE.onSurfaceVariant
                                  : PALETTE.onSurface
                              }
                            >
                              {person.name}
                            </Text>
                            {alreadyAdded ? (
                              <Text
                                fontFamily={FONTS.bodyMedium}
                                fontSize={10}
                                lineHeight={12}
                                color={PALETTE.onSurfaceVariant}
                              >
                                {t("flow.participants.groupAdded")}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.memberAction}>
                            <View
                              style={[
                                styles.memberActionIcon,
                                !alreadyAdded && styles.memberActionPending,
                              ]}
                            >
                              {alreadyAdded ? (
                                <Check
                                  size={16}
                                  color={PALETTE.onSurfaceVariant}
                                />
                              ) : (
                                <Plus size={17} color={PALETTE.onPrimary} />
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View testID="groups-empty-card" style={styles.frequentEmptyCard}>
              <View testID="groups-empty-icon" style={styles.frequentEmptyIcon}>
                <Users color={PALETTE.primary} size={22} />
                <View style={styles.frequentEmptyIconBadge}>
                  <Plus color={PALETTE.onPrimary} size={10} strokeWidth={3} />
                </View>
              </View>
              <View style={styles.frequentEmptyCopy}>
                <Text style={styles.frequentEmptyTitle}>
                  {t("flow.participants.noGroupsTitle")}
                </Text>
                <Text style={styles.frequentEmptyDescription}>
                  {t("flow.participants.noGroupsDescription")}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestions: { gap: 18 },
  frequentContent: { gap: 12 },
  frequentEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: PALETTE.surfaceContainerLow,
  },
  frequentEmptyIcon: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.primaryContainer,
  },
  frequentEmptyIconBadge: {
    position: "absolute",
    right: -3,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.primary,
    borderWidth: 2,
    borderColor: PALETTE.surfaceContainerLow,
  },
  frequentEmptyCopy: { flex: 1, gap: 4 },
  frequentEmptyTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: PALETTE.onSurface,
  },
  frequentEmptyDescription: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: PALETTE.onSurfaceVariant,
  },
  friend: { width: 78, minHeight: 94, alignItems: "center", gap: 8 },
  groupsContent: { gap: 10 },
  groupRail: { gap: 10, paddingVertical: 2, paddingRight: 8 },
  groupChoice: { width: 84, minHeight: 96, alignItems: "center", gap: 4 },
  groupFrame: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  groupFrameSelected: { borderColor: PALETTE.primary },
  groupIndicator: {
    width: 22,
    height: 2,
    borderRadius: 2,
    backgroundColor: PALETTE.primary,
  },
  memberPanel: { gap: 8 },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addAll: {
    minHeight: 44,
    flexDirection: "row",
    flexShrink: 0,
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  memberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  member: {
    minHeight: 68,
    paddingHorizontal: 9,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: PALETTE.surfaceContainer,
    borderRadius: 18,
    backgroundColor: PALETTE.surfaceContainerLowest,
  },
  memberAdded: {
    backgroundColor: PALETTE.surface,
    borderColor: PALETTE.surfaceContainerLow,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  memberName: { flex: 1, minWidth: 0, gap: 2 },
  memberAction: { width: 30, alignItems: "center", gap: 2, flexShrink: 0 },
  memberActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.surfaceContainerLow,
  },
  memberActionPending: { backgroundColor: PALETTE.primary },
});
