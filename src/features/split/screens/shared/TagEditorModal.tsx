import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import {
  Briefcase,
  Heart,
  Home,
  Plane,
  Plus,
  Receipt,
  ShoppingCart,
  Utensils,
  Wine,
  X,
} from "lucide-react-native";
import {
  SystemEmojiPicker,
  useEmojiKeyboard,
} from "react-native-system-emoji-picker";
import ColorPicker from "react-native-wheel-color-picker";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import {
  TAG_NAME_MAX_LENGTH,
  createCustomTagIcon,
  normalizeTagName,
  type SplitTag,
  type SplitTagColor,
  type SplitTagIcon,
} from "../../tags";
import { FONTS, PALETTE } from "../../../../theme/palette";
import { useTranslation } from "../../../../i18n/provider";
import { screenStyles } from "./styles";
import { TagChip } from "./TagChips";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

type IconOption = { key: SplitTagIcon | null; Icon: typeof Utensils };

const ICON_OPTIONS: IconOption[] = [
  { key: null, Icon: X },
  { key: "briefcase", Icon: Briefcase },
  { key: "cart", Icon: ShoppingCart },
  { key: "home", Icon: Home },
  { key: "heart", Icon: Heart },
  { key: "receipt", Icon: Receipt },
  { key: "cup", Icon: Wine },
  { key: "plane", Icon: Plane },
  { key: "utensils", Icon: Utensils },
];

const COLOR_OPTIONS: Array<{ key: SplitTagColor; swatch: string }> = [
  { key: "orange", swatch: "#ff8a45" },
  { key: "mint", swatch: "#8ee8dd" },
  { key: "clay", swatch: "#d99868" },
  { key: "gray", swatch: "#dedede" },
  { key: "#ffd166", swatch: "#ffd166" },
  { key: "#5aa9e6", swatch: "#5aa9e6" },
  { key: "#c77dff", swatch: "#c77dff" },
];

function normalizePickedColor(value: string): `#${string}` | null {
  const colorValue = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(colorValue)
    ? (colorValue as `#${string}`)
    : null;
}

