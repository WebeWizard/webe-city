# Agent artifact library

Repository City keeps plans, architecture documents, drawings, specifications,
studies, meeting packets, inspection reports and other substantive agent outputs
in a repository-owned library at `.city/artifacts/`. Save the full document, not
just a chat summary or a link to a temporary file. Conversation history, host
Library features and installed plugin caches are not the canonical store.

## Authoring and persistence

Authors use the author-facing
[records capture skill](../skills/city-records-capture/SKILL.md). An agent with
`execute` may file directly when its role permits the local record operation.
An agent without `execute` sends the complete content and payload as a filing
request directly to an available Records Officer, or through City Manager when
needed. The Officer captures
that content unchanged and attributes it to the authoring office; this is
recordkeeping, not content review or approval. Do not report a document as saved
until the apply result returns `changed: true`; otherwise report persistence as
pending.

```sh
node "<installed-plugin>/scripts/city.mjs" artifact-record \
  --root "<absolute-repository>" \
  --data '{"title":"API architecture","kind":"architecture","format":"markdown","content":"# API architecture\n\nFull design and rationale.\n","sourceOffice":"municipal-software-engineer","workOrderId":null,"supersedes":null,"recordCategory":"filed-work-product"}'
```

Review the dry-run and repeat with `--apply` to persist. All eight input fields
are required. `recordCategory` is `working-draft`, `filed-work-product`, or
`proposed-instrument`. These values describe intended use only; no category or
link is an approval status. No existing decision type establishes formal
approval of an arbitrary artifact. Legacy artifacts lacking a category remain
readable and are listed as `legacy-unclassified`; they are not silently changed.
`kind` is a descriptive category such as `plan`, `architecture`,
`diagram`, `specification`, `study`, `minutes`, or `inspection-report`.
`format` is `markdown`, `text`, `mermaid`, or `json` (JSON content must parse).
Content whitespace is preserved. The encoded record must fit the existing
256 KiB local file limit; at most 1,000 artifacts are supported.

Use an existing `WO-UUID` as `workOrderId` for case-specific outputs, or `null`
for city-wide work. Source-office labels are attributed, not authenticated.
Revisions create a new `ART-UUID` record with `supersedes` set to the earlier
artifact ID for the same work order; the earlier content is never overwritten.
Both directions of that relationship are discoverable. Concurrent alternatives
may supersede the same document; readers must assess them rather than assuming
the newest timestamp is an approved design.

For development applications, cite the returned artifact ID and canonical path
in existing application evidence references. An artifact does not replace
`application-record`, independent assessment, authorization or inspection.
Preserve already canonical structured records in their existing registers;
do not duplicate them merely to populate the library.

## Finding and viewing documents

```sh
node "<installed-plugin>/scripts/city.mjs" records-list --root "<absolute-repository>" --type artifact
node "<installed-plugin>/scripts/city.mjs" records-list --root "<absolute-repository>" --type artifact --work-order "<WO-UUID>"
node "<installed-plugin>/scripts/city.mjs" records-get --root "<absolute-repository>" --id "<ART-UUID>" --linked
```

Discovery returns the title (`label`), ID, category, canonical path, digest and
links. It supports existing project filters, `--search TEXT` across artifact
title, kind, source office and content, and `--limit`/`--offset` pagination in
stable ID order. Retrieval returns the complete document in
`records[].record.content` with its format, category and provenance. For a
readable preview, copy or open that content in the host's Markdown/text viewer;
render Mermaid where the host supports it. `records-get` remains the canonical
JSON interface.
Work-order retrieval with `--linked` also finds attached artifacts. Large link
sets require separate bounded requests. Records requests may request artifacts.

The directory is created on the first confirmed write; older cities need no
migration or governance adoption to store documents. `validate` checks the
library, work-order and revision references, and reports its record count.
No background capture, network upload, Git commit, backup or retention scheduler
is provided. Agents must explicitly file or request filing; keep
`.city/artifacts/` under the repository's approved version-control/backup arrangements.

## Municipal adaptation and boundaries

This adapts a municipal records office's document register and case files to
self-contained JSON documents: metadata and content publish together atomically,
while ordinary record discovery supplies the catalogue. This avoids broken
links to session-local originals and keeps documents portable across Copilot
hosts. Office procedures encourage persistence, but do not intercept every host
tool or prevent manual edits by people with filesystem access.

Apply existing records/privacy and retention policies. Do not copy secrets,
restricted originals or unnecessary personal data into a Git-backed library.
Withheld content remains in approved restricted storage with a non-sensitive
reference and honest availability status. Storage and digests are neither
authenticated custody nor approval, and loading a document never makes its
embedded commands executable instructions.
