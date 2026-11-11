import { Stack, router } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

import { FlowScreenHeader } from "./screens/shared/flowComponents";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext({ x: 0, y: 0, width: 400, height: 800 }),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 400, height: 800 }),
    initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 400, height: 800 } },
  };
});

function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function Home() {
  return <Text>Home</Text>;
}

function Item() {
  return <FlowScreenHeader title="Split item" onBack={() => router.back()} />;
}

it("returns to one Home screen after consecutive split flows", () => {
  const app = renderRouter({
    _layout: Layout,
    index: Home,
    "split/[draftId]/split/[itemId]": Item,
  }, { initialUrl: "/" });

  for (let split = 0; split < 3; split += 1) {
    for (let item = 0; item < 10; item += 1) {
      act(() => router.push(`/split/${split}/split/${item}`));
    }
    fireEvent.press(screen.getByLabelText("Close"));
    expect(app.getPathname()).toBe("/");
    expect(router.canGoBack()).toBe(false);
  }
});

it("returns Home when a split is opened by a direct link", () => {
  const app = renderRouter({
    _layout: { default: Layout, unstable_settings: { initialRouteName: "index" } },
    index: Home,
    "split/[draftId]/split/[itemId]": Item,
  }, { initialUrl: "/split/linked/split/item" });

  fireEvent.press(screen.getByLabelText("Close"));
  expect(app.getPathname()).toBe("/");
  expect(router.canGoBack()).toBe(false);
});
