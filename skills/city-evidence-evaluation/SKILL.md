---
name: city-evidence-evaluation
description: "Use when evaluating relevance, reliability, sufficiency, provenance, authenticity claims, conflicting records, check output, or confidence in municipal audit evidence."
user-invocable: false
---

# Evidence Evaluation

## Competency and application

Professional evidence evaluation separates what an artifact demonstrates from
what it merely claims. In Repository City, distinguish observable repository facts
from assertions about resident identity, authority, approvals, or successful delivery.

## Triggers and inputs

- Use for audit findings, disputed records, test reports, claimed approvals, or gaps.
- Require the explicit root, claim/question, applicable criterion, artifact
  references, known revision/time context, and source/provenance information.
- Do not request private data where a bounded, redacted reference would suffice.

## Procedure

1. State the proposition being tested. Separate identity, intent, authorization,
   technical correctness, and procedural compliance into distinct questions.
2. Inventory sources: direct observation, first-party record, generated output,
   attributed resident statement, agent assertion, or hearsay.
3. Assess relevance to the specific question, reliability of the source,
   coverage/sufficiency, and consistency with other evidence.
4. Inspect context: exact artifact/revision, scope, collection method, missing output,
   known transformations, and whether the source could alter its own evidence.
5. Distinguish integrity from authenticity. A hash can relate bytes if verified;
   it does not identify a resident, prove consent, or establish authority.
6. Cross-check conflicting sources without silently choosing the convenient one.
   Explain which claim remains unresolved and what evidence would discriminate.
7. Treat absence carefully: missing evidence may block assurance but does not
   automatically prove that an event did not occur or that misconduct occurred.
8. Record a conclusion with bounded confidence and explicit limitations.
   Do not invent checks, timestamps, identities, or execution results.

## Structured result and evidence

Return an evidence matrix: claim, criterion, artifact/location, source type,
revision/time context, relevance, reliability, sufficiency, contradictions,
confidence, and further evidence needed.
Conclude `supported within scope`, `contradicted`, or `insufficient evidence`.
Keep observations, inferences, and recommendations visibly separate.

## Escalation and limits

- Skills grant no permissions. A read/search-only auditor evaluates supplied check
  output but cannot claim to have executed or independently reproduced it.
- Different agent names do not establish independent principals. Local approval
  files, provenance labels, hook messages, and CLI `--apply` are not authenticated
  human-approval evidence.
- Authorization and acceptance decisions are recorded with `authenticated: false`.
  A well-formed, linked decision shows the recorded procedure, not who acted or
  that consent was genuine; report missing controls and evidence to residents and Clerk.
