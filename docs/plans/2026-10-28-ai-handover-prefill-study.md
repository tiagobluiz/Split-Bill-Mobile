# AI handover prompt prefill feasibility

Researched: 2026-10-28. This is a feasibility study; application behavior is unchanged.

## Conclusion

Android provides a suitable mechanism to pass our receipt prompt into the selected AI app: a package-targeted `ACTION_SEND` intent with MIME type `text/plain` and `Intent.EXTRA_TEXT`. Device testing on the user's Samsung SM-S928N running Android 16 confirmed that ChatGPT and Gemini receive the complete prompt in an editable, unsent composer and expose Camera and Photos attachment options. Claude remains untested because it is not installed.

No documented, general mobile chat-prefill contract covering all three providers was established by this research. Do not promise universal support or equate successfully launching an activity with successfully prefilling a composer.

## Current implementation

- `src/features/split/screens/flow/PasteImportScreen.tsx:332` copies the localized prompt to the clipboard.
- Android calls `IntentLauncher.openApplication(packageName)`. This launches the package without passing prompt text or requesting a fresh chat.
- Other platforms open the provider homepage through `Linking.openURL`.
- Android launch failure falls back to the provider website. Successful launch advances the import flow to step two.
- `src/domain/llmHandoff.ts` owns the prompt builder, provider URLs, and Android package identifiers.

## Provider evidence and limits

| Provider | Evidence | Consequence for this feature |
| --- | --- | --- |
| ChatGPT | Official desktop documentation describes a URL that sets composer text without sending it. This documents the desktop app, not the Android/iOS consumer app. | Do not reuse the desktop `codex://` scheme for this mobile receipt workflow. Test Android text sharing; mobile draft-prefill behavior remains unverified. |
| Claude | Official desktop documentation supports `claude://claude.ai/new?q=...`. Official mobile documentation describes prefilled **Code sessions**, requiring Claude Code access. | Neither document establishes ordinary mobile receipt-chat prefill. Test Android text sharing independently. |
| Gemini | The research did not establish an official public URL contract for opening a normal mobile chat with an unsent text draft. | Test Android text sharing independently. Do not assume a guessed URL query parameter works. |

URLs with `q` or `prompt` parameters are not interchangeable across websites and native apps. A website accepting text does not establish that a mobile app preserves it, leaves it unsent, or starts a fresh conversation.

## Recommended Android approach

1. Keep copying the prompt as a fallback.
2. For providers verified on a real device, use `Intent(ACTION_SEND).setType("text/plain").setPackage(packageName).putExtra(Intent.EXTRA_TEXT, prompt)`.
3. If no activity handles the targeted intent, fall back to the current application launcher, then the current website URL.
4. Keep the manual copy action available even after a successful handover. Android cannot confirm that the target app actually displayed the text.
5. Enable prefill per provider only after checking the acceptance criteria below. Providers that submit immediately or omit the photo attachment action must retain the current copy-and-open flow.

This needs no AI API or backend. It uses the user's installed AI app and account.

### Installed Expo limitation

The installed `expo-intent-launcher` implementation has two relevant constraints:

- `packageName` is used only when `className` is also present to construct a `ComponentName`. It does not call `Intent.setPackage`. Passing only `packageName` with `ACTION_SEND` therefore does not reliably target the selected provider.
- `startActivityAsync` uses `startActivityForResult`; its promise resolves when the receiving activity returns a result, rather than simply acknowledging that the launch began. Awaiting it changes when the import screen advances.

Avoid hardcoding external activity class names, which can change between provider releases. A small Android native module that targets the package and uses `startActivity` is the clearest implementation candidate. It should acknowledge dispatch immediately and catch a missing handler so the existing fallback chain can run. Confirm the repository's native-module/build approach before implementation.

## iOS and web

iOS offers a system share sheet, but whether an AI share extension provides an editable draft and supports adding a photo is provider-dependent. It also generally adds a destination-selection step. A direct selected-provider handover needs a documented and tested provider route; Android intents cannot provide it on iOS.

Treat web prefill as a separate capability with its own validation. Do not replace the mobile handover with unverified prompt-bearing URLs.

## Validation required before shipping

For each provider, record the tested app version and Android version and check:

- Cold start and already-running app both open a fresh draft rather than modify an existing conversation.
- The complete localized receipt prompt appears with line breaks intact.
- Nothing is submitted before the user attaches the invoice photo and taps Send.
- Camera/gallery attachment remains available and preserves the prompt.
- Back navigation returns to Split Bill with step two ready and the draft intact.
- Missing app and missing text-share handler preserve the current launch/browser fallback.
- A handler that accepts the intent but ignores the text still leaves the clipboard/manual-paste path available.

