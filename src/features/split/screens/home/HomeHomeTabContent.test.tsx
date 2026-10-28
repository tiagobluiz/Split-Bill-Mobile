import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { HomeHomeTabContent } from "./HomeHomeTabContent";

const props = {
  topInset: 0,
  footerInsetBottom: 0,
  isCreatingSplit: false,
  settings: {
    ownerName: "You",
    balanceFeatureEnabled: false,
    trackPaymentsFeatureEnabled: true,
    language: "en",
    humour: "plain",
    defaultCurrency: "EUR",
    customCurrencies: [],
    tags: [],
  } as any,
  balances: { owedCents: 0, oweCents: 0, currency: "EUR" },
  locale: "en-US",
  recentRecords: [],
  onViewAllSplits: jest.fn(),
  getSplitReminderLabel: jest.fn(),
  onOpenActions: jest.fn(),
};

it("reports an Error from split creation with its actionable message", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  render(<HomeHomeTabContent {...props} onStartSplit={async () => { throw new Error("offline"); }} />);

  fireEvent.press(screen.getByText("Start New Split"));
  await screen.findByText("Recent");
  expect(warn).toHaveBeenCalledWith("Failed to create split", expect.any(Error));
  expect(alert).toHaveBeenCalledWith("Could not create split", "offline");
  alert.mockRestore();
  warn.mockRestore();
});

it("uses the retry message when split creation rejects without an Error", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  render(<HomeHomeTabContent {...props} onStartSplit={async () => { throw "unexpected"; }} />);

  fireEvent.press(screen.getByText("Start New Split"));
  await screen.findByText("Recent");
  expect(alert).toHaveBeenCalledWith("Could not create split", "Please try again.");
  alert.mockRestore();
  warn.mockRestore();
});
