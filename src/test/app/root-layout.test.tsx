import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockUseFonts = jest.fn();
const mockListeners = new Set<() => void>();

const mockStoreState = {
  ready: false,
  bootstrap: jest.fn(async () => undefined),
};

function notifyStore() {
  mockListeners.forEach((listener) => listener());
}

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(async () => undefined),
  preventAutoHideAsync: jest.fn(async () => undefined),
}));

jest.mock("@expo-google-fonts/inter", () => ({
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
  Inter_700Bold: "Inter_700Bold",
  useFonts: (value: any) => mockUseFonts(value),
}));

jest.mock("@expo-google-fonts/public-sans", () => ({
  PublicSans_700Bold: "PublicSans_700Bold",
  PublicSans_900Black: "PublicSans_900Black",
}));

jest.mock("expo-router", () => ({
  Stack: () => {
    const { Text } = require("react-native");
    return <Text>stack</Text>;
  },
}));

jest.mock("../../theme/provider", () => ({
  AppThemeProvider: ({ children }: { children: any }) => <>{children}</>,
}));

jest.mock("../../features/split/store", () => {
  const React = require("react");

  return {
    useSplitStore: jest.fn((selector: (value: any) => any) =>
      React.useSyncExternalStore(
        (listener: () => void) => {
          mockListeners.add(listener);
          return () => mockListeners.delete(listener);
        },
        () => selector(mockStoreState),
        () => selector(mockStoreState)
      )
    ),
  };
});

import RootLayout from "../../../app/_layout";

describe("root layout", () => {
  beforeEach(() => {
    const splashScreen = require("expo-splash-screen");
    splashScreen.hideAsync.mockReset();
    mockUseFonts.mockReset();
    mockListeners.clear();
    mockStoreState.ready = false;
    mockStoreState.bootstrap.mockReset();
    mockStoreState.bootstrap.mockImplementation(async () => undefined);
  });

  it("boots the store and waits until fonts and state are ready", () => {
    const splashScreen = require("expo-splash-screen");
    mockUseFonts.mockReturnValue([false]);

    const view = render(<RootLayout />);

    expect(splashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
    expect(mockStoreState.bootstrap).toHaveBeenCalledTimes(1);
    expect(view.toJSON()).toBeNull();
  });

  it("renders the stack and hides the splash screen when ready", async () => {
    const splashScreen = require("expo-splash-screen");
    mockStoreState.ready = true;
    mockUseFonts.mockReturnValue([true]);

    render(<RootLayout />);

    expect(screen.getByText("stack")).toBeTruthy();
    await waitFor(() => {
      expect(splashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a retry UI when bootstrap fails and retries on demand", async () => {
    mockUseFonts.mockReturnValue([true]);
    mockStoreState.bootstrap
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async () => {
        mockStoreState.ready = true;
        notifyStore();
      });

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByText("We couldn't open Split Bill")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Retry app bootstrap"));
    });

    await waitFor(() => {
      expect(screen.getByText("stack")).toBeTruthy();
    });
    expect(mockStoreState.bootstrap).toHaveBeenCalledTimes(2);
  });

  it("keeps the retry UI visible when retry also fails", async () => {
    mockUseFonts.mockReturnValue([true]);
    mockStoreState.bootstrap.mockRejectedValue(new Error("boom"));

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByText("We couldn't open Split Bill")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Retry app bootstrap"));
    });

    expect(screen.getByText("We couldn't open Split Bill")).toBeTruthy();
  });
});
