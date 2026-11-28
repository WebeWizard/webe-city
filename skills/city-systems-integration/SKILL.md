---
name: city-systems-integration
description: "Use when assessing municipal system interfaces, API contracts, data mappings, integration failures, compatibility, migration sequencing, or cross-component test proposals."
user-invocable: false
---

# Systems Integration

## Plugin loading and recovery

Before resolving plugin resources, follow [plugin loading and recovery](../../docs/plugin-loading.md).
Discover the exact installed path and host-listed activation identifier; resolve
links from the containing installed file, not the target repository or cwd.
Carry verified plugin/version, canonical records checkout and limits through
handoffs. Correct an observed path or syntax error once within existing tools
and authority; never repeat unchanged failures or bypass real blockers.

## Competency and application

Municipal integration joins services while preserving reliable operations and
clear ownership. In a repository, examine contracts and failure behavior rather
than assuming two components integrate because each passes its own tests.

## Triggers and inputs

- Use for interface changes, shared data, external services, dependency upgrades,
  events, migrations, or failures crossing a component boundary.
- Require root, case, resident outcome, producer/consumer interfaces, versions,
  data classification, existing integration tests, and operational constraints.
- Read declared districts and relevant policies; do not access external systems
  or credentials merely because a repository mentions them.

## Procedure

1. Inventory producers, consumers, owners, protocols, contract versions, and trust
   boundaries. Mark undocumented interfaces and ownership gaps.
2. Trace the resident operation through request/event flow and data transformation.
   Identify source-of-truth, validation, identity, and error semantics.
3. Assess compatibility: additive versus breaking changes, old/new coexistence,
   optional fields, version skew, and migration ordering.
4. Examine failure modes: timeouts, partial writes, retries, duplicate delivery,
   ordering, idempotency, rate limits, and recovery after interruption.
5. Propose contract, integration, and end-to-end checks at the smallest useful scope.
   Prefer synthetic data; do not copy private production payloads into city records.
6. State observability requirements and rollback assumptions. A rollback must
   account for changed data and consumers, not just reverted code.
7. Identify dependency/license, operational, security, and resident decisions that
   need separate review. Do not install packages or claim specialist clearance.
8. Prepare an integration proposal. Implement, migrate, or call external systems
   only within a recorded authorization; deployment is a reserved matter.

## Structured result and evidence

Return an interface ledger, flow summary, compatibility matrix, failure-mode table,
data mapping proposal, test scenarios, migration/recovery sequence, evidence
references, unknowns, and required resident decisions.
Label proposed behavior separately from observed existing behavior.

## Escalation and limits

- Chief Planner/City Manager reconcile ownership disputes; the resident decides
  material scope, budget, or governance changes.
- Skills grant no permissions. Follow the active role's tools and constraints;
  no automatic delegation, dependency installation, or access to remote services.
- Local files and `--apply` do not authorize work. Decisions are recorded with
  `authenticated: false`, not authenticated identity.
