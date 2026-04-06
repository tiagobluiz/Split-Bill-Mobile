# Split Engine Spec

This document defines the settlement rules implemented in
`src/domain/splitter.ts`.

## 1. Core Types

The canonical user-editable model is `SplitFormValues`:

```ts
type SplitFormValues = {
  currency: string;
  participants: ParticipantFormValue[];
  payerParticipantId: string;
  items: ItemFormValue[];
};
```

Participants:

```ts
type ParticipantFormValue = {
  id: string;
  name: string;
};
```

Items:

```ts
type ItemFormValue = {
  id: string;
  name: string;
  price: string;
  splitMode: "even" | "shares" | "percent";
  allocations: AllocationFormValue[];
};
```

Allocations:

```ts
type AllocationFormValue = {
  participantId: string;
  evenIncluded: boolean;
  shares: string;
  percent: string;
  percentLocked?: boolean;
};
```

The parsed model is:

- `ParsedParticipant`
- `ParsedItem`
- `ParsedItemShare`
- `ParsedSplit`

The final settlement model is:

- `SettlementResult`
- `PersonSummary`
- `Transfer`

## 2. Data Normalization

### 2.1 Participant and item names

When names are parsed into the authoritative settlement data:

- leading and trailing whitespace is trimmed
- internal whitespace runs collapse to a single space

This normalization is done by:

```ts
trimName(name) => name.trim().replace(/\s+/g, " ")
```

### 2.2 Currency

`detectCurrency(locale)` maps the locale region to a default currency using a
fixed region-to-currency table. If no known region is detected, the fallback is
`EUR`.

This affects defaults only. Settlement math itself treats currency as an
opaque code string.

## 3. Money Rules

### 3.1 Canonical representation

All final arithmetic is performed in integer cents.

### 3.2 User-entered money parsing

`parseMoneyToCents(value)`:

1. trims the input
2. removes all whitespace
3. converts `,` to `.`
4. requires the normalized value to match `^-?\d+(\.\d{1,2})?$`
5. converts to a number
6. returns `Math.round(number * 100)`

Examples:

- `"3.49"` -> `349`
- `"3,49"` -> `349`
- `" 1 234,56 "` -> `123456`
- `"-0.75"` -> `-75`

Rejected examples:

- `""`
- `"abc"`
- `"3.999"`
- `"."`

### 3.3 Amount limits

- `ITEM_AMOUNT_MAX_CENTS = 100_000_000`
- user-facing message: `"Maximum is 1 000 000"`

Step-two validation rejects any item where `abs(parsedAmount)` is above this
limit.

### 3.4 Zero amounts

An item amount of `0` is invalid in step-two validation.

Negative amounts are valid and are used for discount rows.

## 4. Participant Rules

Step-one validation enforces:

- at least 2 participants
- each participant name must be non-empty after normalization
- max participant name length is `25`
- names must be unique case-insensitively after normalization
- `payerParticipantId` is required once at least one participant exists
- the payer must be one of the participants

## 5. Item Rules

Step-two validation enforces:

- at least 1 item
- each item name must be non-empty if an amount is present
- max item name length is `32`
- each item amount must parse successfully
- each item amount must be non-zero
- each item amount must stay within `ITEM_AMOUNT_MAX_CENTS`

## 6. Default Allocation State

`createAllocation(participantId)` creates:

```ts
{
  participantId,
  evenIncluded: true,
  shares: "1",
  percent: "0",
  percentLocked: false
}
```

`createEmptyItem(participants)`:

- creates one allocation per participant
- sets `splitMode` to `"even"`
- seeds percent values using `createDefaultPercentValues`

## 7. Default Percent Values

Percent defaults are distributed in basis points, not floating-point percent
strings.

Algorithm:

1. total basis points = `10_000`
2. base = `floor(10_000 / participantCount)`
3. remainder = `10_000 - base * participantCount`
4. earlier participants get one extra basis point until remainder is exhausted
5. values are formatted as percent strings

Examples:

- `2` participants -> `["50", "50"]`
- `3` participants -> `["33.34", "33.33", "33.33"]`
- `4` participants -> `["25", "25", "25", "25"]`

## 8. Allocation Modes

### 8.1 Even mode

Weights are derived from `evenIncluded`:

- `true` -> weight `1`
- `false` -> weight `0`

Validation requires at least one included participant.

### 8.2 Shares mode

Weights are derived from `parseDecimal(allocation.shares) ?? 0`.

Important details:

- shares may be fractional because the parser accepts any finite decimal
- shares must be `>= 0`
- the total shares across the item must be strictly greater than `0`

### 8.3 Percent mode

Weights are derived from `parseDecimal(allocation.percent) ?? 0`.

Validation requires:

- each percent must be `>= 0`
- total percent must equal `100` within a tolerance of `0.001`

## 9. Percent Rebalancing

`rebalancePercentAllocations(allocations, changedParticipantId, nextPercentValue)`
is an editing helper used by the app UI.

