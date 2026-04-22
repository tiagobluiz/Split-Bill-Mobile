## Split-Bill Mobile Image OCR Import Plan

### Summary
Ship the second import PR as camera/gallery image OCR import. This builds on the AI handoff PR by adding free on-device receipt text extraction for images, while keeping PDF import out of scope.

### Key Changes
- Port the web app receipt text parser into the mobile domain layer as `parseReceiptText`.
- Preserve the documented receipt parser behavior for:
  - trailing prices
  - comma and dot decimal normalization
  - wrapped quantity continuation lines
  - summary, payment, header, and note filtering
  - discount and modifier handling
  - no-items warnings and diagnostic failure messages
- Add a native image OCR adapter that accepts camera/gallery image URIs, extracts raw text on-device, runs `parseReceiptText`, and returns imported items plus warnings.
- Replace the disabled `Scan Photo` action with a working camera/gallery choice.
- Request camera and media permissions through the existing Expo image picker flow.
- Show import progress while OCR is running.
- Queue parsed OCR results for user confirmation before applying them.
- Reuse the same append/replace import application behavior as pasted imports, creating normal `createEmptyItem(currentParticipants)` rows with imported `name` and `price`.
- Keep PDF file import out of scope for this PR because it needs separate native/document parsing decisions.

### Test Plan
- Add mobile domain tests adapted from the web app parser tests for standard receipt lines, Portuguese supermarket lines, wrapped quantity rows, summary rejection, modifiers, and no-items warnings.
- Add store tests for applying parsed OCR items in append and replace mode.
- Add screen tests for permission denial, canceled camera/gallery picker, successful OCR import, OCR warnings, and OCR failure alerts.
- Manually smoke-test Android camera and gallery import in the native/dev build.
- Run gates:
  - `npm run lint`
  - `npm test -- --coverage --runInBand`

### Assumptions
- OCR must be free and on-device; no hosted OCR or AI API is introduced.
- The OCR dependency may require a native/dev build and should not be assumed to work inside Expo Go.
- PDF import remains a later PR.
- The web app parsing behavior remains the behavioral source of truth, even where the heuristics are imperfect.
