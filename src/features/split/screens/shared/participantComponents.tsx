import { Image, Pressable, View } from "react-native";
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
}: {
  name: string;
  ownerName: string;
  ownerProfileImageUri?: string;
  style: StyleProp<ViewStyle | ImageStyle>;
  label: string;
  textSize?: number;
}) {
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

  const tone = getAvatarTone(name);
  return (
    <View accessibilityLabel={label} style={[style, { backgroundColor: tone.background }]}>
      <Text fontFamily={FONTS.bodyBold} fontSize={textSize} color={tone.foreground}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

export function ParticipantRow({
  participant,
  ownerName,
  ownerProfileImageUri,
  onRemove,
}: {
  participant: { name: string };
  ownerName: string;
  ownerProfileImageUri?: string;
  onRemove: () => void;
}) {
  const displayName = getParticipantDisplayName(participant.name, ownerName);

  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$4" style={screenStyles.participantPill}>
      <XStack alignItems="center" gap="$3.5" flex={1}>
        <ParticipantAvatar
          name={participant.name}
          ownerName={ownerName}
          ownerProfileImageUri={ownerProfileImageUri}
          style={screenStyles.participantAvatar}
          label={`Participant avatar ${participant.name.trim() || "unknown"}`}
        />
        <YStack flex={1}>
          <Text fontFamily={FONTS.bodyBold} fontSize={16} color={PALETTE.onSurface}>
            {displayName}
          </Text>
        </YStack>
      </XStack>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove participant ${participant.name}`}
        style={screenStyles.participantRemoveButton}
      >
        <X color={PALETTE.onSurfaceVariant} size={20} />
      </Pressable>
    </XStack>
  );
}
