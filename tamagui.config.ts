import { defaultConfig } from "@tamagui/config/v4";
import { createTamagui } from "tamagui";

import { PALETTE } from "./src/theme/palette";

const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: PALETTE.surface,
      backgroundHover: PALETTE.surfaceContainerLow,
      backgroundPress: PALETTE.surfaceContainer,
      backgroundFocus: PALETTE.surfaceContainerLow,
      color: PALETTE.onSurface,
      colorHover: PALETTE.onSurface,
      colorPress: PALETTE.onSurface,
      colorFocus: PALETTE.onSurface,
      borderColor: "transparent",
      borderColorHover: "transparent",
      borderColorFocus: PALETTE.outlineVariant,
      borderColorPress: "transparent",
      placeholderColor: PALETTE.onSurfaceVariant,
      primary: PALETTE.primary,
      primaryHover: PALETTE.primaryContainer,
      primaryPress: PALETTE.primary,
      secondary: PALETTE.secondary,
      secondaryHover: PALETTE.secondaryContainer,
      secondaryPress: PALETTE.secondary,
      accentBackground: PALETTE.primaryContainer,
      accentColor: PALETTE.onPrimaryContainer,
      muted: PALETTE.surfaceContainerLow,
      mutedHover: PALETTE.surfaceContainerHigh,
      mutedPress: PALETTE.surfaceContainerHigh,
    },
  },
});

export type AppTamaguiConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config;
