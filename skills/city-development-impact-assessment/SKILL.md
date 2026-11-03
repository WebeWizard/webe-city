---
name: city-development-impact-assessment
description: "Use when assessing direct, indirect, cumulative, operational, accessibility, data, cost, or cross-district impacts of a repository development proposal."
user-invocable: false
---

# Development Impact Assessment

Use this method when material impacts warrant it, not automatically for every
ordinary feature. [Development screening](../city-development-applications/SKILL.md)
specifies proportionate requirements; do not require a full impact matrix for
every application. Static assessment is not an executed technical study.

## Competency and application

Municipal impact assessment examines who benefits, who bears costs, and what
mitigations a proposed development needs. In a repository, evaluate a change's
service effects and blast radius before mistaking technical feasibility for merit.

## Triggers and inputs

- Use for cross-component changes, new dependencies, migrations, public interfaces,
  changed operating costs, or disproportionate resident impacts.
- Require root, case, proposal alternatives, affected components/districts,
  acceptance criteria, known service users, and available baseline evidence.
- Consult actual interfaces, operational documentation, relevant policies,
  `.city/districts.json`, and related proposed changes.

## Procedure

1. Define the proposal and counterfactual. State what is outside the assessment.
2. Identify direct effects on behavior, interfaces, data, tests, and operations.
   Trace indirect effects through dependencies and service consumers.
3. Consider cumulative effects with other commitments: migration sequencing,
   repeated disruption, maintenance load, and shared capacity.
4. Assess distribution: who benefits, who must adapt, accessibility barriers,
   support burden, and people or components with fewer alternatives.
5. Evaluate privacy/security, compatibility, resource consumption, licensing
   questions, and recovery implications at a level supported by evidence.
6. For each material impact, identify likelihood, severity, uncertainty, mitigation,
   residual risk, and the evidence that would test the assumption.
7. Compare alternatives on the same dimensions. Include avoidance or smaller scope,
   not only mitigations for a preselected design.
8. Separate ordinary engineering judgment from specialist or resident decisions.
   Identify unavailable specialist reviews without claiming they occurred.

## Structured result and evidence

Produce an impact matrix: affected party/component, direct/indirect/cumulative
effect, source, likelihood, severity, uncertainty, mitigation, residual risk,
proposed owner, and required evidence.
Add an alternatives comparison, recovery assumptions, evidence gaps, and a
plain-language recommendation for resident consideration.

## Escalation and limits

- Escalate material unresolved impacts to Chief Planner/City Manager and residents.
  Legal, security, and accessibility concerns are not cleared by naming a role.
- Skills grant no authority to install dependencies, change budgets, amend the
  charter, approve a proposal, or reduce acceptance criteria.
- This is a pre-authorization assessment. Flag reserved matters (governance,
  security, deletion, deployment, publication, expenditure) so the City Council
  refers them to the resident. Local files and `--apply` are not authorization.
