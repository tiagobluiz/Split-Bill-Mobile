# Logic Handoff Package

This folder is the logic-only source of truth for any future implementation of
Split-Bill outside this repository, including a separate native mobile app.

The goal is behavior parity, not UI parity.

## Scope

These documents cover:

- split input models, validation, and settlement rules
- money parsing, default values, and rounding behavior
- receipt import flow for PDFs and images
- receipt-text parsing and pasted-list parsing
- AI handoff prompt and supported provider launch behavior
- clipboard summary output rules
- PDF export data contract and document semantics
- machine-readable fixtures for conformance testing

These documents do not cover:

- visual design
- component structure
- page layout
- navigation patterns
- styling or animation

## Normative Sources

The current implementation is derived from these files:

- `src/domain/splitter.ts`
- `src/receipt-import/importReceipt.ts`
- `src/receipt-import/parseReceiptText.ts`
- `src/receipt-import/parsePastedItems.ts`
- `src/receipt-import/llmHandoff.ts`
- `src/pdf/buildPdfExportData.ts`
- `src/pdf/SettlementPdfDocument.tsx`
- `src/storage.ts`

The current test suite is the strongest behavioral cross-check:

- `src/domain/splitter.test.ts`
- `src/receipt-import/parseReceiptText.test.ts`
- `src/receipt-import/parsePastedItems.test.ts`
- `src/receipt-import/llmHandoff.test.ts`
- `src/pdf/buildPdfExportData.test.ts`

If code and prose ever disagree, the desired long-term rule is:

1. fix the prose if the code is correct
2. fix the code if the prose captures intended product behavior
3. update fixtures whenever intended behavior changes

## Document Map

- `split-engine-spec.md`
  Defines the settlement model, validation rules, default values, and rounding.
- `receipt-import-spec.md`
  Defines OCR/PDF import flow, receipt-text parsing, pasted-list parsing, and
  AI handoff behavior.
- `output-contracts-spec.md`
  Defines the clipboard summary, PDF export contract, and current draft-storage
  contract.
- `conformance-checklist.md`
  Defines what a future implementation should verify before being considered
  behaviorally compatible.
- `fixtures/`
  Machine-readable golden examples for conformance tests.

## Porting Guidance

For a separate mobile repository:

- Treat the split engine and parsing rules as normative.
- Treat output contracts as normative unless a mobile-specific product decision
  explicitly changes them.
- Treat visual rendering details in the current web PDF component as
  presentation-only, except where those details affect meaning, ordering, or
  inclusion/exclusion rules.
- Recreate the fixture set as automated tests in the mobile repository.

## Locale Notes

Some outputs are locale-dependent:

- currency formatting for clipboard summaries and PDF rendering
- human-readable export date labels
- initial currency detection from the device locale

Whenever a fixture depends on locale-sensitive formatting, the fixture includes
an explicit locale assumption.
