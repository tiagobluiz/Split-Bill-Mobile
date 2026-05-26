# Lint and Quality Policy

This repository enforces the following guardrails in CI:

1. TypeScript strictness
- `tsconfig.json` uses `"strict": true`.
- `npm run typecheck` runs `tsc --noEmit`.

2. Repository lint policy
- `npm run lint` runs ESLint for code quality and complexity thresholds.
- Cyclomatic complexity threshold: `20` (excluding tests and policy exception files).

3. File-size policy for production code
- `npm run check:max-lines` enforces a maximum of `1000` lines for production `.ts/.tsx` files in `app/` and `src/`.
- Exception files must be documented in `scripts/max-lines-exceptions.json` with:
  - `rationale`
  - `followUpIssue`

4. Architecture boundaries
- `npm run check:architecture` enforces:
  - `domain` (`src/domain/**`) imports only from `src/domain/**`.
  - `application/store` (`src/features/**` excluding `screens/**`) cannot import from `screens/ui`.

5. Test and coverage gate
- `npm run test:coverage` runs Jest with `--coverage`.
- Coverage threshold remains at `100%` global statements/branches/functions/lines.
- Regression tests should validate user-visible behavior, not implementation details.

## Required PR Checks

The PR pipeline requires:
- `typecheck`
- `lint`
- `test-coverage`
- `architecture-boundaries`

Merge is blocked whenever any required check fails.

