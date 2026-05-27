import type { DraftRecord } from "../../../../storage/records";
import type { AppSettings, SplitListAmountDisplay } from "../../../../storage/settings";

export type ActivityStateFilter = "all" | "settled" | "unsettled";
export type ActivityDateFilter = "newest" | "oldest";
export type ActivityBalanceFilter = "all" | "nothingDue" | "somethingDue";

export type RecordActionTarget = {
  id: string;
  title: string;
};

export type HomeBalances = {
  owedCents: number;
  oweCents: number;
  currency: string;
};

export type SplitRowSettings = Pick<
  AppSettings,
  "defaultCurrency" | "splitListAmountDisplay" | "customCurrencies"
>;

export type SplitListAmountDisplayOption = {
  key: SplitListAmountDisplay;
  label: string;
  description: string;
  summary: string;
};

export type SelectableSplitListAmountDisplayOption =
  SplitListAmountDisplayOption & {
    disabled: boolean;
  };

export type HomeRecord = DraftRecord;
