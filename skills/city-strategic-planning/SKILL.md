---
name: city-strategic-planning
description: "Use when setting municipal service priorities, resident outcomes, strategic objectives, capacity limits, programme options, or a Repository City planning horizon."
user-invocable: false
---

# Strategic Planning

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

## Competency and application

Municipal strategic planning connects public needs, scarce resources, and measurable
outcomes over a defined horizon. In a repository, prioritize service improvements
and maintenance without treating a task list as a resident-approved programme.

## Triggers and inputs

- Use for competing requests, an overloaded work programme, or changed resident goals.
- Require the explicit repository root, resident priorities, relevant cases, known
  service problems, existing commitments, and available effort/capacity evidence.
- Consult `.city/charter.md`, `.city/config.json`, declared districts, and relevant
  policies/decisions. Label draft or unverified mandates accordingly.

## Procedure

1. Define the planning horizon and service population. Restate the resident outcome
   separately from any proposed technical solution.
2. Establish the baseline from observed incidents, maintenance burden, or service
   evidence. Do not invent utilization, cost, or satisfaction measurements.
3. Identify constraints: ownership, skills, time, dependency risk, accessibility,
   operating cost, and missing specialist judgment.
4. Compare a small number of options, including maintenance/no change. State who
   benefits, who bears disruption, and what work would be displaced.
5. Propose transparent prioritization factors such as resident impact, urgency,
   maintainability, and reversibility. Do not invent approved weights or budgets.
6. Map each proposed objective to an observable outcome, a baseline if available,
   an evidence source, a review point, and a named existing office.
7. Check capacity against commitments. Return tradeoffs to the resident rather
   than silently reducing scope or expanding resources.
8. Prepare a bounded programme proposal with dependencies and stop conditions.

## Structured result and evidence

Return a strategic brief with `horizon`, `resident_outcomes`, `baseline_evidence`,
`constraints`, `options`, `priority_rationale`, `capacity_assumptions`,
`proposed_measures`, `dependencies`, and `resident_decisions_needed`.
For every measurement, identify its source or mark it unknown.

## Escalation and limits

- City Manager coordinates; City Clerk records resident deliberation.
  Charter changes, appointments, and budget changes require a resident decision.
- At most two unresolved coordination rounds, then report a blocked choice.
  Missing specialists remain an explicit gap, not an invented clearance.
- Skills grant no permissions. Local records and CLI write confirmation are not
  authenticated authority. Delivery needs a recorded City Council or resident
  authorization; strategic priorities do not authorize work.
