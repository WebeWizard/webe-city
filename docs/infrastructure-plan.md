# Infrastructure stewardship: implementation plan

Status: Initial infrastructure capability implemented in 0.4.0. The sections
below remain the design basis and identify both shipped behavior and limitations;
the record model does not itself appoint operators, commit resources, authorize
delivery, monitor services, or perform external operations.

## 1. Product definition and municipal basis

Repository City infrastructure is the durable, shared technical foundation that
supports a repository's services and continued development. Its stewardship
continues after an individual delivery work order closes. Stewardship is proactive:
the city identifies and proposes necessary maintenance, upgrades, and security work
from agreed reviews and available evidence rather than waiting for residents to
notice a failure or request each task.

Examples include shared build and test systems, reusable libraries and interfaces,
development tooling, release configuration, data-storage foundations, and
documented dependencies on externally operated services. Not every source file,
package dependency, or application feature needs an infrastructure record.
Register an asset when identifying its service, custodian, condition, dependencies,
and maintenance obligations provides useful continuing accountability.

Keep four concepts distinct:

| Concept | Repository application |
|---|---|
| Infrastructure | The shared foundation supporting ongoing services |
| Asset | An identifiable maintained system or component within that foundation |
| Service | The outcome people depend on, such as reproducible builds |
| Work order | A bounded investigation, repair, improvement, renewal, or retirement |

Municipal precedents:

