---
name: city-master-planning
description: "Use when developing a municipal architectural master plan, repository component map, district boundary proposal, long-term evolution path, or technical land-use equivalent."
user-invocable: false
---

# Master Planning

This substantial/long-term planning method is conditional, not a prerequisite for
every request or ordinary feature. Apply proportionately after
[development screening](../city-development-applications/SKILL.md); an assisted
formal application requires a master plan only when specifically justified.

## Competency and application

Municipal master planning coordinates long-term development, existing assets, and
service capacity. For software, map architecture and future change corridors;
do not force code into physical-city metaphors or treat the map as approval.

## Triggers and inputs

- Use for substantial structural change, boundary ambiguity, or conflicting designs.
- Require root, resident outcomes, current architecture, declared projects and
  districts, technical constraints, existing proposals, and maintenance concerns.
- Read `.city/projects.json`, `.city/districts.json`, relevant policies, source
  interfaces, dependency manifests, and test locations. Distinguish project
  directories from district ownership and declared design from actual structure.

## Procedure

1. Establish the current-state component inventory and its evidence. Mark unknown
   ownership, hidden dependencies, and outdated diagrams.
2. Identify service boundaries, data ownership, external interfaces, build/runtime
   dependencies, and operational responsibilities.
3. Describe pressures on the existing design: reliability, change frequency,
   accessibility, security, cost, compatibility, and maintainability.
4. Compare a minimal evolution path, a credible alternative, and no structural change.
   Avoid a new service or framework when a smaller seam addresses the outcome.
5. Propose target project directories and interface rules with explicit tradeoffs.
   Project directories must be disjoint; cross-check district ownership, which is
   separate, and do not rewrite either register as a side effect of planning.
   When zoning is adopted, assess the separate `.city/zoning.json` path map.
   Propose zoning amendments separately from project scope and district ownership;
   a master plan or map recommendation does not amend the adopted map.
6. Break the proposal into reversible increments, each with a dependency,
   observable acceptance evidence, migration concern, and recovery assumption.
7. Identify standards that are recommendations versus established requirements.
   Flag missing specialist judgments rather than supplying fictitious clearance.
8. Submit the master-plan proposal and any requested ownership/policy changes
   separately for resident consideration.

## Persistent work products

Use [records capture](../city-records-capture/SKILL.md) for the full master-plan
proposal and any separately requested ownership or policy proposal. Mark it
`proposed-instrument`; filing does not adopt it. Return the actual artifact
ID/path or a complete pending filing request.

## Structured result and evidence

Return current-state evidence, component/interface map, known drift, alternatives,
proposed target structure, district impacts, incremental roadmap, test strategy,
migration/recovery assumptions, and unresolved resident decisions.
If drafting an architecture decision record, label its status proposed and link
the case and evidence; do not claim adoption.

## Escalation and limits

- Chief Planner owns analysis; City Manager coordinates cross-office issues.
  Charter, appointments, ownership authority, and budget changes require residents.
- Skills grant no tools. No installs, application changes, or migrations are
  authorized by a master plan or a local decision file.
- A master plan goes to the City Council for an authorization decision; reserved
  matters go to the resident. Decisions are recorded, not authenticated.
