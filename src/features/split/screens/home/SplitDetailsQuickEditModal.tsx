import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SplitDatePicker } from "../shared/SplitDatePicker";
import { InvoicePhotoField } from "../shared/InvoicePhotoField";
import { areSameInvoicePhotos, persistInvoicePhoto, removeInvoicePhoto, type InvoicePhotoSelection } from "../../invoicePhotos";
import { Plus } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { SPLIT_NAME_MAX_LENGTH, trimName } from "../../../../domain";
import { localDay } from "../../../../domain/splitDate";
import { useTranslation } from "../../../../i18n/provider";
import { FONTS, PALETTE } from "../../../../theme/palette";
import {
  getSplitTagDisplayLabel,
  normalizeTagName,
  sortTagsAlphabetically,
  type SplitTag,
  type SplitTagColor,
  type SplitTagIcon,
} from "../../tags";
import { TagChip } from "../shared/TagChips";
import { TagEditorModal } from "../shared/TagEditorModal";
import { FieldLabel } from "../../../../components/ui";
import { screenStyles } from "../shared/styles";
import type { HomeRecord } from "./homeTypes";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

function normalizeSelectedTagIds(tagIds: string[], tags: SplitTag[]) {
  const validIds = new Set(tags.map((tag) => tag.id));
  const seen = new Set<string>();
  return tagIds.filter((tagId) => {
    if (!validIds.has(tagId) || seen.has(tagId)) {
      return false;
    }
    seen.add(tagId);
    return true;
  });
}

