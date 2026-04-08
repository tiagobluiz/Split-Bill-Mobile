import { render, screen } from "@testing-library/react-native";

let mockParams: Record<string, string | string[] | undefined> = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => mockParams),
}));

jest.mock("../../features/split/screens", () => ({
  HomeScreen: () => {
    const { Text } = require("react-native");
    return <Text>home screen</Text>;
  },
  ParticipantsScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`participants:${draftId}`}</Text>;
  },
  SetupScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`setup:${draftId}`}</Text>;
  },
  PayerScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`payer:${draftId}`}</Text>;
  },
  ItemsScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`items:${draftId}`}</Text>;
  },
  PasteImportScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`paste:${draftId}`}</Text>;
  },
  OverviewScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`overview:${draftId}`}</Text>;
  },
  ReviewScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`review:${draftId}`}</Text>;
  },
  ResultsScreen: ({ draftId }: { draftId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`results:${draftId}`}</Text>;
  },
  AssignItemScreen: ({ draftId, itemId }: { draftId: string; itemId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`assign:${draftId}:${itemId}`}</Text>;
  },
  SplitItemScreen: ({ draftId, itemId }: { draftId: string; itemId: string }) => {
    const { Text } = require("react-native");
    return <Text>{`split:${draftId}:${itemId}`}</Text>;
  },
}));

import HomeRoute from "../../../app/index";
import SetupRoute from "../../../app/split/[draftId]/setup";
import ParticipantsRoute from "../../../app/split/[draftId]/participants";
import PayerRoute from "../../../app/split/[draftId]/payer";
import ItemsRoute from "../../../app/split/[draftId]/items";
import PasteRoute from "../../../app/split/[draftId]/paste";
import OverviewRoute from "../../../app/split/[draftId]/overview";
import ResultsRoute from "../../../app/split/[draftId]/results";
import AssignItemRoute from "../../../app/split/[draftId]/assign/[itemId]";
import SplitItemRoute from "../../../app/split/[draftId]/split/[itemId]";

describe("app routes", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("renders the home route", () => {
    render(<HomeRoute />);
    expect(screen.getByText("home screen")).toBeTruthy();
  });

  it("normalizes participant route params", () => {
    mockParams = { draftId: ["draft-1", "ignored"] };
    render(<ParticipantsRoute />);
    expect(screen.getByText("participants:draft-1")).toBeTruthy();
  });

  it("normalizes setup route params", () => {
    mockParams = { draftId: ["draft-setup", "ignored"] };
    render(<SetupRoute />);
    expect(screen.getByText("setup:draft-setup")).toBeTruthy();
  });

  it("falls back when setup route params are missing", () => {
    mockParams = {};
    render(<SetupRoute />);
    expect(screen.getByText("setup:")).toBeTruthy();
  });

  it("falls back when participant route params are missing", () => {
    mockParams = {};
    render(<ParticipantsRoute />);
    expect(screen.getByText("participants:")).toBeTruthy();
  });

  it("normalizes payer route params", () => {
    mockParams = { draftId: "draft-2" };
    render(<PayerRoute />);
    expect(screen.getByText("payer:draft-2")).toBeTruthy();
  });

  it("falls back when payer route params are arrays or missing", () => {
    mockParams = { draftId: ["draft-2a"] };
    const { rerender } = render(<PayerRoute />);
    expect(screen.getByText("payer:draft-2a")).toBeTruthy();

    mockParams = {};
    rerender(<PayerRoute />);
    expect(screen.getByText("payer:")).toBeTruthy();
  });

  it("normalizes items route params", () => {
    mockParams = { draftId: "draft-3" };
    render(<ItemsRoute />);
    expect(screen.getByText("items:draft-3")).toBeTruthy();
  });

  it("falls back when items route params are arrays or missing", () => {
    mockParams = { draftId: ["draft-3a"] };
    const { rerender } = render(<ItemsRoute />);
    expect(screen.getByText("items:draft-3a")).toBeTruthy();

    mockParams = {};
    rerender(<ItemsRoute />);
    expect(screen.getByText("items:")).toBeTruthy();
  });

  it("normalizes paste route params", () => {
    mockParams = { draftId: "draft-4" };
    render(<PasteRoute />);
    expect(screen.getByText("paste:draft-4")).toBeTruthy();
  });

  it("falls back when paste route params are arrays or missing", () => {
    mockParams = { draftId: ["draft-4a"] };
    const { rerender } = render(<PasteRoute />);
    expect(screen.getByText("paste:draft-4a")).toBeTruthy();

    mockParams = {};
    rerender(<PasteRoute />);
    expect(screen.getByText("paste:")).toBeTruthy();
  });

  it("normalizes overview route params", () => {
    mockParams = { draftId: "draft-5" };
    render(<OverviewRoute />);
    expect(screen.getByText("review:draft-5")).toBeTruthy();
  });

  it("falls back when overview route params are arrays or missing", () => {
    mockParams = { draftId: ["", "draft-5a"] };
    const { rerender } = render(<OverviewRoute />);
    expect(screen.getByText("review:draft-5a")).toBeTruthy();

    mockParams = { draftId: [""] };
    rerender(<OverviewRoute />);
    expect(screen.getByText("review:")).toBeTruthy();

    mockParams = {};
    rerender(<OverviewRoute />);
    expect(screen.getByText("review:")).toBeTruthy();
  });

  it("normalizes results route params", () => {
    mockParams = { draftId: undefined };
    render(<ResultsRoute />);
    expect(screen.getByText("results:")).toBeTruthy();
  });

  it("normalizes results route array params", () => {
    mockParams = { draftId: ["draft-7"] };
    render(<ResultsRoute />);
    expect(screen.getByText("results:draft-7")).toBeTruthy();
  });

  it("normalizes assign route params", () => {
    mockParams = { draftId: ["draft-6"], itemId: ["item-9", "other"] };
    render(<AssignItemRoute />);
    expect(screen.getByText("assign:draft-6:item-9")).toBeTruthy();
  });

  it("falls back when assign route params are scalar or missing", () => {
    mockParams = { draftId: "draft-8", itemId: "item-10" };
    const { rerender } = render(<AssignItemRoute />);
    expect(screen.getByText("assign:draft-8:item-10")).toBeTruthy();

    mockParams = {};
    rerender(<AssignItemRoute />);
    expect(screen.getByText("assign::")).toBeTruthy();
  });

  it("normalizes split route params", () => {
    mockParams = { draftId: ["draft-9"], itemId: ["item-11"] };
    render(<SplitItemRoute />);
    expect(screen.getByText("split:draft-9:item-11")).toBeTruthy();
  });

  it("falls back when split route params are scalar or missing", () => {
    mockParams = { draftId: "draft-10", itemId: "item-12" };
    const { rerender } = render(<SplitItemRoute />);
    expect(screen.getByText("split:draft-10:item-12")).toBeTruthy();

    mockParams = {};
    rerender(<SplitItemRoute />);
    expect(screen.getByText("split::")).toBeTruthy();
  });
});
