# Development applications and resident assistance

## Municipal adaptation

Development control separates applicant assistance, planning assessment, a decision
on permission, construction and independent inspection. Repository City adapts
those functions to software changes; it makes no claim to statutory planning powers,
legal permit validity or equivalence to a particular city's law.

Unlike a private municipal applicant expected to commission their own design team,
a repository resident supplies needs, desired outcomes and observations. The city
supplies the **Development Advisor** to help define a reviewable application.
Chief Planner independently screens requests and assesses formal applications.
City Manager coordinates technical help and Records Officer persistence.
Council/resident delivery decisions, Inspector delivery inspection and final
resident acceptance remain separate.

Software component/interface/data-flow diagrams serve as drawings. Specifications,
project facts and existing technical evidence replace only the relevant parts of
a conventional application package. A source review is static evidence, **not** an
executed load test, security study or compatibility experiment. Offices must name
unperformed studies and missing facts honestly. Neither a master plan nor a full
impact matrix is required for every request.

## Baseline and local refinements

The [development policy](../templates/repository/.city/policies/development-applications.md)
requires formal applications for material development: new projects/substantial
capabilities, material architecture/ownership-boundary changes, public-interface
changes, migrations, and significant security, operational, cost or cross-project
effects. Ordinary new features are not automatically formal. Routine documents,
tests and contained repairs normally remain lightweight unless material effects
arise. Lightweight does **not** exempt work from authorization or inspection.

Adopt refinements in this or another `.city/policies/*.md` policy, explicitly
stating repository-wide or exact registered-project applicability, thresholds and
rationale. Cite each applicable adopted section and scoped interpretation.
Local refinements clarify/strengthen, never silently waive the baseline.
Unknown jurisdiction, project, threshold or disputed interpretation means focused
resident questions, not a guessed scope or automatic heavyweight application.
The city investigates available technical facts; residents supply choices/intent
and facts unavailable to the city.

The CLI records a professional determination, not keyword/NLP classification or
a general policy engine. It validates explicit evidence, scopes, references and
invariants, not whether prose is true, every applicable rule was considered, a
referenced file exists, or a not-applicable explanation is professionally sound.
That remains independent assessment's responsibility. Office labels and evidence
are fixed-role **unauthenticated** local provenance, not authenticated identities.

## Enablement and existing cities

New `init` includes a draft policy and revised thirteen-office charter. Only resident
adoption appoints the Advisor and activates readiness requirements. Installing
an update never reappoints offices. Existing cities remain valid without the policy:
review/merge the revised charter appointment and new policy, then preview and apply
`amend` with the resident declaration. Adding the policy to an already adopted city
without changing its charter fails `CHARTER_AMENDMENT_REQUIRED`; the runtime checks
the changed digest, not the semantic adequacy of the appointment text. `init` is
non-destructive and does not replace existing customized charter/policy files.
For existing cities, manually review and merge the new template policy and charter;
rerunning `init` neither adds missing templates nor produces an upgrade plan.

Draft preparation is permitted before adoption but does not activate the process
or appoint the office. Adoption changes context and requires fresh screening.
Earlier authorizations/delivery remain valid: new readiness checks govern the
next authorization, not retroactive revocation.

## Actual CLI contract

Every command requires an explicit absolute `--root` and exact work-order `--id`.
All three accept a **single strict JSON `--data` argument**, default to dry-run and
write only with `--apply`. No file is loaded or command executed from `--data`.
No runtime dependencies or new canonical registry are introduced.

```sh
node "<installed-plugin>/scripts/city.mjs" screen-development --root "<repository>" --id "<WO-ID>" --data '<screening JSON>'
node "<installed-plugin>/scripts/city.mjs" application-record --root "<repository>" --id "<WO-ID>" --data '<application JSON>'
node "<installed-plugin>/scripts/city.mjs" assess-application --root "<repository>" --id "<WO-ID>" --data '<assessment JSON>'
```

