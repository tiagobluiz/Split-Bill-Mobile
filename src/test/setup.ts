import "@testing-library/jest-native/extend-expect";
import { cleanup } from "@testing-library/react-native";

jest.mock("expo-notifications", () => {
  const createSubscription = () => ({
    remove: jest.fn(),
  });

  return {
    PermissionStatus: {
      UNDETERMINED: "undetermined",
      DENIED: "denied",
      GRANTED: "granted",
    },
    AndroidImportance: {
      DEFAULT: 3,
    },
    SchedulableTriggerInputTypes: {
      DATE: "date",
    },
    setNotificationHandler: jest.fn(),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
    addNotificationResponseReceivedListener: jest.fn(() =>
      createSubscription(),
    ),
    addNotificationReceivedListener: jest.fn(() => createSubscription()),
    getPermissionsAsync: jest.fn(async () => ({
      status: "granted",
      granted: true,
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      status: "granted",
      granted: true,
    })),
    setNotificationChannelAsync: jest.fn(async () => undefined),
    scheduleNotificationAsync: jest.fn(async () => "test-notification-id"),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  };
});

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
    Bot: Icon,
    Camera: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
    ClipboardCopy: Icon,
    Equal: Icon,
    FileText: Icon,
    FileJson: Icon,
    Filter: Icon,
    Hash: Icon,
    Home: Icon,
    Info: Icon,
    Merge: Icon,
    MessageCircle: Icon,
    Minus: Icon,
    Pencil: Icon,
    Plus: Icon,
    ReceiptText: Icon,
    RotateCcw: Icon,
    Settings: Icon,
    Share2: Icon,
    Sparkles: Icon,
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

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  const DateTimePicker = ({ children, ...props }: any) =>
    React.createElement(View, props, children);

  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: {
      open: jest.fn(),
      dismiss: jest.fn(),
    },
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});
