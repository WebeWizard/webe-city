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
When zoning is adopted, also read the current map and use its current work-order
zoning check; see the [zoning adaptation](../../docs/zoning.md). Use the
[CLI contract and examples](../../docs/development-applications.md).
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
   For a conditional zoning finding, use the formal route and include each named
   zoning requirement in the application. Unknown or prohibited findings are not
   a lightweight exemption.
4. Unknown jurisdiction, project, threshold or disputed interpretation means
   `needs-clarification` with concrete resident questions. Ask for choices/intent
   or unavailable facts, not city-performable technical research. Do not guess or
   force a heavyweight application because information is missing.
5. Record `lightweight`, `formal` or `needs-clarification`, reasons and evidence
   with `screen-development`. Formal requirements must be individually justified,
   bounded and proportionate; a master plan/full impact matrix is not universal.
   Route formal cases automatically to Development Advisor through City Manager.

## Development Advisor: preparation

1. Read the current screening, adopted scoped policies, work order and acceptance
   criteria, source and available evidence. For a revision, also read the prior
   application, independent findings, resident decisions and current statements.
   Distinguish current records from superseded screening-specific evidence.
2. Collaborate with the resident to define the proposal, a meaningful alternative
   and no change, with tradeoffs. Describe the affected components and boundaries,
   interfaces and data flows, behavior and failure paths, dependencies, operations,
   implementation sequencing, observable acceptance criteria, verification and
   recovery as relevant to the request. Identify assumptions and unresolved design
   choices rather than presenting them as established facts. Provide proportionate
   diagrams, specifications, project facts and studies where required.
3. Build a requirement-by-requirement working matrix: exact screening requirement
   and reason, concrete evidence and location, what it establishes and its limits,
   disposition, remaining gap and next owner/action. Cross-reference each prior
   Planner finding to the new evidence or an explicit unresolved gap. Reuse recorded
   resident choices with their source; ask again only when a distinct decision or
   changed context requires it. Do not present an unchanged gap as resolved.
4. For significant safety, structural, privacy, operational or capacity impacts,
   develop a proportionate planning-level assessment: affected assets and people,
   threat or failure scenarios, proposed controls, residual risks, assumptions and
   evidence needed. Describe the intended network/exposure, identity, data lifecycle,
   operating environment and capacity only when relevant; do not invent facts.
   Distinguish resident intent, source observations, reported facts and unknowns.
   State observation scope and avoid claiming global absence from a limited search.
   Identify which work can be done now by read/search or authorized specialist
   assistance and which empirical checks must await separately authorized delivery.
   An unverified goal is not a measured result.
5. When the permit policy is adopted and a dimension is class 3 or 4, identify
   the matching current-screening qualified statement and, for class 4, independent
   verification. Request outstanding specialist work through City Manager, including
   scope, evidence, exact screening revision, limits and stopping conditions. A
   qualified statement is separate from application studies and independent Planner
   assessment; an undetermined conclusion is not itself a clearance failure or
   proof of safety. Address its substantive unresolved risks against applicable
   requirements. Do not invent a policy requirement for a safe conclusion.
6. Request other engineering or specialist investigation through City Manager.
   Investigate available facts yourself. For each blocker, consider whether the
   resident could readily contribute a fact or access context, clarify priorities,
   or choose an alternative that materially helps, even when city investigation
   could also continue. Explain the gap, practical options and tradeoffs, including
   retaining the original goal where feasible; ask one focused question at a time.
   Distinguish optional help from a required decision and say what can proceed
   without an answer. Do not assume consent, clearance or changed scope from
   silence, or ask residents to perform city technical research. Separate genuinely
   needed pre-authorization evidence from proposed post-authorization implementation
   and tests. Do not demand unauthorized production work to complete a planning packet.
7. Account for each requirement using provided evidence or explained not-applicable.
   Missing studies/answers block readiness. Static analysis is not an executed
   study; never claim an unperformed test or use non-applicability to hide a gap.
   Prepare `application-record` against the exact current screening revision.
   A partial packet is a draft, not ready. Preserve earlier revisions and hand off
   precise blockers rather than cycling an unchanged incomplete packet.
   Directly ask the resident when in conversation; when delegated, return the
   exact question and its context to the coordinating caller for resident contact.

## Chief Planner: independent assessment

Check the current Advisor packet against each scoped requirement and resident
answer. Independently record `assess-application` for its exact revision, with
`ready` or `revise`, reasons and evidence. Cite the applicable requirement and
specific deficiency for each revision finding; distinguish a missing study from
an unperformed future delivery test. A class-3 statement with an undetermined
conclusion is not, by itself, a missing safety clearance. Assess its disclosed
risks against the actual adopted requirements. Never assess an application you prepared.
A ready assessment only enables Council/resident consideration, not delivery.

## Persistence, handoffs and limits

Read/search/edit offices send draft commands through City Manager to Records
Officer, which previews and applies the scoped packaged CLI mutations. Never
hand-edit canonical JSON. Manager resumes `status.workOrders.development` next
actions automatically only when `actionable: true`; after persistence, obtain
fresh status and actually dispatch the next office in the same run. In particular,
route a persisted Advisor application and its actual revision to Chief Planner,
then persist the independent assessment and recheck status. A reported next step
is not a completed handoff. No second resident prompt is needed for city
coordination, but required resident decisions and confirmations remain required.
If there is no coordinating caller or a necessary tool/office is unavailable,
report that limitation and the last confirmed state instead of claiming a handoff.
Ready packets before `awaiting-approval` point to Manager
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
