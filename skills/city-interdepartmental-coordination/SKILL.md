---
name: city-interdepartmental-coordination
description: "Use when coordinating municipal departments, district interfaces, cross-team dependencies, capacity conflicts, handoffs, or bounded Repository City office assignments."
user-invocable: false
---

# Interdepartmental Coordination

For adopted [development applications](../city-development-applications/SKILL.md),
automatically route only `actionable: true` entries in
`status.workOrders.development`, following `next`: Planner
screening, concrete resident clarifications, Development Advisor preparation,
independent Planner assessment, then ordinary permitted lifecycle progression
through Manager and Council's actual decision only at `awaiting-approval`.
Recheck status after each transition; never skip stages or auto-reopen cases.
Current authorized delivery (including blocked delivery), closed cases and
disabled policy have no automatic preparation action (`next: null`).
Formal screening is the
assignment trigger; do not ask residents to request assistance again. Advisor
engineering/specialist requests go through Manager within existing authority.
Send draft professional/intake commands to Records Officer for actual persistence.
After each returned result, the coordinating caller routes needed persistence,
obtains fresh status, and dispatches the next actionable office in the same run.
For a persisted Advisor application, pass its actual revision and evidence to
Chief Planner, then persist the assessment and recheck status. A next-actor
message alone is not a handoff. Do not ask the resident to prompt another office
when the coordinator can dispatch it. Stop for a real decision or confirmation,
referral, unavailable office/tool, invalid state, failure, or lack of progress;
report the blocker and last confirmed state. Never invent an approval or treat
a preview as a saved record.
For a material blocker, relay a focused Advisor question when resident knowledge,
access context, priorities or a scope choice could help, even if optional. Explain
the tradeoffs and work that can proceed independently; do not characterize
optional input as mandatory, assume consent or changed scope, or ask residents
to perform city research. Ask in the current interaction when possible; if contact
is unavailable, report the question and limitation without claiming consultation.

## Competency and application

Municipal coordination reconciles departmental responsibilities without erasing
accountability. Apply it to component ownership, review dependencies, and resident
decisions across a repository's explicitly declared districts.

## Triggers and inputs

- Use when a case crosses districts, needs several offices, or stalls at a handoff.
- Require root, case, desired outcome, declared district ownership, known interface
  contracts, current commitments, and the participating offices' actual capabilities.
- Read relevant `.city/districts.json`, charter, policies, and case history.

## Procedure

1. Identify the minimum offices needed. Distinguish the coordinator, proposal author,
   inspector, record keeper, and resident decision-maker.
2. Build a dependency map: prerequisite, supplying office, receiving office,
   expected evidence, and condition for proceeding.
3. Specify each handoff's root, case, scope, inputs, output, and stopping condition.
   Do not send an entire repository where a bounded question suffices.
4. Check interface responsibilities and capacity assumptions with available evidence.
   Record uncertainty; do not make silent ownership transfers.
5. Separate a technical disagreement from an authority or resident-priority dispute.
   Offer a small set of explicit options rather than endless agent discussion.
6. Reconcile at most two rounds per unresolved dependency; sequential successful
   handoffs are not rounds of the same dispute. Then return the blocker and
   consequences, requesting a resident decision only when actually needed.
7. Preserve inspector/auditor findings and dissent. A coordination summary must not
   convert a blocked review into a pass.
8. For authorized engineering work, route through the Engineering Manager. It
   first assigns an active engineer; only a genuine competency gap goes through
   requisition, independent Human Resources review, Engineering Manager
   appointment, HR hire, and then assignment. Do not skip a handoff or invoke
   an unlisted specialist directly.
9. Give the Clerk the resulting decision proposal and the Records Officer the
   evidence references that need stewardship.

## Structured result and evidence

Return a coordination ledger with columns: dependency, root/case, supplying office,
receiving office, evidence, status, next step, and escalation.
Add capacity assumptions, unresolved ownership, missing specialists, and the
number of coordination rounds used.

## Escalation and limits

- City Manager delegates through its exact configured allowlist; Engineering
  Manager delegates within its own restricted staffing remit.
  Other offices return coordination requests instead of delegating themselves.
  A directly invoked office without a coordinating caller cannot dispatch a
  handoff; report that limitation rather than claiming it happened.
- The manager may cover analysis provisionally but cannot spawn arbitrary offices,
  appoint specialists, approve spending, or fabricate specialist clearance.
- A skill cannot grant tools or make office names separate security principals.
- Route `awaiting-approval` orders to the City Council, `authorized` orders to the
  Engineering Manager for assignment, and `inspection` orders to the Inspector.
  Specialist appointments require adopted `policies/workforce-delegation.md`,
  independent HR review, and a recorded Engineering Manager decision. Local
  approval files and `--apply` do not authorize; decisions are recorded, not
  authenticated.
