import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { HomeSplitsTabContent } from "./HomeSplitsTabContent";

describe("HomeSplitsTabContent", () => {
  it("prunes active tag filters that no longer exist in settings", async () => {
    const setActivityTagFilterIds = jest.fn();

    render(
      <HomeSplitsTabContent
        topInset={0}
        footerInsetBottom={0}
        settings={{
          ownerName: "You",
          ownerProfileImageUri: "",
          balanceFeatureEnabled: true,
          trackPaymentsFeatureEnabled: true,
          defaultCurrency: "EUR",
          language: "en",
          humour: "plain",
          splitListAmountDisplay: "remaining",
          customCurrencies: [],
          tags: [
            {
              id: "tag-groceries",
              label: "Groceries",
              icon: "cart",
              color: "mint",
              builtIn: true,
            },
          ],
        }}
        balances={{
          owedCents: 0,
          oweCents: 0,
          currency: "EUR",
        }}
        locale="en-US"
        filtersExpanded={false}
        setFiltersExpanded={jest.fn()}
        activityStateFilter="all"
        setActivityStateFilter={jest.fn()}
        activityBalanceFilter="all"
        setActivityBalanceFilter={jest.fn()}
        activityDateFilter="newest"
        setActivityDateFilter={jest.fn()}
        activityTagFilterIds={["tag-groceries", "deleted-tag"]}
        setActivityTagFilterIds={setActivityTagFilterIds}
        activityTagFilterMode="all"
        setActivityTagFilterMode={jest.fn()}
        visibleSplitCount={0}
        filteredSplitRecordsLength={0}
        onIncreaseVisibleCount={jest.fn()}
        pagedSplitRecords={[]}
        getSplitReminderLabel={jest.fn()}
        onOpenActions={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(setActivityTagFilterIds).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    const prune = setActivityTagFilterIds.mock.calls[0][0] as (
      current: string[],
    ) => string[];
    expect(prune(["tag-groceries", "deleted-tag"])).toEqual([
      "tag-groceries",
    ]);
  });
  it("keeps tag filter edits as a draft until applied", () => {
    const setIds = jest.fn();
    const setMode = jest.fn();
    render(<HomeSplitsTabContent
      topInset={0} footerInsetBottom={0}
      settings={{ ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: false, trackPaymentsFeatureEnabled: true, defaultCurrency: "EUR", language: "en", humour: "plain", splitListAmountDisplay: "remaining", customCurrencies: [], tags: [{ id: "food", label: "Food", icon: "cart", color: "mint", builtIn: true }] }}
      balances={{ owedCents: 0, oweCents: 0, currency: "EUR" }} locale="en-US" filtersExpanded setFiltersExpanded={jest.fn()}
      activityStateFilter="all" setActivityStateFilter={jest.fn()} activityBalanceFilter="all" setActivityBalanceFilter={jest.fn()}
      activityDateFilter="newest" setActivityDateFilter={jest.fn()} activityTagFilterIds={[]} setActivityTagFilterIds={setIds}
      activityTagFilterMode="all" setActivityTagFilterMode={setMode} visibleSplitCount={0} filteredSplitRecordsLength={0}
      onIncreaseVisibleCount={jest.fn()} pagedSplitRecords={[]} getSplitReminderLabel={jest.fn()} onOpenActions={jest.fn()}
    />);
    fireEvent.press(screen.getByLabelText("Choose tag filters"));
    fireEvent.press(screen.getByLabelText("Food"));
    fireEvent.press(screen.getByLabelText("Cancel"));
    expect(setIds).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Choose tag filters"));
    fireEvent.press(screen.getByLabelText("Food"));
    fireEvent.press(screen.getByLabelText("Apply"));
    expect(setIds).toHaveBeenCalledWith(["food"]);
    expect(setMode).toHaveBeenCalledWith("all");
  });

});
