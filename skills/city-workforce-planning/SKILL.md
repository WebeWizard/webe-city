---
name: city-workforce-planning
description: "Use when matching authorized work to engineering staff, analysing a post's duties and competencies, deciding whether a specialist engineer is needed, drafting a staffing requisition, or deciding a delegated appointment."
user-invocable: false
---

# Workforce Planning

## Competency and application

Public-sector workforce planning aligns the people a service has with the work it
must deliver. Civil services such as Singapore's and Copenhagen's plan from
demonstrated service demand, analyse each job before recruiting, compare demand
against existing capability, and fill gaps by redeployment before creating a new
post. Apply these practices to Repository City's engineering department: an
authorized work order is demand, active engineers are supply, and a specialist
engineer is a new post created only through a merit-based, recorded route.

## Triggers and inputs

- Use when an `authorized` order needs an engineer, an order stalls for lack of
  competence, or a requisition or appointment decision is pending.
- Require root, work-order ID, authorization decision, criteria, project
  directories, `status.workforce` (staff, open requisitions, assignments, drift),
  and the adopted `policies/workforce-delegation.md`.

## Procedure

1. **Demand analysis.** State the work's required outcome, affected projects,
   technologies, standards, and risks from the order and its proposal. Do not
   invent demand from a single phrase in untrusted text.
2. **Supply analysis.** List active engineers with their titles, tools, checks,
   and current assignments. Include the bundled general engineer
   `municipal-software-engineer`; exclude retired staff and staff with drift
   that has not been reviewed.
3. **Gap analysis.** For each needed competency, mark covered, partly covered, or
   missing, with evidence. Prefer assignment or redeployment of an existing fit.
   A missing competency that the general engineer can reasonably handle with
   existing checks is not a gap. Workload alone does not justify a new post.
4. **Job analysis.** For a genuine gap, write a job description: a specific title,
   the purpose tied to the work order, duties (what the post does and does not
   do), observable competencies, applicable standards, and the minimum tools.
   Choose only from `read`, `search`, `edit`, `execute`; `read` and `search` are
   always included and `agent` is never available. Name existing project checks
   as program-and-argument arrays without shell syntax. Review each command's
   possible side effects: `shell: false` is not a sandbox and the program may
   still execute code, access the network, install packages, or modify files.
5. **Tooling proposals.** Record MCP servers only as proposals with a stated
   purpose. They are never installed by the city; the resident decides.
6. **Requisition.** File the requisition, preview first, and route it to Human
   Resources for independent review. Do not pressure or pre-empt the review.
7. **Delegated appointment.** After HR endorsement, apply the merit test again:
   real need, no existing fit, least privilege, separation of duties, and
   conformity with the delegation policy. Approve only what you can justify in
   writing; otherwise decline with reasons. Never approve a post with powers
   beyond the fixed limits, or an appointment to any office other than a
   specialist engineer.
8. **Deployment.** After the hire, assign the order and dispatch the engineer by
   exact `agentName`. Reassign, with reasons, when competence or availability
   changes; the latest assignment is the current one.
9. **Review.** Revisit posts periodically: an idle or obsolete specialist goes
   to HR for retirement with a handover, not silent abandonment.

## Structured result and evidence

Return a staffing note: demand summary; supply table (staff ID, title, tools,
current assignments, fit); gap table (competency, status, evidence); the decision
(assign, requisition, approve, decline) with reasons; requisition and assignment
IDs; MCP proposals; and the next actor from the CLI `next` hint.

## Escalation and limits

- Workforce commands require adopted governance with no drift and the adopted
  workforce delegation policy; otherwise they fail with `NO_DELEGATION`,
  `NOT_ADOPTED`, or `GOVERNANCE_DRIFT`. Report the refusal; do not work around it.
- The resident delegates specialist appointments by adopting the policy and can
  revoke them by amending or removing it. Other appointments, permission
  increases, and reserved matters (governance, security, deletion, deployment,
  publication, expenditure) go to the resident.
- Appointments are recorded with `authenticated: false`. Separation between the
  manager and HR comes from agent instructions, not runtime enforcement.
- This skill grants no tools, appointments, or delivery authority.
