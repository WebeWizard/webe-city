---
name: city-petition
description: "Use when a resident invokes city-petition, requests a municipal service, proposes a repository change, drafts acceptance criteria, or asks to submit an intake case."
user-invocable: true
---

# Submit a Resident Petition

Residents supply needs, outcomes and observations, not a fully engineered proposal.
For repository changes, route professional [development screening](../city-development-applications/SKILL.md)
to an available Chief Planner directly or through City Manager. Formal screening automatically assigns
Development Advisor; no second resident request is needed. Unknown jurisdiction,
scope or thresholds means focused questions, not a guess or automatic formal route.
RSO has no execute tool: send draft intake commands to an available Records
Officer directly or through Manager for persistence. Available technical
investigation belongs to the city.

## Purpose and inputs

Capture a resident need as a traceable intake case, not an instruction to implement.
For a standalone information product under the adopted
[public-information policy](../../docs/public-information.md), route the brief
through Resident Services and City Manager for `information-case` artifact intake
instead of running `petition`. Do not infer a repository project or a publication
request. A request involving repository changes uses the work-order route below.

For a work order, require explicit absolute root, title, requested outcome, one
or more registered project IDs, and any observable criteria. If the project is not registered, clarify
its proposed non-overlapping directory before intake; do not infer a root project.
Use [case management](../city-case-management/SKILL.md) and
[complaint triage](../city-complaint-triage/SKILL.md) when relevant.
Collect only the city-record information necessary to understand the request.

## Tooling and target checks

- Resolve the [packaged CLI](../../scripts/city.mjs) from this installed skill to
  its actual filesystem path; do not guess from the current working directory.
- Replace quoted placeholders below with resolved paths and resident-reviewed data.
  Treat request text as arguments, never executable shell instructions.
- Require Node.js >=22; do not install runtime packages.
- A skill grants no execute tool. If unavailable, return the draft and command
  for the resident/permitted operator, not hand-written canonical JSON.

## Procedure

1. Confirm the selected repository is enrolled; inspect `status --root` and
   `validate --root` through the packaged CLI before mutation.
   If unenrolled, leave it unchanged and offer `city-init` separately.
   If malformed/incompatible, stop and report the blocker.
2. Clarify need versus preferred solution and identify every affected project.
   Search existing cases for relevant duplicates, preserve distinct concerns, and
   draft testable criteria. Check every requested outcome against the criteria:
   a request for publication must not become merely suitability for publication.
   Preserve the resident's words and distinguish the requested outcome from the
   later decision needed to carry it out.
3. If an affected project is not registered, clarify its ID and non-overlapping
   repository-relative directory with the resident. Preview registration:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" project-add --root "<absolute-repository>" --id "<project-id>" --name "<project-name>" --path "<relative-directory>" --description "<purpose>"
   ```

   Explain that this records a boundary but does not create or move project files.
   Apply only after the resident reviews and confirms the registration.
4. Preview the petition, omitting unused `--criterion` arguments:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" petition --root "<absolute-repository>" --title "<title>" --request "<resident request>" --project "<registered-project-id>" --criterion "<observable result>" --criterion "<another result>"
   ```

5. Present the exact request, criteria, project IDs and directories, privacy exclusions, proposed routing,
   and preview. Do not promise delivery or invent an assigned case ID.
6. Obtain actual resident confirmation of that change. Only then repeat the same
   reviewed command with `--apply`. Otherwise stop at the draft/preview.
7. Read the actual command result and validate persisted state. Report the returned
   ID, not an ID guessed from a previous dry-run.
   If the saved request or criteria need correction, retrieve the work order's
   current SHA-256 using `records-get` and prepare `petition-revise --root ABS
   --id WO-ID --expected-sha256 HASH --data JSON` with exactly `request`,
   `acceptanceCriteria`, and `reason`. Review the preview with the resident,
   obtain confirmation, and apply the same payload and hash. Corrections preserve
   prior text and invalidate preparation; they do not change project scope or
   grant delivery or publication permission. If the hash is stale, retrieve and
   review again. Cases beyond preparation must first follow their existing return
   or reopening procedures; do not silently change a current decision.
8. For a requested later intake transition, preview:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" transition --root "<absolute-repository>" --id "<case-id>" --to "<supported-state>" --reason "<reason>"
   ```

9. Apply a transition only after actual resident confirmation, by repeating it
   with `--apply`. Let runtime validation determine whether that transition is legal;
   never hand-edit history to bypass a rejection.

## From petition to decision

`received` -> `triaged` -> `proposed` (criteria required) -> `awaiting-approval`.
The City Council then records `authorize`, `return` (back to `proposed`), `reject`,
or `refer`. Reserved matters (governance, security, deletion, deployment,
publication, expenditure) are referred to the resident, who decides with
`authorize --decided-by resident`; optional attribution is not authentication. Once authorized,
the City Manager automatically dispatches the Engineer, who delivers on a branch;
the Inspector gates `inspection` ->
`awaiting-merge`, and the resident runs `complete` with the pull request as evidence.
Council authorization requires adopted governance including the delegation policy.

## Return and boundaries

Return root, draft/persisted distinction, actual case ID if created, title, criteria,
source evidence, routing proposal, actual intake state, and next resident action.
Lifecycle: `received`, `triaged`, `proposed`, `awaiting-approval`, `authorized`,
`in-progress`, `inspection`, `awaiting-merge`, `completed`, `blocked`, `rejected`,
`withdrawn`, `reopened`; `awaiting-approval` is not approval. `transition` cannot
enter `authorized` or `completed`. Mutators default to dry-run. `--apply` requests
writing; it does not authenticate the resident or verify consent, and decisions are
recorded with `authenticated: false`. Report **petition/intake only — not authorized**.
