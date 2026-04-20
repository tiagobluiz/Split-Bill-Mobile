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
export function PayerScreenView({ draftId }: { draftId: string }) {   const record = useRecord(draftId);   const { setPayer, setStep, settings } = useSplitStore(useShallow((state) => ({     setPayer: state.setPayer,     setStep: state.setStep,     settings: state.settings,   })));   const [showPayerHint, setShowPayerHint] = useState(false);   const insets = useSafeAreaInsets();    if (!record) {     return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;   }    const payerErrors = record.values.payerParticipantId ? [] : ["Choose who paid the bill."];    return (     <AppScreen       scroll={false}       footer={         <FloatingFooter>           <Pressable             accessibilityRole="button"             accessibilityLabel="Next: Add Items"             accessibilityState={{ disabled: !record.values.payerParticipantId }}             style={[               screenStyles.participantsContinueButton,               !record.values.payerParticipantId ? screenStyles.participantsContinueButtonDisabled : null,             ]}             onPress={async () => {               if (!record.values.payerParticipantId) {                 setShowPayerHint(true);                 return;               }                  await setStep(4);                 router.push(`/split/${draftId}/items`);             }}           >             <XStack alignItems="center" justifyContent="center" gap="$2.5">               <Text                 fontFamily={FONTS.headlineBlack}                 fontSize={18}                 color={!record.values.payerParticipantId ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer}               >                 Next: Add Items               </Text>               <ArrowRight color={!record.values.payerParticipantId ? PALETTE.onSurfaceVariant : PALETTE.onPrimaryContainer} size={20} />             </XStack>           </Pressable>         </FloatingFooter>       }     >       <ScrollView         style={screenStyles.flex}         stickyHeaderIndices={[0]}         contentContainerStyle={[           screenStyles.participantsScrollContent,           {             paddingBottom: 172 + Math.max(insets.bottom, 14),             gap: 26,           },         ]}         showsVerticalScrollIndicator={false}       >         <View style={[screenStyles.stickyFlowHeader, { paddingTop: Math.max(insets.top + 10, 28) }]}>           <FlowScreenHeader title="Who paid?" onBack={() => router.replace(`/split/${draftId}/participants`)} />         </View>          <YStack gap="$5">           <YStack gap="$3.5">             {record.values.participants.map((participant) => {               const selected = participant.id === record.values.payerParticipantId;                return (                 <Pressable                   key={participant.id}                   accessibilityRole="button"                   accessibilityLabel={`Choose payer ${participant.name}`}                   style={[screenStyles.payerOptionRow, selected ? screenStyles.payerOptionRowSelected : null]}                   onPress={() => void setPayer(participant.id)}                 >                   <XStack alignItems="center" gap="$3.5" flex={1}>                     <ParticipantAvatar                       name={participant.name}                       ownerName={settings.ownerName}                       ownerProfileImageUri={settings.ownerProfileImageUri}                       style={screenStyles.payerAvatar}                       label={`Payer avatar ${participant.name}`}                       textSize={16}                     />                     <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>                       {getParticipantDisplayName(participant.name, settings.ownerName)}                     </Text>                   </XStack>                   {selected ? (                     <View style={screenStyles.payerSelectedIndicator}>                       <Check color={PALETTE.onPrimary} size={16} />                     </View>                   ) : (                     <View style={screenStyles.payerUnselectedIndicator} />                   )}                 </Pressable>               );             })}           </YStack>          </YStack>       </ScrollView>       <SplitNoticeModal messages={showPayerHint ? payerErrors : []} onDismiss={() => setShowPayerHint(false)} />     </AppScreen>   ); }  


