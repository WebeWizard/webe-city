# Building permits

Repository City v0.5.0 adds an optional, resident-adopted permit policy modeled
on the risk-proportionate parts of Copenhagen's building-case process. It
extends the existing development application and delivery authorization
pipeline; it does not create a second approval route.

## Municipal practice adapted

| Copenhagen practice | Repository City adaptation |
|---|---|
| Building Act and BR18 provide a national baseline; local plans refine it | Adopted development policy is the baseline; project-scoped adopted policies refine it. |
| Fire and structural classes shape documentation responsibility | Screening records safety and structural classes (1–4), rationale, and evidence. |
| Certified professionals take responsibility for higher-risk technical evidence | Higher classes require a recorded staff competency statement. This is not a professional licence. |
| Independent checking for the highest-risk structural work | Class 4 requires an independent statement verification by a different qualified staff member. |
| Municipality checks required material is present and decides the application | Chief Planner assesses the formal Advisor application; Council or resident separately authorizes delivery. |
| A permit is issued with conditions and commencement deadlines | The authorization decision contains conditions, project consent evidence, a 30-day start deadline, and a 30-day inactivity period. |
| Owner files completion notification; municipal oversight continues | Engineering Manager records a completion notice before inspection. The Building Inspector remains independent; resident acceptance remains final. |
| Planning exemptions can involve notice and neighbour participation | General policy exceptions remain subject to `authority-and-policy.md`; structured dispensation and consultation records are not in this release. |
| Unpermitted work may require legalization or removal | The runtime does not legalize or revert automatically. The Auditor preserves a finding and refers it for resident direction. |

## Workflow

1. Resident adopts `policies/building-permits.md` with `amend` alongside the
   development and workforce delegations. Initialization alone does not adopt
   the policy or confer authority.
2. Chief Planner screens and records the two risk classes. Lightweight cases
   are limited to classes 1 and 2. Formal cases retain the existing Advisor
   application and independent assessment requirements.
3. Classes 3 and 4 need matching competencies in active engineer staff records.
   Class 4 also needs a second qualified verifier. Labels are unauthenticated
   local records, not licences.
   Because the class-3 statement must exist before authorization, the bundled
   workforce delegation policy permits a read/search-only specialist, hired
   after independent HR endorsement and manager approval, to prepare an
   outstanding class-3 safety statement before delivery authorization. A
   resident may amend that permission away. Generated instructions require current, drift-free
   adoption, active drift-free staff, `permit-safety-class-3` competency, the
   requisition's work order, its current screening revision, and a bounded manager
   request. No delivery assignment is needed for this preparation; `assign`
   still refuses unauthorized orders. The specialist returns evidence and an
   author-attributed filing request; the Engineering Manager records
   `permit-statement` and routes durable filing to the Records Officer. No edits,
   execution, lifecycle transitions, class-4 or structural work, verification,
   or delivery authority are granted. This adapts professional preparation of
   application evidence, not commencement of permitted building work.
   The runtime records sequencing but does not interpret policy prose or
   authenticate actors. Existing cities apply the permission by adopting the
   revised policy with `amend`.
4. For class-3 implementation, assess delivery staffing separately after
   authorization. Assign an active specialist when the work requires defined
   expertise, or requisition a delivery-capable specialist if none fits. The
   read/search-only statement preparer cannot implement the work, and statement
   competency alone does not establish delivery fit. Class 3 alone does not
   justify a new post; ordinary work may use the general engineer.
5. Council may authorize classes 1–3 under its adopted delegation; class 4 is
   resident-reserved. Authorization includes permit conditions and any
   affected-project consent declarations.
6. Delivery must commence by the permit deadline and show lifecycle activity
   within the inactivity period. `status` reports current permit states;
   transitions refuse lapsed work. A same-authority decider can grant up to two
   30-day extensions with a recorded reason. Class-4 extensions are resident
   decisions. There is no background timer.
7. Engineering Manager records a completion notice addressing each condition.
   The Building Inspector independently inspects; the resident accepts with
   `complete`.

## CLI records

When the permit policy is adopted, add this object to the existing screening
JSON:

```json
{
  "safetyClass": 1,
  "structuralClass": 2,
  "classRationale": "Public contract changes are bounded and preserve existing consumers."
}
```

In the existing `screen-development` input, this is the `permit` property.
Authorization requires `--permit` JSON with `conditions` and `rightOfWay` arrays.
For example:

```json
{
  "conditions": [{"id": "compatibility", "description": "Preserve the documented API contract."}],
  "rightOfWay": []
}
```

For class 3 or 4, record the professional statement with
`permit-statement --data`:

```json
{
  "dimension": "structural",
  "class": 3,
  "staffId": "api-specialist",
  "screeningRevision": 1,
  "scope": "The public API and its compatibility boundary.",
  "evidence": "Reviewed the versioned contract and migration analysis."
}
```

Statements are append-only. To correct one, for example placeholder evidence,
record a new statement for the same dimension, class and screening revision with
`"supersedes": <current revision>` and a `correctionReason`; optionally link the
complete filed document with `evidenceArtifactId`. The original remains on
record, and a superseded class-4 statement needs a new verification. See
[statement supersession](./work-order-file-parts.md#statement-supersession).

For class 4, use `permit-verification --data` with
`statementRevision`, a different qualified `staffId`, `outcome`,
`reason`, and `evidence`. Before moving a permitted order into `inspection`,
record `completion-notice --data` with `permitId`, `conditions` (every
condition ID, status, and evidence), and overall `evidence`.

All commands remain dry-run by default and write only with `--apply`.
`status.permits` lists active, lapsed, void, and completed permits. All permit
records remain unauthenticated.

Use `permit-extend --permit-id PMT-ID --days N --decided-by city-council|resident
--reason TEXT` to extend an active or lapsed permit (classes 1–3 by Council,
class 4 by the resident). Resident decisions also require `--declared-by` and
`--evidence`. The limit is two extensions per permit.

## Deliberate limits

This is a repository workflow adaptation, not a simulator of Danish law. The
runtime does not implement Danish planning permission, Building Appeals Unit or
Planning Appeals Board procedure, neighbour-notice periods, structured
dispensation records, retroactive legalization, municipal fines, or physical
inspection. It does not authenticate a staff competency or enforce repository
paths. The initial limits are documented rather than silently represented as
implemented municipal controls.

Before claiming exact Copenhagen thresholds or appeal timelines, maintainers
should verify them against current official sources:

- [Bygningsreglementet (BR18)](https://bygningsreglementet.dk/)
- [Byg og Miljø](https://www.bygogmiljoe.dk/)
- [City of Copenhagen](https://www.kk.dk/)
- [Nævnenes Hus](https://naevneneshus.dk/)
