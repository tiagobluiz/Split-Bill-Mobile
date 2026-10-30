import { Image, Pressable, Text as NativeText, View } from "react-native";
import { useEffect, useState } from "react";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";
import { X } from "lucide-react-native";
import {
  Text as TamaguiText,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from "tamagui";

import { FONTS, PALETTE } from "../../../../theme/palette";
import { getAvatarTone, getInitials, getParticipantDisplayName, isOwnerReference } from "./participantUtils";
import { screenStyles } from "./styles";
import { getTagColorStyle } from "./TagChips";
import type { SavedPerson } from "../../people";

const Text = TamaguiText as any;
const XStack = TamaguiXStack as any;
const YStack = TamaguiYStack as any;

export function ParticipantAvatar({
  name,
  ownerName,
  ownerProfileImageUri,
  style,
  label,
  textSize = 15,
  person,
}: {
  name: string;
  ownerName: string;
  ownerProfileImageUri?: string;
  style: StyleProp<ViewStyle | ImageStyle>;
  label: string;
  textSize?: number;
  person?: Pick<SavedPerson, "photoUri" | "color">;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [person?.photoUri]);
  const imageUri = ownerProfileImageUri?.trim();
  if (isOwnerReference(name, ownerName) && imageUri) {
    return (
      <Image
        accessibilityLabel={label}
        source={{ uri: imageUri }}
        style={[style as StyleProp<ImageStyle>, screenStyles.avatarImage]}
      />
    );
  }

  if (person?.photoUri && !imageFailed) {
    return <Image accessibilityLabel={label} source={{ uri: person.photoUri }} onError={() => setImageFailed(true)} style={[style as StyleProp<ImageStyle>, screenStyles.avatarImage]} />;
  }

  const tone = getAvatarTone(name);
  const personTone = person?.color ? getTagColorStyle(person.color) : tone;
  return (
    <View accessibilityLabel={label} style={[style, { backgroundColor: personTone.background }]}>
      <NativeText
        style={{
          width: "100%",
          color: personTone.foreground,
          fontFamily: FONTS.bodyBold,
          fontSize: textSize,
          lineHeight: textSize + 2,
          includeFontPadding: false,
          textAlign: "center",
          textAlignVertical: "center",
        }}
      >
        {getInitials(name)}
      </NativeText>
    </View>
  );
}

export function ParticipantRow({
  participant,
  ownerName,
  ownerProfileImageUri,
  subtitle,
  removeLabel,
  onRemove,
  person,
}: {
  participant: { name: string };
  ownerName: string;
  ownerProfileImageUri?: string;
  subtitle?: string;
  removeLabel?: string;
  onRemove: () => void;
  person?: Pick<SavedPerson, "photoUri" | "color">;
}) {
  const displayName = getParticipantDisplayName(participant.name, ownerName);

  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" style={screenStyles.participantPill}>
      <XStack alignItems="center" gap="$3" flex={1}>
        <ParticipantAvatar
          name={participant.name}
          ownerName={ownerName}
          ownerProfileImageUri={ownerProfileImageUri}
          style={[screenStyles.participantAvatar, { width: 42, height: 42, borderRadius: 21 }]}
          label={`Participant avatar ${participant.name.trim() || "unknown"}`}
          textSize={18}
          person={person}
        />
        <YStack flex={1}>
          <Text
            fontFamily={FONTS.bodyBold}
            fontSize={15}
            color={PALETTE.onSurface}
            numberOfLines={2}
          >
            {displayName}
          </Text>
          {subtitle ? <Text fontFamily={FONTS.bodyMedium} fontSize={12} color={PALETTE.onSurfaceVariant}>{subtitle}</Text> : null}
        </YStack>
      </XStack>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={removeLabel ?? `Remove participant ${participant.name}`}
        style={screenStyles.participantRemoveButton}
      >
        <X color={PALETTE.onSurfaceVariant} size={20} />
      </Pressable>
    </XStack>
  );
}
