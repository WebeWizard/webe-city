# Work-order file parts and statement corrections

Plugin 0.7.0 adds two history-preserving records controls:

- **File parts** let a long-running work order keep recording revisions
  after its live file nears the 262,144-byte per-file limit.
- **Statement supersession** corrects an erroneous class-3 or class-4
  professional statement without editing the original.

## Municipal practice adapted

Real municipal records offices do not stretch a case folder without limit,
and they do not rewrite a filed document. When a case file grows too large,
the office closes the current volume and opens a new one. Each closed volume
is listed on the case cover sheet, in order. When a filed professional
statement is wrong, a new statement explicitly supersedes it. The original
stays on file, and the reason for the correction is recorded. Both controls
apply those practices to JSON records.

## File parts

### Capacity reporting

`validate` reports `capacity`:

```json
{
  "fileBytesLimit": 262144,
  "nearLimitThresholdBytes": 209715,
  "nearLimitWorkOrders": [
    { "id": "WO-…", "bytes": 256614, "fileParts": 0, "action": "file-part-close --id WO-… --reason TEXT" }
  ]
}
```

Any write that would make a live work order exceed the limit fails with
`SIZE_LIMIT`. Previews fail the same way. The error message gives the
current and resulting sizes, states that no record was written, and names
the `file-part-close` remedy. The limit is still enforced. It is not raised.

### Closing a part

```text
city file-part-close --root PATH --id WO-ID --reason TEXT [--apply]
```

Like other commands, this is a dry run unless you pass `--apply`. It moves the
live file's open portion into a new immutable record at
`.city/work-order-parts/<WO-ID>-part-NNNN.json`. The open portion is the
lifecycle history and every development revision list. The part record
contains:

- `workOrderId` and `part` (1–99);
- `previousPartSha256`, which is `null` for part 1 and otherwise the SHA-256
  of the previous part file;
- `closedAt`, which is never earlier than any entry it closes;
- `reason`;
- `sourceOffice: "records-officer"` and `authenticated: false`;
- the closed `contents` and the plugin `provenance`.

The live work order keeps its identity, status, `updatedAt` and current
fields. It keeps empty revision lists and appends `{id, sha256}` to its
`fileParts` manifest. Later revisions are appended to the live file as
before.

Revision numbers continue across parts. When the runtime loads a work order,
it assembles the parts in manifest order, then the open portion. It validates
the assembled case file with the same lifecycle, chronology, continuity,
linkage and policy rules as an ordinary work order. Commands that read the
work order always see the complete history. These include `status`,
authorization, development readiness, decisions and records requests.

`records-list --type work-order-part [--work-order WO-ID]` and
`records-get --id WO-ID-part-NNNN` retrieve closed parts. A work order's
`--linked` output lists its parts. `records-get` on the work order returns its
live (stored) form, including the manifest.

### Integrity and concurrency

- Part files are created exclusively and are never rewritten.
- The runtime fails closed with `INVALID_RECORD` in each of these cases:
  - a part's bytes no longer match the manifest SHA-256;
  - a listed part is missing;
  - a part's chain digest is wrong;
  - a part file is not listed in any manifest.
- Closing a part runs under the city mutation lock. The runtime rechecks the
  city and work-order bytes, publishes the part, and then replaces the live
  file with a compare-and-swap.
  - If the live-file replacement fails, the runtime removes the part it just
    published.
  - If that removal also fails, it reports `PARTIAL_WRITE`. In that case an
    unlisted part remains, and `validate` names it.
- Concurrent writers are still serialized. A write that observed the
  pre-close bytes fails with `CONFLICT` and leaves no change.
- `NOTHING_TO_CLOSE` is reported when the open portion is empty.
- `SIZE_LIMIT` is reported when an order already has 99 parts or the part
  itself would exceed the per-file limit.
- Decisions pin the live work-order bytes, as before. Closing a part changes
  those bytes, so close parts before an authorization decision, not between
  a decision and the transition it authorizes.

### Alternatives considered

| Option | Why it was not chosen |
|---|---|
| Raise the per-file limit | Only defers the failure and weakens the bounded-read protection. |
| Compact JSON encoding | Saves about a third, breaks byte-stable diffs and review, and still fails later. |
| Continuation work order | Breaks decision, assignment, permit and workforce links that key on one order ID. |
| Truncate or drop old evidence | Silently changes history; contrary to records retention. |
| Unbounded per-order directory | Hides growth and weakens deterministic loading limits. |

### Migration and operations

- No migration is needed. Work orders without `fileParts` are unchanged and
  validated exactly as before. The feature is used only when someone runs
  `file-part-close --apply`.
- After a part is closed, plugins before 0.7.0 cannot read the city.
  - They reject `fileParts` as an unknown field and fail explicitly. They do
    not misread the record.
  - To roll back, restore `.city/` from a backup.
- Back up and preserve `.city/work-order-parts/` with the rest of `.city/`.
  Do not edit or delete part files.
- Logical limits still apply to the assembled file:
  - 1,000 history entries and 1,000 revisions per kind;
  - 99 parts per order;
  - the 1,000-entry directory read cap for all parts in a city.
- `CLOSED_FILE_PART` is a defensive error. It is raised if a write would alter
  content that is already closed, which normal commands cannot do.

## Statement supersession

`permit-statement` appends revisions and never edits one. Each dimension and
screening revision has one current statement. A second statement for the same
dimension and screening is refused with `INVALID_ARGUMENT` unless it
explicitly supersedes the current one:

```json
{
  "dimension": "safety",
  "class": 3,
  "staffId": "safety-specialist",
  "screeningRevision": 1,
  "scope": "The screened module safety boundary.",
  "evidence": "Complete qualified safety study.",
  "evidenceArtifactId": "ART-…",
  "supersedes": 1,
  "correctionReason": "Replace placeholder evidence with the separately filed statement."
}
```

Rules:

- `supersedes` and `correctionReason` must be given together.
- `supersedes` must name the current (head) statement for that dimension and
  screening revision.
  - The superseding statement must have the same `class`.
  - A stale or forked target fails with `STALE_DEVELOPMENT`.
  - Each statement can be superseded only once, so corrections form a
    single chain.
- The optional `evidenceArtifactId` links the statement to a filed artifact
  for the same work order.
  - A missing artifact gives `NOT_FOUND`.
  - An artifact for another work order gives `INVALID_ARGUMENT`.
  - It can be used on first statements as well as corrections.
- The original statement remains byte-identical in the record. Readiness uses
  only the current statement.
- For class 4, an independent verification applies only to the statement it
  names.
  - Superseding a verified statement returns the order to
    `third-party-verification`.
  - Verifying a superseded statement is refused with `STALE_DEVELOPMENT`.
- The usual competency, staffing, policy and sequencing checks apply to the
  correcting statement.

Operations:

- Before authorization, record a correction directly.
- After authorization, follow the existing return or reopen route, because
  the decision pinned the earlier work-order bytes.
- Corrections are unauthenticated records of professional responsibility,
  just like original statements.
