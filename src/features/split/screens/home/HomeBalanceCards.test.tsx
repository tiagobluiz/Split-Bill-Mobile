import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as ReactNative from "react-native";

import type { AppSettings } from "../../../../storage/settings";
import { HomeBalanceCards } from "./HomeBalanceCards";

const settings: AppSettings = {
  ownerName: "You",
  ownerProfileImageUri: "",
  balanceFeatureEnabled: true,
  trackPaymentsFeatureEnabled: true,
  defaultCurrency: "EUR",
  language: "en",
  humour: "plain",
  splitListAmountDisplay: "remaining",
  customCurrencies: [],
};

function renderBalances(owedCents: number, oweCents: number) {
  return render(
    <HomeBalanceCards
      balances={{ owedCents, oweCents, currency: "EUR" }}
      locale="en-IE"
      settings={settings}
    />,
  );
}

describe("HomeBalanceCards", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fills both stretched wrappers so the visible cards share one height", () => {
    renderBalances(10_964, 3_027);

    expect(
      StyleSheet.flatten(screen.getByTestId("home-balance-owed-card").props.style),
    ).toMatchObject({ flexGrow: 1 });
    expect(
      StyleSheet.flatten(screen.getByTestId("home-balance-owe-card").props.style),
    ).toMatchObject({ flexGrow: 1 });
  });

  it("lets card content determine its height without reserved bottom space", () => {
    renderBalances(27_500_000, 0);

    for (const id of ["home-balance-owed-content", "home-balance-owe-content"]) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeUndefined();
    }
  });

  it("limits titles to two word-wrapped lines", () => {
    renderBalances(0, 0);

    for (const id of ["home-balance-owed-title", "home-balance-owe-title"]) {
      const title = screen.getByTestId(id);
      expect(title.props.numberOfLines).toBe(2);
      expect(title.props.lineHeight).toBe(16);
      expect(title.props.textBreakStrategy).toBe("simple");
      expect(title.props.android_hyphenationFrequency).toBe("none");
    }
  });

  it("starts both amounts at the reduced 27px default size", () => {
    renderBalances(0, 0);

    for (const id of ["home-balance-owed-amount", "home-balance-owe-amount"]) {
      const amount = screen.getByTestId(id);
      expect(amount.props.numberOfLines).toBe(1);
      expect(amount.props.fontSize).toBe(27);
      expect(amount.props.adjustsFontSizeToFit).toBeUndefined();
    }
  });

  it("remeasures glyphs explicitly at the current accessibility font scale", () => {
    renderBalances(2_750_000, 0);
    const fontScale = ReactNative.Dimensions.get("window").fontScale;

    for (const id of ["home-balance-owed-measure", "home-balance-owe-measure"]) {
      const measurement = screen.getByTestId(id);
      expect(measurement.props.allowFontScaling).toBe(false);
      expect(StyleSheet.flatten(measurement.props.style).fontSize).toBeCloseTo(
        27 * fontScale,
      );
    }
  });

  it("applies one shared font size based on the wider formatted amount", () => {
    renderBalances(2_750_000, 0);

    fireEvent(screen.getByTestId("home-balance-owed-content"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(screen.getByTestId("home-balance-owe-content"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(screen.getByTestId("home-balance-owed-measure"), "textLayout", {
      nativeEvent: { lines: [{ width: 300 }] },
    });
    fireEvent(screen.getByTestId("home-balance-owe-measure"), "textLayout", {
      nativeEvent: { lines: [{ width: 80 }] },
    });

    expect(screen.getByTestId("home-balance-owed-amount").props.fontSize).toBe(18);
    expect(screen.getByTestId("home-balance-owe-amount").props.fontSize).toBe(18);
  });

  it("uses the shared 60% floor for extreme values", () => {
    renderBalances(100_000_000, 0);

    for (const side of ["owed", "owe"]) {
      fireEvent(screen.getByTestId(`home-balance-${side}-content`), "layout", {
        nativeEvent: { layout: { width: 100 } },
      });
    }
    fireEvent(screen.getByTestId("home-balance-owed-measure"), "textLayout", {
      nativeEvent: { lines: [{ width: 1_000 }] },
    });
    fireEvent(screen.getByTestId("home-balance-owe-measure"), "textLayout", {
      nativeEvent: { lines: [{ width: 80 }] },
    });

    expect(screen.getByTestId("home-balance-owed-amount").props.fontSize).toBe(16.2);
    expect(screen.getByTestId("home-balance-owe-amount").props.fontSize).toBe(16.2);
  });
});
