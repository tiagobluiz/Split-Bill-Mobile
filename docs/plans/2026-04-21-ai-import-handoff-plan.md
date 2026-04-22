## Split-Bill Mobile AI Import Handoff Plan

### Summary
Ship the first import PR as an AI handoff and paste-import workflow. This keeps the feature independently shippable without billable AI APIs, personal-account integration, native OCR dependencies, or PDF parsing.

### Key Changes
- Enable the existing `AI Paste` entry point on the items screen.
- Use the current domain helpers for the AI handoff:
  - `buildReceiptLlmPrompt`
  - `getReceiptLlmProviderUrl`
  - `getReceiptLlmLaunchTarget`
  - `parsePastedItems`
- Copy the receipt extraction prompt to the clipboard before launching a provider.
- Open ChatGPT, Claude, or Gemini through React Native `Linking.openURL`.
- Route the user through a two-step paste import screen:
  - Step 1 explains the AI handoff, copies the prompt, and opens the selected provider.
  - Step 2 lets the user paste the AI-generated item list and preview accepted, ignored, and estimated-total details.
- Refresh `PasteImportScreen` copy so it describes the active AI-compatible import workflow instead of a deferred milestone.
- Keep append/replace behavior routed through the existing `importPastedList` store action.
- Keep the expected AI output format directly compatible with the documented pasted-list parser.
- Treat empty or invalid pasted input as a no-op rather than an error because the preview already communicates what will be imported.

### Test Plan
- Add screen tests that verify the `AI Paste` entry point is enabled and opens the AI provider choice flow.
- Verify the prompt is copied to the clipboard before provider launch.
- Verify ChatGPT, Claude, and Gemini launch through `Linking.openURL` using the existing provider URL helpers.
- Verify the flow navigates to `/split/{draftId}/paste` after launching a provider.
- Verify empty pasted input is allowed as a no-op and returns without an error alert.
- Verify paste preview shows accepted count, ignored count, and estimated total.
- Verify already-previewed ignored-line warnings are not repeated as alerts while successful imports still return to the items screen.
- Verify append and replace modes call `importPastedList` with the selected mode.
- Run gates:
  - `npm run lint`
  - `npm test -- --coverage --runInBand`

### Assumptions
- No billable AI API calls are introduced.
- No direct OpenAI, Claude, or Gemini SDK integration is introduced.
- The user remains responsible for uploading the receipt to their preferred AI tool and pasting the result back into the app.
- Camera/gallery OCR and PDF import are intentionally out of scope for this PR.
