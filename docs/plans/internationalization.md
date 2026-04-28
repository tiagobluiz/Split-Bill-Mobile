# Language + Humour I18n Plan

## Summary
Add a first-class localization layer that resolves copy by `language + humour`, with app-wide selection stored in Settings and device locale used only as the initial default. V1 will support `English` and `Portuguese`, each with `plain` and `sassy` tones, and any humorous label that is too long for a constrained UI slot will automatically fall back to that language’s plain variant.

## Key Changes
- Introduce an app copy system built around stable message keys instead of inline strings.
- Add app settings fields for:
  - `language`: `en` | `pt`
  - `humour`: `plain` | `sassy`
- Add a localization resolver API along the lines of:
  - `translate(key, params?, options?)`
  - `options.fallbackTone?: "plain"`
  - `options.maxLength?: number`
- Keep formatting concerns separate from copy concerns:
  - existing `Intl` money/date formatting stays locale-based
  - human-readable labels/messages move into translation catalogs
- Seed translation catalogs for:
  - screen titles, subtitles, buttons, tabs, empty states, filters, settings labels
  - validation and helper messages from domain/shared helpers
  - modal titles/bodies/actions
  - clipboard/export/PDF labels and summaries
  - accessibility labels and short action text
- Add per-key metadata for tight UI surfaces where tone may overflow:
  - CTA buttons
  - tab labels
  - pills/status chips
  - action sheet options
  - short toggles like `On` / `Off`
- Implement fallback behavior as:
  - resolve requested `language + humour`
  - if missing, fall back to same language + `plain`
  - if `maxLength` is provided and the resolved string exceeds it, fall back to same language + `plain`
  - only if the base language key is missing, fall back to default app language
- Extend the Settings screen with app-wide selectors for language and humour, persisted through the existing `AppSettings` storage flow and bootstrapped into the store.
- Add a localization provider/hook near app root so screens and helpers can consume a single resolved copy context rather than threading strings manually through every component.
- Refactor copy-heavy helpers so they no longer return hardcoded English:
  - validation in `src/domain/splitter.ts`
  - record/status text in shared screen helpers
  - clipboard/PDF/export summary builders
  - root-level app error copy

## Interfaces And Data Shape
- Add a typed message-key registry so `translate()` only accepts known keys.
- Add translation catalogs shaped by language and humour, for example conceptually:
  - `catalog[language][humour][key] = string | formatter`
- Allow interpolation params for dynamic strings such as character limits, duplicate counts, participant names, and pending step labels.
- Add optional copy constraints metadata keyed by message id for short surfaces, instead of scattering max-length logic in components.
- Keep draft/split data unchanged for v1 since selection is global, not per split.

## Test Plan
- Unit tests for translation resolution:
  - resolves exact `language + humour`
  - falls back to plain humour when humorous variant is missing
  - falls back to plain humour when `maxLength` is exceeded
  - interpolates params correctly
- Storage/store tests:
  - new settings fields normalize and persist
  - bootstrap loads stored language/humour
  - device locale sets the first-run default language
- Screen/integration tests:
  - settings can switch language and humour
  - core home/flow screens render translated labels
  - tight labels use plain fallback when sassy exceeds allowed length
- Domain/export tests:
  - validation messages localize
  - clipboard summary localizes
  - PDF/export labels localize while currency/date formatting still respects locale
- Regression checks:
  - accessibility labels remain present and localized
  - existing step-flow behavior is unchanged apart from copy

## Assumptions
- V1 supports `en/plain`, `en/sassy`, `pt/plain`, and `pt/sassy`.
- Humour applies to all user-facing copy, including exports and accessibility labels.
- Device locale is used only to choose the initial language default; users can override it in Settings.
- Length protection is opt-in per key for constrained UI elements, not a global cap on every string.
- Translation content will be manually curated in code/catalog files, not generated at runtime.
