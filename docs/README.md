# Split-Bill Mobile Docs

This repository keeps the mobile implementation contract and build plan in-docs so the project is restartable without tribal knowledge.

## Start Here

- [`docs/mobile-implementation-plan.md`](./mobile-implementation-plan.md)
- [`docs/logic/README.md`](./logic/README.md)
- [`docs/renders/mellow_split/DESIGN.md`](./renders/mellow_split/DESIGN.md)

## Structure

- `docs/logic/`
  Logic contract, output contracts, conformance guidance, and reference fixtures.
- `docs/renders/`
  Mobile screen references and design system direction.
- `docs/mobile-implementation-plan.md`
  Locked decisions, execution phases, accepted deviations, and validation gates for this repo.

## Testing Standard

- The repo standard is `100%` coverage for statements, branches, functions, and lines across all implemented code.
- The testing pyramid here is intentional: isolated domain/component tests first, then store tests, then screen tests.
- Internal helpers should be covered through public behavior, not by changing visibility only for tests.
- The canonical project policy lives in [`docs/mobile-implementation-plan.md`](./mobile-implementation-plan.md#testing-policy).

## Android updates

Release builds check Google Play on launch and resume. When Play reports an eligible update has been known to the device for at least 30 days, the app requires its immediate update flow. Missing age information or a failed check leaves the app usable; the timer is controlled by Play, not the release date. Debug builds skip the check.

Older versions cannot enforce this policy until they install a release containing it. To encourage those users, check Play App Signing and recovery eligibility, then use Play Console → App bundle explorer → Recovery tools → Prompt users to update. Every track containing the selected old bundle must have a newer compatible release. The recovery prompt can be dismissed and returns after a cold start. See [Google's recovery instructions](https://support.google.com/googleplay/android-developer/answer/13812041) and [in-app update testing instructions](https://developer.android.com/guide/playcore/in-app-updates/test).