RSO/Advisor/Planner, which have no execute tool, prepare commands for Records
Officer through Manager. The Officer persists the supplied professional finding,
not its own substitute assessment, and returns the actual canonical revision.

### Screening — fixed source `chief-planner`

All keys shown are required. A lightweight example:

```json
{
  "route": "lightweight",
  "projectIds": ["website"],
  "scopeEvidence": "The request affects only the registered website project.",
  "reason": "Contained wording repair without public-interface or other material effects.",
  "evidence": "Reviewed current pages and interface boundaries.",
  "impacts": [],
  "questions": [],
  "policyCitations": [
    {"path": "policies/development-applications.md", "section": "Baseline materiality", "projectIds": []}
  ],
  "requirements": []
}
```

Routes are `lightweight`, `formal`, `needs-clarification`. Conclusive screening must
cover the exact work-order projects. All selected IDs must be registered;
`projectIds: []` is allowed only for needs-clarification with concrete `questions`.
For an unknown project at initial intake, RSO asks before `petition`, which still
requires registered scope. Legacy unassigned version 1 orders may record
needs-clarification without assignment. A conclusive screening with explicitly
selected registered IDs binds that formerly unassigned order to those projects
and writes version 2 (`scopeAssigned: true`); a dry-run previews the exact change.
No project is inferred and existing assigned scopes are never silently replaced.
Return active delivery to proposed before a new planning cycle or scope assignment.

Impacts are unique values from `new-project`, `substantial-capability`, `architecture`,
`ownership-boundary`, `public-interface`, `data-migration`, `security`, `operations`,
`cost`, `cross-project`. Lightweight cannot contain impacts, unresolved questions
or formal requirements. Formal screening requires at least one individually
justified requirement; local refinements may justify formal treatment even without
a baseline impact. Each requirement is
`{"id":"contract","kind":"specification","description":"Versioned API contract","reason":"Review compatibility"}`.
Kinds: `proposal`, `diagram`, `specification`, `project-facts`, `study`.
Do not demand every kind. Formal `questions` may capture unresolved resident
choices; all must be answered before readiness.

Citations use an existing `policies/<name>.md` path, section/interpretation and
project IDs selected in this screening (`[]` means repository-wide).
Names follow the local policy register: an ASCII letter/digit followed by up to
199 ASCII letters/digits, dots, underscores or hyphens, then `.md`
(for example `policies/Website_API.v1.md`). Nested or traversal paths are rejected.
The repository-wide baseline citation is mandatory. Up to 100 projects, 10 impacts,
50 questions/citations and 25 requirements are accepted.

### Application — fixed source `development-advisor`

```json
{
  "screeningRevision": 1,
  "reason": "Resident-assisted proposal against the current formal screening.",
  "evidence": "Source analysis and resident choices; no executed runtime study claimed.",
  "proposal": "Add a versioned API while preserving existing consumers.",
  "answers": [{"question": "Which compatibility window is acceptable?", "answer": "Preserve existing consumers indefinitely."}],
  "artifacts": [{"requirementId": "contract", "disposition": "provided", "evidence": "docs/api-contract.md: versioned contract and migration alternatives."}]
}
```

`screeningRevision` must be the exact current formal screening. Answers must match
its questions exactly; artifact requirement IDs must match its requirements.
`disposition` is `provided` or `not-applicable`, with nonempty evidence/reference
or a justified explanation. A partial application is recordable but **not ready**.
Missing required studies and resident answers are reported explicitly.
Never use non-applicability to conceal a study still necessary to resolve an impact.

### Independent assessment — fixed source `chief-planner`

```json
{
  "applicationRevision": 1,
  "outcome": "ready",
  "reason": "Independent assessment finds the proportionate packet reviewable.",
  "evidence": "Checked contract, alternatives and every screening requirement."
}
```

