import { useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { ArrowRight, Bot, CheckCircle2, ClipboardCopy, Info, MessageCircle, ReceiptText, Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FieldLabel,
  FloatingFooter,
  PrimaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
} from "../../../../components/ui";
import { useTranslation } from "../../../../i18n/provider";
import {
  buildReceiptLlmPrompt,
  formatMoney,
  getReceiptLlmAndroidPackage,
  getReceiptLlmProviderUrl,
  itemHasDuplicate,
  parseMoneyToCents,
  parsePastedItems,
  type LlmProvider,
} from "../../../../domain";
import { getDeviceLocale } from "../../../../lib/device";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";
import { FlowScreenHeader } from "../shared/flowComponents";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

const AI_PROVIDERS: Array<{
  id: LlmProvider;
  label: string;
  icon: "bot" | "message" | "sparkles";
  iconColor: string;
  iconBackground: string;
}> = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    icon: "bot",
    iconColor: "#107166",
    iconBackground: "#dff8f3",
  },
  {
    id: "claude",
    label: "Claude",
    icon: "message",
    iconColor: "#9d4401",
    iconBackground: "#fff0e4",
  },
  {
    id: "gemini",
    label: "Gemini",
    icon: "sparkles",
    iconColor: "#365bd8",
    iconBackground: "#e8edff",
  },
];

const IMPORT_STATUS_BACKGROUND = "#dff8f3";
const IMPORT_STATUS_ICON_BACKGROUND = "#b9f0e5";
const IMPORT_STATUS_CTA_BACKGROUND = "#c9f3eb";

function AiProviderIcon({
  icon,
  color,
}: {
  icon: (typeof AI_PROVIDERS)[number]["icon"];
  color: string;
}) {
  if (icon === "bot") {
    return <Bot color={color} size={20} />;
  }
  if (icon === "message") {
    return <MessageCircle color={color} size={20} />;
  }
  return <Sparkles color={color} size={20} />;
}

