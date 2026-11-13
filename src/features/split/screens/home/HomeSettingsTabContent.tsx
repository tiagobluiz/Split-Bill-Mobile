import { useEffect, useMemo, useState } from "react";
import { BackHandler, Image, Pressable, ScrollView, Switch, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus, Trash2, Tag, Coins, Globe, Volume2, List, CircleCheck, ChartNoAxesColumn } from "lucide-react-native";
import {
  Text as TamaguiText,
  YStack as TamaguiYStack,
} from "tamagui";


import type { AppSettings } from "../../../../storage/settings";
import {
  getSplitTagDisplayLabel,
  sortTagsAlphabetically,
  type SplitTag,
  type SplitTagColor,
  type SplitTagIcon,
} from "../../tags";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import {
  getCurrencyOptionLabel,
  getInitials,
} from "../shared/participantUtils";

import {
  isBalanceDependentSplitListAmountDisplay,
} from "./useHomeSettingsDraftController";
import type { SplitListAmountDisplayOption } from "./homeTypes";
import { screenStyles } from "../shared/styles";
import { ConfirmChoiceModal } from "../shared/modals";
import { FormBottomSheet } from "../shared/FormBottomSheet";
import { TagChip } from "../shared/TagChips";
import { TagEditorModal } from "../shared/TagEditorModal";
import { HomeMainHeader } from "./HomeMainHeader";

const Text = TamaguiText as any;
const YStack = TamaguiYStack as any;