The attached Android emulator was inspected using package queries. ChatGPT, Claude, and the configured Gemini package are not installed, so this session could not validate receiving-app behavior. Unit tests can verify intent construction and fallbacks but cannot prove what another app displays.

## Follow-up: physical-device results

The user subsequently attached a Samsung SM-S928N running Android 16 and authorized handover tests. Tests used ADB to dispatch the same package-targeted `ACTION_SEND` intent proposed above; no Split Bill application code was changed or installed.

| Check | ChatGPT | Gemini |
| --- | --- | --- |
| Installed and handles targeted `text/plain` sharing | Pass | Pass |
| Full English receipt prompt, 731 characters | Exact match | Exact match |
| Full Portuguese receipt prompt, 732 characters | Exact match | Exact match |
| Line breaks and Portuguese accents preserved | Pass | Pass |
| Prompt remains in an unsent composer | Pass | Pass |
| Camera and Photos options exposed after handover | Pass | Pass |
| Launch while already running | Pass | Pass |
| Cold launch reported by Android | Pass | Pass |

Prompt comparisons read the receiving app's `android.widget.EditText` accessibility text and compared it exactly against the generated prompt. The test harness reconstructed the plain-tone prompt from the current translation catalogs and the prompt builder's ordered keys, including the 54-character item-name limit. Screenshots confirmed unsent composers and attachment menus.

Gemini's configured package delegates to an activity in `com.google.android.googlequicksearchbox` on this phone. Targeting `com.google.android.apps.bard` still worked; do not hardcode the delegated activity class.

No test prompt was sent and no photo was selected or uploaded. Actual attachment completion, behavior when starting from an existing populated conversation, Split Bill's return navigation, absent-app fallbacks, other phones/app versions, and iOS remain unverified. Cold/warm tests refer to Android's reported launch state; Gemini's delegated Google-app process was not explicitly force-stopped.

Result at the time: text-only prefill passed initial tests for ChatGPT and Gemini. The stricter image-plus-prompt acceptance gate below supersedes this initial recommendation for Gemini.

## Follow-up: prompt plus attached image

At the user's request, tested the image stored in the development emulator at `files/invoice-photos/id-mq3yu0li.png` (212,766-byte PNG). This is a screenshot used as the split's invoice attachment, rather than a real receipt. Its content does not affect the transport test. The phone's installed Split Bill version is 1.1.3 and is not debuggable, so its private files could not be accessed directly.

A temporary, separately packaged Android test app (`com.miagology.handoverprobe`) packaged that image and the 732-character Portuguese prompt. It shared a private image through a non-exported, read-only content provider using:

- `ACTION_SEND` targeted to the selected AI package.
- MIME type `image/png`.
- `EXTRA_TEXT` containing the complete prompt.
- `EXTRA_STREAM` containing a parcelable `Uri`.
- `ClipData` for the same URI and `FLAG_GRANT_READ_URI_PERMISSION`.

| Provider | Result |
| --- | --- |
| ChatGPT | A single combined intent displayed the image thumbnail and the complete Portuguese prompt together in an unsent composer. Accessibility text exactly matched all 732 prompt characters. |
| Gemini: combined intent | Image thumbnail appeared, but `EXTRA_TEXT` was ignored. With a prior English draft, that old text stayed. With an empty composer, the image appeared with no prompt. |
| Gemini: text first, image second | Sending a `text/plain` intent first, then the image intent after the first had been handled, displayed both image and the exact 732-character Portuguese prompt. This is a preliminary workaround, not a robust single-dispatch contract. |

No Send button was pressed and no AI response was requested. This verifies attachment previews in unsent drafts; it does not establish whether providers upload attachment bytes before message submission. The temporary test app was uninstalled afterwards. The user's installed Split Bill application was not replaced and no production source was changed.

### Implementation implications and release gate

For ChatGPT, include the split's `invoicePhotoUri` when present, convert its private file URI to a shareable content URI, and send prompt plus image together. Existing Expo FileSystem infrastructure already includes a file provider and `getContentUriAsync`; the native handover helper still needs to place the URI in a typed `EXTRA_STREAM`, add ClipData/read grants, and target the provider package.

Do not pass the content URI as a plain string extra: Android sharing expects a `Uri`. The installed Expo intent launcher's generic extras map does not by itself establish that typed payload.

For Gemini, retain a dependable manual fallback. The two-stage method needs repeated device tests, lifecycle/timing validation, and checks from existing conversations before adoption. A successful two-stage experiment does not prove two immediately dispatched intents will reliably work. A fallback opens the image with the prompt copied and tells the user to paste it if it is not present.

