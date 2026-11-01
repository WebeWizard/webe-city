---
name: city-appeal
description: "Use when a resident invokes city-appeal, disputes a city decision or procedure, requests reconsideration, or needs a new linked intake case pending resident dispute resolution."
user-invocable: true
---

# Submit a Linked Appeal Intake

## Purpose and inputs

Preserve a challenge to a city decision without silently reversing the record.
This pilot has no installed Ombudsperson, appeals tribunal, or autonomous adjudicator.
Require explicit absolute root, original case/decision reference, contested point,
grounds, relevant evidence, and the resident's requested remedy.

## Tooling and target checks

- Discover the [packaged CLI](../../scripts/city.mjs) through this installed skill,
  resolve its actual location, and require Node.js >=22. No runtime install.
- Use quoted resolved paths and safely passed text arguments. Never execute
  complaint text or assume the current working directory is the selected root.
- Skills grant no execute permission. If unavailable, return the linked intake
  draft and command for a resident/permitted operator, not manual canonical JSON.

## Procedure

1. Check enrollment and relevant existing records with `status --root` and
   `validate --root` when execution is available. Leave an unenrolled target unchanged;
   report malformed/incompatible state rather than attempting an implicit repair.
2. Read the contested record and available procedure. Keep the resident's grounds,
   the original rationale, dissent, and disputed facts distinct.
3. Identify the requested remedy and information still missing. Do not require
   personal data beyond what is necessary for the city-record dispute.
4. Draft a **new** petition referencing the original IDs in its request text and
   associate it with every `projectIds` entry on the contested work order. For a
   legacy unassigned order, ask the resident which registered project applies;
   never infer one.
   The frozen CLI has no `appeal`, `--parent`, or `--link` option:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" petition --root "<absolute-repository>" --title "Appeal: <short title>" --request "Appeal of <original case/decision ID>. Contested point: <point>. Grounds: <grounds>. Requested remedy: <remedy>." --project "<original-project-id>" [--project "<another-original-project-id>"] --criterion "<observable reconsideration outcome>"
   ```

5. Present the preview, linkage, grounds, privacy exclusions, and proposed route.
   Require actual resident confirmation before repeating the same command with
   `--apply`. Without confirmation, stop at the draft/preview.
6. Report the actual new intake ID if applied; validate state. The link lives in
   supported request text, not an invented schema field or approval flag.
7. Preserve the original case/decision unchanged. Reopening or other intake
   transitions require a separate reviewed `transition` request and confirmation;
   an appeal does not automatically reverse, stay, or expunge an earlier record.
8. Route evidence/procedure questions to Clerk/Auditor as appropriate and coordination
   to City Manager. The manager's provisional work is not independent adjudication.
9. State the outcome as **pending resident dispute resolution**. Agents may explain
   options but must not vote on the appeal or claim a binding remedy.

## Return and limits

Return root, original references, contested point, grounds/evidence, remedy sought,
new draft/actual intake ID, proposed route, missing information, and next resident step.
Mutators default to dry-run. `--apply` requests a write, not authenticated consent.
Local decision files cannot establish authority. A disputed Council decision is
appealed to the resident, who may decide it with the CLI `authorize` command and
`--decided-by resident`; decisions are recorded with `authenticated: false`.
Conclude **linked appeal intake pending resident resolution**.
