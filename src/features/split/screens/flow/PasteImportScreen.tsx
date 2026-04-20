import { useState } from "react";
import { Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { ReceiptText, X } from "lucide-react-native";
import {
  Paragraph as TamaguiParagraph,
  Text as TamaguiText,
  XStack as TamaguiXStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FieldLabel,
  FloatingFooter,
  PrimaryButton,
  ScreenHeader,
  SectionCard,
  SectionEyebrow,
  SoftInput,
} from "../../../../components/ui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useSplitStore } from "../../store";
import { useRecord } from "../shared/hooks";
import { screenStyles } from "../shared/styles";

const Paragraph = TamaguiParagraph as any;
const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;

export function PasteImportScreenView({ draftId }: { draftId: string }) {
  const record = useRecord(draftId);
  const importPastedList = useSplitStore((state) => state.importPastedList);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");

  if (!record) {
    return <AppScreen scroll={false}><EmptyState title="Loading draft" description="Opening your split record." /></AppScreen>;
  }

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <PrimaryButton
            label="Apply import"
            icon={<ReceiptText color={PALETTE.onPrimary} size={18} />}
            onPress={async () => {
              if (!input.trim()) {
                Alert.alert("Nothing to import", "Paste at least one line before applying import.");
                return;
              }
              const result = await importPastedList(input, mode);
              const noValidItems = result.warningMessages.some((warning) =>
                warning.includes("No valid items were detected")
              );
              if (noValidItems) {
                Alert.alert("Import failed", result.warningMessages.join("\n"));
                return;
              }
              if (result.warningMessages.length > 0) {
                Alert.alert("Import notes", result.warningMessages.join("\n"));
              }
              router.back();
            }}
          />
        </FloatingFooter>
      }
    >
      <ScreenHeader
        title="Paste item list"
        trailing={
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => router.replace("/")}>
            <X color={PALETTE.primary} size={22} />
          </Pressable>
        }
      />

      <SectionCard>
        <FieldLabel>Import mode</FieldLabel>
        <XStack gap="$3">
          {(["append", "replace"] as const).map((option) => (
            <Pressable key={option} style={[screenStyles.togglePill, { backgroundColor: mode === option ? PALETTE.primary : PALETTE.surfaceContainerLow }]} onPress={() => setMode(option)}>
              <Text color={mode === option ? PALETTE.onPrimary : PALETTE.primary} fontFamily={FONTS.bodyBold}>
                {option === "append" ? "Append" : "Replace"}
              </Text>
            </Pressable>
          ))}
        </XStack>
      </SectionCard>

      <SectionCard>
        <FieldLabel>Pasted text</FieldLabel>
        <SoftInput value={input} onChangeText={setInput} multiline placeholder={"Bananas - 2.49\nTomatoes: 1.80\nMilk 3.40"} />
      </SectionCard>

      <SectionCard soft>
        <SectionEyebrow>Later milestones</SectionEyebrow>
        <Paragraph color={PALETTE.onSurfaceVariant} fontFamily={FONTS.body}>
          OCR, PDF import, and the AI extraction handoff stay deferred in this build. The same documented parser contract still guides this pasted import flow.
        </Paragraph>
      </SectionCard>
    </AppScreen>
  );
}