export function PasteImportScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const importPastedList = useSplitStore((state) => state.importPastedList);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState<LlmProvider>("chatgpt");
  const prompt = buildReceiptLlmPrompt();
  const parsedPreview = useMemo(() => parsePastedItems(input), [input]);
  const hasPastedText = input.trim().length > 0;
  const previewAcceptedItems = useMemo(() => {
    if (!record) {
      return [];
    }

    const existingItems = record.values.items.filter(
      (item) => item.name.trim() || item.price.trim(),
    );
    const acceptedItems: Array<{
      id: string;
      name: string;
      price: string;
      category?: string;
    }> = [];

    parsedPreview.items.forEach((item, index) => {
      const candidate = {
        id: `preview-${index}`,
        name: item.name,
        price: item.price,
        category: "",
      };
      const duplicateScope =
        mode === "replace" ? acceptedItems : [...existingItems, ...acceptedItems];

      if (!itemHasDuplicate(duplicateScope, candidate)) {
        acceptedItems.push(candidate);
      }
    });

    return acceptedItems;
  }, [mode, parsedPreview.items, record]);
  const parsedItemCount = previewAcceptedItems.length;
  const ignoredLineCount =
    parsedPreview.ignoredLines.length +
    Math.max(0, parsedPreview.items.length - previewAcceptedItems.length);
  const estimatedTotalCents = previewAcceptedItems.reduce(
    (sum, item) => sum + (parseMoneyToCents(item.price) ?? 0),
    0,
  );
  const locale = getDeviceLocale();

  const openStepTwo = () => {
    setStep(2);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  };

  const copyPromptAndOpenAi = async () => {
    try {
      await Clipboard.setStringAsync(prompt);
      if (Platform.OS === "android") {
        const packageName = getReceiptLlmAndroidPackage(provider);
        try {
          await IntentLauncher.openApplication(packageName);
        } catch (error) {
          await Linking.openURL(getReceiptLlmProviderUrl(provider, true));
        }
      } else {
        await Linking.openURL(getReceiptLlmProviderUrl(provider, true));
      }
      openStepTwo();
    } catch (error) {
      console.warn("Failed to launch AI receipt handoff", error);
      Alert.alert(
        t("flow.import.openFailedTitle"),
        t("flow.import.openFailedBody"),
      );
    }
  };

  const copyPromptText = async () => {
    try {
      await Clipboard.setStringAsync(prompt);
    } catch (error) {
      console.warn("Failed to copy AI receipt prompt", error);
      Alert.alert(
        t("flow.import.copyFailedTitle"),
        t("flow.import.copyFailedBody"),
      );
    }
  };

  const applyImport = async () => {
    try {
      const result = await importPastedList(input, mode);
      const actionableWarnings = result.warningMessages.filter(
        (warning) =>
          !warning.includes("No valid items were detected") &&
          !warning.includes("pasted line") &&
          !warning.includes("duplicate imported"),
      );
      if (actionableWarnings.length > 0) {
        Alert.alert(t("flow.import.notesTitle"), actionableWarnings.join("\n"));
      }
      router.back();
    } catch (error) {
      console.warn("Failed to import pasted list", error);
      Alert.alert(
        t("flow.import.applyFailedTitle"),
        t("flow.import.applyFailedBody"),
      );
    }
  };

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title={t("common.loadingSplitTitle")} description={t("common.loadingSplitDescription")} /></AppScreen>;
  }

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <YStack gap="$2.5">
            {step === 1 ? (
              <>
                <PrimaryButton
                  label={t("flow.import.copyOpenAi")}
                  icon={<ReceiptText color={PALETTE.onPrimary} size={18} />}
                  onPress={() => void copyPromptAndOpenAi()}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={t("flow.import.alreadyHaveListA11y")} onPress={openStepTwo}>
                  <Text textAlign="center" color={PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={14}>
                    {t("flow.import.alreadyHaveList")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <YStack gap="$2.5">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={10}
                  color={PALETTE.onSurfaceVariant}
                  textTransform="uppercase"
                  letterSpacing={2.1}
                >
                  {t("flow.import.preview")}
                </Text>
                <XStack alignItems="flex-end" justifyContent="space-between" gap="$3">
                  {[
                    {
                      label: t("flow.import.accepted"),
                      value: `${parsedItemCount}`,
                      color: PALETTE.onSurface,
                    },
                    {
                      label: t("flow.import.total"),
                      value: formatMoney(
                        estimatedTotalCents,
                        record.values.currency,
                        locale,
                      ),
                      color: PALETTE.onSurface,
                    },
                    {
                      label: t("flow.import.ignored"),
                      value: `${ignoredLineCount}`,
                      color:
                        ignoredLineCount > 0
                          ? PALETTE.primary
                          : PALETTE.onSurface,
                    },
                  ].map((stat) => (
                    <YStack
                      key={stat.label}
                      accessible={true}
                      accessibilityLabel={t("flow.import.previewA11y", { label: stat.label, value: stat.value })}
                      flex={1}
                      gap="$0.5"
                    >
                      <Text
                        fontFamily={FONTS.headlineBlack}
                        fontSize={stat.label === "Total" ? 24 : 22}
                        color={stat.color}
                        letterSpacing={-1}
                      >
                        {stat.value}
                      </Text>
                      <Text
                        fontFamily={FONTS.bodyMedium}
                        fontSize={12}
                        color={PALETTE.onSurfaceVariant}
                      >
                        {stat.label}
                      </Text>
                    </YStack>
                  ))}
                </XStack>
                <PrimaryButton
                  label={t("flow.import.addReview")}
                  icon={<ArrowRight color={PALETTE.onPrimary} size={18} />}
                  onPress={() => void applyImport()}
                  disabled={parsedItemCount === 0}
                />
              </YStack>
            )}
          </YStack>
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
          title={t("flow.import.title")}
          onBack={() => {
            if (step === 2) {
              setStep(1);
              return;
            }
            router.replace(`/split/${draftId}/items`);
          }}
        />
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          { paddingBottom: 228 + Math.max(insets.bottom, 14), gap: 22 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <YStack gap="$5">
            <SectionCard soft>
              <SectionEyebrow>{t("flow.import.stepOne")}</SectionEyebrow>
              <Text fontFamily={FONTS.headlineBlack} fontSize={30} color={PALETTE.onSurface} letterSpacing={-0.8}>
                {t("flow.import.askAiTitle")}
              </Text>
              <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={15} lineHeight={22}>
                {t("flow.import.askAiDescription")}
              </Paragraph>
            </SectionCard>

            <SectionCard>
              <FieldLabel>{t("flow.import.chooseTool")}</FieldLabel>
              <XStack gap="$3">
                {AI_PROVIDERS.map((option) => {
                  const selected = provider === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityLabel={t("flow.import.chooseToolA11y", { provider: option.label })}
                      style={[
                        {
                          flex: 1,
                          minHeight: 92,
                          borderRadius: 24,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 12,
                          backgroundColor: selected ? PALETTE.secondaryContainer : PALETTE.surfaceContainerLow,
                          borderWidth: selected ? 1 : 0,
                          borderColor: selected ? PALETTE.secondary : "transparent",
                        },
                      ]}
                      onPress={() => setProvider(option.id)}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: option.iconBackground,
                        }}
                      >
                        <AiProviderIcon icon={option.icon} color={option.iconColor} />
                      </View>
                      <Text
                        color={selected ? PALETTE.onSecondaryContainer : PALETTE.primary}
                        fontFamily={FONTS.bodyBold}
                        fontSize={13}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </XStack>
            </SectionCard>

            <SectionCard>
              <XStack justifyContent="space-between" alignItems="center" gap="$3">
                <FieldLabel>{t("flow.import.prompt")}</FieldLabel>
                <Pressable accessibilityRole="button" accessibilityLabel={t("flow.import.copyPromptA11y")} onPress={() => void copyPromptText()}>
                  <XStack alignItems="center" gap="$1.5">
                    <ClipboardCopy color={PALETTE.primary} size={14} />
                    <Text color={PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={12}>
                      {t("flow.import.copyPrompt")}
                    </Text>
                  </XStack>
                </Pressable>
              </XStack>
              <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body} fontSize={14} lineHeight={22}>
                {prompt}
              </Paragraph>
            </SectionCard>

            <SectionCard soft>
              <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={21}>
                {t("flow.import.afterAi")}
              </Paragraph>
            </SectionCard>
          </YStack>
        ) : (
          <YStack gap="$5">
            <SectionCard soft>
              <SectionEyebrow>{t("flow.import.stepTwo")}</SectionEyebrow>
              <Text fontFamily={FONTS.headlineBlack} fontSize={30} color={PALETTE.onSurface} letterSpacing={-0.8}>
                {t("flow.import.pasteTitle")}
              </Text>
            </SectionCard>

            <SectionCard>
              <FieldLabel>{t("flow.import.mode")}</FieldLabel>
              <XStack gap="$3">
                {(["append", "replace"] as const).map((option) => (
                  <Pressable key={option} style={[screenStyles.togglePill, { backgroundColor: mode === option ? PALETTE.primary : PALETTE.surfaceContainerLow }]} onPress={() => setMode(option)}>
                    <Text color={mode === option ? PALETTE.onPrimary : PALETTE.primary} fontFamily={FONTS.bodyBold}>
                      {option === "append" ? t("flow.import.mode.append") : t("flow.import.mode.replace")}
                    </Text>
                  </Pressable>
                ))}
              </XStack>
            </SectionCard>

            <SectionCard>
              <XStack justifyContent="space-between" alignItems="center" gap="$3">
              <FieldLabel>{t("flow.import.pastedText")}</FieldLabel>
                {hasPastedText ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t("common.clearAll")} onPress={() => setInput("")}>
                    <Text color={PALETTE.primary} fontFamily={FONTS.bodyBold} fontSize={12} textTransform="uppercase" letterSpacing={1.1}>
                      {t("common.clearAll")}
                    </Text>
                  </Pressable>
                ) : null}
              </XStack>
              <SoftInput value={input} onChangeText={setInput} multiline placeholder={t("flow.import.samplePlaceholder")} />
            </SectionCard>

          </YStack>
        )}
      </ScrollView>
    </AppScreen>
  );
}
