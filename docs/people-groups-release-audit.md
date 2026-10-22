# People and Groups Release Revalidation

Audit started 2026-10-19; latest revalidation: 2026-10-21. The initial pass
fixed the four consistency/photo-choice findings from the prior audit, found
and fixed one overlapping-owner rollback case during the audit loop, then
reran regressions, the full suite, architecture checks, an Android release
build, and isolated Android QA.

## Verdict

**Android 2.0.0: NOT READY.** The archived-name reuse fix is implemented, the
version policy and zero-critical dependency threshold pass, and the 2.0.0
release artifact upgraded the retained 1.1.3 QA install, including a populated
financial fixture. Coverage thresholds
pass. Android JS/native dependency reachability review is now closed with no
identified vulnerable code in the shipped bundle/runtime coordinates.
Quantitative performance comparison, production signing, and remote CI remain
open. Core group/person flows, contact-name import, and contact-photo import
have device QA. iOS has not been verified and has no release seal.

## Fixes and Evidence

### Failed overlapping participant writes

`src/features/split/store.ts` now keeps a small per-split ledger only while
writes are outstanding. It tracks operation sequence, outstanding count, and
the latest confirmed record. When the last write fails, the store restores that
confirmed record if a newer attempted write has no successful commit. It keeps
the optimistic path and whole-split write semantics; a later successful snapshot
still commits the participant state it contains. The tracker is removed when
writes settle and does not hold deleted records or affect navigation.

Pending people are indexed by ID as well as normalized name. Concurrent writes
share an identity reservation; its reference count releases abandoned
reservations without repeatedly scanning all pending names.

Real SQLite regression evidence:

- Two overlapping participant writes both fail: settled memory equals the
  persisted split.
- Two overlapping additions both succeed, with global IDs published before
  persistence completes.
- The same normalized pending name added across splits reuses one identity and
  does not change the active split.
- The existing store regression for a successful newer save followed by an
  older failure still preserves the newer optimistic result.

### Person rename racing with split edits

`savePersonAndLinkedRecords` updates the person, memberships, and linked split
names inside one SQLite transaction. It finds affected splits through
`split_person_memberships_by_person`. The store merges the person, memberships,
and names by ID into the latest in-memory state instead of assigning an old
whole-store snapshot. Ordinary split writes canonicalize linked names from the
settings row they already read, so an older participant name cannot undo a
rename.

The real SQLite scheduling regression pauses a rename transaction, starts a
split participant addition, then releases the rename. Both operations settle;
memory and SQLite agree on the participant list and canonical name. Existing
rename tests also verify local participant IDs, allocations, payer, settlements,
and net amounts remain unchanged. A real SQLite create-person/group-membership
test verifies atomic settings persistence without changing split history.

### Owner-name conflicts

Known conflicts are rejected before optimistic publication and are checked
again by the queued persistence path. If persistence rejects an owner rename,
only the still-current owner name and linked display names are restored; newer
unrelated settings and split edits are preserved. The SQLite regression checks
both persisted and in-memory owner names remain unchanged after a conflict.

The audit loop also found an overlap case not in the original four: two owner
renames can both be optimistic before either queued write runs. If both writes
fail, rolling the second draft back to the first draft leaves memory inconsistent
with SQLite. The store now retains the last confirmed owner name/person and
advances that baseline only after a successful write. A real SQLite regression
forces both writes to fail and confirms the owner setting and owner participant
both return to the last persisted name.

### Imported contact photos

An existing person initializes from their saved photo, or from initials and
saved color when no photo exists. A contact image remains a suggestion until
the user explicitly selects it. The editor regression confirms the explicit
choice and color controls remain visible for a saved person without a photo.

## Performance Review

No additional SQL statements or full-history reads were added to an ordinary
split save. Canonical-name normalization is folded into the identity planner's
existing person-ID lookup; it adds no people map or participant traversal. The
per-split write tracker uses constant-time map operations and immutable record
references, and is discarded when the last write settles. Person rename work
uses the indexed membership relation and scales with splits linked to that
person. No global serialization, event replay, deep-copy rollback, or new
database read was added to participant selection.

