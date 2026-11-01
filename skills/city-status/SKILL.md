---
name: city-status
description: "Use when a resident invokes city-status, asks what is pending or blocked, checks enrollment and governance, or requests an evidence-based summary of work orders, decisions, and resident referrals."
user-invocable: true
---

# Explain City Status

## Purpose and inputs

Provide a read-only account of repository-local governance, projects, work orders,
decisions, workforce, and due institutional reviews.
Require the explicit absolute repository root and any case or district filter.
Do not infer enrollment, approval, or completion from the installed plugin inventory.

## Tooling

- Resolve the [packaged CLI](../../scripts/city.mjs) relative to this installed skill
  and discover its actual filesystem path before executing.
- Replace the quoted placeholders below with resolved locations; handle spaces
  and a non-default working directory. Package root and repository root differ.
- Require Node.js >=22; do not run `npm install` or other runtime installation.
- If the active role has no execute tool, read relevant records and provide a
  clearly limited summary plus the validation command for a permitted operator.
  Do not claim a CLI result you did not observe.

## Procedure

1. Run the two read-only checks when execution is available:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" validate --root "<absolute-repository>"
   node "<installed-plugin>/scripts/city.mjs" status --root "<absolute-repository>"
   ```

2. Distinguish unenrolled, enrolled draft, enrolled adopted, legacy (migration
   available), malformed, and incompatible state using actual output. Report
   adopted governance as a recorded, unauthenticated resident declaration and
   surface any adoption drift, including whether `adoption.history` shows prior
   amendments (each a superseded revision with its own date, digests, and
   summary). Never initialize, repair, reset, migrate, adopt, or amend as a
   side effect.
3. Read relevant work orders, decisions, charter, and policies only as needed to
   explain the resident's question. Report whether Council authorization is
   available (adopted governance with `policies/council-delegation.md`, no drift).
4. Summarize registered project directories and work-order counts by project.
   Identify legacy work orders without project IDs as unassigned. Summarize actual
   states, recent reasons, unresolved evidence, related cases, decisions by kind,
   and next actor. Do not invent costs, appointments, or progress.
5. Summarize workforce from `status.workforce`: active and retired staff,
   requisitions by status, current work-order assignments, orders without an
   assignment, and generated-file drift. Drift is reported, not enforced; it is
   not proof that a specialist agent was or was not invoked. Specialist
   appointments require the adopted workforce delegation policy and the recorded
   HR-review/Engineering-Manager-appointment sequence.
6. Report `status.institutionalReview` exactly: whether the feature is available,
   any policy error, review window, last review, observed counts, thresholds, and
   due triggers.    At the start of city coordination, the Manager dispatches the Performance and
   Innovation Officer to check `status` and conduct a due review in the same
   run; residents need not invoke that office. The CLI has no background
   scheduler, so do not claim the trigger was evaluated while the plugin was
   inactive.
7. List orders awaiting the resident first: Council referrals of reserved matters
   (still `awaiting-approval`) and `awaiting-merge` orders ready for `complete`.
   Keep `awaiting-approval` distinct from authorized and `awaiting-merge` distinct
   from `completed`.
8. Identify stale or missing evidence and disagreements between summaries and
   source records. Validation failure blocks assurance; it is not "no work pending."
9. Present privacy-minimized evidence references, not raw personal data or secrets.
   City-record privacy guidance does not secure all application data.
10. Give a clear resident next step: clarify, consider a proposal, resolve a dispute,
   inspect malformed state, or separately request `city-init`.

## Structured result and evidence

Return root, observed enrollment/governance status, validation result, evidence
locations, case/state summary, pending questions, blockers, and next actions.
Identify which facts came from CLI output versus a limited file read.
If commands were not run, say so explicitly.

## Limits

This skill grants no execution or edit permission. Status is read-only and cannot
ratify a charter, verify human approval, transition a case, merge, or authorize work.
Local provenance and `--apply` are not authentication; decisions are recorded with
`authenticated: false`. Always expose **status report — decisions recorded, not authenticated**.
