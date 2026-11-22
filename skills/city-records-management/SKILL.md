---
name: city-records-management
description: "Use when organizing municipal records, preserving provenance, correcting decision history, classifying case evidence, preparing recovery, or applying records-only privacy controls."
user-invocable: false
---

# Records Management

Preserve work-order-attached development screenings, assisted applications and
independent assessments as append-only revisions. On Manager-routed professional
commands, Records Officer may preview/apply `screen-development`,
`application-record`, `assess-application` and intake/transition persistence using
the packaged CLI, not hand-edited canonical JSON. Keep source roles and honest
unauthenticated evidence; return the actual revision to RSO/Advisor/Planner.
Invoke it as `node "<installed-plugin>/scripts/city.mjs"` with the actual
absolute installed plugin path; do not assume a `city` executable exists on PATH
or that the hook's `PLUGIN_ROOT` is available in the agent shell. Use the exact
target repository as `--root`. If the executable path is unknown, report the
blocker rather than guessing.

## Competency and application

Municipal records management preserves authentic context, findability, and
accountability across a record's lifecycle. Repository City keeps canonical case
and proposal records in the target repository, not the installed plugin cache.

Use [records capture](../city-records-capture/SKILL.md) for author-side filing
instructions. The Records Officer receives filing requests when authors cannot
run the packaged CLI, then captures the supplied content unchanged and attributes
it to the authoring office. This is recordkeeping, not content review or approval.
Use `records-list --type artifact` to discover documents and `records-get` to
retrieve their full content. Existing artifacts without a category remain
legacy-unclassified; do not silently relabel them.

## Triggers and inputs

Empty record directories may be absent after checkout. The runtime treats
missing registers as empty and creates the destination on a confirmed record
write, so no manual `mkdir` or hook bypass is needed. Missing referenced records,
malformed records, symlinks, and non-directory paths still require reviewed
recovery. Do not reinitialize an existing city or invent replacement decisions.

- Use for record creation/review, corrections, broken references, handoffs, or recovery.
- Require explicit root, record IDs, source artifacts, requested action, applicable
  record schema, retention/access policy, and any hold or privacy concern.
- Inventory `.city/config.json` (including any `adoption.history` of
  amendments, oldest first), `.city/districts.json`, charter, policies, work
  orders, decisions, and `.city/zoning.json` when present. Proposal decisions are drafts; authorization and
  acceptance decisions are written only by the CLI with their work-order history.

## Procedure

1. Identify each record's purpose, stable ID, provenance, relationships, version,
   location, status, and known gaps using the existing schema.
2. Use `records-list` for bounded metadata discovery, then `records-get` with exact
   canonical IDs for content, including the zoning map when present. Request
   first-degree links only when they help the task; do not create a request for
   records already available through retrieval.
3. If an exact needed record is missing or requires a source-office response, ask
   the City Manager to route a records request with the purpose, exact item list,
   optional source office, and related work order. The Records Officer reports
   each item as `found`, `not-found`, `withheld`, or `unavailable`; a `found`
   response cites the requested record's current canonical path and digest.
4. Re-fetch cited records before use and compare their current digest to the
   response. A mismatch means the source changed; assess the current version rather
   than treating the earlier digest as immutable proof.
5. Preserve relevant source references, including who/what supplied evidence and
   whether identity or integrity was actually established.
6. For a routed filing request, validate required metadata, repository root,
   content format, work-order and supersession references. Preview the exact
   `artifact-record` operation. Do not edit the author's content, change the
   authoring office, or infer a formal status. Apply only after the record operation
   is explicitly confirmed; report the ID/path only from the actual apply result.
7. Keep canonical records repository-local. Link external presentations such as
   issues without maintaining a competing independent source of truth.
8. Minimize personal data, secrets, and duplicated raw logs in city records.
   Apply authorized access rules without claiming control of all application data.
9. Make only explicitly requested, schema-compatible edits. Never add unsupported
   approval/adoption fields or hand-edit state to bypass CLI validation. A charter
   or policy revision after adoption is recorded only through `amend`, never by
   hand-editing `adoption` or its `history`.
10. Preserve adverse findings and uncertainty. Use attributed corrections or
   superseding records; do not silently rewrite history or erase a dispute.
11. Inventory backup/recovery prerequisites and references. Distinguish an available
   backup from a tested restore, and a supplied digest from verified integrity.
12. Pass retention/disposition questions to records appraisal. Unknown policy,
   unresolved holds, or unclear ownership means preserve and escalate.

## Structured result and evidence

Return a record register: ID, type, path, source, version/status, related records,
privacy classification, retention/hold reference, integrity evidence, and gaps.
For edits, list exact paths, requested purpose, correction links, and validation
performed or still needed. Do not invent timestamps, hashes, or execution results.

## Escalation and limits

- Records Officer/Clerk may edit within their role.
  Records Officer may execute the packaged records CLI, including
  `artifact-record`, for the exact selected root; Clerk supplies a persistence/
  validation request rather than claiming a CLI check was run.
- This skill grants no tools, deletion rights, authority, or access privileges.
  Hashes and local provenance are not authenticated human consent.
- A records request is not an access grant. Do not copy restricted content into a
  request or response; office labels and file digests are not authentication or
  immutable custody.
- `--apply` is write confirmation only. Authorization and acceptance decisions are
  written only by `authorize` and `complete`, recorded with `authenticated: false`.
