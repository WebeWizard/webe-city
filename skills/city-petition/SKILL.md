---
name: city-petition
description: "Use when a resident invokes city-petition, requests a municipal service, proposes a repository change, drafts acceptance criteria, or asks to submit an intake case."
user-invocable: true
---

# Submit a Resident Petition

## Purpose and inputs

Capture a resident need as a traceable intake case, not an instruction to implement.
Require explicit absolute root, title, requested outcome, one or more registered
project IDs, and any observable criteria. If the project is not registered, clarify
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
   draft testable criteria.
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
`authorize --decided-by resident --declared-by ... --evidence ...`. Once authorized,
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
