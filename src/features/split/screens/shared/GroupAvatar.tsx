import { Image, View } from "react-native";
import { useEffect, useState } from "react";
import { Users } from "lucide-react-native";
import { Text as TamaguiText } from "tamagui";
import type { ParticipantGroup } from "../../people";
import { PALETTE } from "../../../../theme/palette";
import { getTagIcon } from "./TagChips";
import { screenStyles } from "./styles";

const Text = TamaguiText as any;

export function GroupAvatar({ group, size = 52 }: { group: Pick<ParticipantGroup, "photoUri" | "icon" | "color">; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [group.photoUri]);
  const background = group.color?.startsWith("#") ? group.color : ({ orange: "#ffe5d2", mint: "#dff5ee", clay: "#f0d3ba", gray: "#e9e5e1" } as Record<string, string>)[group.color ?? "orange"] ?? "#ffe5d2";
  const Icon = getTagIcon(group.icon ?? "home") ?? Users;
  return <View style={[screenStyles.groupsDirectoryIcon, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>{group.photoUri && !imageFailed ? <Image source={{ uri: group.photoUri }} onError={() => setImageFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, position: "absolute" }} /> : group.icon?.startsWith("custom:") ? <Text fontSize={size * .42}>{group.icon.slice(7)}</Text> : <Icon color={PALETTE.primary} size={size * .42} />}</View>;
}
