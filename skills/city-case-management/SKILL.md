---
name: city-case-management
description: "Use when opening, clarifying, routing, tracking, linking, reopening, or communicating a resident petition or municipal repository service case."
user-invocable: false
---

# Case Management

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

Capture the resident's need/outcome/observations, not an engineered application.
Route [development screening](../city-development-applications/SKILL.md) to
an available Planner directly or through Manager, with focused questions for unknown scope/thresholds. A formal
determination automatically routes to Development Advisor for proportionate
assistance, then independent Planner assessment. RSO/Advisor/Planner draft commands
go to an available Records Officer directly or through Manager; never hand-edit canonical work orders.

## Competency and application

Case management maintains continuity from first contact through a documented
disposition. For Repository City, preserve the resident's need, evidence, and
case relationships without confusing an intake record with authority to deliver.
Delivery starts only after a recorded City Council or resident authorization.

## Triggers and inputs

- Use for a new petition, duplicate request, follow-up, handoff, or lost context.
- Require explicit root, requested outcome, affected service, known observations,
  existing case IDs, and the resident's acceptable result.
- Consult relevant work orders, decisions, charter, and applicable records policy.
  Do not collect unnecessary identities, secrets, or raw customer datasets.

## Procedure

1. Restate the need in plain language. Separate observed facts, allegations,
   suggested solutions, and questions still needing the resident's answer.
2. Search bounded existing case records for related or duplicate work. Link cases;
   do not discard a distinct resident concern merely because wording overlaps.
3. Draft a title, request, and observable acceptance criteria. Exclude implementation
   details that are not essential to the outcome.
4. Identify the responsible existing office and explain the routing rationale.
   Use complaint triage if service impact or disputed conduct is involved.
5. Use [resident petition intake](../city-petition/SKILL.md) for CLI creation.
   Without execute permission, supply a draft and command; do not bypass the CLI
   by hand-editing canonical work-order JSON.
6. Distinguish a proposed transition from one actually persisted. Follow the
   runtime's current transition validation rather than assuming every pair is legal.
7. Communicate the case ID, present intake state, unresolved information, next actor,
   and what the resident should expect next. Do not promise completion dates.
8. Preserve context across handoffs and record a reason for rejection, withdrawal,
   or reopening without erasing earlier evidence.
9. For previously filed work products, use `records-list --type artifact
   --work-order WO-ID` or `--search TEXT` to find canonical IDs. Use
   `records-get --id ART-ID` for exact content and open readable content in an
   appropriate host viewer. Keep access controls in the repository's actual
   storage; do not copy restricted content into a case summary.

## Structured result and evidence

Return `root`, `case_id_or_draft`, `title`, `resident_need`, `criteria`,
`observations_with_sources`, `related_cases`, `proposed_route`, `intake_state`,
`missing_information`, `related_artifacts`, and `next_resident_action`.
Mark whether persistence occurred and cite the actual CLI result if it did.

## Escalation and limits

- Lifecycle: `received`, `triaged`, `proposed`, `awaiting-approval`, `authorized`,
  `in-progress`, `inspection`, `awaiting-merge`, `awaiting-acceptance`, `completed`, `blocked`, `rejected`,
  `withdrawn`, `reopened`. Intake moves an order no further than `awaiting-approval`.
- Mutators default to dry-run; obtain resident confirmation where the applicable
  workflow requires it. Do not seek identity proof. `--apply` is not authentication.
- Escalate disputed decisions through `city-appeal`; no Ombudsperson is installed.
  Skills grant no powers; decisions are recorded, not authenticated.
