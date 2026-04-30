# Release Visual Validation

Use this checklist before saving screenshots or reviewing launch visuals for a release candidate.

## Brand Direction

- Treat the in-app warm palette as the canonical UI direction until replacement store assets are provided.
- Keep launcher icon, adaptive icon, and splash file references in `app.json` pointed only at final production assets.
- Do not mix temporary green-first branding explorations into release screenshots.

## Screenshot Rules

- Capture screenshots only from a clean app session.
- Do not keep screenshots that show Expo Go, Metro loading banners, update banners, placeholder icons, or blank boot states.
- Re-capture any screen after a styling change if the saved image no longer matches the current release candidate.
- Prefer screenshots from the main user journey: home, participants, items, review, and results.

## Launch Validation

- Confirm the Android launch path shows the intended app icon and splash assets.
- Confirm the first in-app screen matches the warm brand palette used throughout the product.
- Confirm no development-only overlays are visible before saving screenshots for docs, reviews, or store prep.
