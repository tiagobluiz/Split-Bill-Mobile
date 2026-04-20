import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, Keyboard, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  Camera,
  Check,
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
  FloatingFooter,
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
} from "../../../../components/ui";
import {
  buildShareSummary,
  computeSettlement,
  createEmptyItem,
  createId,
  formatMoney,
  normalizeMoneyInput,
  parseMoneyToCents,
  resetPercentAllocations,
  resetShareAllocations,
  validateStepOne,
  validateStepTwo,
  validateStepThree,
} from "../../../../domain";
import type { ParticipantFormValue } from "../../../../domain/splitter";
import { getDeviceLocale } from "../../../../lib/device";
import type { DraftRecord } from "../../../../storage/records";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { getClipboardSummaryPreview, getPdfExportPreview, getSettlementPreview, useSplitStore } from "../../store";
import {
  getAvatarTone,
  getCurrencyOptionLabel,
  getCurrencyOptions,
  getFrequentFriends,
  getInitials,
  getParticipantDisplayName,
  getParticipantsStepErrors,
  isOwnerReference,
} from "../shared/participantUtils";
import {
  buildRecordRoute,
  cloneAllocations,
  cloneItem,
  formatPercentValue,
  getAssignedParticipantCount,
  getDraftPendingStep,
  getFriendlySplitMessage,
  getItemCategoryLabel,
  getLatestPendingSplitItem,
  getLatestPendingSplitItemId,
  getPercentInputMessage,
  getRecordTitle,
  hasTrailingPercentSeparator,
  isItemAssigned,
  isVisibleItem,
  normalizeCommittedPercentValue,
  normalizePercentInput,
  rebalanceEditablePercentAllocations,
} from "../shared/recordUtils";
import {
  formatAppMoney,
  getHomeBalanceCards,
  getOverviewSettlementLabel,
  getOwingPeople,
  getRecentRowMeta,
  getSettledParticipantIds,
} from "../shared/settlementUtils";
import { ErrorList, ModePills, ModeToggle } from "../shared/components";
import { HomeTabBar, RecordRow, type HomeTabKey } from "../shared/homeParts";
import { ActionSheetModal, ConfirmChoiceModal, SplitNoticeModal } from "../shared/modals";
import { ParticipantAvatar, ParticipantRow } from "../shared/participantComponents";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const MAX_SPLIT_NAME_LENGTH = 20;
const MAX_ITEM_NAME_LENGTH = 25;
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
export function ParticipantsScreenView({ draftId }: { draftId: string }) {   const record = useRecord(draftId);   const { records, updateParticipants, setStep, settings } = useSplitStore(useShallow((state) => ({     records: state.records,     updateParticipants: state.updateParticipants,     setStep: state.setStep,     settings: state.settings,   })));   const [name, setName] = useState("");   const [participantsNoticeMessages, setParticipantsNoticeMessages] = useState<string[]>([]);   const participantInputRef = useRef<TextInput>(null);   const participantNameRef = useRef(name);   const insets = useSafeAreaInsets();    useEffect(() => {     participantNameRef.current = name;   }, [name]);    if (!record) {     return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;   }    const participantsStepErrors = getParticipantsStepErrors(record.values);   const stepOneErrors = [...new Set(participantsStepErrors.map((error) => error.message))];   const isParticipantsStepReady = participantsStepErrors.length === 0;   const activeParticipantNames = new Set(record.values.participants.map((participant) => participant.name.trim().toLowerCase()).filter(Boolean));   const frequentFriends = getFrequentFriends(records, draftId, settings.ownerName).filter(     (friend) => !activeParticipantNames.has(friend.name.trim().toLowerCase())   );   const addParticipant = async (rawName: string, options?: { keepKeyboardOpen?: boolean }) => {     const trimmed = rawName.trim();     if (!trimmed || record.values.participants.some((participant) => participant.name.toLowerCase() === trimmed.toLowerCase())) {       return;     }      await updateParticipants([...record.values.participants, { id: createId(), name: trimmed }]);     setParticipantsNoticeMessages([]);     setName("");     if (options?.keepKeyboardOpen) {       requestAnimationFrame(() => {         participantInputRef.current?.focus();       });     } else {       Keyboard.dismiss();     }   };    return (     <AppScreen       scroll={false}       footer={         <FloatingFooter>           <Pressable             accessibilityRole="button"             accessibilityLabel="Next: Select Payer"             accessibilityState={{ disabled: !isParticipantsStepReady }}             style={[               screenStyles.participantsContinueButton,               !isParticipantsStepReady ? screenStyles.participantsContinueButtonDisabled : null,             ]}             onPress={async () => {               if (!isParticipantsStepReady) {                 setParticipantsNoticeMessages([...new Set(stepOneErrors.map(getFriendlySplitMessage))]);                 return;               }                await setStep(3);               router.push(`/split/${draftId}/payer`);             }}           >             <XStack alignItems="center" justifyContent="center" gap="$2.5">               <Text                 fontFamily={FONTS.headlineBlack}                 fontSize={18}                 color={!isParticipantsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer}               >                 Next: Select Payer               </Text>               <ArrowRight color={!isParticipantsStepReady ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer} size={20} />             </XStack>           </Pressable>         </FloatingFooter>       }     >       <ScrollView         style={screenStyles.flex}         keyboardShouldPersistTaps="always"         stickyHeaderIndices={[0]}         contentContainerStyle={[           screenStyles.participantsScrollContent,           {             paddingBottom: 172 + Math.max(insets.bottom, 14),           },         ]}         showsVerticalScrollIndicator={false}       >         <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>           <FlowScreenHeader title="Who's splitting?" onBack={() => router.replace(`/split/${draftId}/setup`)} />         </View>          <YStack gap="$5">           {frequentFriends.length > 0 ? (             <YStack gap="$4">               <Text                 fontFamily={FONTS.bodyBold}                 fontSize={11}                 color={PALETTE.onSurfaceVariant}                 textTransform="uppercase"                 letterSpacing={2.4}               >                 Frequent Participants               </Text>               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={screenStyles.frequentFriendsRow}>                 {frequentFriends.map((friend) => (                   <Pressable                     key={friend.name}                     accessibilityRole="button"                     accessibilityLabel={`Add frequent friend ${friend.name}`}                     style={screenStyles.frequentFriendItem}                     onPress={() => void addParticipant(friend.name, { keepKeyboardOpen: false })}                   >                     <View style={[screenStyles.frequentFriendFrame, friend.selected ? screenStyles.frequentFriendFrameSelected : null]}>                       <ParticipantAvatar                         name={friend.name}                         ownerName={settings.ownerName}                         ownerProfileImageUri={settings.ownerProfileImageUri}                         style={[screenStyles.frequentFriendAvatar, { backgroundColor: friend.background }]}                         label={`Frequent friend avatar ${friend.name}`}                         textSize={18}                       />                     </View>                     <Text fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurface}>                       {friend.name}                     </Text>                   </Pressable>                 ))}               </ScrollView>             </YStack>           ) : null}            <View style={screenStyles.participantInputShell}>             <TextInput               ref={participantInputRef}               value={name}               onChangeText={(value) => {                 participantNameRef.current = value;                 setName(value);               }}               onSubmitEditing={() => void addParticipant(participantNameRef.current, { keepKeyboardOpen: true })}               blurOnSubmit={false}               returnKeyType="done"               placeholder="Enter name"               placeholderTextColor="rgba(86, 67, 57, 0.42)"               style={screenStyles.participantInput}             />             <Pressable               accessibilityRole="button"               accessibilityLabel="Add person"               style={screenStyles.participantAddButton}               onPress={() => void addParticipant(participantNameRef.current, { keepKeyboardOpen: true })}             >               <Plus color={PALETTE.onPrimary} size={20} />             </Pressable>           </View>            <YStack gap="$3.5">             <Text               fontFamily={FONTS.bodyBold}               fontSize={11}               color={PALETTE.onSurfaceVariant}               textTransform="uppercase"               letterSpacing={2.4}             >               Added Participants             </Text>              {record.values.participants.length === 0 ? (               null             ) : (               <YStack gap="$3.5">                 {record.values.participants.map((participant) => (                     <ParticipantRow                       key={participant.id}                       participant={participant}                       ownerName={settings.ownerName}                       ownerProfileImageUri={settings.ownerProfileImageUri}                       onRemove={() =>                         void updateParticipants(record.values.participants.filter((entry) => entry.id !== participant.id))                       }                   />                 ))}               </YStack>             )}           </YStack>          </YStack>       </ScrollView>       <SplitNoticeModal messages={participantsNoticeMessages} onDismiss={() => setParticipantsNoticeMessages([])} />     </AppScreen>   ); }  


