# Design System Document

## 1. Overview & Creative North Star: "The Social Ledger"
The objective of this design system is to transform a utilitarian task—splitting a bill—into a sophisticated, editorial experience. We are moving away from the "transactional" feel of fintech and toward a "social lifestyle" aesthetic. 

**Creative North Star: The Social Ledger**
This system treats every financial interaction as a story. By leveraging intentional asymmetry, generous white space, and high-contrast editorial typography, we create an environment that feels like a premium digital magazine rather than a spreadsheet. We break the rigid, boxy templates of traditional mobile apps by using overlapping elements, soft tonal shifts, and a "thumb-first" ergonomics strategy.

## 2. Colors: Tonal Depth & Warmth
The palette is rooted in the warm transition from sunset orange to botanical green, but these are used as precision instruments rather than blunt backgrounds.

*   **Primary Identity:** Use `primary` (#9d4401) for high-intent actions. Use the `primary_container` (#f98948) as a signature accent to draw the eye toward "the win"—completing a payment or settling a debt.
*   **The "No-Line" Rule:** To achieve a high-end feel, **prohibit 1px solid borders.** Boundaries between sections must be defined solely through background color shifts. For example, a list of items (`surface_container_low`) should sit on the main `surface` without a stroke.
*   **Surface Hierarchy & Nesting:** Treat the UI as layers of fine paper. 
    *   The base layer is `surface` (#f9f9f9).
    *   Secondary information sits on `surface_container`.
    *   Active cards or interactive elements use `surface_container_lowest` (#ffffff) to "pop" forward naturally.
*   **The "Glass & Gradient" Rule:** Floating elements, such as the bottom navigation, must utilize a backdrop-blur (12px–20px) with a semi-transparent `surface_container_lowest`. 
*   **Signature Textures:** For hero sections or empty states, use a subtle linear gradient from `primary` (#9d4401) to `secondary` (#006a60) at a 45-degree angle, with opacity set to 5–10% to provide a "visual soul" to the background.

## 3. Typography: Editorial Authority
We utilize a high-contrast pairing to establish a clear information hierarchy.

*   **The Headline Voice (Public Sans):** Used for all `display` and `headline` roles. Public Sans at 100% weight provides a sturdy, geometric foundation. For bill totals and group names, use `display-lg`. This mimics a magazine masthead, making the numbers feel significant.
*   **The Functional Voice (Inter):** Used for `title`, `body`, and `label` roles. Inter provides the technical precision needed for line items, percentages, and names.
*   **Hierarchy Strategy:** Always maintain a significant scale jump between headlines and body text. If a headline is `headline-lg`, the supporting text should jump down to `body-md` to create "breathing room" through typographic contrast.

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often a crutch for poor layout. In this system, we use light to define space.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tokens. Place a `surface_container_lowest` card on a `surface_container_low` background to create a lift that feels organic to the device.
*   **Ambient Shadows:** When an element must float (e.g., a "Split" button), use an extra-diffused shadow: `box-shadow: 0 12px 32px rgba(157, 68, 1, 0.08)`. The shadow color should be a tinted version of the `primary` color, not a generic black or gray.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use the `outline_variant` token at **15% opacity**. This creates a suggestion of a container without breaking the "No-Line" rule.
*   **Glassmorphism:** Use `surface_tint` at 5% opacity on top of blurred containers to ensure the element feels physically integrated into the UI.

## 5. Components: Tactile & Friendly
Every component follows a minimum `DEFAULT` roundedness of **1rem (16px)** to maintain an approachable, premium feel.

*   **Buttons:**
    *   **Primary:** Solid `primary` background with `on_primary` text. Use `xl` (3rem) rounding for a pill shape.
    *   **Secondary:** `secondary_container` background with `on_secondary_container` text.
    *   **Tertiary:** No background, just `primary` text.
*   **Input Fields:** Avoid boxes. Use a `surface_container_highest` bottom-weighted "shelf" or a subtle background fill. Labels should always be in `label-md` using `on_surface_variant`.
*   **Lists & Cards:** **Strictly forbid dividers.** Use 16px–24px of vertical white space to separate bill items. To group items, wrap them in a `surface_container_low` region with `md` (1.5rem) rounded corners.
*   **Thumb-Friendly Navigation:** The primary navigation must be a floating bar at the bottom of the screen. It should use Glassmorphism (backdrop-blur) and sit 16px away from the screen edges to feel like an "appliance" rather than a fixed menu.
*   **Progress Indicators:** Use the orange-to-green gradient for progress bars to visualize the journey from "Unpaid" (Orange) to "Settled" (Green).

## 6. Do's and Don'ts

### Do
*   **Do** use intentional asymmetry. Align a large total to the left and the "Pay" button to the right with generous vertical offset.
*   **Do** use `surface` (#f9f9f9) instead of pure white for the main background to reduce eye strain and increase the "premium" feel.
*   **Do** use the `xl` (3rem) corner radius for main CTAs to make them feel "squishy" and tappable.
*   **Do** leverage `surface_container_lowest` for elements that need the highest user focus.

### Don't
*   **Don't** use 1px black or gray borders to separate content. It cheapens the editorial look.
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#1a1c1c) to maintain tonal harmony.
*   **Don't** crowd the edges. Maintain a minimum 24px "Safe Zone" on the left and right of the screen.
*   **Don't** use standard Material Design "shadow-heavy" elevations. Stick to tonal shifts and ambient, tinted blurs.