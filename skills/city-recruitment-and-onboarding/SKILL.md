---
name: city-recruitment-and-onboarding
description: "Use when reviewing a staffing requisition on merit, preparing a hiring packet, onboarding a newly hired specialist engineer, or retiring staff with an offboarding handover in Repository City."
user-invocable: false
---

# Recruitment and Onboarding

## Competency and application

Merit-based civil services separate the manager who needs a post from the
personnel function that tests the request and conducts the hire. Public service
commissions review whether a post is justified, whether the job description and
competency framework are sound, and whether the appointment respects fairness,
least privilege, and conflict-of-interest rules. Onboarding gives a new officer a
clear mandate, standards, and tools; offboarding preserves continuity through a
recorded handover. Apply these practices to specialist engineers in Repository City.

## Triggers and inputs

- Use when a requisition is `requested`, an appointment is `approved`, a new
  engineer needs onboarding, or a post should be retired.
- Require root, requisition or staff ID, the linked work order, `status.workforce`,
  the adopted `policies/workforce-delegation.md` and `resources-and-workforce.md`.

## Procedure

1. **Eligibility screen.** Confirm the requisition links an existing open work
   order, its staff ID is new (retired IDs cannot be reused), and governance is
   adopted with the workforce delegation policy.
2. **Merit review.** Test each criterion and record a finding:
   - need: a specific, documented demand that the work order supports;
   - no existing specialist fit: no active engineer has the required
     technology or domain expertise. General capability alone does not count
     as a fit when the work order requires specialist expertise (for example,
     React expertise to build a React website); ordinary work without a defined
     specialty should use `municipal-software-engineer`;
   - job description: duties bounded, competencies observable, standards real;
   - least privilege: only the tools the duties require; never `agent`;
   - checks: existing project commands as argument arrays; review their side
     effects. No shell is used, but the runner is not a sandbox and commands
     can still execute code, access the network, install, or modify files;
   - separation of duties: the post cannot authorize, inspect, merge, or accept.
3. **Endorse or decline.** Endorse only when every criterion passes. Decline with
   the failing criteria so the manager can file a corrected requisition.
4. **Hiring packet.** After the manager's `approved` appointment, preview `hire`
   and review each generated file in full. The packet lists the agent file, the
   skill with `references/practice.md`, `scripts/run-checks.mjs`,
   `scripts/checks.json`, the staff record, the tools granted, and any MCP
   proposals the resident may choose to install manually. Apply only the
   reviewed preview.
5. **Onboarding.** Report the new `agentName`, skill name, toolkit command
   (`node .github/skills/city-engineering-<id>/scripts/run-checks.mjs --root ABS`),
   and that the fixed governance section overrides the specialty text. Hand the
   staff ID to the Engineering Manager for assignment; do not assign it yourself.
6. **Integrity.** Generated files are recorded with SHA-256 digests. Hand edits
   or missing files appear as drift in `status`/`validate`; drift is reported,
   not enforced. Report it to the manager and resident; do not repair it by hand.
7. **Offboarding.** Retire a post that is obsolete, idle, or no longer trusted.
   The handover lists open assignments, in-flight branches, pending findings,
   successor, and records. Retired staff cannot be assigned. Generated files are
   kept; deleting them is the resident's decision.

## Structured result and evidence

Return a personnel record: requisition or staff ID; criterion-by-criterion findings
with evidence; outcome applied or previewed; hiring packet or handover; drift
observed; refusals unchanged; and the next actor from the CLI `next` hint.

## Escalation and limits

- HR reviews, hires, and retires; it never assigns work or approves appointments.
  The Engineering Manager appoints under the resident's delegation; the resident
  decides other appointments and reserved matters (governance, security,
  deletion, deployment, publication, expenditure).
- Fixed limits no approval changes: generated engineers have tools from `read`,
  `search`, `edit`, `execute` only, `agents: []`, and fixed governance text. MCP
  servers are proposed, never installed. Hire never overwrites an existing file.
  The check runner uses `shell: false` but is not a sandbox; review each command
  and its possible side effects.
- Records carry `authenticated: false`. Separation of duties is by instruction.
- This skill grants no tools, appointments, or authority.