export function HomeSettingsTabContent({
  topInset,
  footerInsetBottom,
  settings,
  onEditProfile,
  balanceFeatureEnabledDraft,
  setBalanceFeatureEnabledDraft,
  trackPaymentsFeatureEnabledDraft,
  setTrackPaymentsFeatureEnabledDraft,
  defaultCurrencyDraft,
  setLanguageMenuOpen,
  setHumourMenuOpen,
  setCurrencyMenuOpen,
  setSplitListAmountDisplayMenuOpen,
  languageDraft,
  humourDraft,
  splitListAmountDisplayOptions,
  splitListAmountDisplayDraft,
  setSplitListAmountDisplayDraft,
  customCurrenciesDraft,
  tags,
  onAddTag,
  tagEditorOpen,
  setTagEditorOpen,
  pendingTagDeleteId,
  setPendingTagDeleteId,
  getTagUsageCount,
  onConfirmDeleteTag,
}: {
  topInset: number;
  footerInsetBottom: number;
  settings: AppSettings;
  onEditProfile: () => void;
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
  tags: SplitTag[];
  onAddTag: (
    label: string,
    icon?: SplitTagIcon | null,
    color?: SplitTagColor,
  ) => Promise<boolean>;
  tagEditorOpen: boolean;
  setTagEditorOpen: (value: boolean) => void;
  pendingTagDeleteId: string;
  setPendingTagDeleteId: (tagId: string) => void;
  getTagUsageCount: (tagId: string) => number | null;
  onConfirmDeleteTag: (tagId: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState<"overview" | "tags">("overview");
  useEffect(() => {
    if (page === "overview" || tagEditorOpen || pendingTagDeleteId) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPage("overview");
      return true;
    });
    return () => subscription.remove();
  }, [page, tagEditorOpen, pendingTagDeleteId]);
  const orderedTags = useMemo(
    () => sortTagsAlphabetically(tags, (tag) => getSplitTagDisplayLabel(tag, t)),
    [tags, t],
  );
  const pendingDeleteTag = tags.find((tag) => tag.id === pendingTagDeleteId);
  const pendingDeleteTagLabel = pendingDeleteTag
    ? getSplitTagDisplayLabel(pendingDeleteTag, t)
    : "";
  const pendingDeleteTagUsageCount = pendingDeleteTag
    ? getTagUsageCount(pendingDeleteTag.id)
    : 0;

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
        {page !== "overview" ? (
          <YStack gap="$4">
            <Pressable testID="settings-back" accessibilityRole="button" accessibilityLabel={t("settings.back")} onPress={() => setPage("overview")} style={{ flexDirection: "row", alignItems: "center" }}><ChevronLeft color={PALETTE.primary} size={22} /><Text color={PALETTE.primary} fontFamily={FONTS.bodyBold}>{t("settings.title")}</Text></Pressable>
            <Text fontFamily={FONTS.headlineBlack} fontSize={28} color={PALETTE.onSurface}>{t("tags.settingsTitle")}</Text>
            <YStack gap="$4">
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={14}
              lineHeight={21}
              color={PALETTE.onSurfaceVariant}
            >
              {t("tags.settingsDescription")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tags.add")}
              style={screenStyles.tagCreateButton}
              onPress={() => setTagEditorOpen(true)}
            >
              <Plus color={PALETTE.primary} size={16} />
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={14}
                color={PALETTE.primary}
              >
                {t("tags.add")}
              </Text>
            </Pressable>
            <YStack gap="$2">
              {orderedTags.map((tag) => (
                <View key={tag.id} style={screenStyles.tagManagerRow}>
                  <TagChip tag={tag} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tags.deleteA11y", {
                      tag: getSplitTagDisplayLabel(tag, t),
                    })}
                    onPress={() => setPendingTagDeleteId(tag.id)}
                  >
                    <Trash2 color={PALETTE.danger} size={18} />
                  </Pressable>
                </View>
              ))}
            </YStack>
            </YStack>
          </YStack>
        ) : (
          <YStack style={{ gap: 20 }}>
            <SettingsSection title={t("settings.userProfile")}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${settings.ownerName}, ${t("settings.editProfile")}`} onPress={onEditProfile} style={rowStyle}>
                {settings.ownerProfileImageUri ? <Image source={{ uri: settings.ownerProfileImageUri }} style={avatarStyle} /> : <View style={[avatarStyle, { backgroundColor: PALETTE.primaryContainer, alignItems: "center", justifyContent: "center" }]}><Text fontFamily={FONTS.bodyBold} color={PALETTE.primary} fontSize={18}>{getInitials(settings.ownerName)}</Text></View>}
                <View style={{ flex: 1 }}><Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>{settings.ownerName}</Text><Text color={PALETTE.onSurfaceVariant} fontSize={13}>{t("settings.editProfile")}</Text></View><ChevronRight color={PALETTE.onSurfaceVariant} size={20} />
              </Pressable>
            </SettingsSection>
            <SettingsSection title={t("settings.organization")}>
              <SettingsRow icon={Tag} label={t("tags.settingsTitle")} value={t(tags.length === 1 ? "settings.tagCountOne" : "settings.tagCount", { count: tags.length })} badge onPress={() => setPage("tags")} />
            </SettingsSection>
            <SettingsSection title={t("settings.preferences")}>
              <SettingsRow icon={Coins} label={t("settings.defaultCurrency")} value={getCurrencyOptionLabel(defaultCurrencyDraft, { customCurrencies: customCurrenciesDraft })} accessibilityLabel={t("settings.currencyPicker")} onPress={() => setCurrencyMenuOpen(true)} />
              <SettingsRow divider icon={Globe} label={t("settings.language")} value={t(languageDraft === "pt" ? "settings.language.pt" : "settings.language.en")} accessibilityLabel={t("settings.pickLanguage")} onPress={() => setLanguageMenuOpen(true)} />
              <SettingsRow divider icon={Volume2} label={t("settings.tone")} value={t(humourDraft === "sassy" ? "settings.humour.sassy" : humourDraft === "unhinged" ? "settings.humour.unhinged" : "settings.humour.plain")} accessibilityLabel={t("settings.pickTone")} onPress={() => setHumourMenuOpen(true)} />
              <SettingsRow divider icon={List} label={t("settings.splitRows")} value={splitListAmountDisplayOptions.find((option) => option.key === splitListAmountDisplayDraft)?.label} accessibilityLabel={t("settings.splitRowsPicker")} onPress={() => setSplitListAmountDisplayMenuOpen(true)} />
            </SettingsSection>
            <SettingsSection title={t("settings.features")}>
              <SettingsSwitch icon={CircleCheck} label={t("settings.trackPayments.title")} description={t("settings.trackPayments.shortDescription")} accessibilityLabel={t("settings.trackPayments.toggleA11y")} value={trackPaymentsFeatureEnabledDraft} onChange={(next) => { setTrackPaymentsFeatureEnabledDraft(next); if (!next) { setBalanceFeatureEnabledDraft(false); if (isBalanceDependentSplitListAmountDisplay(splitListAmountDisplayDraft)) setSplitListAmountDisplayDraft("total"); } }} />
              <SettingsSwitch divider icon={ChartNoAxesColumn} label={t("settings.balanceHelper.title")} description={t("settings.balanceHelper.shortDescription")} accessibilityLabel={t("settings.balanceHelper.toggleA11y")} value={balanceFeatureEnabledDraft} onChange={(next) => { setBalanceFeatureEnabledDraft(next); if (next) setTrackPaymentsFeatureEnabledDraft(true); else if (isBalanceDependentSplitListAmountDisplay(splitListAmountDisplayDraft)) setSplitListAmountDisplayDraft("total"); }} />
            </SettingsSection>
            <SettingsSection title={t("settings.data")}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface}>{t("settings.aboutData")}</Text>
                <Text fontFamily={FONTS.bodyMedium} fontSize={14} lineHeight={20} color={PALETTE.onSurfaceVariant}>{t("settings.disclaimer.body")}</Text>
              </View>
            </SettingsSection>
          </YStack>
        )}
      </ScrollView>
      {pendingDeleteTag && pendingDeleteTagUsageCount === null ? (
        <FormBottomSheet title={t("home.loadingSplits")} onClose={() => setPendingTagDeleteId("")}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} style={screenStyles.formSheetCancel} onPress={() => setPendingTagDeleteId("")}>
            <Text fontFamily={FONTS.bodyBold} fontSize={14} color={PALETTE.primary} textAlign="center">{t("common.cancel")}</Text>
          </Pressable>
        </FormBottomSheet>
      ) : pendingDeleteTag ? (
        <ConfirmChoiceModal
          title={t("tags.confirmDeleteTitle")}
          body={t("tags.confirmDeleteBody", {
            tag: pendingDeleteTagLabel,
            usage: t(
              pendingDeleteTagUsageCount === 1
                ? "tags.confirmDeleteUsageSingular"
                : "tags.confirmDeleteUsagePlural",
              { count: pendingDeleteTagUsageCount ?? 0 },
            ),
          })}
          confirmLabel={t("tags.confirmDelete")}
          discardLabel={t("common.cancel")}
          onConfirm={() => onConfirmDeleteTag(pendingDeleteTag.id)}
          onDiscard={() => setPendingTagDeleteId("")}
        />
      ) : null}
      {tagEditorOpen ? (
        <TagEditorModal
          existingTags={tags}
          onCancel={() => setTagEditorOpen(false)}
          onSave={async (label, icon, color) => {
            const saved = await onAddTag(label, icon, color);
            if (saved) {
              setTagEditorOpen(false);
            }
            return saved;
          }}
        />
      ) : null}
    </YStack>
  );
}

const rowStyle = { minHeight: 56, paddingHorizontal: 16, paddingVertical: 6, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 };
const avatarStyle = { width: 48, height: 48, borderRadius: 24 };
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 10 }}><Text fontFamily={FONTS.bodyBold} fontSize={12} letterSpacing={1} textTransform="uppercase" color={PALETTE.onSurfaceVariant}>{title}</Text><View style={{ backgroundColor: PALETTE.surfaceContainerLowest, borderRadius: 18, shadowColor: PALETTE.primary, shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 }}><View style={{ borderRadius: 18, overflow: "hidden" }}>{children}</View></View></View>;
}
function SettingsRow({ icon: Icon, label, subtitle, value, badge, divider, accessibilityLabel, onPress }: { icon: any; label: string; subtitle?: string; value?: string; badge?: boolean; divider?: boolean; accessibilityLabel?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={[rowStyle, { borderTopWidth: divider ? 0.5 : 0, borderColor: PALETTE.outlineVariant }]}><Icon size={22} color={PALETTE.primary} /><View style={{ flex: 1 }}><Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface}>{label}</Text>{subtitle ? <Text fontSize={12} color={PALETTE.onSurfaceVariant}>{subtitle}</Text> : null}</View>{value ? <Text fontSize={13} color={badge ? PALETTE.primary : PALETTE.onSurfaceVariant} style={{ flexShrink: 0, maxWidth: "45%", ...(badge ? { backgroundColor: PALETTE.secondaryContainer, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" } : {}) }}>{value}</Text> : null}<ChevronRight size={18} color={PALETTE.onSurfaceVariant} /></Pressable>;
}
function SettingsSwitch({ icon: Icon, label, description, accessibilityLabel, value, onChange, divider }: { icon: any; label: string; description: string; divider?: boolean; accessibilityLabel: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={[rowStyle, { borderTopWidth: divider ? 0.5 : 0, borderColor: PALETTE.outlineVariant }]}><Icon size={22} color={PALETTE.primary} /><View style={{ flex: 1 }}><Text fontFamily={FONTS.bodyBold} fontSize={15} color={PALETTE.onSurface}>{label}</Text><Text fontSize={12} color={PALETTE.onSurfaceVariant}>{description}</Text></View><Switch accessibilityLabel={accessibilityLabel} value={value} onValueChange={onChange} trackColor={{ false: PALETTE.track, true: PALETTE.primary }} thumbColor={PALETTE.onPrimary} /></View>;
}
