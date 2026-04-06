# Output Contracts Spec

This document defines logic-bearing output contracts for:

- copied settlement summaries
- PDF export data
- PDF export semantics
- current browser draft storage

## 1. Clipboard Summary Contract

The current app copies a plain-text summary from `copySummary()` in `src/App.tsx`.

### 1.1 Preconditions

Before building the summary, the app:

- removes one trailing blank item draft if present
- computes settlement on the normalized values
- aborts if settlement is invalid

### 1.2 Ordering

People are ordered with:

1. payer first
2. everyone else alphabetically by `name` using localeCompare with
   `sensitivity: "base"`

### 1.3 Exact shape

The copied text is:

```txt
Split Bill summary
{payerName}: paid {paidMoney} and should get back {netMoney}.
{otherName}: owes {owedMoney}.
...
```

Rules:

- the first line is always exactly `Split Bill summary`
- one person per line after that
- the payer line uses `paid ... and should get back ...`
- every non-payer line uses `owes ...`
- non-payer amounts are `abs(netCents)`
- money formatting uses `formatMoney`, so the exact string depends on locale and
  currency

## 2. PDF Export Data Contract

`buildPdfExportData(values, date)` is the canonical PDF export payload builder.

### 2.1 Preconditions

The function throws if:

- settlement is invalid
- parsed split is invalid
- no payer exists

### 2.2 Returned shape

```ts
type PdfExportData = {
  appName: string;
  exportDateLabel: string;
  fileName: string;
  currency: string;
  totalCents: number;
  note: string;
  payer: PdfExportPerson;
  people: PdfExportPerson[];
  items: PdfExportItem[];
};
```

### 2.3 Stable constants

- `appName = "Split-Bill"`
- `note = "Item breakdown is provisional. Final leftover cents are balanced in the final balances section."`

### 2.4 Filename rule

`buildPdfFilename(date)` returns:

```txt
split-bill-YYYY-MM-DD.pdf
```

Month and day are always zero-padded to two digits.

### 2.5 Export date label

`exportDateLabel` uses `Intl.DateTimeFormat(locale, { year, month: "short", day })`.

This is locale-dependent and presentation-only.

### 2.6 People ordering

`people` is sorted:

1. payer first
2. everyone else alphabetically by name using `en-US` locale and
   `sensitivity: "base"`

### 2.7 Person fields

Each exported person includes:

- `participantId`
- `name`
- `isPayer`
- `paidCents`
- `consumedCents`
- `netCents`

These must match the authoritative settlement result.

### 2.8 Item fields

Each exported item includes:

- `id`
- `name`
- `amountCents`
- `splitMode`
- `splitModeLabel`
- `shares`

Split mode labels are:

- `even` -> `Even split`
- `shares` -> `Share units`
- `percent` -> `Percent`

### 2.9 Exported share inclusion rule

PDF item shares exclude zero-amount rows.

This matters because item share lists can otherwise include explicit `0`
allocations for excluded participants.

### 2.10 Important accounting rule

The `items[*].shares` values come from `parseSplit`, which uses per-item rounded
shares.

The `people[*]` values come from `computeSettlement`, which uses aggregate
rounding across the full bill.

Therefore:

- item rows are explanatory
- people totals are authoritative
- the note about provisional item breakdown is part of the contract

## 3. PDF Document Semantics

`SettlementPdfDocument` defines the current document meaning.

The styling itself is not normative for other platforms, but the content model
is.

### 3.1 Document metadata

Current metadata:

- author: `Split-Bill`
- title: `Split-Bill Summary`
- subject: `Grocery bill split summary`
- creator: `Split-Bill`

### 3.2 Required sections

The rendered PDF currently contains:

1. header
2. final settlement
3. who owes
4. item breakdown

### 3.3 Header content

The header includes:

- app name
- `Grocery bill split summary`
- exported date label
- currency code

### 3.4 Final settlement section

This section includes:

- payer name
- payer paid amount
- payer collect amount
- total receipt amount

### 3.5 Who owes section

This section includes only non-payers whose `netCents < 0`.

Each row shows:

- participant name
- `abs(netCents)`

### 3.6 Item breakdown section

This section includes:

- the fixed provisional note
- one block per item
- item name
- item amount
- split mode label
- one row per non-zero share showing participant name and amount

## 4. Draft Storage Contract

This section is web-specific, but documenting it is useful if another client
wants compatibility with current drafts.

### 4.1 Storage key

The browser localStorage key is:

```txt
split-bill:main-spa:draft
```

### 4.2 Stored payload

```ts
type StoredDraft = {
  step: number;
  hasUnlockedFullNavigation?: boolean;
  values: SplitFormValues;
};
```

### 4.3 Behavior

- loading silently returns `null` on malformed JSON
- storing overwrites the full key
- clearing removes the key
- the current app autosaves after a `400ms` debounce

This storage contract is not required for a future mobile app unless draft
compatibility is explicitly desired.
