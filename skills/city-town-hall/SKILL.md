---
name: city-town-hall
description: "Use when a resident invokes city-town-hall, requests municipal deliberation, compares proposals, prepares a draft agenda, or seeks a resident decision packet."
user-invocable: true
---

# Prepare a Town Hall

## Purpose and inputs

Make proposed choices understandable to residents through a draft agenda and
decision packet. Agents contribute analysis, not votes or synthetic public consent.
Require explicit root, purpose, case references, resident questions, available
evidence, and applicable meeting procedures if any exist.

## Procedure

1. Establish whether the target is enrolled. An unenrolled repository stays unchanged;
   offer `city-init` separately. Report malformed/incompatible city state as blocked.
2. Read the charter, relevant policies, work orders, decision records,
   inspection findings, and disputes. Separate draft rules from established facts.
3. If runtime status is needed and execute is available, resolve the
   [packaged CLI](../../scripts/city.mjs) to its actual installed path first.
   Require Node.js >=22, no runtime install, and run only documented `status --root`
   or `validate --root` commands with the selected absolute root.
4. Use [agenda management](../city-agenda-management/SKILL.md) to organize information,
   consultation, and proposed resident decisions. Include missing evidence and
   deferred items instead of declaring every proposal ready.
5. For each decision, present the outcome sought, no-change option, alternatives,
   impacts, tradeoffs, evidence, uncertainty, and any conflict of interest.
6. Identify charter amendments, appointments, budget changes, and policy proposals
   explicitly. Resident sovereignty is not delegated to an assembly of agents.
7. Identify pilot offices that could answer bounded questions. Only a manager with
   its configured agent tool/allowlist may delegate; do not spawn new offices.
8. Produce the packet and stop for actual resident deliberation. No `town-hall`,
   `vote`, `adopt`, or `approve` CLI command exists.
9. After actual statements are supplied, use
   [minute taking](../city-minute-taking/SKILL.md) to draft an attributed record.
   Do not fabricate attendance, quorum, votes, consensus, or authenticated consent.
10. Send requested records to City Clerk. Preserve dissent and uncertainty; any
    drafted decision must remain schema-compatible and a proposal; authorization
    decisions come only from the CLI `authorize` command.

## Structured result and evidence

Return:
- **Draft agenda:** purpose, assumptions, participants if known, ordered items.
- **Decision proposals:** case, question, options, impacts, sources, missing evidence.
- **Resident questions:** explicit choices, disputed facts, and possible deferrals.
- **Draft minutes**, only if actual deliberation evidence is available.
- **Record handoff:** proposed Clerk action and unresolved validation needs.

## Limits

This skill grants no tools, voting rights, or policy authority. A read/edit-only
role cannot execute commands merely because this procedure mentions them.
A proposal or meeting record is not ratification, adoption, or verified approval.
Do not treat a recorded preference as permission for implementation or an
instruction merge; delivery needs a CLI `authorize` decision by the City Council
or resident, recorded with `authenticated: false`.
Conclude **draft deliberation/decision proposal only**.
