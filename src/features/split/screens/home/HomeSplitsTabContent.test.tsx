import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { HomeSplitsTabContent } from "./HomeSplitsTabContent";
import { buildRecordFixture } from "../../integrationTestUtils";
import { createRecordRowModel } from "../shared/recordRowModel";
import type { DraftRecord } from "../../../../storage/records";

describe("HomeSplitsTabContent", () => {
  it("shows skeletons on initial load and keeps existing rows during pagination", () => {
    const settings = { ownerName: "You", ownerProfileImageUri: "", balanceFeatureEnabled: false, trackPaymentsFeatureEnabled: true, defaultCurrency: "EUR", language: "en" as const, humour: "plain" as const, splitListAmountDisplay: "total" as const, customCurrencies: [], tags: [] };
    const props = {
      topInset: 0, footerInsetBottom: 0, settings, balances: null, locale: "en-US", filtersExpanded: false, setFiltersExpanded: jest.fn(),
      activityStateFilter: "all" as const, setActivityStateFilter: jest.fn(), activityBalanceFilter: "all" as const, setActivityBalanceFilter: jest.fn(),
      activityDateFilter: "newest" as const, setActivityDateFilter: jest.fn(), activityTagFilterIds: [], setActivityTagFilterIds: jest.fn(),
      activityTagFilterMode: "all" as const, setActivityTagFilterMode: jest.fn(), visibleSplitCount: 0, filteredSplitRecordsLength: 0,
      onIncreaseVisibleCount: jest.fn(), getSplitReminderLabel: jest.fn(), onOpenActions: jest.fn(), listLoading: true,
    };
    const { rerender } = render(<HomeSplitsTabContent {...props} pagedSplitRecords={[]} />);
    expect(screen.getByRole("progressbar", { name: "Loading splits…" })).toBeTruthy();
    expect(screen.getByLabelText("Show filters").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText("Show filters"));
    expect(props.setFiltersExpanded).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("split-loading-card", { includeHiddenElements: true })).toHaveLength(4);
    const record = buildRecordFixture({ id: "loaded", status: "completed" }) as DraftRecord;
    const model = createRecordRowModel(record, "You", settings);
    rerender(<HomeSplitsTabContent {...props} pagedSplitRecords={[model]} />);
    expect(screen.getByLabelText(`Open split ${model.title}`)).toBeTruthy();
    expect(screen.getAllByTestId("split-loading-card", { includeHiddenElements: true })).toHaveLength(1);
    rerender(<HomeSplitsTabContent {...props} listLoading={false} pagedSplitRecords={[model]} />);
    expect(screen.queryByTestId("split-list-loading")).toBeNull();
    expect(screen.getByLabelText("Show filters").props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByLabelText("Show filters"));
    expect(props.setFiltersExpanded).toHaveBeenCalledTimes(1);
    const onRetry = jest.fn();
    rerender(<HomeSplitsTabContent {...props} listLoading={false} listError onRetry={onRetry} pagedSplitRecords={[model]} />);
    fireEvent.press(screen.getByLabelText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });
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