Outcome is `ready` or `revise`; assessment must reference the exact current
application revision. `ready` refuses a packet missing answers/artifacts.
Advisor cannot assess its own work or grant authority. Evidence text is bounded
at 4,000 characters, proposal at 20,000; all arrays/history/file sizes use existing
bounded record safety. Empty/unknown/malformed keys, duplicate requirements,
unknown impact/kind/disposition and stale references fail rather than default.

## Readiness, invalidation and records

`status.workOrders.development` and each mutation's `development` output report
`enabled`, lifecycle `status`, `authorizationCurrent`, `actionable`, `stage`,
`ready`, `questions`, `missing` and nullable `next` (`actor/action` when actionable).
Stages: `screening-required`, `resident-clarification`, `advisor-preparation`,
`independent-assessment`, `ready-lightweight`, `ready-formal`, `governance-drift`.
Stages, readiness and missing evidence remain diagnostics even when no automatic
action is eligible; `ready` alone is not Council decision eligibility.
Manager resumes only `actionable: true` entries, following `next`: formal
preparation to Advisor, questions to resident, independent assessment to Planner.
Ready packets point to `city-manager / arrange-lifecycle-progression` until the
case is `awaiting-approval`; only then is the handoff
`city-council / review-authorization`. Arrange ordinary permitted transitions,
rechecking status after each step (re-triage may invalidate screening); never skip
stages or auto-reopen a case. This is coordination during an active session, not a
background scheduler or an automatic CLI agent spawn.
Current authorized delivery (including blocked-with-current-authorization) and
completed/rejected/withdrawn cases have `actionable: false`, `next: null`, without
revoking authorization or dropping diagnostic/history information. When
`enabled: false`, the same nonactionable output applies: readiness is only
draft/legacy advice, not a new obligation. Explicit CLI draft preparation is
still permitted within the existing pre-delivery lifecycle rules.
`preparationRequiredForNextAuthorization` distinguishes existing authorized delivery.

With the policy adopted, entering `awaiting-approval` and positive `authorize`
(including resident authorization) require current conclusive screening. Formal
cases additionally require the current complete Advisor application and ready
independent assessment. Failure is `DEVELOPMENT_NOT_READY`. Existing awaiting cases
made incomplete by a revision may still receive `reject`, `return`, or `refer`;
the normal authorization-decision state contract remains awaiting-approval.
An earlier-stage incomplete case stays in preparation or may be blocked/rejected/
withdrawn through its normal transitions rather than being labelled Council-ready.
Draft/unadopted governance and drift retain existing delivery-decision refusals.

Screenings snapshot request/title/criteria, registered project facts, district
boundaries, governance/adoption revision and planning-cycle resets. Re-triage,
reopening and return-to-proposed invalidate preparation for subsequent authorization;
ordinary triaged-to-proposed progression does not. Re-screening supersedes earlier
applications; any new application revision requires a new assessment, even if its
text is unchanged. Restoring a policy's exact adopted bytes restores that same
revision; adopting a changed revision invalidates old preparation.

All revisions remain attached under optional work-order `development` arrays
`screenings`, `applications`, `assessments`, retrieved by existing `records-list/get`.
Each stores sequential revision, recordedAt, sourceOffice, authenticated:false and
plugin provenance; screenings also store a context digest. Metadata leaves
`updatedAt` equal to the final **lifecycle** history timestamp. This additive optional
extension preserves work-order schema versions 1/2; no migration is needed. Writes
reuse mutation locks, atomic replacement, conflict checks and size/history limits.
Editable local records and hashes are not tamper-proof custody or access controls.

## Building-permit policy

The optional, separately adopted
[building-permits policy](./building-permits.md) adds risk classes, professional
statements, permit conditions and expiry, project-consent declarations, and
completion notices. When that policy is adopted, each screening adds a `permit`
object with `safetyClass`, `structuralClass` (1–4), and `classRationale`.
Class-3/4 statements and class-4 independent verification are attached as
additional development revisions. See the building-permit guide for their CLI
contracts and the limits of these unauthenticated competency records.
