---
name: city-interdepartmental-coordination
description: "Use when coordinating municipal departments, district interfaces, cross-team dependencies, capacity conflicts, handoffs, or bounded Repository City office assignments."
user-invocable: false
---

# Interdepartmental Coordination

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

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
engineering/specialist consultations may go directly to available peers within
existing authority; staffing and unavailable peers go through Manager.
Send draft professional/intake commands directly to an available Records Officer,
or through Manager when needed, for actual persistence.
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
   The coordinating caller reuses an available delegate for related follow-ups
   to the same office and work order when its host supports messaging. Keep
   delegate handles scoped to the current session, root, work order and office;
   never treat a handle or accepted message as a durable record or a completed
   handoff. If messaging is unavailable, dispatch normally with current evidence.
   Where background delegation is supported, the coordinating caller launches
   delegates in background mode, records actual handles and launch modes, and
   waits for results. Use synchronous dispatch if background mode is unavailable;
   the caller routes the returned handoff. Parallelize only independent work and
   serialize conflicting writes to the same canonical records.
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

## Direct peer messages

Any participating office may communicate directly with any other available peer
for the same selected root and case when the host exposes `list_agents` and
`write_agent` and adopted governance permits the particular handoff. Existing
charters and policies may require Manager routing; follow those requirements
until properly amended, without silently changing adopted documents.
The coordinator shares the actual session-local office/handle
mapping and launch mode with participants, identifies each participant's own
entry, and updates it as the team changes. A listing can include the caller
itself or stale handles; an office name or listing alone does not establish a
distinct, messageable peer or its case, identity, appointment or authority.
Never message the caller's own handle. If the recipient, its mode, or its case
is uncertain, ask the coordinator to identify or arrange the peer; do not send
case information to an unknown agent.

Send a bounded request with the root, case ID, sender and recipient offices,
purpose, relevant scope and record revisions, expected result and stopping
condition. Share only information needed for the request. Follow host visibility,
permissions and same-task restrictions. A receiving peer may reply directly
when the host supports it. A message is not a decision, authentication, authority
to act, or a filed record; do not claim delivery, completion, or persistence
without the corresponding result. Preserve material findings and handoffs through
the normal canonical records route.

If direct messaging or a peer is unavailable, return the complete request and
any author-attributed draft payload to City Manager or the coordinating caller
for routing. An explicit host rejection because the recipient is in sync mode
means that attempt was not delivered: do not retry that handle; return the
payload in the synchronous result for the caller to route and obtain the result.
If delivery is uncertain, do not resend or start duplicate work until its outcome
is known. Recheck canonical records and any active assignment before a write;
listing the caller's own task is not evidence of another writer. A directly
invoked office without an available peer or coordinating caller reports the limitation. Notify
the Manager when coordination, staffing, a required confirmation, a resident
decision, or an escalation is needed. Direct consultation does not permit an
office to launch agents, appoint staff, authorize work, or bypass independent
assessment or inspection.

## Structured result and evidence

Return a coordination ledger with columns: dependency, root/case, supplying office,
receiving office, evidence, status, next step, and escalation.
Add capacity assumptions, unresolved ownership, missing specialists, and the
number of coordination rounds used.

## Escalation and limits

- City Manager delegates through its exact configured allowlist; Engineering
  Manager delegates within its own restricted staffing remit.
  Other offices can message available peers but cannot launch agents. When a
  peer or the messaging tools are unavailable, return coordination requests to
  the caller rather than claiming a handoff happened.
- The manager may cover analysis provisionally but cannot spawn arbitrary offices,
  appoint specialists, approve spending, or fabricate specialist clearance.
- A skill cannot grant tools or make office names separate security principals.
- Route `awaiting-approval` orders to the City Council, `authorized` orders to the
  Engineering Manager for assignment, and `inspection` orders to the Inspector.
  Specialist appointments require adopted `policies/workforce-delegation.md`,
  independent HR review, and a recorded Engineering Manager decision. Local
  approval files and `--apply` do not authorize; decisions are recorded, not
  authenticated.
