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
import {
  getClipboardSummaryPreview,
  getPdfExportPreview,
  getSettlementPreview,
  useSplitStore,
} from "../../store";
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
export function SetupScreenView({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const { updateDraftMeta, setStep, settings } = useSplitStore(
    useShallow((state) => ({
      updateDraftMeta: state.updateDraftMeta,
      setStep: state.setStep,
      settings: state.settings,
    })),
  );
  const insets = useSafeAreaInsets();
  const [splitName, setSplitName] = useState(record?.values.splitName ?? "");
  const [currency, setCurrency] = useState(
    record?.values.currency ?? settings.defaultCurrency,
  );
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [setupNoticeMessages, setSetupNoticeMessages] = useState<string[]>([]);
  useEffect(() => {
    if (record) {
      setSplitName(record.values.splitName ?? "");
      setCurrency(record.values.currency ?? settings.defaultCurrency);
      setCurrencyMenuOpen(false);
      setSetupNoticeMessages([]);
    }
  }, [record, settings.defaultCurrency]);
  if (!record) {
    return (
      <AppScreen scroll={false}>
        <EmptyState
          title="Loading split"
          description="Opening your split record."
        />
      </AppScreen>
    );
  }
  const currencyOptions = [
    ...getCurrencyOptions(settings),
    ...(!getCurrencyOptions(settings).some(
      (option) => option.code === settings.defaultCurrency,
    )
      ? [
          {
            code: settings.defaultCurrency,
            label: getCurrencyOptionLabel(settings.defaultCurrency, settings),
          },
        ]
      : []),
  ];
  const normalizedCurrency = currency.trim().toUpperCase();
  const canContinue = Boolean(normalizedCurrency);
  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next: Add Participants"
            accessibilityState={{ disabled: !canContinue }}
            style={[
              screenStyles.participantsContinueButton,
              !canContinue
                ? screenStyles.participantsContinueButtonDisabled
                : null,
            ]}
            onPress={async () => {
              if (!canContinue) {
                return;
              }
              if (!splitName.trim()) {
                setSetupNoticeMessages([
                  "Please give this bill a short name first.",
                ]);
                return;
              }
              await updateDraftMeta(
                splitName.trim().slice(0, MAX_SPLIT_NAME_LENGTH),
                normalizedCurrency,
              );
              await setStep(2);
              router.push(`/split/${draftId}/participants`);
            }}
          >
            <XStack alignItems="center" justifyContent="center" gap="$2.5">
              <Text
                fontFamily={FONTS.headlineBlack}
                fontSize={18}
                color={
                  !canContinue
                    ? PALETTE.onSurfaceVariant
                    : PALETTE.onPrimaryContainer
                }
              >
                Next: Add Participants
              </Text>
              <ArrowRight
                color={
                  !canContinue
                    ? PALETTE.onSurfaceVariant
                    : PALETTE.onPrimaryContainer
                }
                size={20}
              />
            </XStack>
          </Pressable>
        </FloatingFooter>
      }
    >
      <View
        style={[
          screenStyles.stickyFlowHeader,
          { paddingTop: Math.max(insets.top + 10, 28) },
        ]}
      >
        <FlowScreenHeader
          title="New Split"
          onBack={() => router.replace("/")}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          { paddingBottom: 172 + Math.max(insets.bottom, 14) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <YStack gap="$4">
            <YStack gap="$2">
              <FieldLabel>Split name</FieldLabel>
              <View style={screenStyles.assignInputShell}>
                <TextInput
                  accessibilityLabel="Split name"
                  value={splitName}
                  onChangeText={(value) => {
                    setSplitName(value.slice(0, MAX_SPLIT_NAME_LENGTH));
                    if (setupNoticeMessages.length > 0) {
                      setSetupNoticeMessages([]);
                    }
                  }}
                  placeholder="e.g. Weekend groceries"
                  placeholderTextColor="rgba(86,67,57,0.35)"
                  style={screenStyles.assignInput}
                  maxLength={MAX_SPLIT_NAME_LENGTH}
                />
              </View>
            </YStack>
            <YStack gap="$2">
              <FieldLabel>Currency</FieldLabel>
              <YStack gap="$2.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose currency"
                  style={screenStyles.selectRow}
                  onPress={() => setCurrencyMenuOpen((value) => !value)}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <Text
                      fontFamily={FONTS.bodyMedium}
                      fontSize={17}
                      color={PALETTE.onSurface}
                    >
                      {getCurrencyOptionLabel(
                        normalizedCurrency || settings.defaultCurrency,
                        settings,
                      )}
                    </Text>
                    <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                  </XStack>
                </Pressable>
                {currencyMenuOpen ? (
                  <YStack gap="$2">
                    {currencyOptions.map((option) => {
                      const active = normalizedCurrency === option.code;
                      return (
                        <Pressable
                          key={option.code}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose currency ${option.code}`}
                          style={[
                            screenStyles.selectRow,
                            active ? screenStyles.selectRowActive : null,
                          ]}
                          onPress={() => {
                            setCurrency(option.code);
                            setCurrencyMenuOpen(false);
                          }}
                        >
                          <Text
                            fontFamily={FONTS.bodyMedium}
                            fontSize={16}
                            color={active ? PALETTE.primary : PALETTE.onSurface}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </YStack>
                ) : null}
              </YStack>
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal
        messages={setupNoticeMessages}
        onDismiss={() => setSetupNoticeMessages([])}
      />
    </AppScreen>
  );
}