Remaining coverage: real receipt JPEG/HEIC inputs, larger images, upload/analysis after user submission, explicit existing-conversation behavior, cold-start combined sharing, return navigation from Split Bill, Claude, and iOS. The planned gate for Gemini's two-stage route is five consecutive cold-start and five warm-start successes for each locale (English and Portuguese), with exact prompt and one image visible together, unsent, and successful return to Split Bill. The phone was not connected for this implementation run, so that gate was not met and the two-stage route stays disabled.

### Implementation results (2026-10-29)

- Added a local Android Expo module with a TypeScript API accepting `{ provider, prompt, invoicePhotoUri? }`.
- The handover screen resolves stable and legacy invoice-photo paths through `resolveInvoicePhotoUri`, copies the prompt first, then dispatches the selected provider intent.
- ChatGPT gets prompt and image in one package-targeted share. Gemini with an image gets the image while the prompt remains on the clipboard; the screen explicitly instructs the user to paste it if needed. Gemini without an image gets text-only sharing.
- Shared files use a typed `Uri` in `EXTRA_STREAM`, `ClipData`, the resolved image MIME type, and temporary read permission. The persisted image is not moved or deleted.
- If image dispatch fails, the screen retries text-only. If provider dispatch fails, it tries the installed app launcher and then the provider website. Non-Android behavior and Claude remain on the existing path.
- The screen blocks repeated launches while one is pending and proceeds to step two after Android accepts dispatch. That acceptance confirms only that Android started the target activity; it does not confirm the receiving composer contents.
- Validation in this run: typecheck, lint, architecture checks, relevant invoice-path and handover/screen tests, Expo Android autolinking, and Android debug assembly passed. Device runtime acceptance tests against the AI apps remain pending; no test message was sent.

## Follow-up: automatic execution after handover

The user asked whether the selected AI could also execute the prompt automatically. No documented mobile submission parameter was established for the tested image-sharing handover in either ChatGPT or Gemini. The earlier device tests demonstrated that those handovers leave the composer unsent.

Android's `ACTION_SEND` transfers content for the receiving app to handle; its name does not mean that it submits an AI conversation. The inspected installed-package intent filters expose content sharing, but do not establish an automatic-execution contract. Intent filters also do not enumerate every private extra an application might accept, so this is not proof that every undocumented mechanism is impossible.

Adding an instruction such as "execute now" to draft text cannot trigger execution before submission: the model has not received that text yet. No guessed `autoSend`/`submit` extras were treated as supported functionality.

Google documents automatic submission for some Gemini screen-action suggestion chips. That is a Gemini-owned interaction with screen context, not an established third-party intent contract for our custom receipt prompt and private image URI. Its normal file-analysis workflow still documents tapping Submit.

USB debugging could simulate tapping Send during a test, but does not provide a feature that the released Split Bill app can use on ordinary phones. No new prompt was submitted during this follow-up, and no accessibility service or device setting was enabled.

Recommended product boundary: prepare the image and prompt, then leave one Send tap to the user. If execution must start inside Split Bill without that tap, investigate a direct AI API integration as a separate architecture change rather than promise automatic submission in the consumer mobile apps.

Additional sources:

- Android intent contract: https://developer.android.com/reference/android/content/Intent#ACTION_SEND
- Gemini file analysis workflow: https://support.google.com/gemini/answer/14903178?co=GENIE.Platform%3DAndroid&hl=en
- Gemini screen actions and their auto-submit behavior: https://support.google.com/gemini/answer/15850607?hl=en
- Official OpenAI desktop deep-link reference (desktop-only, explicitly leaves the prompt unsent): https://learn.chatgpt.com/docs/app/commands

## Sources

- Android sharing contract: https://developer.android.com/training/sharing/send
- Expo IntentLauncher reference: https://docs.expo.dev/versions/latest/sdk/intent-launcher/
- Installed implementation: `node_modules/expo-intent-launcher/android/src/main/java/expo/modules/intentlauncher/IntentLauncherModule.kt`
- Installed TypeScript API: `node_modules/expo-intent-launcher/src/IntentLauncher.ts`
- OpenAI desktop links: https://learn.chatgpt.com/docs/app/commands
- Claude desktop links: https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link
- Claude mobile Code links: https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link

Next validation: install a rebuilt development app on the Samsung phone and verify ChatGPT with and without an image across cold and warm launches. Run Gemini's full locale/launch-state acceptance gate before considering its two-stage text-plus-image handover. Keep the tested-safe clipboard/image fallback until it passes. Validate Claude separately before enabling its prefill path.
