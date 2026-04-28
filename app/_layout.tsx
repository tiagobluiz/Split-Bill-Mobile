import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { PublicSans_700Bold, PublicSans_900Black } from "@expo-google-fonts/public-sans";

import { AppThemeProvider } from "../src/theme/provider";
import { useSplitStore } from "../src/features/split/store";
import { PALETTE } from "../src/theme/palette";
import { getDefaultTranslationSettings, t } from "../src/i18n";
import { LocalizationProvider } from "../src/i18n/provider";
import { getDeviceLocale } from "../src/lib/device";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useSplitStore((state) => state.bootstrap);
  const ready = useSplitStore((state) => state.ready);
  const settings = useSplitStore((state) => state.settings);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PublicSans_700Bold,
    PublicSans_900Black,
  });

  useEffect(() => {
    void Promise.resolve(bootstrap()).catch(() => {
      setBootstrapFailed(true);
    });
  }, [bootstrap]);

  useEffect(() => {
    if (fontsLoaded && (ready || bootstrapFailed)) {
      void SplashScreen.hideAsync();
    }
  }, [bootstrapFailed, fontsLoaded, ready]);

  if (!fontsLoaded) {
    return null;
  }

  if (!ready && !bootstrapFailed) {
    return null;
  }

  if (bootstrapFailed) {
    const fallbackSettings = getDefaultTranslationSettings(getDeviceLocale());
    return (
      <AppThemeProvider>
        <LocalizationProvider
          language={fallbackSettings.language}
          humour={fallbackSettings.humour}
        >
          <View style={{ flex: 1, backgroundColor: PALETTE.surface, paddingHorizontal: 24, justifyContent: "center" }}>
            <View style={{ gap: 20 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: "900", color: PALETTE.onSurface, letterSpacing: -1 }}>
                  {t("app.error.openTitle")}
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: PALETTE.onSurfaceVariant }}>
                  {t("app.error.openDescription")}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("app.error.retryA11y")}
                style={{
                  minHeight: 56,
                  borderRadius: 24,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: PALETTE.primary,
                }}
                onPress={() => {
                  setBootstrapFailed(false);
                  void Promise.resolve(bootstrap()).catch(() => {
                    setBootstrapFailed(true);
                  });
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: "700", color: PALETTE.onPrimary }}>
                  {t("app.error.retry")}
                </Text>
              </Pressable>
            </View>
          </View>
        </LocalizationProvider>
      </AppThemeProvider>
    );
  }

  const resolvedTranslationSettings = {
    ...getDefaultTranslationSettings(getDeviceLocale()),
    language: settings?.language ?? getDefaultTranslationSettings(getDeviceLocale()).language,
    humour: settings?.humour ?? getDefaultTranslationSettings(getDeviceLocale()).humour,
  };

  return (
    <AppThemeProvider>
      <LocalizationProvider
        language={resolvedTranslationSettings.language}
        humour={resolvedTranslationSettings.humour}
      >
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
      </LocalizationProvider>
    </AppThemeProvider>
  );
}
