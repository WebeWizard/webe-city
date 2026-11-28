---
name: city-building-permits
description: "Apply the adopted repository permit policy: classify risk, assemble qualified statements, record permit terms, check lapse, prepare completion notices, and preserve independent inspection and resident acceptance."
user-invocable: false
---

# Building permits

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

Use this procedure only when `.city/policies/building-permits.md` is adopted.
Initialization and a dry-run do not adopt the policy or authorize delivery.

## Screening and plan checking

- Read the current work order, project scope, adopted development and permit
  policies, and the exact affected interfaces.
- The Chief Planner records separate `safetyClass` and `structuralClass` values
  from 1 to 4, rationale, and evidence in `screen-development`'s `permit` field.
- Lightweight is limited to classes 1 and 2. Security impacts are at least
  safety class 2; architecture, ownership-boundary, public-interface,
  data-migration, and cross-project impacts are at least structural class 2.
- Formal cases use the Development Advisor and independent Chief Planner
  assessment. The class declaration does not replace required studies.
- If classification or affected scope is uncertain, ask a focused resident
  question. Do not guess a low class to avoid review.

## Professional statements

- For each class-3 or class-4 dimension, the Engineering Manager arranges an
  active engineer with an exact competency in the filled requisition:
  `permit-safety-class-N` or `permit-structural-class-N`.
- Record the scoped evidence with `permit-statement`. A staff title alone is not
  evidence of competency.
- Correct an erroneous statement only by a new `permit-statement` with
  `supersedes` (the current revision) and a `correctionReason`; never edit the
  record. Link the filed document with `evidenceArtifactId` when it exists.
- For class-3 work, assess delivery staffing separately from statement
  preparation. Assign an active specialist when implementation duties require
  defined expertise; otherwise, ordinary work may use the general engineer.
  Statement competency alone does not establish delivery fit, and a
  read/search-only specialist hired for pre-authorization safety preparation
  cannot implement the work. If required delivery expertise is not active,
  requisition a delivery-capable specialist under the adopted workforce policy.
- Class 4 also requires a `permit-verification` from another active qualified
  engineer. The statement author and assigned delivery engineer cannot verify
  the statement.
- These are unauthenticated local competency declarations, not professional
  licences. If no suitable staff member exists, pause and refer the staffing
  decision; do not lower the risk class.

## Permit decision and delivery

- Council authorizes classes 1–3 under adopted delegation. Class 4 is decided by
  the resident. No engineer, advisor, inspector, or auditor grants a permit.
- `authorize --permit` records conditions and affected-project right-of-way
  consent. Verify each condition is specific and testable; cite evidence for
  every external project consent.
- `status.permits` reports permit state. The runtime checks the 30-day
  commencement and inactivity limits when status or a lifecycle transition is
  requested; there is no background scheduler. The same authorized decider may
  extend a permit up to twice, for up to 30 days per extension; class 4 is
  resident-reserved. If it cannot be extended, fresh screening and authorization
  are required before work resumes.
- Before transition to `inspection`, the Engineering Manager records a
  `completion-notice` for the current permit, addressing every condition.
- The Building Inspector independently checks delivered work and may return
  failed work to `in-progress`. The resident alone accepts with `complete`.

## Limits

- Do not call these controls Danish legal permits, certified-professional
  licences, physical inspections, authenticated identity, or a filesystem
  security boundary.
- This release does not automate neighbour consultation, dispensation
  registers, retroactive legalization, or remediation orders. Preserve concerns
  in the records process and refer them to the resident.
- Commands are previews by default; only the Records Officer or authorized
  decision office performs its assigned write after reviewing the exact
  preview. A record with `authenticated: false` is not verified consent.