- [Copenhagen's planned maintenance of culture and leisure facilities](https://www.kk.dk/sites/default/files/2026-01/2026-01-16%20Status%20p%C3%A5%20Planlagt%20vedligehold%20for%202025.pdf)
  connects a long-range condition assessment to a funded ten-year programme,
  coordinating renewal to extend useful life and reduce unexpected closures.
- [Copenhagen's 2026 climate-adaptation report](https://www.kk.dk/sites/default/files/2026-10/Klimatilpasningsredeg%C3%B8relsen%202026.pdf)
  treats municipal, utility, and private assets as a coordinated system and
  reports service protection, delivery progress, and financing constraints.
- [Copenhagen's municipal-plan consultation](https://kp24.kk.dk/offentlig-hoering-af-kommuneplan-2024)
  records public input for political consideration before adoption; participation
  is distinct from the final approval.
- [Singapore's National Infrastructure Plan](https://www.ura.gov.sg/infrastructure-planning/national-infrastructure-plan/)
  aligns agencies and utility licensees over a fifteen-year horizon through an
  annual review of development needs, infrastructure capacity, and tradeoffs.
- [Singapore's rail financing and regulatory framework](https://www.lta.gov.sg/content/ltagov/en/who_we_are/our_work/public_transport_system/rail/new_rail_financing_framework.html)
  distinguishes asset ownership and renewal from operation and maintenance,
  requiring maintenance plans, fault-trend analysis, and operating standards.
- [Singapore's digital-service performance and reliability standards](https://info.standards.tech.gov.sg/control-catalog/dss/pr/)
  cover periodic service review, availability, performance, compatibility, and
  advance communication of scheduled downtime.
- [Asset Management BC's local-government framework](https://www.assetmanagementbc.ca/framework/)
  connects inventory, condition, levels of service, risk, maintenance planning,
  resources, and measurable outcomes. It explicitly supports incremental,
  proportionate implementation.
- [Victoria's public-sector asset management framework](https://www.dtf.vic.gov.au/asset-management-accountability-framework)
  distinguishes planning, acquisition, operation/maintenance, and disposal, and
  covers both physical and intangible assets.

Repository adaptations must be explicit:

- Assets here are primarily software and operational arrangements, not physical
  municipal property. Condition means evidenced technical fitness, not age alone.
- The existing repository `project` is a registered directory, not a time-bounded
  municipal capital project. Preserve that contract; use work orders for delivery.
- A service dependency may be externally operated. Recording it does not make
  the city its owner, grant access, or authorize changes outside the repository.
- Lifecycle costs may be estimates or unknown. Do not invent budgets, asset
  valuations, subscriptions, service guarantees, or procurement authority.
- Maintenance dates are checked during city activity. No continuous monitoring
  or autonomous municipal workforce is implied. Existing human/external operating
  arrangements must be recorded separately from plugin activity.
- Adapt planning horizons to repository releases, support deadlines, and service
  needs rather than copying municipal calendar horizons. A rolling infrastructure
  programme is not a mandatory master plan or formal application for every change.
- Singapore is a city-state; Copenhagen is a municipality within national and
  regional arrangements. Borrow planning and stewardship practices, not sovereign
  powers, taxation, statutory penalties, or authority over external operators.
- Resident-reserved security decisions and unauthenticated local records remain
  conservative repository-specific choices, not claims to reproduce either
  government's operational delegation or legal authority.

## 1.1 Initial implementation shipped in 0.4.0

The initial capability is optional local recordkeeping and bounded workflow
integration, not a live asset-management service:

- `asset-register`, `asset-revise`, and `asset-review` maintain strict,
  revisioned asset evidence under `.city/infrastructure/assets/`.
- `infrastructure-programme-record` maintains one revisioned rolling programme
  under `.city/infrastructure/programme.json`; estimates and proposed activities
  confer no spending or delivery authority.
- `status.infrastructure` reports due obligations, stale service measurements,
  open findings, deferrals, missing operator coverage, support deadlines, and
  programme review status from local records only.
- SchemaVersion 3 work orders can identify infrastructure assets, pin their
  revision/locators/baseline/criticality, and list exact local targets plus linked
  due obligations and open findings. Existing v1/v2 orders remain valid.
- Authorization and delivery progression reject changed asset revisions,
  changed maintenance occurrences, closed findings, and targets outside pinned
  locators. A linked security finding requires explicit resident-reserved
  authority; Council cannot authorize it.
- The new [policy](../templates/repository/.city/policies/infrastructure-management.md)
  and [skill](../skills/city-asset-management/SKILL.md) assign stewardship work to
  existing offices and preserve human operating responsibility.

Affected-user consultation, actual disruption notices, system-wide recovery
exercise records, and service-target breach arithmetic remain professional
recordkeeping responsibilities rather than dedicated runtime record types in
this first slice. No scheduler, remote advisory retrieval, scanner, monitor,
notification delivery, or autonomous maintenance is implemented. These limits
must remain explicit until separately designed and tested.

## 2. Existing foundations and gaps

Reuse rather than replace:

- [Resources and workforce policy](../templates/repository/.city/policies/resources-and-workforce.md)
  already requires asset/supplier inventories, maintenance responsibilities,
  renewal, and verified disposition, but supplies no structured register.
- [Service catalogue](../templates/repository/.city/policies/service-catalogue.md)
  already calls for one backlog covering maintenance, defects, features, and
  incidents. Infrastructure must feed that backlog, not establish a second one.
- [Runtime](../scripts/lib/city.mjs) already provides records, project scoping,
  status, governance adoption, authorization, inspection handoff, and completion.
- [Institutional review](../skills/city-institutional-review/SKILL.md) demonstrates
  policy-enabled checks during coordination, without a background scheduler.

The principal gaps to address are:

1. There is no canonical, queryable asset register or evidenced maintenance history.
2. New work orders require projects, while project directories must be disjoint
   and cannot be the repository root. Shared root configuration cannot safely be
   handled by declaring a catch-all root project or ignoring inspection scope.
3. Asset-by-asset obligations need a rolling, service-oriented renewal programme
   with capacity forecasts, lifecycle resource needs, and visible unfunded work.
4. Work completion needs continuing service measurements, explicit operating
   coverage, coordinated resilience, and communication with affected users.

## 3. Initial scope and responsibility

Implement asset management using existing offices first. Do not add a Public
Works department or new bundled office merely to hold the register.

| Responsibility | Existing office or authority |
|---|---|
| Accountable stewardship, service expectations, priorities and escalation | City Manager, within adopted policy |
| Technical inventory advice, maintenance estimates and delivery staffing | Engineering Manager and competent engineers |
| Rolling renewal programme, long-term capacity, cross-project effects, replacement options and materiality screening | Chief Planner, coordinated by City Manager with Engineering Manager resource estimates |
| Record operational coverage, service measurements and recovery arrangements | City Manager coordinates the actual responsible human/external operators and technical custodians; an agent appointment supplies no continuous coverage |
| Consult affected users and communicate planned service disruption | Resident Services Officer coordinates feedback and notices; City Clerk preserves decisions and consultation evidence |
| Prepare a formal development application when screening requires one | Development Advisor |
| Persist canonical asset records and evidence through supported commands | Records Officer, coordinated by City Manager |
| Authorize delivery within existing delegation; refer reserved matters | City Council or resident |
| Deliver approved maintenance | Assigned engineer |
| Independently inspect results | Building Inspector |
| Accept delivery and decide reserved matters | Resident |
| Independently examine stewardship, deferred risks and record quality | City Auditor |

Add a professional `city-asset-management` skill, not a resident workflow.
Use municipal vocabulary: asset register, condition assessment, levels of service,
maintenance plan, renewal, and disposal. A record or due date authorizes no work.

Add an `infrastructure-management.md` policy template for these responsibilities,
schedule-setting delegation, risk-based review frequency, maintenance capacity,
programme review, service measurements, operating coverage, security escalation,
consultation, reporting, and deferral review. Cross-reference the
existing resource, service, continuity, records, and development policies rather
than duplicating procurement, budgets, or delivery rules. New cities review it
before adoption; existing cities explicitly add and adopt it with `amend`.
No new charter appointment is necessary for the initial existing-office design.

## 4. Data model

Add a canonical record type, `infrastructure-asset`, with IDs such as
`IA-<uuid>`, stored in `.city/infrastructure/assets/`. Publish its JSON schema.
Use bounded, append-only revisions and observation history within each asset
record rather than introducing a separate maintenance-ticket database.

| Information | Initial contract |
|---|---|
| Identity and provenance | Schema version, ID, city ID, name, purpose, timestamps, plugin provenance |
| Classification | Small documented category set and lifecycle: proposed, active, deprecated, retired |
| Responsibility | Accountable office, technical custodian, operator, and whether city-maintained or an external dependency |
| Service relationship | Supported service descriptions, responsible office, proposed versus authorized expectations, measurement definition/source, observed results and dates, review thresholds and evidence freshness |
| Operating coverage | Responsible human/external operator role, non-secret reporting channel, existing monitoring/advisory arrangements, coverage limits, escalation and last verification |
| Location | Explicit repository-relative file/directory locators or non-secret external references |
| Relationships | Consuming project IDs and dependencies on other registered assets |
| Criticality and risk | Consequence of failure, rationale, known risks, and evidence; no invented numeric precision |
| Condition | Unknown, satisfactory, degraded, or failed; observation date, method, evidence, and limitations |
| Supported baseline | Observed version/configuration, compatibility constraints, support/end-of-life dates, and evidence or explicit unknowns |
| Maintenance plan | Stable obligation IDs, responsible role, recurring or event-driven trigger, task and acceptance evidence, due date/recurrence where applicable, and escalation rules |
| Findings | Stable finding IDs, source reference and date, affected asset/baseline, applicability and exposure assessment, urgency rationale, and linked work orders |
| Deferrals | Outstanding obligation/finding, reason, responsible risk owner, authority reference where required, next review date, and original due date |
| Renewal and exit | Known support/renewal dates, replacement or recovery references, and resource estimates or unknowns |
| Resilience and communication | Shared failure points, continuity-plan references, restoration dependencies, affected users/projects, maintenance-window constraints and consultation/notice evidence |
| History | Revisions, reasons, source office, observations, related work orders, and retained prior values |

Rules:

- Separate lifecycle, condition, criticality, and maintenance due state. An active
  asset can have unknown condition; an overdue review is not proof of failure.
- Unknown owners, dates, cost, or condition must be explicit unresolved facts,
  not successful defaults. Do not invent them to complete registration.
- Project-consumer relationships and dependency links are informational, not
  permission to edit those projects or traverse into another repository.
- Validate identifiers, cross-record references, chronology, revision continuity,
  duplicates, and dependency self-links/cycles. Retirement preserves references;
  active dependants need a documented resolution before retirement is accepted.
- Preserve assessment history. Reject stale updates using expected revisions,
  existing mutation locks, identity checks, and compare-before-write patterns.
- Missing local assets and unavailable external services are condition findings,
  not malformed city records. Structural corruption remains an explicit error.
- A finding can be unresolved, applicable, or evidenced as not applicable; never
  turn an unassessed security advisory into either a confirmed vulnerability or
  a clean bill of health. Preserve its disposition and source evidence.
- Store no credentials, secret-bearing URLs, or external access tokens.
- Measurements retain their source, observation time, limitations and relevant
  history. Missing or stale measurements and unverified operating coverage are
  explicit gaps; neither work completion nor an operator's name proves reliability.

Add one canonical `infrastructure-programme` record at
`.city/infrastructure/programme.json`, with its own published schema and bounded,
append-only revisions. It contains the planning horizon and review date, supported
services and linked assets, demand/capacity forecasts, sequenced renewal options,
support deadlines, lifecycle resource estimates, actual authority references,
unfunded gaps, and links to the existing backlog. Distinguish proposed activities
and estimates from authorized commitments. Preserve earlier forecasts, reasons for
changes, source evidence and the responsible offices. This is a rolling planning
record, not another task database, spending approval, or a delivery authorization.

Use the existing records interfaces for list/get, linked retrieval, requests,
resolution, filtering and pagination. Include reverse links from assets to work
orders and programme entries. Do not create a parallel records-access mechanism.

## 5. CLI and delivery scope

### Asset commands

Proposed commands, all requiring an explicit absolute repository root:

| Command | Purpose |
|---|---|
| `asset-register --root ABS --data JSON [--apply]` | Preview or record an evidenced asset inventory entry |
| `asset-revise --root ABS --id IA-ID --revision N --data JSON [--apply]` | Append a reasoned revision against the expected current revision |
| `asset-review --root ABS --id IA-ID --revision N --data JSON [--apply]` | Append condition or obligation evidence, including related work where applicable |
| `infrastructure-programme-record --root ABS --revision N --data JSON [--apply]` | Create or revise the rolling programme against its expected revision; 0 means no programme exists |

All writes default to dry-run. Registration is inventory, not acquisition,
appointment, adoption, or delivery approval. Draft observations may be recorded,
but policy-enabled maintenance coordination requires adopted, non-drifting
governance. Do not add an asset-delete command.
Programme writes use the same dry-run, mutation-lock, identity and stale-write
protections. Use asset reviews for supplied service measurements, operating
coverage, exercises and communication evidence; do not introduce a monitoring
executor, notification sender, or separate command family for each observation.

### Infrastructure-linked work orders

Introduce work-order schema version 3 for infrastructure-linked orders:

- Permit project scope, infrastructure scope, or both, with at least one real
  delivery target. Preserve versions 1 and 2 unchanged; ordinary project-only
  intake can continue writing version 2.
- Extend `petition` with repeatable asset references and optional structured
  maintenance-occurrence or finding references. A maintenance occurrence identifies
  asset, obligation and due date; an event-driven request identifies asset and
  finding. Both can be deduplicated and linked to existing work.
- Pin the asset revision and exact intended repository file/directory targets.
  Informational consumer projects must not silently become editable project scope.
- Root files and narrowly named shared directories can be infrastructure targets.
  Reject repository-root grants, wildcards, traversal, Git/city metadata targets,
  and paths escaping through symlinks. Use the existing canonical relative-path
  conventions and platform-aware filesystem checks.
- Asset locators describe what exists; delivery targets describe what this order
  proposes to change. Validate the latter against the pinned asset definition.
  An external-only asset requires a concrete local target for software delivery;
  otherwise route an advisory/external-owner request without pretending the CLI
  can operate the external system.
- Include these targets and pinned revisions in development screening snapshots,
  application assessment, authorization, assignment, delivery handoffs and inspection.
  Update development input schemas so an infrastructure-only case can be screened
  with no project IDs without bypassing the adopted development workflow.
- Add a compatible delivery-decision revision for infrastructure scope snapshots,
  retaining earlier decision versions. Compare scope at authorization and completion;
  a material scope change returns for new screening/authorization.
- Later asset revisions never broaden an existing authorization. Benign condition
  observations do not retroactively invalidate delivery; a missing/unsafe target or
  material discrepancy blocks affected work for explicit resolution.

The Engineer and Inspector use the same resolved delivery-scope contract.
Do not merely add `assetIds` while leaving their project-only rules unchanged.
Update generated specialist templates and workforce assignment validation too.
Existing generated staff files must not be overwritten: record scope-contract
compatibility for new hires, preserve legacy specialists for project-only work,
and require an explicit reviewed upgrade or replacement before infrastructure
assignment. Changes to generated files must retain digest/drift checks.

Existing reserved matters and tool restrictions still apply. In particular,
registering CI, release systems, identity or recovery arrangements does not
authorize changing enforcement controls, deploying, spending, or accessing
external systems. Route restricted actions to the responsible resident/operator.
The runtime remains a local recorder, not a sandbox or authenticated authority.

## 6. Maintenance coordination and reporting

### Rolling infrastructure programme

Chief Planner prepares a proportionate service-oriented programme with City
Manager and Engineering Manager, reviewed at a cadence established through adopted
policy and when demand, support deadlines, incidents, or resident priorities
materially change. Record the chosen horizon and rationale, not a fictional
fifteen-year software forecast.

The programme connects existing condition and maintenance needs to:

- Expected service demand, capacity constraints, and cross-project dependencies.
- Planned renewal, replacement, deprecation, and compatibility transitions,
  including their sequence, alternatives, milestones, and recovery concerns.
- Expected effort, staffing, compute/storage and real financial costs where
  relevant, including operations and eventual exit rather than acquisition alone.
- Actual authorized resources, uncertainty, unfunded requirements, consequences
  of delay, and options to change priorities, resources, or service expectations.

Keep proposed investments distinct from adopted commitments and approved work.
No accounting ledger, automatic purchase, or fictional funding is required. Link
programme activities to the existing backlog when work is proposed; reviewing
the programme neither authorizes delivery nor makes every ordinary feature a
formal development application.

### Asset maintenance plans

Each asset's plan identifies its accountable owner, technical custodian, supported
baseline, service expectations, review tasks, required evidence, and escalation
route. Include proportionate preventive inspections, dependency/support reviews,
security reviews, and recovery checks where relevant. Establish review frequency
through adopted policy and evidenced criticality, not a universal schedule:
shared authentication infrastructure warrants different attention from a
documentation formatter. Missing expertise or an incomplete plan is a visible gap,
not permission to assume the asset is maintained.

### Continuing service performance and operating coverage

For each important service expectation, identify its responsible office,
measurement definition and source, observation/review frequency, proposed or
authorized target, review threshold, and maximum evidence age. Use proportionate
measures such as successful reproducible builds, supported-version compatibility,
service availability where applicable, or measured recovery time. Retain observed
results and relevant trends separately from targets; record unmeasured, stale or
unapproved expectations honestly. A passing delivery inspection is evidence about
that change, not indefinite proof of service health.

Identify who actually receives failures, vulnerability advisories and user reports
while the plugin is inactive: the responsible human/operator role, existing
reporting channel and tooling, coverage hours or limitations, escalation route,
and last verified arrangement. Record absent coverage and missing escalation
arrangements as risks, with an owner and review date. Naming a city agent does not
provide an on-call operator, and entering a monitoring URL does not establish
monitoring or grant access.

During active coordination, review supplied operator reports and measurements,
identify breaches and stale evidence, and route resulting findings through the
existing backlog/incident process. Critical gaps go to the actual responsible
human rather than waiting for an inactive agent. Creating or changing external
monitoring, notifications, credentials or paid services remains a separately
authorized operator action; the plugin neither provisions them nor guarantees
that an external report will be received.

### System-level resilience and coordinated change

Treat related assets as service-supporting systems, not merely an inventory of
independently healthy components. For critical services and material cross-asset
changes, assess common failure points, external-provider loss, cascading effects,
required restoration order, incompatible intermediate versions, and overlapping
maintenance windows. Coordinate affected custodians/operators before proposing a
change that could interrupt a dependent service.

Reuse the [continuity and accountability policy](../templates/repository/.city/policies/continuity-and-accountability.md)
for approved recovery objectives, backup boundaries and exercises. Link relevant
assets and programme entries to those arrangements; require proportionate,
authorized recovery exercises and independently reviewed results for critical
systems. Record measured recovery, failed assumptions and corrective work.
Untested recovery objectives remain unverified, not achieved service guarantees.
An exercise requiring execution or external access needs existing authority;
neither an asset entry nor the programme grants it.

### Participation and disruption communication

Resident Services identifies affected project maintainers/users and responsible
operators. Before material service reductions, deprecations, disruptive upgrades
or changes to shared service expectations, obtain proportionate feedback and
record concerns, options and their disposition for the actual decision-maker.
Consultation informs the decision but neither supplies authorization nor simulates
an electorate. Record justified non-applicability for changes with no affected
users; do not create a universal town-hall gate for ordinary maintenance.

For planned disruption, propose a coordinated maintenance window and the notice
lead time under adopted policy. Communicate affected services, expected start and
duration, workaround/recovery information and a contact route through an existing
authorized channel; record the notice evidence, not merely a draft message.
Material changes to the window or expected impact require an updated notice.
Record justified exceptions through the existing incident/authority process;
urgency creates no additional power or automatic notification capability.

### Recurring and event-driven triggers

| Trigger | Assessment and proposed response |
|---|---|
| Scheduled inspection or review becomes due | Assess condition and identify preventive maintenance or a justified no-change result |
| Failed existing check, defect report, or service interruption | Assess impact and propose corrective maintenance; follow the existing incident process where applicable |
| Security advisory or existing scanner finding | Establish affected versions, applicability, exposure, urgency, mitigation options, and responsible decision-maker |
| Dependency or platform approaches end of support | Assess upgrade, replacement, or retirement before support is lost |
| Capacity, compatibility, reliability, or recovery weakness | Propose an evidenced improvement, renewal, or recovery measure |
| Service threshold breach, stale evidence, or unverified operating coverage | Confirm the evidence/coverage gap and route corrective assessment or escalation to the responsible office/operator |

Use evidence supplied by existing repository tooling, published advisories,
responsible operators, and office assessments. The new status evaluator does not
fetch advisories, execute scanners, or probe external services. Record the source,
observation time, affected baseline, uncertainty, and disposition so an old finding
or repeated report is not mistaken for a new event.

A newer release alone is not a maintenance obligation. Recommend an upgrade when
support, security, defects, compatibility, or service needs justify it. Compare
staying on the supported baseline, upgrading, replacing, and retiring as relevant;
include compatibility/migration checks, recovery or rollback provisions, resource
needs, and acceptance evidence. An assessment may conclude that no change is
necessary, with reasons and a next review.

### Security handling

Route suspected exposures promptly through the existing incident/escalation
process when reported; do not hold them for the next scheduled maintenance review.
Triage applicability, exploitability/exposure, service criticality, and possible
containment without putting secrets or exploit-sensitive details in public intake.
Record uncertainty and obtain authorized specialist help when necessary.

Security matters remain reserved for resident decisions under current policy.
A security-motivated patch must not be relabelled routine `dependency-patch` work
to bypass that reservation. Expedited escalation creates no emergency authority:
mitigation, enforcement-control changes, deployment, expenditure, and external
access still require the appropriate existing authority and responsible operator.
Unresolved authority or unavailable capacity is an explicit urgent escalation,
not silent deferral or permission to act.

### Reporting, capacity, and deferral

Add an `infrastructure` section to `status` and relevant diagnostics to `validate`:

- Availability and policy state; counts by lifecycle, condition and criticality.
- Assets with missing owners, unknown/stale condition evidence, unresolved
  dependencies, known missing paths, and recorded service risks.
- Due and overdue obligations, blocked maintenance, associated open work orders,
  and renewal/replacement needs with evidence and responsible office.
- Unresolved findings, pending security decisions, end-of-support risks, and
  deferred maintenance with reasons, risk owners, next reviews, and capacity gaps.
- Programme revision, horizon, next review, renewal/resource forecasts, and
  unfunded needs linked to assets, services and existing work.
- Observed service results against authorized targets, fault trends, measurement
  dates and stale/unknown evidence; do not substitute work-order counts for health.
- Operating-coverage gaps, overdue recovery exercises/corrective actions, and
  upcoming coordinated maintenance windows with missing consultation or notices.
- Explicit actionable next steps only when policy and governance permit them;
  diagnostic information remains visible when coordination is disabled.

Compute due dates from explicit calendar dates and configured recurrence, not
from guessed maintenance needs. Define UTC date-boundary semantics and use an
injectable clock for deterministic tests. Preserve the original due occurrence
when work is deferred; a later schedule revision must not erase the overdue
history or masquerade as completion.

City Manager and Engineering Manager propose explicit maintenance capacity within
the existing portfolio and resource limits; residents decide limits and reserved
priority tradeoffs. Do not invent a fixed percentage or promise unavailable staff.
Prioritize using exposure, service impact, criticality, support deadlines,
dependencies, effort, and the consequences of delay. Maintenance must not remain
indefinitely behind features without a visible decision. When capacity is
insufficient, report the gap and propose reprioritization, a reduced service level,
or additional authorized resources through the programme. Consult affected users
before material service reductions and obtain the actual required decision;
a capacity shortage alone changes no commitment. Record deferral reasons, responsible risk
owner, required decision reference, and next review; deferral is not completion.

### Work-order delivery and verified outcomes

During ordinary city coordination:

1. City Manager reviews infrastructure diagnostics alongside existing status and
   triages newly reported events when they arrive during active coordination.
   Arrange a programme review when due or when material evidence changes.
2. Records Officer persists supported inventory or assessment proposals.
3. Manager ensures actionable obligations and findings enter the existing backlog
   with responsible owner, priority rationale, acceptance criteria, asset reference,
   and source occurrence/finding. Link an appropriate open work order instead of
   duplicating it; recheck under the mutation lock when creating a linked order.
   Record an evidenced no-change disposition or explicit deferral when applicable.
4. Chief Planner applies existing proportional development screening. Routine
   maintenance is not automatically a formal application or an authorization waiver.
   Include proportionate system impacts, recovery concerns, affected-user feedback
   and disruption arrangements in preparation when relevant.
5. Delivery follows existing authorization, engineering assignment, independent
   inspection and resident acceptance.
6. Records Officer records the result against the correct obligation and occurrence.
   A maintenance change is satisfied only with linked completion and its required
   inspection/acceptance evidence. An assessment-only obligation can be satisfied
   by its specified assessment evidence; it does not imply a repair. An attempted
   upgrade or a passing command alone is insufficient: verify the supported
   baseline, service criteria, and security/compatibility outcome as applicable,
   and retain remaining risks and the next review date.
7. Report unresolved risk, deferral reasons, capacity and renewal needs to residents.
   Recurring obligations become due again; completion never erases their history.
   Update programme forecasts when evidence changes and continue service
   measurements after delivery; closing work never closes ongoing stewardship.

No automatic authorization, source edits, command execution, external health
probes, package installation, deployment, or background scheduler is introduced.
No failed/withdrawn/rejected order satisfies a maintenance obligation.
Unattended advisory ingestion, scheduled scanning/execution, and emergency response
while the plugin is inactive require a separately designed automation layer; this
capability must not claim to provide them.

## 7. Implementation sequence and affected surfaces

Each milestone includes its focused tests and documentation.

| Milestone | Deliverable and principal changes | Depends on |
|---|---|---|
| 1. Define stewardship | Document Copenhagen/Singapore precedents and adaptations; finalize policy, programme review, service/coverage responsibilities and participation; add professional skill | None |
| 2. Build the records | New infrastructure runtime module; asset/programme schemas and validators; safe write commands; records indexing/retrieval; read-only diagnostics including measurements and coverage | 1 |
| 3. Support shared delivery | Work-order/decision contracts, petition parsing, exact scope resolution, development readiness snapshots, workforce compatibility, Engineer/Inspector and specialist templates | 2 |
| 4. Close the stewardship loop | Rolling programme review; recurring/event triage; deduplication; upgrades/security routing; performance, capacity and coverage review; coordinated resilience and disruption; verified completion and recurrence | 2, 3 |
| 5. Verify packaged operation | Compatibility cases, packaged smoke scenario, documentation, package inventory and host-level workflow observation | 1-4 |

Specific integration points:

- [CLI entry point and help](../scripts/city.mjs): command parser, proposed JSON
  contract, errors and help notes.
- [Runtime orchestration](../scripts/lib/city.mjs): city loading, initialization,
  records access, status/validation, petitions, decisions and amendment behavior.
  Put new infrastructure-specific logic in `scripts/lib/infrastructure.mjs`, following
  the existing development/workforce module pattern.
- [Constants](../scripts/lib/constants.mjs),
  [validation](../scripts/lib/validation.mjs),
  [filesystem helpers](../scripts/lib/filesystem.mjs), and
  [schemas](../schemas/): versions, IDs, limits, optional storage layout,
  asset and programme schema/record contracts, directory identities, safe writes
  and public/runtime contract parity.
- [Development runtime](../scripts/lib/development.mjs) and
  [workforce runtime](../scripts/lib/workforce.mjs): pinned scope, readiness,
  assignments and generated-specialist compatibility.
- [Office definitions](../com.github.copilot/agents/),
  [professional/resident skills](../skills/), and
  [specialist templates](../templates/workforce/): update affected intake,
  status, planning, authorization, records, engineering, inspection and audit
  instructions, not just City Manager routing.
- [Repository templates](../templates/repository/.city/): new draft policy and
  cross-references; initialize empty asset storage without fabricated assets,
  a purportedly approved programme, monitoring coverage, or service measurements.
- [Governance documentation](./governance.md),
  [development applications](./development-applications.md),
  [compatibility](./compatibility.md), [README](../README.md), and
  [roadmap](../PLAN.md): explain terms, scope, commands, adoption and limits.
- [Package tests](../tests/plugin.test.mjs),
  [runtime tests](../tests/runtime.test.mjs), and
  [packaged smoke](../scripts/smoke.mjs): verify all shipped surfaces.

Compatibility requirements:

- Missing infrastructure storage, programme or policy in an older city means
  unavailable/not configured, not corrupt enrollment; existing records and
  delivery remain valid. Registering an asset must not require a fictitious
  programme or operational guarantee.
- `init` remains non-destructive. Do not rely on rerunning it to modify existing
  cities; supported asset writes create optional storage safely when first needed.
- Installing a plugin update neither adopts a policy nor silently changes service
  commitments, office authority, generated specialists, or existing record bytes.
- Overdue maintenance, unknown condition and ordinary asset failure must not make
  the hook deny all city work. Malformed infrastructure records retain the normal
  explicit validation/refusal behavior.
- Do not add runtime dependencies or require external services.

## 8. Acceptance criteria and validation

The capability is complete when a disposable target repository can demonstrate:

1. Register a shared build/test asset used by two projects and an external
   dependency, with honest ownership/condition gaps and no source-file changes.
2. List/get/request the records and follow asset/work-order links through the
   existing records interfaces, including bounded filtering and pagination.
3. Report due, overdue, unknown, disabled and drift states exactly at tested UTC
   date boundaries, without mutating state or running checks from `status`.
4. Raise one work order for a due occurrence across repeated or competing runs;
   preserve deferral, rejection and failed-inspection evidence without false
   completion or duplicate pending work.
5. Authorize and inspect a narrowly scoped shared root file, with zero project
   targets where appropriate; reject a neighbouring file, whole-root scope,
   missing asset revision, traversal, symlink escape and out-of-scope targets.
6. Prove an asset revision cannot broaden approved scope, consumer-project links
   grant no edits, and stale development/authorization snapshots are rejected.
7. Assign both a bundled engineer and a compatible generated specialist;
   refuse unsupported infrastructure assignment to legacy generated staff without
   overwriting their files or breaking ordinary project work.
8. Complete an inspected/accepted maintenance change, record its evidence, and
   show the next recurrence. An uncompleted order or unrelated review must not
   reset the due date.
9. Deprecate/retire an asset with documented dependency resolution and authority,
   preserving its history; no physical deletion or external cancellation occurs.
10. Load older city layouts and work-order/decision versions unchanged, and prove
    unrelated repositories remain inert. Malformed records fail explicitly;
    missing physical assets and overdue work remain reportable conditions.
11. Triage a failed check, support deadline, capacity/compatibility finding, and
    supplied security advisory into the correct assessment and existing backlog.
    Repeated reports reuse the relevant finding/order; unresolved and evidenced
    not-applicable advisories remain distinguishable.
12. Refer security-motivated maintenance to the resident even for a patch release;
    urgency must not bypass authorization, inspection, acceptance, or operator
    responsibility. No scanner execution or advisory fetching occurs from `status`.
13. Propose a justified upgrade with compatibility and recovery evidence, and
    separately record a justified decision to retain a supported baseline rather
    than upgrading solely because a newer release exists.
14. Report insufficient maintenance capacity and an explicit deferral with its
    reason, risk owner, original due date and next review. Scheduling changes,
    capacity gaps, and passing checks alone must not falsely satisfy obligations.
15. Persist and retrieve a rolling programme with a justified repository-specific
    horizon, condition/demand inputs, sequenced renewal, lifecycle resource
    estimates, actual authority references and unfunded gaps. Preserve revisions,
    reject stale writes, and report when review is due without creating duplicate
    tasks or treating estimates as spending authority.
16. Record a service measurement and its target/source/date, show a breach and
    stale/unknown evidence distinctly, and retain relevant trends. Completing an
    upgrade must not refresh old measurements or falsely declare continuing health.
17. Record a real human/external operating arrangement and a missing-coverage
    case, including reporting channel, limitations, last verification and escalation.
    No background process, external monitor, delivery of a notification, or
    inactive-agent response may be claimed from registration or status alone.
18. Assess a shared-provider failure or multi-asset compatibility transition and
    record coordinated restoration order, authorized recovery exercise evidence
    and corrective actions. Individually satisfactory assets must not hide an
    untested system-level recovery assumption.
19. Record affected-user feedback and its disposition for a material service
    change, plus actual notice evidence for planned disruption and a changed
    maintenance window. Consultation is not approval; a draft notice is not sent,
    and ordinary non-disruptive maintenance needs no invented public hearing.

Run focused runtime tests per milestone, `npm run check` for shipped content,
then `npm test` and `npm run smoke` for the integrated capability. Exercise all
CLI scenarios in temporary repositories, never initialize this source repository.
Observe actual host routing separately before claiming model-driven workflow
support; automated tests alone do not prove it.

Defer automated discovery/import, external connectors, live monitoring, incident
automation, financial accounting, autonomous renewals, protected merge integration,
and new specialist offices until the basic stewardship loop is proven.
