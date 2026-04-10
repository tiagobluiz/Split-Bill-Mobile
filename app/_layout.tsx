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

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useSplitStore((state) => state.bootstrap);
  const ready = useSplitStore((state) => state.ready);
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
    return (
      <AppThemeProvider>
        <View style={{ flex: 1, backgroundColor: PALETTE.surface, paddingHorizontal: 24, justifyContent: "center" }}>
          <View style={{ gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: "900", color: PALETTE.onSurface, letterSpacing: -1 }}>
                We couldn&apos;t open Split Bill
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: PALETTE.onSurfaceVariant }}>
                Try loading the app again.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry app bootstrap"
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
                Try again
              </Text>
            </Pressable>
          </View>
        </View>
      </AppThemeProvider>
    );
  }

  return (
    <AppThemeProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </AppThemeProvider>
  );
}