The previous implementation had no saved latency benchmark, so a valid numeric
before/after p50/p95 comparison cannot be reported. This pass verified the
query shape and behavior and ran the app on a separate emulator, but did not
claim a measured latency delta. A warmed benchmark against the pre-fix build is
still needed to quantify optimistic-update time and p50/p95 persistence across
small/large groups and 100/1,000-split histories. This is the remaining
performance-validation limit; the code change itself adds no ordinary SQL
round trip or extra participant traversal.

## Test and Build Results

- Full coverage run after the final regression: 40/40 suites passed; 590 passed,
  1 skipped, 1 todo.
- Coverage thresholds were not met: statements 85.82%, branches 79.27%,
  functions 83.74%, lines 88.07%. Configured thresholds remain 85% for every
  measure. The command exits nonzero on branch and function coverage.
- Focused SQLite regressions and person editor tests passed (26 tests), and the
  new overlapping-owner failure regression passed against real SQLite.
- TypeScript, ESLint, max-lines, architecture boundary checks, and `git diff
  --check` pass.
- Final Android `assembleRelease` succeeded in 4m12s. Gradle emitted existing R8
  Play Services Auth stack-map and Gradle deprecation warnings. The release APK
  is unsigned by Gradle.
- For QA, a temporary copy was signed with the local debug key and installed on
  the new isolated `PeopleAudit_API36` emulator (`emulator-5556`); the existing
  emulator (`emulator-5554`) was not modified. The app reached Home, entered a
  new split, displayed participant selection, and accepted a new participant
  while the keyboard was open. No app crash or React Native error appeared in
  logcat. Android showed a System UI not responding prompt during first boot;
  choosing Wait cleared it and the device remained responsive afterward.
- Contacts permission handling, native image selection/cropping, person editor
  save on-device, iOS, and automated E2E are not covered by this smoke test. No
  native E2E runner is configured in the repository.

## Architecture and Migration

The identity model remains appropriate: global `personId` supports cross-split
history and the indexed membership table, while split-local participant IDs
continue to key financial allocations, payer, and settlement state. This turn
did not alter migration behavior or schema. Existing real-SQLite migration
tests continue to cover historical payload shapes, verified backup, rollback
and retry, idempotency, unique membership, index query plans, and foreign keys.
No migration data-loss defect was reproduced in this audit.

Whole-split writes intentionally retain snapshot semantics. The new bookkeeping
addresses failed optimistic chains without defining per-action undo or replay.
Saved-person edits are now targeted and transactional; ordinary split edits
remain immediate and do not wait on an application-wide coordinator.

## Earlier Release Gates (Historical)

- Version policy fails against configured `origin/main`: app/package version
  remains 1.1.3 and Android versionCode remains 11; both must increase.
- Production dependency audit reports 94 advisories: 2 low, 21 moderate,
  70 high, and 1 critical. This requires dependency triage; no forced upgrade
  was applied.
- Global branch/function coverage thresholds fail as reported above.
- iOS and full native contacts/photo flows remain unverified.

All five reproduced correctness cases pass their retained assertions and the
fresh audit found no further reproducible correctness defect in the reviewed
paths. Release readiness remains gated by coverage, versioning, dependency
triage, and remaining native/performance validation.

## Android 2.0.0 Release Pass

Date: 2026-10-19.

### Changes and Identity Behavior

- Creating a split participant or group member by an archived name now reuses
  the existing global ID and restores it atomically with the successful split
  or group write. Historical split saves and bulk group additions do not
  opportunistically restore archived identities.
- Group draft names resolve against current persisted settings inside the
  transaction. New people, archived-person restorations, and the group commit
  together; the store publishes targeted updates only after commit.
- The contact selector's Back and Import controls have accessible button names.
- Package, lockfile root, Expo version, and Android `versionName` are `2.0.0`;
  Android `versionCode` is `12`. `npm run check:version` passes.

### Verification

- Focused identity/store/group-editor run: 3 suites, 99 tests passed.
- Full coverage run: 40 suites passed; 594 passed, 1 skipped, 1 todo. Global
  coverage is statements 86.04%, branches 80.55%, functions 84.19%, lines
  88.45%. The unchanged 85% branch and function thresholds fail; the test
  command exits nonzero. This is a release blocker.
- `npm run typecheck`, `npm run lint` (including max-lines),
  `npm run check:version`, `npm run check:architecture`, and `git diff --check`
  pass.
