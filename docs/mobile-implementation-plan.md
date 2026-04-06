# Split-Bill Mobile v1 Execution Plan

## Summary

Build `C:\dev\Split-Bill-Mobile` as an `Expo + React Native` app using `Expo Router`, `Zustand`, `SQLite`, `Tamagui`, and a pure TypeScript domain layer. The app is rebuilt from scratch against `docs/logic/*` as the behavioral contract, with Android-biased QA and iOS-ready architecture.

The first implementation milestone is `core parity first`: manual participant/item entry, pasted-item import, deterministic split logic, settlement summary sharing, PDF export data generation, local draft persistence, and editable local history. OCR/image/PDF import and AI handoff are deferred to later milestones.

## Locked Decisions

- Stack: Expo React Native, TypeScript, Expo Router, Zustand, SQLite, Tamagui.
- Platforms: both iOS and Android are supported structurally; Android gets first-class validation.
- Input scope in v1: manual entry and pasted text only.
- Persistence: local-first, no auth, no sync.
- Completed history: editable original records, not snapshots.
- Contract priority: `docs/logic/*` is the behavior source of truth; any docs/renders conflict pauses for a product decision.
- Render policy: visual strictness is the goal, but no silent drift is allowed.

## Explicit Deviations From The Original Brief

- The fixtures under `docs/logic/fixtures/` remain reference material and spot-check inputs.
- The fixtures are **not** the automated release gate for this build.
- v1 generates the PDF export data contract, but does not yet render an actual PDF file.
- OCR, image import, PDF import, and AI handoff are intentionally deferred.

## Build Order

1. Persist docs plan and repo entrypoint.
2. Scaffold Expo app, routing, Tamagui theme, fonts, and SQLite shell.
3. Implement and test the pure split/parsing/output domain layer.
4. Implement setup flow for participants, payer, and manual items.
5. Implement allocation editing, overview, and final results.
6. Implement pasted import, summary sharing, PDF export data, autosave, and editable history.
7. Run Android-biased QA and iOS compatibility verification.

## v1 Scope

- Home/history surface
- Add participants
- Select payer
- Add items manually
- Paste item list
- Item assignment in even/shares/percent
- Split progress overview
- Final results
- Clipboard/share summary semantics
- PDF export data contract generation
- Draft autosave and editable completed history

## Deferred Scope

- OCR/image import
- Camera capture
- PDF file import
- On-device OCR pipeline
- AI handoff flow
- Provider launch semantics
- Exact AI prompt launch UI
- Actual rendered PDF file export

## Validation And QA Gates

- Domain tests cover money parsing, validation, even/shares/percent behavior, percent rebalance, payer-biased remainder allocation, aggregate rounding, pasted-item parsing, clipboard summary output, and PDF export data semantics.
- Screen and store-level validation cover draft restore, record reopening, and the core split flow.
- Manual QA prioritizes Android device behavior and visual comparison against `docs/renders`.
- Settlement spot checks continue to use `docs/logic/fixtures/*` as reference inputs.

## Testing Policy

- Every implemented file must remain at `100%` statements, branches, functions, and lines coverage at all times.
- `npm test -- --coverage --runInBand` is a required quality gate and must stay green before work is considered complete.
- Tests must be meaningful and behavior-oriented, not written just to satisfy counters.
- Every public component must have its own isolated test coverage.
- Screen tests are required on top of isolated component and domain tests; they do not replace them.
- Business logic must be tested through public behavior and public APIs. Do not change function visibility only to test internals.
- Prefer removing impossible branches over keeping defensive code that cannot occur through the documented contract.
- When new code is added, its isolated tests and any affected screen/store/domain tests must land in the same change.
