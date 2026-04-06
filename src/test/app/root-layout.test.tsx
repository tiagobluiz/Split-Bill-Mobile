import { render, screen, waitFor } from "@testing-library/react-native";

const mockBootstrap = jest.fn(async () => undefined);
const mockUseFonts = jest.fn();

let mockReady = false;

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

jest.mock("../../features/split/store", () => ({
  useSplitStore: jest.fn((selector: (value: any) => any) =>
    selector({
      bootstrap: mockBootstrap,
      ready: mockReady,
    })
  ),
}));

import RootLayout from "../../../app/_layout";

describe("root layout", () => {
  beforeEach(() => {
    const splashScreen = require("expo-splash-screen");
    splashScreen.hideAsync.mockReset();
    mockBootstrap.mockReset();
    mockUseFonts.mockReset();
    mockReady = false;
  });

  it("boots the store and waits until fonts and state are ready", () => {
    const splashScreen = require("expo-splash-screen");
    mockUseFonts.mockReturnValue([false]);

    const view = render(<RootLayout />);

    expect(splashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(view.toJSON()).toBeNull();
  });

  it("renders the stack and hides the splash screen when ready", async () => {
    const splashScreen = require("expo-splash-screen");
    mockReady = true;
    mockUseFonts.mockReturnValue([true]);

    render(<RootLayout />);

    expect(screen.getByText("stack")).toBeTruthy();
    await waitFor(() => {
      expect(splashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });
});
