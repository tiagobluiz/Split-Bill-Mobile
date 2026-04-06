import "react-native-gesture-handler";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { PublicSans_700Bold, PublicSans_900Black } from "@expo-google-fonts/public-sans";

import { AppThemeProvider } from "../src/theme/provider";
import { useSplitStore } from "../src/features/split/store";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useSplitStore((state) => state.bootstrap);
  const ready = useSplitStore((state) => state.ready);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PublicSans_700Bold,
    PublicSans_900Black,
  });

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (fontsLoaded && ready) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) {
    return null;
  }

  return (
    <AppThemeProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </AppThemeProvider>
  );
}