export function TagEditorModal({
  existingTags,
  onSave,
  onCancel,
}: {
  existingTags: SplitTag[];
  onSave: (
    label: string,
    icon: SplitTagIcon | null,
    color: SplitTagColor,
  ) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<SplitTagIcon | null>("utensils");
  const [color, setColor] = useState<SplitTagColor>("orange");
  const [customColor, setCustomColor] = useState<`#${string}`>("#ef476f");
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [error, setError] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const emojiKeyboard = useEmojiKeyboard();

  useEffect(() => {
    if (!customColorOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [customColorOpen]);

  const scrollToColorPicker = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const scrollToFormTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const openCustomColorPicker = () => {
    setColor(customColor);
    scrollToColorPicker();
    setCustomColorOpen(true);
  };

  const closeCustomColorPicker = () => {
    setCustomColorOpen(false);
    scrollToFormTop();
  };

  const validateTagName = () => {
    const normalizedLabel = normalizeTagName(label);
    if (!normalizedLabel) {
      return t("tags.validationMissingName");
    }
    if (
      existingTags.some(
        (tag) =>
          tag.label.trim().toLowerCase() === normalizedLabel.toLowerCase(),
      )
    ) {
      return t("tags.validationDuplicateName");
    }
    return "";
  };

  return (
    <View style={screenStyles.splitNoticeOverlay} pointerEvents="box-none">
      <View style={screenStyles.splitNoticeBackdrop} />
      <View style={screenStyles.tagEditorKeyboardWrap}>
        <View style={screenStyles.tagEditorCard}>
          <YStack gap="$3">
            <Text
              fontFamily={FONTS.headlineBold}
              fontSize={24}
              color={PALETTE.onSurface}
            >
              {t("tags.createTitle")}
            </Text>
            <Text
              fontFamily={FONTS.bodyMedium}
              fontSize={13}
              lineHeight={19}
              color={PALETTE.onSurfaceVariant}
            >
              {t("tags.createDescription")}
            </Text>
            <View style={screenStyles.tagPreviewPanel}>
              <Text
                fontFamily={FONTS.bodyBold}
                fontSize={10}
                color={PALETTE.onSurfaceVariant}
                textTransform="uppercase"
                letterSpacing={1.4}
              >
                {t("tags.livePreview")}
              </Text>
              <TagChip
                tag={{
                  id: "preview",
                  label: label.trim() || t("tags.newTag"),
                  icon,
                  color,
                }}
              />
            </View>
          </YStack>
          <ScrollView
            ref={scrollViewRef}
            style={screenStyles.tagEditorScroll}
            contentContainerStyle={screenStyles.tagEditorScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <YStack gap="$4">
              <YStack gap="$2">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={13}
                  color={PALETTE.onSurface}
                >
                  {t("tags.name")}
                </Text>
                <View style={screenStyles.assignInputShell}>
                  <TextInput
                    value={label}
                    onChangeText={(value) => {
                      setLabel(value.slice(0, TAG_NAME_MAX_LENGTH));
                      setError("");
                    }}
                    placeholder={t("tags.namePlaceholder")}
                    placeholderTextColor={PALETTE.inputPlaceholder}
                    style={screenStyles.assignInput}
                    maxLength={TAG_NAME_MAX_LENGTH}
                  />
                </View>
              </YStack>
              <YStack gap="$2.5">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={13}
                  color={PALETTE.onSurface}
                >
                  {t("tags.selectIcon")}
                </Text>
                <XStack flexWrap="wrap" gap="$2.5">
                  {ICON_OPTIONS.map(({ key, Icon }) => (
                    <Pressable
                      key={key ?? "none"}
                      accessibilityRole="button"
                      accessibilityLabel={
                        key
                          ? t("tags.iconA11y", { icon: key })
                          : t("tags.noIcon")
                      }
                      accessibilityState={{ selected: icon === key }}
                      style={[
                        screenStyles.tagEditorIconButton,
                        icon === key
                          ? screenStyles.tagEditorIconButtonSelected
                          : null,
                      ]}
                      onPress={() => setIcon(key)}
                    >
                      <Icon
                        color={
                          icon === key
                            ? PALETTE.primary
                            : PALETTE.onSurfaceVariant
                        }
                        size={18}
                      />
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tags.addCustomIcon")}
                    style={[
                      screenStyles.tagEditorIconButton,
                      icon?.startsWith("custom:")
                        ? screenStyles.tagEditorIconButtonSelected
                        : null,
                    ]}
                    onPress={() => {
                      emojiKeyboard.open();
                    }}
                  >
                    <Plus
                      color={
                        icon?.startsWith("custom:")
                          ? PALETTE.primary
                          : PALETTE.onSurfaceVariant
                      }
                      size={18}
                    />
                  </Pressable>
                </XStack>
                <SystemEmojiPicker
                  ref={emojiKeyboard.ref}
                  autoHideAfterSelection
                  dismissOnTapOutside
                  keyboardAppearance="light"
                  onEmojiSelected={(emoji) => {
                    const customIcon = createCustomTagIcon(emoji);
                    if (customIcon) {
                      setIcon(customIcon);
                      setError("");
                    }
                  }}
                />
              </YStack>
              <YStack gap="$2.5">
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={13}
                  color={PALETTE.onSurface}
                >
                  {t("tags.selectColor")}
                </Text>
                <XStack flexWrap="wrap" gap="$2.5">
                  {COLOR_OPTIONS.map((option) => (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      accessibilityLabel={t("tags.colorA11y", {
                        color: option.key,
                      })}
                      accessibilityState={{ selected: color === option.key }}
                      style={[
                        screenStyles.tagEditorColorButton,
                        color === option.key
                          ? screenStyles.tagEditorColorButtonSelected
                          : null,
                      ]}
                      onPress={() => {
                        if (customColorOpen) {
                          closeCustomColorPicker();
                        }
                        setColor(option.key);
                      }}
                    >
                      <View
                        style={[
                          screenStyles.tagEditorColorSwatch,
                          { backgroundColor: option.swatch },
                        ]}
                      />
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tags.addCustomColor")}
                    style={[
                      screenStyles.tagEditorColorButton,
                      color.startsWith("#")
                        ? screenStyles.tagEditorColorButtonSelected
                        : null,
                    ]}
                    onPress={() => {
                      if (customColorOpen) {
                        closeCustomColorPicker();
                        return;
                      }
                      openCustomColorPicker();
                    }}
                  >
                    <Plus
                      color={
                        color.startsWith("#")
                          ? PALETTE.primary
                          : PALETTE.onSurfaceVariant
                      }
                      size={18}
                    />
                  </Pressable>
                </XStack>
                {customColorOpen ? (
                  <View style={screenStyles.tagColorPickerPanel}>
                    <ColorPicker
                      color={customColor}
                      onColorChange={(nextColor) => {
                        const normalized = normalizePickedColor(nextColor);
                        if (normalized) {
                          setCustomColor(normalized);
                          setColor(normalized);
                        }
                      }}
                      onColorChangeComplete={(nextColor) => {
                        const normalized = normalizePickedColor(nextColor);
                        if (normalized) {
                          setCustomColor(normalized);
                          setColor(normalized);
                        }
                      }}
                      thumbSize={28}
                      sliderSize={22}
                      noSnap
                      row={false}
                      swatches={false}
                      useNativeDriver={false}
                      useNativeLayout
                    />
                  </View>
                ) : null}
              </YStack>
              {error ? (
                <Text
                  fontFamily={FONTS.bodyBold}
                  fontSize={13}
                  color={PALETTE.danger}
                >
                  {error}
                </Text>
              ) : null}
              <YStack gap="$2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("tags.createAction")}
                  style={screenStyles.splitNoticeButton}
                  onPress={async () => {
                    const validationMessage = validateTagName();
                    if (validationMessage) {
                      setError(validationMessage);
                      return;
                    }
                    const saved = await onSave(label, icon, color);
                    if (!saved) {
                      setError(t("tags.validation"));
                    }
                  }}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.onPrimary}
                  >
                    {t("tags.createAction")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
                  style={screenStyles.confirmChoiceSecondaryButton}
                  onPress={onCancel}
                >
                  <Text
                    fontFamily={FONTS.bodyBold}
                    fontSize={14}
                    color={PALETTE.primary}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>
              </YStack>
            </YStack>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
