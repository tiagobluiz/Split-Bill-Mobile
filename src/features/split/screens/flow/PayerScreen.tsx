import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { Check } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  AppScreen,
  EmptyState,
  FloatingFooter,
} from "../../../../components/ui";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { useSplitStore } from "../../store";
import { FlowScreenHeader } from "../shared/flowComponents";
import { FlowContinueButton } from "../shared/components";
import { useRecord } from "../shared/hooks";
import { SplitNoticeModal } from "../shared/modals";
import { ParticipantAvatar } from "../shared/participantComponents";
import { getParticipantDisplayName } from "../shared/participantUtils";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function PayerScreenView({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const record = useRecord(draftId);
  const { setPayer, setStep, settings } = useSplitStore(
    useShallow((state) => ({
      setPayer: state.setPayer,
      setStep: state.setStep,
      settings: state.settings,
    })),
  );
  const [showPayerHint, setShowPayerHint] = useState(false);
  const insets = useSafeAreaInsets();

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

  const payerErrors = record.values.payerParticipantId
    ? []
    : [t("validation.payerRequired")];

  return (
    <AppScreen
      scroll={false}
      footer={
        <FloatingFooter>
          <FlowContinueButton
            accessibilityLabel={t("flow.payer.nextA11y")}
            disabled={!record.values.payerParticipantId}
            label={t("flow.payer.next", undefined, { maxLength: 20 })}
            onPress={async () => {
              if (!record.values.payerParticipantId) {
                setShowPayerHint(true);
                return;
              }

              await setStep(4);
              router.push(`/split/${draftId}/items`);
            }}
          />
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
          title={t("flow.payer.title")}
          onBack={() => router.replace(`/split/${draftId}/participants`)}
        />
      </View>
      <ScrollView
        style={screenStyles.flex}
        contentContainerStyle={[
          screenStyles.participantsScrollContent,
          {
            paddingBottom: 172 + Math.max(insets.bottom, 14),
            gap: 26,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <YStack gap="$3.5">
            {record.values.participants.map((participant) => {
              const selected =
                participant.id === record.values.payerParticipantId;

              return (
                <Pressable
                  key={participant.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose payer ${participant.name}`}
                  style={[
                    screenStyles.payerOptionRow,
                    selected ? screenStyles.payerOptionRowSelected : null,
                  ]}
                  onPress={() => void setPayer(participant.id)}
                >
                  <XStack alignItems="center" gap="$3.5" flex={1}>
                    <ParticipantAvatar
                      name={participant.name}
                      ownerName={settings.ownerName}
                      ownerProfileImageUri={settings.ownerProfileImageUri}
                      style={screenStyles.payerAvatar}
                      label={`Payer avatar ${participant.name}`}
                      textSize={16}
                    />
                    <Text
                      fontFamily={FONTS.bodyBold}
                      fontSize={16}
                      color={PALETTE.onSurface}
                    >
                      {getParticipantDisplayName(
                        participant.name,
                        settings.ownerName,
                      )}
                    </Text>
                  </XStack>
                  {selected ? (
                    <View style={screenStyles.payerSelectedIndicator}>
                      <Check color={PALETTE.onPrimary} size={16} />
                    </View>
                  ) : (
                    <View style={screenStyles.payerUnselectedIndicator} />
                  )}
                </Pressable>
              );
            })}
          </YStack>
        </YStack>
      </ScrollView>
      <SplitNoticeModal
        messages={showPayerHint ? payerErrors : []}
        onDismiss={() => setShowPayerHint(false)}
      />
    </AppScreen>
  );
}