export function SplitDetailsQuickEditModal({
  record,
  tags,
  onSave,
  onCancel,
  onAddTag,
}: {
  record: HomeRecord;
  tags: SplitTag[];
  onSave: (details: { splitName: string; tagIds: string[]; splitDate?: string; invoicePhotoUri?: string | null; invoicePhotoName?: string | null; invoicePhotoSize?: number | null }) => Promise<void>;
  onCancel: () => void;
  onAddTag: (
    label: string,
    icon?: SplitTagIcon | null,
    color?: SplitTagColor,
  ) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [nameDraft, setNameDraft] = useState(record.values.splitName ?? "");
  const [splitDate, setSplitDate] = useState(record.values.splitDate ?? localDay(new Date(record.createdAt)));
  const [invoicePhotoUri, setInvoicePhotoUri] = useState(record.values.invoicePhotoUri ?? null);
  const [invoicePhotoName, setInvoicePhotoName] = useState(record.values.invoicePhotoName ?? null);
  const [invoicePhotoSize, setInvoicePhotoSize] = useState(record.values.invoicePhotoSize ?? null);
  const [selectedTagIds, setSelectedTagIds] = useState(() =>
    normalizeSelectedTagIds(record.values.tagIds ?? [], tags),
  );
  const [error, setError] = useState("");
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [pendingCreatedTagLabel, setPendingCreatedTagLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const orderedTags = useMemo(
    () => sortTagsAlphabetically(tags, (tag) => getSplitTagDisplayLabel(tag, t)),
    [tags, t],
  );
  const previousRecordIdRef = useRef(record.id);

  useEffect(() => {
    if (previousRecordIdRef.current === record.id) {
      return;
    }
    previousRecordIdRef.current = record.id;
    setNameDraft(record.values.splitName ?? "");
    setSplitDate(record.values.splitDate ?? localDay(new Date(record.createdAt)));
    setInvoicePhotoUri(record.values.invoicePhotoUri ?? null);
    setInvoicePhotoName(record.values.invoicePhotoName ?? null);
    setInvoicePhotoSize(record.values.invoicePhotoSize ?? null);
    setSelectedTagIds(normalizeSelectedTagIds(record.values.tagIds ?? [], tags));
    setError("");
    setSaving(false);
  }, [record.id, record.values.splitName, record.values.tagIds, record.values.invoicePhotoUri, record.values.invoicePhotoName, record.values.invoicePhotoSize, tags]);

  useEffect(() => {
    setSelectedTagIds((current) => normalizeSelectedTagIds(current, tags));
  }, [tags]);

  useEffect(() => {
    if (!pendingCreatedTagLabel) {
      return;
    }
    const createdTag = tags.find(
      (tag) =>
        getSplitTagDisplayLabel(tag, t).trim().toLowerCase() ===
        pendingCreatedTagLabel.trim().toLowerCase(),
    );
    if (!createdTag) {
      return;
    }
    setSelectedTagIds((current) =>
      current.includes(createdTag.id) ? current : [...current, createdTag.id],
    );
    setPendingCreatedTagLabel("");
  }, [pendingCreatedTagLabel, tags]);

  const saveDetails = async () => {
    const nextName = trimName(nameDraft);
    if (!nextName) {
      setError(t("home.editDetails.nameRequired"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const savedPhoto = await persistInvoicePhoto(invoicePhotoUri);
      try {
      await onSave({
        splitName: nextName.slice(0, SPLIT_NAME_MAX_LENGTH),
        tagIds: selectedTagIds,
        splitDate,
        invoicePhotoUri: savedPhoto,
        invoicePhotoName: invoicePhotoUri ? invoicePhotoName : null,
        invoicePhotoSize: invoicePhotoUri ? invoicePhotoSize : null,
      });
      } catch (error) {
        if (!areSameInvoicePhotos(savedPhoto, record.values.invoicePhotoUri)) await removeInvoicePhoto(savedPhoto);
        throw error;
      }
      if (!areSameInvoicePhotos(savedPhoto, record.values.invoicePhotoUri)) await removeInvoicePhoto(record.values.invoicePhotoUri);
    } catch (saveError) {
      const message =
        saveError instanceof Error && saveError.message
          ? saveError.message
          : t("common.tryAgain");
      setError(t("home.editDetails.saveFailed", { error: message }));
      setSaving(false);
    }
  };

  return (
    <>
      <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("modal.dismissActionSheet")}
          style={screenStyles.splitNoticeBackdrop}
          onPress={onCancel}
        />
        <View style={screenStyles.quickEditCard}>
          <YStack gap="$3">
            <YStack gap="$1">
              <Text
                fontFamily={FONTS.headlineBold}
                fontSize={22}
                color={PALETTE.onSurface}
              >
                {t("home.editDetails.title")}
              </Text>
              <Text
                fontFamily={FONTS.bodyMedium}
                fontSize={13}
                lineHeight={19}
                color={PALETTE.onSurfaceVariant}
              >
                {t("home.editDetails.description")}
              </Text>
            </YStack>
            <ScrollView
              style={screenStyles.quickEditScroll}
              contentContainerStyle={screenStyles.quickEditContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <YStack gap="$2">
                <FieldLabel>{t("flow.setup.splitName")}</FieldLabel>
                <View style={screenStyles.quickEditInputShell}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={(value) => {
                      setNameDraft(value);
                      if (error) {
                        setError("");
                      }
                    }}
                    accessibilityLabel={t("flow.setup.splitName")}
                    placeholder={t("flow.setup.splitNamePlaceholder")}
                    placeholderTextColor={PALETTE.inputPlaceholder}
                    maxLength={SPLIT_NAME_MAX_LENGTH}
                    style={screenStyles.quickEditInput}
                    returnKeyType="done"
                  />
                </View>
              </YStack>
              <SplitDatePicker value={splitDate} onChange={setSplitDate} />
              <YStack gap="$2">
                <FieldLabel>{t("tags.label")}</FieldLabel>
                <View style={screenStyles.tagPickerGrid}>
                  {orderedTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        accessibilityRole="button"
                        accessibilityLabel={getSplitTagDisplayLabel(tag, t)}
                        accessibilityState={{ selected }}
                        style={screenStyles.tagFilterOption}
                        onPress={() =>
                          setSelectedTagIds((current) =>
                            current.includes(tag.id)
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id],
                          )
                        }
                      >
                        <TagChip tag={tag} selected={selected} />
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tags.add")}
                    style={screenStyles.tagPickerAddInline}
                    onPress={() => setTagEditorOpen(true)}
                  >
                    <XStack alignItems="center" gap="$1.5">
                      <Plus color={PALETTE.primary} size={13} />
                      <Text
                        fontFamily={FONTS.bodyBold}
                        fontSize={12}
                        color={PALETTE.primary}
                      >
                        {t("tags.add")}
                      </Text>
                    </XStack>
                  </Pressable>
                </View>
              </YStack>
              <InvoicePhotoField
                value={invoicePhotoUri}
                fileSize={invoicePhotoSize}
                onChange={(photo: InvoicePhotoSelection | null) => {
                  setInvoicePhotoUri(photo?.uri ?? null);
                  setInvoicePhotoName(photo?.name ?? null);
                  setInvoicePhotoSize(photo?.size ?? null);
                }}
              />
              {error ? (
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={13}
                  lineHeight={18}
                  color={PALETTE.danger}
                >
                  {error}
                </Text>
              ) : null}
            </ScrollView>
            <YStack gap="$2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.editDetails.save")}
                disabled={saving}
                style={[
                  screenStyles.splitNoticeButton,
                  saving ? screenStyles.quickEditButtonDisabled : null,
                ]}
                onPress={() => void saveDetails()}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onPrimary}
                >
                  {t("home.editDetails.save")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                style={[
                  screenStyles.splitNoticeButton,
                  screenStyles.splitNoticeButtonSecondary,
                ]}
                onPress={onCancel}
              >
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={14}
                  color={PALETTE.onSecondaryContainer}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </YStack>
          </YStack>
        </View>
      </View>
      {tagEditorOpen ? (
        <TagEditorModal
          existingTags={tags}
          onCancel={() => setTagEditorOpen(false)}
          onSave={async (label, icon, color) => {
            const saved = await onAddTag(label, icon, color);
            if (!saved) {
              return false;
            }
            setPendingCreatedTagLabel(normalizeTagName(label));
            setTagEditorOpen(false);
            return true;
          }}
        />
      ) : null}
    </>
  );
}
