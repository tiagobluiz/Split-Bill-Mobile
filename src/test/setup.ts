import "@testing-library/jest-native/extend-expect";

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});

jest.mock("tamagui", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const passthrough = ({ children, ...props }: any) => React.createElement(View, props, children);

  return {
    Paragraph: Text,
    Text,
    XStack: passthrough,
    YStack: passthrough,
    Circle: passthrough,
    TamaguiProvider: ({ children }: any) => children,
    Theme: ({ children }: any) => children,
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = (props: any) => React.createElement(View, props);

  return {
    AlertTriangle: Icon,
    ArchiveRestore: Icon,
    ArrowLeft: Icon,
    ArrowRight: Icon,
    Bell: Icon,
    Camera: Icon,
    Check: Icon,
    ChevronDown: Icon,
    ClipboardCopy: Icon,
    Equal: Icon,
    FileJson: Icon,
    Hash: Icon,
    Home: Icon,
    Minus: Icon,
    Pencil: Icon,
    Plus: Icon,
    ReceiptText: Icon,
    RotateCcw: Icon,
    Settings: Icon,
    Share2: Icon,
    Trash2: Icon,
    Users: Icon,
    Wallet: Icon,
    X: Icon,
  };
});

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => undefined),
  })),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 16,
    left: 0,
  }),
}));

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
    Swipeable: ({ children, renderRightActions, ...props }: any) =>
      React.createElement(
        View,
        props,
        children,
        typeof renderRightActions === "function" ? renderRightActions() : null
      ),
  };
});

jest.mock("@react-native-community/slider", () => {
  const React = require("react");
  const { View } = require("react-native");

  return ({ children, ...props }: any) => React.createElement(View, props, children);
});
