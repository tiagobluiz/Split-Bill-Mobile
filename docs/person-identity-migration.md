# Person identity and split memberships

Split-local participant IDs remain the keys for allocations, payer references,
settlements, and reminders. Every persisted participant also has a global
`personId`. Editable form input can omit it only for a new participant; storage
resolves the person and persists both identities atomically. Existing references
cannot be accidentally omitted or point to a missing person.

## Migration version 1

Bootstrap runs identity migration before normalization or reminder reconciliation.
Equal names after trimming, whitespace collapsing, and lowercasing share an
identity. Accents and full historical names are preserved. Valid existing IDs
take precedence over names. The owner has a stable `ownerPersonId` managed through
the profile; ordinary directory actions cannot delete it.

Migration reads both historical JSON formats without filtering malformed rows.
It verifies a persistent SQLite backup before changing participant links. The
backup is `split-bill-mobile.before-person-identity-v1.db` in the app's SQLite
directory. A `.pending` file is an unverified backup attempt and can be replaced
on retry. The verified backup is never overwritten or automatically deleted.

People, links, memberships, and the migration version commit together. Assertions
check that split payloads differ only by added person IDs, and that local IDs,
financial inputs, settlement/reminder state, unknown fields, and timestamps are
preserved. Interrupted writes roll back. Startup retries verify the backup and
source again; completed migrations verify identity coverage and memberships.

Malformed payloads, conflicting identities, repeated membership, inconsistent
dangling IDs, backup failures, or SQLite errors stop startup without discarding
records. Diagnose the failure before changing the source database. Never restore
the migration backup over later user edits automatically. Preserve a copy of the
current database before any deliberate recovery operation.

## Membership table

`split_person_memberships` contains `split_id`, `participant_id`, and `person_id`.
Its primary key is `(split_id, participant_id)`, with unique `(split_id, person_id)`
and a covering index on `(person_id, split_id)`. SQLite enforces split foreign
keys on the actual transaction connection.

`saveRecord`, `saveRecordsAndSettings`, and `deleteRecord` maintain memberships in
the same transaction as the source records. Person renames use the multi-record
transaction. Participant reassignment preserves financial references and changes
only identity/name. Empty splits have no memberships. Financial-only edits retain
the same memberships.

`listRecordIdsForPerson` and `countRecordsForPerson` use the index, with optional
draft/completed filtering and all statuses by default. `rebuildPersonMemberships`
can reconstruct this derived table from valid split records transactionally.
Person deletion rechecks indexed split references and group membership in its
transaction, archives referenced identities, and deletes only unused people.
There is no financial balance cache or statistics UI in this change.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.
The SQLite integration tests require Node 24 (also configured for the coverage
CI job), and exercise the real SQLite engine, backup verification, transaction
rollback, retry, index query plans, foreign keys, deletion, and reassignment.

Android emulator rehearsal verified three existing splits and seven participant
entries against the retained pre-migration backup, preserving financial payloads
and timestamps. iOS native rehearsal remains a release verification step.
