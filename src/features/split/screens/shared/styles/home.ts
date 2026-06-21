import { PALETTE } from "../../../../../theme/palette";

export const homeStyles = {
  stickyHomeHeader: {
      backgroundColor: PALETTE.surface,
      paddingHorizontal: 20,
      paddingBottom: 18,
      zIndex: 5,
    },
  assignInputShellError: {
      borderWidth: 1.5,
      borderColor: "#cf3f38",
    },
  homeScrollContent: {
      paddingHorizontal: 20,
      gap: 28,
    },
  mainTabScrollContent: {
      paddingHorizontal: 20,
    },
  mainTabHeaderWrap: {
      marginHorizontal: -20,
      paddingHorizontal: 20,
      backgroundColor: PALETTE.surface,
      zIndex: 5,
    },
  homeHeader: {
      minHeight: 48,
      justifyContent: "center",
    },
  ctaHalo: {
      backgroundColor: PALETTE.brandOverlay,
      borderRadius: 34,
      padding: 8,
    },
  homeCta: {
      minHeight: 148,
      borderRadius: 30,
      backgroundColor: PALETTE.tertiary,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      overflow: "hidden",
      shadowColor: PALETTE.primary,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
  homeCtaIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: PALETTE.surfaceContainerLowest,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
  settingsInlineActionActive: {
      backgroundColor: PALETTE.brandOverlayStrong,
    },
  homeBalanceCardWrap: {
      flex: 1,
    },
  homeBalanceCardContent: {
      justifyContent: "flex-start",
      gap: 18,
    },
  settingsAvatarWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      marginTop: 24,
      backgroundColor: PALETTE.brandOverlayStrong,
      borderWidth: 1,
      borderColor: PALETTE.outlineVariant,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
  settingsAvatarImage: {
      width: "100%",
      height: "100%",
    },
  settingsFeatureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
  settingsFeatureToggle: {
      minWidth: 70,
      minHeight: 42,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: PALETTE.outlineVariant,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: PALETTE.surface,
    },
  settingsFeatureToggleActive: {
      backgroundColor: PALETTE.primary,
      borderColor: PALETTE.primary,
    },
} as const;

