---
name: city-institutional-review
description: "Use when the City Manager assigns an institutional-effectiveness review, status reports a review due, or the city needs a bounded comparison of its offices and procedures with applicable real municipal practice."
user-invocable: false
---

# Institutional Review and Improvement

## Purpose

Identify evidence-backed structural or procedural improvement opportunities. This
skill provides a method, not authority to change governance. The Performance and
Innovation Officer recommends; the City Manager, Council, or resident decides
through existing authority.

## Inputs and due-state check

Require the explicit repository root, an assignment from the City Manager, and
current `status` output. Proceed only when `institutionalReview.available` and
`institutionalReview.due` are both true. Capture the policy path, review window,
due trigger names, observed counts, and thresholds. If policy is not adopted,
governance has drifted, or thresholds cannot be parsed, stop and report why.

The CLI has no background scheduler. `status` computes whether a review is due
when the City Manager checks it during city coordination. Do not claim that a
review was triggered while the plugin was inactive or no city command ran.

## Procedure

1. Read the adopted charter and institutional-review policy. Confirm the scope
   remains within this repository and record the time window being reviewed.
2. Use `records-list` and exact-ID `records-get` for relevant work orders,
   decisions, workforce records, prior institutional reviews, and supporting
   evidence. Minimize personal and restricted data. Do not infer missing records.
3. Examine every due trigger; look for recurring patterns, not isolated events.
   Note that complaints, appeals, and audit findings are not automatically
   counted unless represented in the available canonical records.
4. Identify real municipal practices relevant to a specific observed gap.
   Prefer official city sources, charters, ordinances, and primary documents.
   Cite sources specifically and separate verified source facts from model
   knowledge. Never fabricate citations; label unverifiable comparisons
   provisional and state why.
5. Assess applicability to the city's scope, adopted authority, size, capacity,
   privacy obligations, existing offices, and maintenance cost. A real-city
   institution is not automatically suitable here.
6. Make proportionate recommendations with evidence, likely impacts, uncertainty,
   and a proposed owner. Use `administrative` for changes within current
   authority, `council` for bounded work proposals under adopted delegation,
   and `resident` for reserved matters. Any governance, security, deletion,
   deployment, publication, expenditure, roster, appointment, or permission
   change must be routed to the resident.
7. Prepare a `review-record` dry-run with a concise summary and structured
   recommendations. Apply only after the preview validates. The record documents
   the review; it does not adopt a policy or authorize implementation.
8. Give the record ID to the City Manager and route each recommendation
   independently through the applicable decision path.

## Recommendation fields

Each `--recommendation` is JSON with exactly:

```json
{
  "title": "Specific improvement opportunity",
  "rationale": "Observed gap and why this may address it",
  "precedent": "Relevant real-city practice and applicability limits",
  "sources": ["Identifiable source citation or URL"],
  "route": "administrative",
  "reservedMatters": []
}
```

Use one or more identifiable source citations. `reservedMatters` may contain only
the charter's reserved-matter names; if nonempty, `route` must be `resident`.

## Return

State the review window, trigger observations, records and scope, data gaps,
source citations and verification limits, concrete findings, recommendations
with routes, and the review-record ID. If no structural gap is demonstrated,
record that conclusion without manufacturing a recommendation. Label the result
**institutional review — recommendations only; decisions recorded, not authenticated**.
