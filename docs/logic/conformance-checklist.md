# Conformance Checklist

Use this checklist when implementing Split-Bill logic in another repository.

## 1. Split Engine

- Parse money exactly as documented, including comma-decimal handling.
- Keep all authoritative arithmetic in integer cents.
- Enforce participant, payer, item, shares, and percent validations exactly.
- Preserve the single-payer model.
- Match default percent generation in basis points.
- Match percent rebalance behavior, including lock semantics and rejection
  conditions.
- Match item-level remainder allocation bias: non-payers before payer.
- Match final aggregate rounding behavior: round totals across the whole bill,
  not by summing already rounded item rows.
- Match transfer generation rules exactly.

## 2. Receipt Import

- Detect PDF versus image using the documented file rules.
- Try PDF embedded text before OCR fallback.
- Run OCR fallback only when the text layer yields zero parsed items.
- Reconstruct PDF text lines using the documented Y-coordinate and EOL rules.
- Match the receipt-text keyword lists and classification heuristics.
- Force modifier rows negative.
- Match pasted-item accepted formats and ignored-line warnings.
- Match failure messages when no items can be detected.

## 3. AI Handoff

- Preserve the exact extraction prompt unless product requirements intentionally
  change it.
- Keep the expected AI output directly compatible with pasted-item parsing.
- Match provider URLs and mobile launch behavior if reproducing the same flow.

## 4. Output Contracts

- Match clipboard summary ordering and sentence templates.
- Match PDF export filename generation.
- Match the payer-first plus alphabetical people ordering in exported data.
- Keep PDF item shares provisional and final people totals authoritative.
- Preserve the fixed PDF explanatory note unless the rounding model changes.

## 5. Fixture Coverage

At minimum, the target implementation should recreate and pass the fixture set
in `docs/logic/fixtures/` for:

- even split baseline
- per-item rounding bias away from payer
- aggregate rounding across many items
- percent rebalance sequence
- receipt wrapped-line parsing
- receipt footer-noise rejection
- pasted-list parsing
- clipboard summary output
- PDF export payload generation
- AI handoff prompt generation

## 6. Recommended Release Gate

A future mobile implementation should not be considered logic-compatible until:

1. all fixtures pass
2. at least one end-to-end user flow reproduces the same final balances
3. manual verification confirms receipt-import edge cases still behave the same
