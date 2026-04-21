## Split-Bill Mobile Improvement Plan (Maintainability + Type Safety)

### Summary
Reduce regression risk by removing `@ts-nocheck`, breaking the screen monolith into typed modules, centralizing duplicated flow logic, and stabilizing async UI tests. Preserve current UX/behavior and 100% coverage.

### Key Changes
- Create a typed `splitFlow` helper module for step reachability/pending-step rules and consume it from both screen and store layers.
- Refactor `screens.tsx` into feature-sliced modules:
  - `screens/home/*` for home tabs/settings/history
  - `screens/flow/*` for setup/participants/payer/items/overview/results
  - `screens/shared/*` for reusable view utilities and formatting helpers
- Remove `@ts-nocheck` from:
  - `src/features/split/screens.tsx`
  - `src/components/ui.tsx`
- Introduce explicit prop/state types for extracted components and shared helpers.
- Keep store as the single source of truth for domain mutations and persistence; UI modules become mostly presentational + orchestration.

### Test Plan
- Keep existing tests green and coverage at 100%.
- Add focused tests for the new shared `splitFlow` helper (single source of truth).
- Update screen tests to eliminate async `act(...)` warnings by wrapping pending async state transitions and using `waitFor` where needed.
- Run gates:
  - `npm run lint`
  - `npm test -- --coverage --runInBand`

### Assumptions
- No behavior/UX redesign in this pass; this is a structural reliability refactor.
- Keep current libraries (Expo Router, Zustand, Tamagui, SQLite) unchanged.
- Target is `origin/main` as of commit `b07f87d`.
