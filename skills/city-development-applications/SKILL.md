---
name: city-development-applications
description: "Use when screening a resident request for material development, preparing an assisted application, or independently assessing the exact current application revision."
user-invocable: false
---

# Development Application Screening and Assistance

## Scope and inputs

Require selected root, canonical work order, registered projects and actual
adopted charter/policies. Read the
[policy template](../../templates/repository/.city/policies/development-applications.md)
as a baseline, but apply the repository's adopted revision and scoped refinements.
Use the [CLI contract and examples](../../docs/development-applications.md).
This skill supplies a professional method, not tool access or authority.

## Chief Planner: screening

1. Start from the resident's need, outcome and observations, not an expectation
   that the resident will design the solution.
2. Investigate source, project facts, interfaces, ownership and available evidence.
   Material changes include new projects/substantial capabilities, material
   architecture/ownership changes, public interfaces, migrations, and significant
   security, operational, cost or cross-project effects. Ordinary new features
   are not automatically formal. Routine documents/tests/contained repairs normally
   stay lightweight unless material impacts exist.
3. Apply and cite the baseline and every applicable adopted local refinement.
   A citation records policy path, section/interpretation and exact project IDs
   (`[]` means repository-wide). Local rules cannot silently waive the baseline.
4. Unknown jurisdiction, project, threshold or disputed interpretation means
   `needs-clarification` with concrete resident questions. Ask for choices/intent
   or unavailable facts, not city-performable technical research. Do not guess or
   force a heavyweight application because information is missing.
5. Record `lightweight`, `formal` or `needs-clarification`, reasons and evidence
   with `screen-development`. Formal requirements must be individually justified,
   bounded and proportionate; a master plan/full impact matrix is not universal.
   Route formal cases automatically to Development Advisor through City Manager.

## Development Advisor: preparation

1. Collaborate with the resident to define the proposal and prepare only relevant
   drawings/diagrams, specifications, project facts and technical studies/evidence.
2. Request engineering or specialist investigation through City Manager. Read/search
   available technical evidence yourself; ask residents only what they can supply.
3. Account for each requirement using provided evidence or explained not-applicable.
   Missing studies/answers block readiness. Static analysis is not an executed
   study; never claim an unperformed test or use non-applicability to hide a gap.
4. Prepare `application-record` against the exact current screening revision.
   A partial packet is a draft, not ready. Preserve earlier revisions.

## Chief Planner: independent assessment

Check the current Advisor packet against each scoped requirement and resident
answer. Independently record `assess-application` for its exact revision, with
`ready` or `revise`, reasons and evidence. Never assess an application you prepared.
A ready assessment only enables Council/resident consideration, not delivery.

## Persistence, handoffs and limits

Read/search/edit offices send draft commands through City Manager to Records
Officer, which previews and applies the scoped packaged CLI mutations. Never
hand-edit canonical JSON. Manager resumes `status.workOrders.development` next
actions automatically only when `actionable: true`; no second request for Advisor
assistance is needed. Ready packets before `awaiting-approval` point to Manager
to arrange ordinary permitted lifecycle progression, rechecking after each step.
Only `awaiting-approval` hands off the actual Council decision. Never skip stages
or auto-reopen a case. Current authorized delivery (including blocked delivery),
closed cases and disabled policy have `actionable: false`, `next: null`; retain
their diagnostic stages and records without dispatching preparation.
Adopted development policy enables readiness gates; older policy sets stay valid.
Explicit draft preparation remains permitted but does not adopt policy or appoint
the Advisor. Scope, policy,
re-triage, reopening, return-to-proposed and re-screening invalidate obsolete
preparation for the next authorization. Normal triaged-to-proposed does not.

No assistance, application, study, skill or ready assessment grants production
implementation, installation, paid work, permissions or delivery authority.
Council/resident decisions, independent inspection and final acceptance remain
required, including on the lightweight route. Provenance is unauthenticated.
