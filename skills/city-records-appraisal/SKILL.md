---
name: city-records-appraisal
description: "Use when assessing municipal record value, retention schedules, archives, disposition proposals, preservation priorities, legal holds, or recovery obligations."
user-invocable: false
---

# Records Appraisal

## Competency and application

Municipal appraisal evaluates administrative, evidential, historical, and public
accountability value. In a repository, distinguish transient working material
from case history that must survive staff, plugin, and policy changes.

## Triggers and inputs

- Use for storage pressure, archival planning, policy review, or proposed disposal.
- Require root, inventory, record purpose, applicable retention policy, ownership,
  known legal/audit/dispute holds, sensitivity, and available recovery evidence.
- Read source policy and record relationships. Do not invent legal duties or
  treat an agent's legal interpretation as authoritative advice.

## Procedure

1. Classify records by function and lifecycle: active case, closed intake history,
   decision proposal, inspection/audit evidence, policy, or transient duplicate.
   A closed intake disposition is not a `completed` work order.
2. Assess continuing value: rights and obligations, decision rationale, dispute
   history, reproducibility, operational recovery, and unique institutional context.
3. Identify the retention trigger and period only where an applicable policy
   establishes them. Otherwise propose a schedule and mark it unadopted.
4. Check holds and unresolved disputes before proposing archival or disposal.
   Missing hold information is a reason to preserve, not permission to delete.
5. Balance records-only privacy minimization with accountability. Consider bounded
   redaction or reduced duplication without destroying essential provenance.
6. Propose archive format, identifiers, relationships, access needs, integrity
   evidence, and recovery checks. Do not claim a restore has been tested if it has not.
7. Separate the appraisal recommendation from authorization to act.
   Obtain a separate resident decision for retention-policy or disposition changes.
8. Provide a reversible preservation proposal where possible and document residual
   risks, ownership uncertainty, and specialist advice still needed.
9. Include artifact records in the inventory. Their `recordCategory` is intended
   use, not authority; legacy records without the field are
   `legacy-unclassified`. Do not infer formal status or retention periods from a
   category. Apply holds and the adopted schedule, if any; otherwise preserve.

## Structured result and evidence

Return an appraisal table: record class/IDs, purpose, value, policy source,
retention trigger/period or unknown, holds, proposed action, privacy considerations,
recovery prerequisite, resident decision required, and confidence.
Label every schedule, archival transfer, and disposal recommendation as a proposal.

## Escalation and limits

- Unknown policy means preserve. Do not delete, lift a hold, migrate, or rewrite
  history merely because appraisal recommended it.
- Skills grant no permissions or legal authority. Charter/policy changes and
  resource commitments require resident judgment and applicable independent controls.
- Decision records are recorded with `authenticated: false`; preserve them with
  their work-order history. Deletion is a reserved matter for the resident.
