import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider, Theme } from "tamagui";

import config from "../../tamagui.config";

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <TamaguiProvider config={config} defaultTheme="light">
        <Theme name="light">{children}</Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
