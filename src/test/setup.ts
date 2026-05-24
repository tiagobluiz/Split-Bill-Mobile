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

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  EncodingType: {
    Base64: "base64",
  },
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ""),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => ({
      granted: false,
      directoryUri: null,
    })),
    createFileAsync: jest.fn(async () => "content://backup-file"),
  },
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(async () => ({
    canceled: true,
    assets: null,
  })),
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-auth-session", () => {
  class AuthRequest {
    codeVerifier = "mock-code-verifier";

    async makeAuthUrlAsync() {
      return "https://accounts.google.com/mock";
    }

    async promptAsync() {
      return {
        type: "dismiss",
      };
    }
  }

  return {
    makeRedirectUri: jest.fn(() => "split-bill-mobile://oauthredirect"),
    AuthRequest,
    ResponseType: {
      Code: "code",
    },
    exchangeCodeAsync: jest.fn(async () => ({
      accessToken: "token",
      refreshToken: "refresh-token",
      issuedAt: 1,
      expiresIn: 3600,
      tokenType: "Bearer",
    })),
    refreshAsync: jest.fn(async () => ({
      accessToken: "token",
      refreshToken: "refresh-token",
      issuedAt: 1,
      expiresIn: 3600,
      tokenType: "Bearer",
    })),
  };
});

jest.mock("expo-background-task", () => ({
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  BackgroundTaskResult: {
    Success: 1,
    Failed: 2,
  },
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isAvailableAsync: jest.fn(async () => true),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));

jest.mock("@noble/hashes/sha2.js", () => ({
  sha256: {},
}));

jest.mock("@noble/hashes/pbkdf2.js", () => ({
  pbkdf2: (_hash: unknown, passphrase: string, salt: Uint8Array, options: { dkLen: number }) => {
    const source = `${passphrase}:${Array.from(salt).join(",")}`;
    const output = new Uint8Array(options.dkLen);
    for (let i = 0; i < options.dkLen; i += 1) {
      const code = source.charCodeAt(i % source.length) || 0;
      output[i] = (code + i) % 256;
    }
    return output;
  },
}));

jest.mock("expo-notifications", () => ({
  PermissionStatus: {
    GRANTED: "granted",
  },
  AndroidImportance: {
    DEFAULT: 3,
  },
  SchedulableTriggerInputTypes: {
    DATE: "date",
  },
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "1.0.0-test",
    },
    nativeAppVersion: "1.0.0-test",
  },
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
