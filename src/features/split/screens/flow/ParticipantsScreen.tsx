import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  Camera,
  ClipboardCopy,
  Equal,
  FileJson,
  Filter,
  Hash,
  Home,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  AvatarBadge,
  EmptyState,
  FieldLabel,
  MeasuredFloatingFooter,
  HeroCard,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
  useFloatingFooterInset,
} from "../../../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  createEmptyItem,
  createId,
  formatMoney,
  normalizeMoneyInput,
  normalizePersonNameInput,
  personNameKey,
  PERSON_NAME_MAX_LENGTH,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepOne,
  validatePersonName,
  validateStepTwo,
  validateStepThree,
} from "../../../../domain";
import type { ParticipantFormValue } from "../../../../domain/splitter";
import { getDeviceLocale } from "../../../../lib/device";
import { trackSplitStepCompleted } from "../../../../lib/telemetry";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import {
  getClipboardSummaryPreview,
  getPdfExportPreview,
  getSettlementPreview,
  useSplitStore,
} from "../../store";
import { ParticipantSuggestions } from "./ParticipantSuggestions";
import {
  getCurrencyOptionLabel,
  getCurrencyOptions,
  getInitials,
  getParticipantDisplayName,
  getParticipantsStepErrors,
  isOwnerReference,
  sortParticipantsByName,
} from "../shared/participantUtils";
import {
  cloneAllocations,
  cloneItem,
  formatPercentValue,
  getAssignedParticipantCount,
  getDraftPendingStep,
  getFriendlySplitMessage,
  getItemCategoryLabel,
  getNextPendingSplitItem,
  getNextPendingSplitItemId,
  getPercentInputMessage,
  getRecordTitle,
  hasTrailingPercentSeparator,
  isItemAssigned,
  isVisibleItem,
  normalizeCommittedPercentValue,
  normalizePercentInput,
  rebalanceEditablePercentAllocations,
} from "../shared/recordUtils";
import { buildRecordRoute } from "../../routes";
import {
  formatAppMoney,
  getHomeBalanceCards,
  getOverviewSettlementLabel,
  getOwingPeople,
  getRecentRowMeta,
  getSettledParticipantIds,
} from "../shared/settlementUtils";
import {
  ErrorList,
  FlowContinueButton,
  ModePills,
  ModeToggle,
} from "../shared/components";
import { HomeTabBar, RecordRow, type HomeTabKey } from "../shared/homeParts";
import {
  ActionSheetModal,
  ConfirmChoiceModal,
  SplitNoticeModal,
} from "../shared/modals";
import {
  ParticipantAvatar,
  ParticipantRow,
} from "../shared/participantComponents";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const MAX_SPLIT_NAME_LENGTH = 64;
const MAX_ITEM_NAME_LENGTH = 64;
const ITEM_CATEGORY_OPTIONS = [
  "General",
  "Produce",
  "Bakery",
  "Dairy",
  "Pantry",
  "Drinks",
  "Main",
  "Entree",
  "Side",
  "Dessert",
  "Service",
  "Museum",
  "Tickets",
] as const;
export function ParticipantsScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const {
    records,
    updateParticipants,
    setStep,
    settings,
    addParticipantsFromGroup,
  } = useSplitStore(
    useShallow((state) => ({
      records: state.records,
      updateParticipants: state.updateParticipants,
      setStep: state.setStep,
      settings: state.settings,
      addParticipantsFromGroup: state.addParticipantsFromGroup,
    })),
  );
  const [name, setName] = useState("");
  const [participantsNoticeMessages, setParticipantsNoticeMessages] = useState<
    string[]
  >([]);
  const participantInputRef = useRef<TextInput>(null);
  const participantNameRef = useRef(name);
  const insets = useSafeAreaInsets();
  const { insetBottom: footerInsetBottom, onMeasuredHeight } =
    useFloatingFooterInset({ fallbackHeight: 186 });
  useEffect(() => {
    participantNameRef.current = name;
  }, [name]);
  if (!record) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title={t("common.loadingSplitTitle")}
          description={t("common.loadingSplitDescription")}
        />
      </AppScreen>
    );
  }
  const participantsStepErrors = getParticipantsStepErrors(record.values);
  const stepOneErrors = [
    ...new Set(participantsStepErrors.map((error) => error.message)),
  ];
  const isParticipantsStepReady = participantsStepErrors.length === 0;
  const sortedParticipants = sortParticipantsByName(record.values.participants);
  const searchQuery = personNameKey(name);
  const addParticipant = async (
    rawName: string,
    options?: { keepKeyboardOpen?: boolean; personId?: string },
  ) => {
    const trimmed = normalizePersonNameInput(rawName);
    const validation = validatePersonName(rawName, record.values.participants, undefined, {
      allowOwnerPlaceholder: Boolean(options?.personId && options.personId === settings.ownerPersonId),
    });
    if (validation?.reason === "required") {
      Keyboard.dismiss();
      return;
    }
    if (validation?.reason === "max" || validation?.reason === "reserved") {
      setParticipantsNoticeMessages([validation.reason === "max" ? t("validation.participantNameMax", { max: validation.max }) : t("settings.ownerNameReserved")]);
      return;
    }
    try {
      await updateParticipants((participants) => {
        if (validatePersonName(trimmed, participants, undefined, { allowOwnerPlaceholder: true })) {
          return participants;
        }
        return [
          ...participants,
          {
            id: createId(),
            name: trimmed,
            ...(options?.personId ? { personId: options.personId } : {}),
          },
        ];
      });
    } catch (error) {
      console.warn("Failed to add participant", error);
        setParticipantsNoticeMessages([
        t("flow.participants.addFailed"),
      ]);
      return;
    }
    setParticipantsNoticeMessages([]);
    setName("");
    if (options?.keepKeyboardOpen) {
      requestAnimationFrame(() => {
        participantInputRef.current?.focus();
      });
    } else {
      Keyboard.dismiss();
    }
  };
  const peopleById = new Map((settings.people ?? []).map((person) => [person.id, person]));
  const participantsByName = new Set(
    record.values.participants.map((participant) => personNameKey(participant.name)),
  );
  const participantPersonIds = new Set(
    record.values.participants.map((participant) => participant.personId).filter(Boolean),
  );
  const matchingPeople = searchQuery
    ? (settings.people ?? [])
        .filter((person) =>
          !person.archivedAt &&
          personNameKey(person.name).includes(searchQuery) &&
          !participantPersonIds.has(person.id) &&
          !participantsByName.has(personNameKey(person.name)),
        )
        .sort((left, right) => left.name.localeCompare(right.name, getDeviceLocale(), { sensitivity: "base" }))
    : [];
  const savedPersonAlreadyAdded =
    searchQuery.length > 0 &&
    (settings.people ?? []).some(
      (person) =>
        !person.archivedAt &&
        personNameKey(person.name).includes(searchQuery) &&
        (participantPersonIds.has(person.id) ||
          participantsByName.has(personNameKey(person.name))),
    );
  const addGroupPeople = async (groupId: string, personIds?: string[]) => {
    try {
      await addParticipantsFromGroup(groupId, personIds);
      setParticipantsNoticeMessages([]);
    } catch (error) {
      console.warn("Failed to add group participant", error);
      setParticipantsNoticeMessages([t("flow.participants.addFailed")]);
    }
  };
  return (
    <AppScreen
      scroll={false}
      overlay={(
        <>
        <SplitNoticeModal
          messages={participantsNoticeMessages}
          onDismiss={() => setParticipantsNoticeMessages([])}
        />
        </>
      )}
      footer={
        <MeasuredFloatingFooter onMeasuredHeight={onMeasuredHeight}>
          <FlowContinueButton
            accessibilityLabel={t("flow.participants.nextA11y")}
            accessibilityHint={
              isParticipantsStepReady
                ? t("flow.participants.nextHintReady")
                : t("flow.participants.nextHintBlocked")
            }
            disabled={!isParticipantsStepReady}
            label={t("flow.participants.next", undefined, { maxLength: 24 })}
            onPress={async () => {
              if (!isParticipantsStepReady) {
                setParticipantsNoticeMessages([
                  ...new Set(stepOneErrors.map(getFriendlySplitMessage)),
                ]);
                return;
              }
              await setStep(3);
              await trackSplitStepCompleted({
                step: "participants",
                draftStatus: record.status,
              });
              router.push(`/split/${draftId}/payer`);
            }}
          />
        </MeasuredFloatingFooter>
      }
    >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
      >
        <FlowScreenHeader
          title={t("flow.participants.title")}
          onBack={() => router.replace(`/split/${draftId}/setup`)}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          { paddingBottom: footerInsetBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <ParticipantSuggestions
            records={records} record={record} settings={settings}
            onAddFriend={(name, personId) => { void addParticipant(name, { keepKeyboardOpen: false, personId }); }}
            onAddGroup={addGroupPeople}
          />
          <View
            testID="participant-name-input-shell"
            style={[screenStyles.participantInputShell, { marginTop: -4 }]}
          >
            <TextInput
              ref={participantInputRef}
              accessibilityLabel={t("flow.participants.inputPlaceholder")}
              value={name}
              maxLength={PERSON_NAME_MAX_LENGTH}
              onChangeText={(value) => {
                participantNameRef.current = value;
                setName(value);
              }}
              onSubmitEditing={() =>
                void addParticipant(participantNameRef.current, {
                  keepKeyboardOpen: true,
                })
              }
              blurOnSubmit={false}
              returnKeyType="done"
              placeholder={t("flow.participants.inputPlaceholder")}
              placeholderTextColor="rgba(86, 67, 57, 0.42)"
              style={screenStyles.participantInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("flow.participants.add")}
              style={screenStyles.participantAddButton}
              onPress={() =>
                void addParticipant(participantNameRef.current, {
                  keepKeyboardOpen: true,
                })
              }
            >
              <Plus color={PALETTE.onPrimary} size={20} />
            </Pressable>
          </View>
          {searchQuery ? (
            <YStack gap="$2">
              {matchingPeople.map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("flow.participants.addSavedPersonA11y", { name: person.name })}
                  onPress={() => void addParticipant(person.name, { personId: person.id })}
                  style={screenStyles.participantPill}
                >
                  <XStack alignItems="center" gap="$3">
                    <ParticipantAvatar
                      name={person.name}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      style={screenStyles.participantAvatar}
                      label={t("flow.participants.savedPersonAvatarA11y", { name: person.name })}
                      person={person}
                    />
                    <Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface}>
                      {person.name}
                    </Text>
                  </XStack>
                </Pressable>
              ))}
              {matchingPeople.length === 0 ? (
                <Text accessibilityLiveRegion="polite" color={PALETTE.onSurfaceVariant}>
                  {savedPersonAlreadyAdded
                    ? t("flow.participants.savedPersonAlreadyAdded")
                    : t("flow.participants.noSavedPersonMatches", {
                        name: normalizePersonNameInput(name),
                      })}
                </Text>
              ) : null}
            </YStack>
          ) : null}
          <YStack gap="$3.5">
            <Text
              fontFamily={FONTS.bodyBold}
              fontSize={11}
              color={PALETTE.onSurfaceVariant}
              textTransform="uppercase"
              letterSpacing={2.4}
            >
              {t("flow.participants.added")}
            </Text>
            {sortedParticipants.length === 0 ? null : (
              <YStack gap="$2.5">
                {sortedParticipants.map((participant) => (
                  <View key={participant.id} style={screenStyles.recentShadowWrap}>
                    <ParticipantRow
                      participant={participant}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      person={participant.personId ? peopleById.get(participant.personId) : undefined}
                      onRemove={() => {
                        void updateParticipants((participants) =>
                          participants.filter(
                            (entry) => entry.id !== participant.id,
                          ),
                        ).catch((error) => {
                          console.warn("Failed to remove participant", error);
                          setParticipantsNoticeMessages([
                            t("flow.participants.removeFailed"),
                          ]);
                        });
                      }}
                    />
                  </View>
                ))}
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </AppScreen>
  );
}