Behavior:

1. Parse the changed percent as a decimal percent.
2. Convert it to basis points with `Math.round(percent * 100)`.
3. Sum the basis points of all other locked allocations.
4. Reject the edit if `fixed + changed > 10_000`.
5. Redistribute the remaining basis points across all other unlocked
   allocations.
6. If there are no unlocked allocations and the remaining basis points are not
   `0`, reject the edit.
7. Mark the changed allocation as `percentLocked: true`.
8. Preserve already locked allocations as locked.
9. Assign redistributed basis points to earlier unlocked allocations first when
   there is a remainder.

If the edit is invalid, the function returns `null` and the app ignores the
change.

`resetPercentAllocations`:

- recomputes the default percent split
- sets every `percentLocked` to `false`

## 10. Participant Synchronization Across Items

`syncItemAllocations(items, participants)` keeps every item aligned with the
current participant list.

Rules:

- existing participant allocations are preserved when possible
- missing participants receive default allocations
- removed participants are dropped from every item
- existing `percentLocked` values default to `false` if missing

## 11. Rounded Item Share Allocation

`parseSplit` converts each item into rounded per-item shares using
`allocateByWeights`.

Algorithm:

1. Ignore all zero-weight participants when calculating the proportional split.
2. Compute each exact share as `absoluteAmount * weight / totalWeight`.
3. Take `floor(exact)` for each positive-weight participant.
4. Compute the leftover cent remainder.
5. Sort participants for remainder distribution by:
   1. non-payers first
   2. larger fractional remainder first
   3. earlier participant order in the participant list
6. Give one cent at a time in that sorted order until the remainder is fully
   distributed.
7. Reapply the original sign of the item amount.

Consequences:

- remainder cents are intentionally biased away from the payer
- the per-item rounded shares always sum exactly to the item amount

If an item has no positive weights, `allocateByWeights` returns `null` and the
parsed item share list becomes an empty array.

## 12. Final Settlement Algorithm

`computeSettlement` does not simply sum the already rounded item shares.

Instead it:

1. validates the full form state
2. parses the split into participants and per-item rounded shares
3. separately recomputes exact, unrounded participant totals across all items
4. rounds only the final participant totals with `roundAggregateShares`
5. builds payer/non-payer balances and transfers

This means:

- item breakdown rows are rounded at the item level
- final balances are authoritative at the aggregate level
- item-level rounding bias is not repeated across every item

### 12.1 Exact aggregate totals

`allocateExactByWeights` computes exact decimal shares without flooring or final
cent assignment. These exact amounts are accumulated across all items by
participant.

### 12.2 Aggregate rounding

`roundAggregateShares(exactTotals, participants, targetTotalCents)`:

1. truncates each exact total toward zero
2. computes the delta between the target receipt total and the truncated sum
3. if delta is positive, add cents in this order:
   1. non-payers first
   2. larger positive residual first
   3. earlier participant order
4. if delta is negative, subtract cents in this order:
   1. non-payers first
   2. smaller residual first
   3. earlier participant order

This preserves the product rule that leftover burden should fall on non-payers
before the payer.

### 12.3 Paid, consumed, net

For each participant:

- `consumedCents` is the aggregate rounded consumption total
- `paidCents` is `totalCents` for the payer and `0` for everyone else
- `netCents = paidCents - consumedCents`

### 12.4 Transfers

Transfers are generated only from non-payers with negative net balances.

Each transfer is:

```ts
{
  fromParticipantId,
  fromName,
  toParticipantId: payer.id,
  toName: payer.name,
  amountCents: abs(netCents)
}
```

Zero-amount transfers are removed.

The current product supports exactly one payer.

## 13. Formatting Helpers

`formatMoney(amountCents, currency, locale)`:

- uses `Intl.NumberFormat`
- always renders two decimals

`formatMoneyTrailingSymbol`:

- uses the currency narrow symbol
- strips currency position/literals from `formatToParts`
- returns `number + symbol`

`buildShareSummary(item, participants, currency)`:

- emits `"Name amount"` segments
- joins them with a bullet separator

## 14. Current App Integration Rules

These behaviors are currently outside the pure split engine but affect visible
product behavior.

### 14.1 Trailing blank item normalization

Before step-two validation, clipboard export, and PDF export, the app removes a
single trailing item if both `name` and `price` are blank.

This is a composer convenience, not a core settlement rule.

### 14.2 Exclusive shortcuts

The current app provides an "only this person" shortcut:

- even mode -> selected participant included, all others excluded
- shares mode -> selected participant gets `"1"`, all others get `"0"`
- percent mode -> selected participant gets `"100"`, all others get `"0"`

### 14.3 Reset shortcuts

The current app also provides mode-specific reset helpers:

- even -> include everyone
- shares -> reset every share to `"1"`
- percent -> reset to default balanced percentages and unlock everything
