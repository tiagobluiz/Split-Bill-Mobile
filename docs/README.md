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
