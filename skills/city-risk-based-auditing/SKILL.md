---
name: city-risk-based-auditing
description: "Use when scoping an independent municipal audit, prioritizing material risks, sampling cases, assessing control design and operation, or reporting procedural findings."
user-invocable: false
---

# Risk-Based Auditing

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

## Competency and application

Municipal risk-based auditing directs limited assurance effort toward material
exposure while preserving independence. For Repository City, assess claimed
authority, scope, records, and controls rather than merely counting completed forms.

## Triggers and inputs

- Use for a resident assurance question, suspected process gap, or focused case audit.
- Require root, audit question, relevant cases/revisions, criteria, known risks,
  available evidence, and the proposed sample.
- Read applicable charter/policies and their actual status. A draft control is not
  an adopted rule, and a written rule is not proof of enforcement.

## Procedure

1. State the audit objective, boundaries, period/revisions, and independence conflicts.
2. Identify material risks: self-approval, unauthorized scope, missing resident
   decisions, suppressed findings, record loss, privacy exposure, or false assurance.
3. Assess inherent impact/likelihood with explicit uncertainty. Do not invent
   quantitative scores or resident-approved risk tolerances.
4. Select a bounded sample with a rationale. Include exceptions and high-risk cases;
   disclose that a risk-directed sample is not statistically representative.
5. Trace each sampled case through request, proposal, reported decision, inspection,
   and records. Identify missing links without assuming misconduct.
6. Distinguish control design, actual implementation, and operating evidence.
   A passing hook or CI check alone cannot authenticate resident authorization.
7. Evaluate residual risk using the evidence-evaluation method. Separate a factual
   nonconformity, insufficient evidence, and an improvement recommendation.
8. Report directly to the resident and supply findings to City Clerk for recording.
   Do not let delivery management suppress or approve the audit conclusion.

## Persistent audit reports

Use [records capture](../city-records-capture/SKILL.md) for complete audit
reports, findings, evidence and limitations. Preserve adverse findings without
filtering. Read-only auditors submit a filing request directly to an available
Records Officer or through City Manager;
filing must not depend on the delivery chain's approval.

## Structured result and evidence

Return objective/scope, criteria sources, risks, sample and exclusions, procedures,
control design/implementation/operation observations, findings, and limitations.
Each finding has ID, severity/rationale, criterion, condition, evidence, consequence,
confidence, recommendation, and proposed responsible office.

## Escalation and limits

- City Auditor has read/search only: no execution, editing, fixes, or delegation.
  This skill does not grant those tools or establish a separate security principal.
- Seek missing evidence rather than certifying an unsupported claim.
  Conflicts or disputed authority are reported to the resident, not silently resolved.
- Decisions are recorded with `authenticated: false`, and separation of duties
  rests on agent definitions, not runtime enforcement. Disclose that assurance
  limit even if a narrow audit finds no exceptions.
