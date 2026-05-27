import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { FieldLabel, SectionEyebrow } from "../../../../components/ui";
import type { AppSettings } from "../../../../storage/settings";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import {
  getCurrencyOptionLabel,
  getInitials,
} from "../shared/participantUtils";
import { HomeMainHeader } from "./HomeMainHeader";
import {
  isBalanceDependentSplitListAmountDisplay,
  MAX_OWNER_NAME_LENGTH,
} from "./useHomeSettingsDraftController";
import type {
  SplitListAmountDisplayOption,
} from "./homeTypes";
import { screenStyles } from "../shared/styles";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function HomeSettingsTabContent({
  topInset,
  footerInsetBottom,
  settings,
  ownerNameDraft,
  setOwnerNameDraft,
  ownerProfileImageUriDraft,
  balanceFeatureEnabledDraft,
  setBalanceFeatureEnabledDraft,
  trackPaymentsFeatureEnabledDraft,
  setTrackPaymentsFeatureEnabledDraft,
  defaultCurrencyDraft,
  setLanguageMenuOpen,
  setHumourMenuOpen,
  setCurrencyMenuOpen,
  setSplitListAmountDisplayMenuOpen,
  setProfileActionMenuOpen,
  languageDraft,
  humourDraft,
  splitListAmountDisplayOptions,
  splitListAmountDisplayDraft,
  setSplitListAmountDisplayDraft,
  customCurrenciesDraft,
}: {
  topInset: number;
  footerInsetBottom: number;
  settings: AppSettings;
  ownerNameDraft: string;
  setOwnerNameDraft: (value: string) => void;
  ownerProfileImageUriDraft: string;
  balanceFeatureEnabledDraft: boolean;
  setBalanceFeatureEnabledDraft: (
    value: boolean | ((value: boolean) => boolean),
  ) => void;
  trackPaymentsFeatureEnabledDraft: boolean;
  setTrackPaymentsFeatureEnabledDraft: (
    value: boolean | ((value: boolean) => boolean),
  ) => void;
  defaultCurrencyDraft: string;
  setLanguageMenuOpen: (value: boolean) => void;
  setHumourMenuOpen: (value: boolean) => void;
  setCurrencyMenuOpen: (value: boolean) => void;
  setSplitListAmountDisplayMenuOpen: (value: boolean) => void;
  setProfileActionMenuOpen: (value: boolean) => void;
  languageDraft: "en" | "pt";
  humourDraft: "plain" | "sassy" | "unhinged";
  splitListAmountDisplayOptions: SplitListAmountDisplayOption[];
  splitListAmountDisplayDraft:
    | "remaining"
    | "total"
    | "userPaid"
    | "totalAndRemaining";
  setSplitListAmountDisplayDraft: (
    value: "remaining" | "total" | "userPaid" | "totalAndRemaining",
  ) => void;
  customCurrenciesDraft: Array<{ code: string; name: string; symbol: string }>;
}) {
  const { t } = useTranslation();

  return (
    <YStack flex={1}>
      <HomeMainHeader topInset={topInset} />
      <ScrollView
        testID="settings-tab-scroll"
        style={screenStyles.flex}
        nestedScrollEnabled
        contentContainerStyle={[
          screenStyles.mainTabScrollContent,
          { paddingBottom: footerInsetBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5">
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.userProfile")}</SectionEyebrow>
            <XStack gap="$4" alignItems="flex-start">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.profilePictureOptions")}
                style={screenStyles.settingsAvatarWrap}
                onPress={() => setProfileActionMenuOpen(true)}
              >
                {ownerProfileImageUriDraft ? (
                  <Image
                    source={{ uri: ownerProfileImageUriDraft }}
                    style={screenStyles.settingsAvatarImage}
                  />
                ) : (
                  <Text
                    fontFamily={FONTS.headlineBlack}
                    fontSize={22}
                    color={PALETTE.primary}
                  >
                    {getInitials(ownerNameDraft || settings.ownerName)}
                  </Text>
                )}
              </Pressable>
              <YStack flex={1} gap="$2">
                <FieldLabel>Your name</FieldLabel>
                <View style={screenStyles.assignInputShell}>
                  <TextInput
                    value={ownerNameDraft}
                    onChangeText={(value) =>
                      setOwnerNameDraft(value.slice(0, MAX_OWNER_NAME_LENGTH))
                    }
                    placeholder={t("settings.ownerNamePlaceholder")}
                    placeholderTextColor={PALETTE.inputPlaceholder}
                    style={screenStyles.assignInput}
                    maxLength={MAX_OWNER_NAME_LENGTH}
                  />
                </View>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  This is the name the app uses for your own spot in a split,
                  like `Tiago (You)`.
                </Text>
              </YStack>
            </XStack>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.defaultCurrency")}</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("settings.defaultCurrencyDescription")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.currencyPicker")}
              style={screenStyles.selectRow}
              onPress={() => setCurrencyMenuOpen(true)}
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
                  {getCurrencyOptionLabel(defaultCurrencyDraft, {
                    customCurrencies: customCurrenciesDraft,
                  })}
                </Text>
                <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
              </XStack>
            </Pressable>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.voice")}</SectionEyebrow>
            <YStack gap="$3">
              <FieldLabel>{t("settings.language")}</FieldLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.pickLanguage")}
                style={screenStyles.selectRow}
                onPress={() => setLanguageMenuOpen(true)}
              >
                <XStack alignItems="center" justifyContent="space-between" gap="$3">
                  <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                    {t(languageDraft === "pt" ? "settings.language.pt" : "settings.language.en")}
                  </Text>
                  <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                </XStack>
              </Pressable>
            </YStack>
            <YStack gap="$3">
              <FieldLabel>{t("settings.tone")}</FieldLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.pickTone")}
                style={screenStyles.selectRow}
                onPress={() => setHumourMenuOpen(true)}
              >
                <XStack alignItems="center" justifyContent="space-between" gap="$3">
                  <Text fontFamily={FONTS.bodyMedium} fontSize={17} color={PALETTE.onSurface}>
                    {t(
                      humourDraft === "sassy"
                        ? "settings.humour.sassy"
                        : humourDraft === "unhinged"
                          ? "settings.humour.unhinged"
                          : "settings.humour.plain",
                    )}
                  </Text>
                  <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
                </XStack>
              </Pressable>
            </YStack>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.splitRows")}</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("settings.splitRowsDescription")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.splitRowsPicker")}
              style={screenStyles.selectRow}
              onPress={() => setSplitListAmountDisplayMenuOpen(true)}
            >
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <YStack flex={1} gap="$1">
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={16}
                    color={PALETTE.onSurface}
                  >
                    {
                      splitListAmountDisplayOptions.find(
                        (option) => option.key === splitListAmountDisplayDraft,
                      )?.label
                    }
                  </Text>
                  <Text
                    fontFamily={FONTS.bodyMedium}
                    fontSize={13}
                    lineHeight={18}
                    color={PALETTE.onSurfaceVariant}
                  >
                    {
                      splitListAmountDisplayOptions.find(
                        (option) => option.key === splitListAmountDisplayDraft,
                      )?.summary
                    }
                  </Text>
                </YStack>
                <ChevronDown color={PALETTE.onSurfaceVariant} size={18} />
              </XStack>
            </Pressable>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.features")}</SectionEyebrow>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  {t("settings.trackPayments.title")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("settings.trackPayments.description")}
                </Text>
              </YStack>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Toggle track payments"
                accessibilityState={{
                  checked: trackPaymentsFeatureEnabledDraft,
                }}
                style={[
                  screenStyles.settingsFeatureToggle,
                  trackPaymentsFeatureEnabledDraft
                    ? screenStyles.settingsFeatureToggleActive
                    : null,
                ]}
                onPress={() => {
                  const nextTrackPayments = !trackPaymentsFeatureEnabledDraft;
                  setTrackPaymentsFeatureEnabledDraft(nextTrackPayments);
                  setBalanceFeatureEnabledDraft((value) =>
                    nextTrackPayments ? value : false,
                  );
                }}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={
                    trackPaymentsFeatureEnabledDraft
                      ? PALETTE.onPrimary
                      : PALETTE.primary
                  }
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {trackPaymentsFeatureEnabledDraft ? t("common.on") : t("common.off")}
                </Text>
              </Pressable>
            </View>
            <View style={screenStyles.settingsFeatureRow}>
              <YStack gap="$2.5" flex={1}>
                <Text
                  fontFamily={FONTS.headlineBold}
                  fontSize={18}
                  color={PALETTE.onSurface}
                >
                  {t("settings.balanceHelper.title")}
                </Text>
                <Text
                  fontFamily={FONTS.bodyMedium}
                  fontSize={14}
                  lineHeight={21}
                  color={PALETTE.onSurfaceVariant}
                >
                  {t("settings.balanceHelper.description")}
                </Text>
              </YStack>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Toggle balance helper"
                accessibilityState={{ checked: balanceFeatureEnabledDraft }}
                style={[
                  screenStyles.settingsFeatureToggle,
                  balanceFeatureEnabledDraft
                    ? screenStyles.settingsFeatureToggleActive
                    : null,
                ]}
                onPress={() => {
                  const nextBalance = !balanceFeatureEnabledDraft;
                  setBalanceFeatureEnabledDraft(nextBalance);
                  if (
                    !nextBalance &&
                    isBalanceDependentSplitListAmountDisplay(
                      splitListAmountDisplayDraft,
                    )
                  ) {
                    setSplitListAmountDisplayDraft("total");
                  }
                  setTrackPaymentsFeatureEnabledDraft((value) =>
                    nextBalance ? true : value,
                  );
                }}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={12}
                  color={
                    balanceFeatureEnabledDraft
                      ? PALETTE.onPrimary
                      : PALETTE.primary
                  }
                  textTransform="uppercase"
                  letterSpacing={1.6}
                >
                  {balanceFeatureEnabledDraft ? t("common.on") : t("common.off")}
                </Text>
              </Pressable>
            </View>
          </YStack>
          <View style={screenStyles.itemsSectionSeparator} />
          <YStack gap="$4">
            <SectionEyebrow>{t("settings.disclaimer.title")}</SectionEyebrow>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("settings.disclaimer.body")}
            </Text>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