- `npm audit --omit=dev --audit-level=critical` exits successfully with zero
  critical advisories. The production dependency graph still reports 93
  advisories (2 low, 21 moderate, 70 high). The high-severity findings have not
  been fully classified against the shipped Android artifact; this is an open
  security gate, not an implicit acceptance of those findings.
- `./gradlew assembleRelease` succeeded for Android 2.0.0. Gradle output
  includes existing R8 Play Services Auth stack-map warnings and Gradle
  deprecation warnings. The APK is unsigned by Gradle; the QA copy was signed
  with a local debug key only and is not a distributable release artifact.
- Pinned Maestro CLI 2.11.0 was downloaded and its SHA-256 verified against the
  release checksum. `.maestro/groups-archived-identity.yaml` passed on the
  isolated API 36 emulator for group creation, the contacts import entry and
  empty state, person archival, archived-name restoration, and active-directory
  visibility. Contacts permission was already granted on that emulator, so the
  runtime grant/denial prompt was not exercised there. The flow does not yet
  cover selected-contact import, photo picking, or adding a group member to a
  split. The CI Maestro job is configured but has not yet run on GitHub Actions.
- The isolated emulator's retained `1.1.3`/versionCode `11` install accepted
  an in-place `2.0.0`/versionCode `12` update without clearing app data. This
  package-update check used the app-generated draft-only database described
  below; it did not contain financial entries. The
  pre/post SQLite snapshots are `device-backups/PeopleAudit_API36-1.1.3-split-bill-mobile.db`
  and `device-backups/PeopleAudit_API36-2.0.0-split-bill-mobile.db`. Both have
  one split, one membership-index row, and identical payloads: split
  `id-jfm9vxhn`, local participant `id-auh0ywva`, global person
  `df152421-bb00-44f4-82d1-ef5e7c98d376`. The retained QA draft contains no
  financial items, so this on-device rehearsal does not exercise nonzero
  allocations or settlements; preservation of those fields remains supported
  by the real-SQLite migration and identity tests, not this device fixture.

### Follow-up Audit (2026-10-20)

- Added behavioral test coverage for group and person editor validation,
  membership selection/removal, edit-draft preservation, photo replacement and
  fallback, permissions, retryable saves, and person conflict results. Added a
  reminder normalization/scheduling/reconciliation suite for shared split
  infrastructure.
- Latest full coverage run: 41 suites; 620 passed, 1 skipped, 1 todo. Global
  coverage is statements 88.42%, branches 82.74%, functions 86.70%, and lines
  90.26%. The configured 85% branch threshold still fails, by 2.26 percentage
  points (approximately 106 additional branch outcomes at the current
  denominator). No threshold or existing assertion was changed.
