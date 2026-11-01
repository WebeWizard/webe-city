---
name: city-case-management
description: "Use when opening, clarifying, routing, tracking, linking, reopening, or communicating a resident petition or municipal repository service case."
user-invocable: false
---

# Case Management

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

## Structured result and evidence

Return `root`, `case_id_or_draft`, `title`, `resident_need`, `criteria`,
`observations_with_sources`, `related_cases`, `proposed_route`, `intake_state`,
`missing_information`, and `next_resident_action`.
Mark whether persistence occurred and cite the actual CLI result if it did.

## Escalation and limits

- Lifecycle: `received`, `triaged`, `proposed`, `awaiting-approval`, `authorized`,
  `in-progress`, `inspection`, `awaiting-merge`, `completed`, `blocked`, `rejected`,
  `withdrawn`, `reopened`. Intake moves an order no further than `awaiting-approval`.
- Mutators default to dry-run; applying requires actual resident confirmation,
  not merely a local approval file. `--apply` is not authentication.
- Escalate disputed decisions through `city-appeal`; no Ombudsperson is installed.
  Skills grant no powers; decisions are recorded, not authenticated.
