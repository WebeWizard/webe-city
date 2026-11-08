---
name: city-asset-management
description: "Use when maintaining the repository's shared infrastructure asset register, service evidence, maintenance obligations, rolling renewal programme, resilience, or upgrade/security planning."
user-invocable: false
---

# Infrastructure Asset Management

Apply the adopted [infrastructure-management policy](../../templates/repository/.city/policies/infrastructure-management.md)
and distinguish recorded fact, technical assessment, proposal, authorization,
and verified outcome. If that policy is absent or not adopted, provide advice
only; do not imply it governs the city.

## Establish the evidence

Use the packaged CLI's `validate`, `status`, `records-list`, and `records-get`
commands against the explicit repository root. Read only the relevant asset,
programme, work order, adopted policies, and evidence. The CLI requires Node.js
22 or later. Do not initialize a repository, change enrollment, or invent an
asset, service target, operator, SLA, support date, budget, or approval.

For each maintained system, identify its service outcome, accountable owner,
technical custodian, actual operator and coverage, local locators, consumer
projects, dependencies, condition, criticality, baseline and support deadline,
recurring/event-driven obligations, findings, deferrals, renewal estimate, and
failure/recovery arrangements. State unknowns. Keep externally operated assets
within their actual jurisdiction.

Use `asset-register` for a new record; `asset-revise --revision N` for an
optimistic revision; and `asset-review` for dated condition, service-measurement,
obligation, or finding evidence. Commands default to dry-run. `--apply` writes
local unauthenticated records only. Use strict JSON matching the published
[asset schema](../../schemas/infrastructure-asset.schema.json) and inspect the
preview before applying.

## Plan and route work

Review obligations and measurements when due and on reliable new evidence:
failed checks, incidents, advisory reports, support deadlines, compatibility
changes, or resident reports. Status is a point-in-time evaluation, not a
monitor, scanner, fetcher, notification service, or scheduler. Assess false
positives, applicability, severity, affected baseline, service consequences,
capacity, dependencies, rollback, and recovery; an upgrade is not justified by
version novelty alone.

Keep a rolling programme with an explicit horizon and review date, current asset
revisions, sequenced alternatives and work, resource estimates, authority status,
and unfunded needs. Use `infrastructure-programme-record` with the published
[programme schema](../../schemas/infrastructure-programme.schema.json). A plan
or estimate never appropriates funds or authorizes delivery.

Submit a bounded petition with `--infrastructure` JSON containing the asset IDs,
exact repository-relative targets, and any due obligation/open finding
references. Add `--project` for registered consumer projects when relevant.
Never use an asset locator as permission to edit every descendant: name every
target. The CLI pins the current asset revisions and refuses unsafe paths.

Follow ordinary screening, policy adoption, authorization, assignment, delivery,
independent inspection, and resident acceptance. Reconfirm current asset scope
before authorization and while progressing delivery. Any linked security finding
requires explicit resident-reserved authority; Council must refer it. Neither
urgency, a maintenance schedule, a programme entry, nor a test result bypasses
the decision or inspection sequence.

Only after accepted completion may a linked obligation be recorded as completed
or an applicable finding as resolved. Preserve due dates, recurrence, failure,
deferral, risk owner, authority reference, and next review. Do not claim ongoing
service health from a completed change; update a measurement only with new dated
evidence. Record affected-user input and actual communications for material
disruption, distinguishing consultation from approval and proposed notices from
sent notices.

## Boundaries

Do not run scanners, contact operators, obtain remote advisory data, make edits,
create branches, send notices, merge, or deploy unless a separate tool and
authorization explicitly provide for that action. Do not claim continuous
coverage, external verification, or action while the plugin is inactive. Escalate
security, expenditure, deletion/retirement, external ownership, unsafe recovery,
or insufficient capacity to the proper resident or accountable human.