- Focused editor and reminder run: 3 suites, 37 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run check:version`,
  `npm run check:architecture`, and `git diff --check` pass after the added
  tests.
- Rechecked signing material: `android/app/debug.keystore` is the only keystore
  in the app directory; there is no upload keystore or configured production
  signing property. The release APK remains non-distributable.
- Security triage confirms the audit is not solely dev-tool noise: some high
  findings are in Expo CLI/Metro and community CLI/build tooling, while the
  dependency graph also attributes high findings through React Native,
  Reanimated, Tamagui menus, and Firebase-related packages. Presence in npm's
  production dependency graph is not itself proof of shipped-code reachability;
  that reachability has not yet been established artifact-by-artifact, so this
  is still an open gate. Current scan: 0 critical, 70 high, 21 moderate, 2 low.
- Emulator inventory remains the isolated API 36 QA device `emulator-5556` and
  the user's separate `emulator-5554`. The prior Maestro flow and migration
  rehearsal remain the only device evidence; no new production build was
  produced in this follow-up because app runtime code did not change.

The fresh audit found no new correctness defect in the code paths changed by
this follow-up. It did not clear the global coverage gate or certify the
remaining native, security, performance, data-fixture, signing, or CI gates.

### Open Release Gates

- **Coverage:** threshold cleared in the 2026-10-20 recheck (statements 90.30%,
  branches 85.02%, functions 89.09%, lines 91.39%). Branch coverage has almost
  no margin, so continue adding meaningful focused tests; this is no longer a
  release-blocking threshold failure.
- **Security:** npm and Android runtime Maven advisory checks are recorded in
  the latest audit below. Both exact resolved dependency sets have zero
  critical advisories; the native scan is limited to `releaseRuntimeClasspath`
  and does not replace binary analysis or a vendor security review.
- **Performance:** no valid pre-fix benchmark snapshot was captured. A numeric
  same-device/build comparison for optimistic update time and warmed p50/p95
  across small/large groups and 100/1,000-split histories is unavailable; the
  >10% regression gate cannot be evaluated.
- **Native QA:** group creation, contacts entry/empty state, person archival,
  archived-name restoration, library photo selection/cropping, selecting and
  saving a real provider contact name, and adding a group member to a split
  passed on the final build. Contact-photo import remains unverified. CI
  execution is pending.
- **Distribution signing:** the release APK is unsigned. Production signing
  credentials/configuration and a final distributable APK or AAB were not
  available or validated.
- **Migration QA:** a populated copy of the retained 1.1.3 database now boots on
  the 2.0.0 Android build with financial and identity references unchanged. The
  source backup itself contains no expenses; the tested €24 record was seeded
  into a temporary copy, so this is a controlled fixture, not user-data
  evidence. The Android package replacement from an installed 1.1.3 build was
  not rehearsed.
- **iOS:** unverified by scope.

No Android READY seal is issued while any of these gates is open.

### Coverage and Gate Recheck (2026-10-20)

- Added deletion regressions for owner-alias handling, a missing identity, and
  deletion after a successful hard delete, plus legacy unlinked split-row and
  group-only reference archival. The owner-alias fixture is injected at the
  SQLite boundary because normal settings validation correctly rejects an
  alias that duplicates the configured owner identity.
- Full coverage command: `npm run test:coverage -- --runInBand --silent`.
  Result: exit 0; 42/42 suites passed, 653 passed, 1 skipped, 1 todo. Global
  coverage: statements 90.30% (5619/6222), branches 85.02% (3970/4669),
  functions 89.09% (1602/1798), lines 91.39% (5172/5659). The unchanged 85%
  thresholds all pass; branch coverage is at the threshold with effectively
  no margin, so further meaningful regression coverage is still desirable.
- `npm run typecheck`, `npm run lint` (including max-lines),
  `npm run check:version`, `npm run check:architecture`, and `git diff --check`
  pass.
- The clean-install recheck completed after aligning `node_modules` with the
  lockfile. It confirms the four global coverage measures above and the same
  passing typecheck, lint, version, architecture, and diff checks.
- Final Android release build after the native dependency constraints:
  `android\\gradlew.bat app:assembleRelease`, `BUILD SUCCESSFUL` in 2m38s.
  Artifact metadata reports `2.0.0`, versionCode `12`; SHA-256
  `3690EFC9C5F6F5E5F7176972FF96E253F2AA40936677E92F6DC92AFC60BE18B1`.
  The artifact remains unsigned; a separate QA copy was signed with a local
  debug key and verified on the disposable emulator. The build repeats the
  existing Play Services Auth/R8 stack-map warnings.
- Pinned Maestro CLI 2.11.0 passed `.maestro/groups-archived-identity.yaml`,
  `.maestro/group-to-split.yaml`, and `.maestro/person-contact-import.yaml` on
  the explicitly selected clean disposable API 36 AVD (`emulator-5558`). This
  covers group creation, contact import empty state, person archival and
  archived-name restoration, group-member split addition, and selecting/saving
  a seeded Android contact name. A manual Android Photo Picker smoke test
  selected a library image, completed square cropping, hid color controls for
  the photo-backed draft, saved the person, and showed it in the directory.
  Contact-photo import remains unverified. The CI workflow now builds the
  release variant, signs a QA-only copy with the app debug keystore, and runs all
  three flows after seeding its synthetic contact. The equivalent signing
  command and workflow YAML parse locally; the remote CI job has not run.
  Earlier, Maestro auto-selected a different connected development emulator;
  reruns explicitly targeted `emulator-5558`, and all three passed. The retained
  migration emulator and `emulator-5554` were not modified.
- Populated migration rehearsal: copied the retained
  `PeopleAudit_API36-1.1.3-split-bill-mobile.db` to a temporary fixture (the
  source backup SHA-256 remained unchanged), seeded a completed €24.00 split,
  two 50% allocations, payer `owner-local`, a settled-participant marker, and
  matching membership-index rows, then loaded it into the disposable API 36
  emulator under 2.0.0. Bootstrap completed successfully. Before/after SQLite
  queries matched split ID/status/step, item ID and price, allocations, payer
  local ID, settled local ID, and both global membership mappings. An initial
  attempt correctly failed because the hand-built fixture omitted an index row;
  adding the required row produced a valid 1.1.3-state fixture. No production
  code change was needed. This validates DB bootstrap/preservation, not package
  replacement with this populated financial fixture. A separate attempt to
  build the exact 1.1.3 source APK for that stronger rehearsal was interrupted
  during native compilation and produced no APK.
- Production bundle/source-map reachability check examined 4,022 module sources.
  The npm-audited leaf implementations `@grpc/grpc-js`, Firestore JS,
  `xmldom`, `brace-expansion`, `browserslist`, `compression`, `fast-uri`,
  `image-size`, `js-yaml`, `node-forge`, `postcss`, `source-map-js`, `undici`,
  and `ws` are absent from the exported JS bundle. `nanoid` was present through
  React Navigation at the vulnerable `3.3.11` version on the first QA build;
  this was a real reachability defect. Added an npm override to `3.3.18`,
  regenerated the lockfile, ran `npm ci`, and verified both the installed
  package and final source map. `nanoid` no longer appears as a vulnerable
  package in the audit report. Runtime Reanimated/Tamagui sources are present,
  but npm attributes their high status transitively through React Native's
  dependency graph rather than identifying a direct advisory against those
  package versions. The npm report still lists 69 high-severity meta/transitive
  findings (92 total: 0 critical, 69 high, 21 moderate, 2 low); its zero-critical
  gate passes. Gradle's `releaseRuntimeClasspath` contains Firebase Analytics
  and Crashlytics native SDKs but no Firestore or gRPC Java runtime. A scan of
  its 335 selected Maven coordinates against the OSV query API returned zero
  advisory matches after adding Android constraints for Gson 2.14.0, Commons IO
  2.22.0, and Guava 33.7.2-android. Earlier hits for older OkHttp, Guava,
  Play Services, and Kotlin versions were requested versions Gradle overrides
  to fixed selected versions and are excluded from the corrected scan. This
  checks resolved Maven coordinates, not binary reachability, OS packages, or
  Gradle build plugins.
- The original device backup has no financial rows, but the populated copied-DB
  bootstrap rehearsal now passes as detailed above. The draft-only package
  update passed; package update with the populated financial fixture remains
  unverified. Contact-photo import, production signing, the benchmark
  comparison, and the configured release-build Maestro CI execution remain
  outstanding. Photo picker and contact-name selection have device smoke
  coverage.

Coverage is no longer an open threshold failure, and the npm bundle review led
to a targeted production dependency fix. The release verdict does not change:
Android 2.0.0 remains **NOT READY** because the same-device performance
comparison, production signing, and CI execution remain open. A populated
financial fixture has now passed an installed 1.1.3-to-2.0.0 package update, as
documented below. Contact-photo QA has also passed. iOS remains unverified. The
native dependency scan was rerun after the narrow dependency constraints and
the resulting release APK rebuilt and device-tested, but it is not a
production-signed distributable artifact.

### Device QA Update (2026-10-21)

- Used the dedicated `PeopleAudit_API36` AVD (Android 16/API 36, x86_64,
  1080x2400). Installed the current 2.0.0/versionCode 12 release artifact as a
  QA-only copy signed with the machine's Android debug key. This signing is not
  production signing. Installation updated the existing app without clearing
  its data; bootstrap loaded the retained split successfully.
- Exercised contact-photo import with a synthetic contact and image in the
  emulator's Android contacts provider. The contact selector rendered the
  photo; selecting it and saving created
  `files/person-photos/id-xwb0w5yg.jpg`. The persisted settings payload points
  to that app-owned URI. The file exists after save, and after force-stop and
  relaunch the app bootstrapped the saved record without a fatal exception.
  The imported provider image was used only as a borrowed source; the saved
  record references the app-owned copy.
- Also imported a second synthetic contact named `ParticipantA`, matching an
  existing saved person. The editor showed an explicit `Edit existing person`
  action; choosing it loaded the existing record. Cancel left exactly one
  `ParticipantA` with the original global ID, confirming no duplicate or
  implicit save was created in this flow. This contact had no photo, so the
  existing-record/contact-photo suggestion branch remains covered by the
  editor tests rather than this device check.
- Android initially displayed a System UI not responding prompt during the QA
  session; choosing Wait cleared it. The app then completed bootstrap and the
  photo import/save flow. This is recorded as an emulator stability caveat, not
  an application crash.
- Built the exact 1.1.3 release APK from `origin/main` commit
  `8a44d878919d175d62fd4ff5908d3e7cb84f946e` (versionCode 11) and signed a
  temporary QA copy with the machine debug key. Installed it as a downgrade on
  the separate `SplitBill_ReleaseQA_API36` AVD, preserving the existing app
  data. Converted a copy of that AVD's completed €24 split into legacy shape:
  removed global person IDs/settings and identity tables while retaining the
  old package's real SQLite schema, split-local participants, allocations,
  payer, and settlement marker. The installed 1.1.3 app reopened this fixture.
- The first 2.0.0 update correctly rejected a stale, empty migration backup
  left behind by the AVD's earlier 2.0.0 install. Inspection showed the backup
  contained zero settings and zero records while the legacy source contained
  one completed split; it was test-environment residue, not a matching 1.1.3
  backup. After deleting only that verified-empty QA backup, relaunch completed
  identity migration and bootstrap. No app source change was required.
- Pre/post SQLite comparison passed: split ID/status/step/timestamps, €24.00
  item, both 50% allocations, payer local ID, settled local ID, and every
  non-identity field matched. The two `{id,name}` participants retained their
  local IDs and gained global person IDs; settings contains both global people,
  the membership index contains two correct rows, migration version 1 is
  recorded, the verified backup contains the original legacy payload, and
  `integrity_check` / `foreign_key_check` pass. This closes populated-data
  package-upgrade migration QA.
- Independently compared the verified backup's complete `app_settings` and
  `split_records` rows against the pre-upgrade SQLite snapshot; both matched
  exactly, including the legacy participant payload and financial references.
- Post-rehearsal verification: 33 focused identity unit/SQLite integration
  tests passed, as did `npm run typecheck`, `npm run lint`,
  `npm run check:version`, `npm run check:architecture`, and `git diff --check`.
  No application source was modified during this verification.
- No application source changed during this QA update. Previously recorded
  full-suite coverage (all four unchanged 85% thresholds pass), typecheck,
  lint, architecture/version checks, dependency scans, and release build remain
  the latest code verification results.

### Current Blocking Gates

- Production signing key/configuration and a signed distributable AAB/APK are
  unavailable.
- The >10% performance regression criterion cannot be evaluated: no valid
  same-build/device pre-fix baseline and warmed p50/p95 dataset has been
  captured. An exact 1.1.3 release APK is now available, but it predates the
  People/Groups workflows and cannot serve as a comparable baseline for group
  operations. The older 2.0.0 QA APK does contain the identity-migration and
  confirmed-write code, so it is not demonstrably pre-fix and is also rejected
  as the baseline. No measurement is being substituted from a narrower DB-only
  microbenchmark.
- Remote GitHub Actions has not run for the current uncommitted workflow changes.
- iOS remains outside this Android release seal and is unverified.

Self-check: this iteration closed contact-photo device QA, high-severity
Android reachability disposition, and the populated package-upgrade migration
gate. The first migration error was reproduced as stale AVD backup residue and
cleared only after proving the stale backup was empty and the legacy source
valid. The release remains **NOT READY** because the performance comparison,
production signing, and remote CI gates remain open.

### Android Dependency Reachability Recheck (2026-10-21)

- `npm audit --omit=dev --json` reports 0 critical, 69 high, 11 moderate, and
  2 low advisories in the npm dependency graph (82 total); npm's default exit
  status remains nonzero for these findings. The unchanged release gate
  `npm audit --omit=dev --audit-level=critical` passes because it requires zero
  critical advisories.
- Extracted every high-severity entry with an actual advisory object from the
  audit JSON and checked its package path against the final Android release
  source map. The affected leaves were `@grpc/grpc-js`, `@xmldom/xmldom`,
  `brace-expansion`, `braces`, `browserslist`, `compression`, `fast-uri`,
  `image-size`, `js-yaml`, `node-forge`, `postcss`, `source-map-js`, `undici`,
  and `ws`; none appears in the bundle source list. Aggregate entries such as
  React Native, Reanimated, Tamagui, Firebase wrappers, and Expo tooling inherit
  the audit severity through those dependency chains; the underlying audited
  vulnerable leaves are not bundled in the shipped JS. No blanket upgrade was
  applied because it would change the RN/Expo dependency stack without
  removing reachable vulnerable code.
- The previously recorded OSV scan of 335 resolved Android release runtime
  Maven coordinates returned no advisory matches after the narrow fixed-version
  constraints. This is a coordinate/source-map reachability review, not a
  binary vulnerability scanner or a review of build plugins/host tooling.
- Conclusion: the plan's Android shipped-runtime high-severity reachability
  gate is closed on current evidence; the npm graph still reports high findings
  for tooling/transitive leaves, which remain visible in the report. This does
  not change the overall NOT READY verdict because the performance comparison,
  production signing, and remote CI are still open.

### Release Revalidation (2026-10-21)

- Re-ran `npm run test:coverage -- --runInBand --silent`: 42/42 suites passed,
  653 passed, 1 skipped, 1 todo. Coverage remains statements 90.30%, branches
  85.02%, functions 89.09%, and lines 91.39%; configured 85% global thresholds
  pass. Branch coverage remains close to the minimum.
- Re-ran `npm run typecheck`, `npm run lint`, `npm run check:version`, and
  `npm run check:architecture`; all passed. `git diff --check` passed (Git only
  reported existing LF/CRLF normalization notices).
- Confirmed the checkout still has uncommitted release changes on local `main`.
  No production signing variables (`MYAPP_UPLOAD_STORE_FILE`, passwords, or
  alias) are present; the only repository keystore is the debug key. Secret
  values were not read or displayed.
- Searched the repository and the known 1.1.3 build worktree for a saved
  performance benchmark or comparable pre-fix APK; none was found. The
  1.1.3 artifact predates this feature and the available 2.0.0 QA APKs contain
  the fixes, so neither is a valid before/after comparator. No performance
  claim is inferred from the fresh functional test run.
- This was a revalidation, not a release-gate closure. Repeating local checks
  cannot provide remote CI results, production signing, or the missing valid
  performance baseline. Android 2.0.0 remains **NOT READY** until those
  independent gates are satisfied.

### Focused Coverage Improvement (2026-10-21)

- Added five behavior-level editor regressions: person contact-book empty and
  unmatched states, no-selection completion, picker permission denial and
  cancellation, owned-photo cleanup with save retry, and group contact
  permission retry plus empty-book handling. Also isolated one-shot image
  picker mocks per person-editor test and removed an existing async `act()`
  warning. No production code or prior assertion was changed.
- Focused editor verification: 2 suites, 42 tests passed. Full coverage run:
  42/42 suites passed; 658 passed, 1 skipped, 1 todo. Global coverage is
  statements 90.51%, branches 85.47%, functions 89.21%, and lines 91.55%; all
  unchanged 85% thresholds pass. Editor branch coverage is now GroupEditor
  85.10% and PersonEditor 85.24%.
- Re-ran typecheck and lint/max-lines; both pass. Existing identity migration
  tests continue to run against real SQLite and cover source-data preservation,
  verified backup failure/retry, malformed input, idempotency, rollback, and
  financial-reference invariants. Lower branch coverage there is concentrated
  in defensive integrity/foreign-key failure paths; happy-path and rollback
  coverage are retained. The report uses the fresh `coverage-final.json`
  through Istanbul because the checked-in-worktree `coverage-summary.json` is
  stale (last modified 2026-10-19).
- Self-check: this pass added test evidence and raised global branch coverage
  by 0.45 percentage points from the previous fresh run; it was not another
  unchanged recheck. It does not close any external release gate. Android
  2.0.0 remains **NOT READY** pending production signing, a valid performance
  comparison, and CI results for the published release changes.
