# Repository City

A Copilot plugin that treats repository management as municipal public service.
Humans are the residents; agents are the city's employees. Residents establish
the mandate. Employees maintain records, assess requests, plan work, and inspect
results without inventing their own authority.

**Status: private 0.4.0 pilot, not a production government.**
The plugin supplies installable offices and skills, foundational governance
templates, local recordkeeping, and a recorded City Council approval and
delivery lifecycle. Decisions are **recorded, not authenticated**: under the
charter, repository access is the source of authority, so anyone with write
access can run the CLI and every record says `authenticated: false`. The
resident gives final acceptance of each pull request. The runtime never runs
git, merges, pushes, or deploys, and it does not implement expenditure.
An open-source license and publisher have not been selected.

## What is included

- Thirteen offices: City Manager, City Council, Resident Services Officer, City
  Clerk, Chief Planner, Development Advisor, Engineering Manager, Human Resources
  Officer, Municipal Software Engineer, Building Inspector, Records Officer, City Auditor, and
  Performance and Innovation Officer.
- Twenty-two professional skills drawn from real municipal competencies,
  including development applications, asset management and delivery authorization
  (27 skills total).
- Five resident workflows: city initialization, petitions, town halls, status,
  and appeals.
- Draft charter and operating procedures for authority, policy, services,
  resources, appointments, records, privacy, continuity, accountability, and
  council and workforce delegation.
- Dependency-free Node.js tooling for initialization, intake, lifecycle
  transitions, project registration, development screening/application/assessment,
  adoption, delivery authorization,
  acceptance, workforce requisitions, HR review, delegated appointments, local
  specialist generation, assignment, retirement, institutional-review trigger
  evaluation and review-record persistence, infrastructure asset/programme
  records, pinned infrastructure work scopes, and validation.
- A guarded Copilot hook that leaves unrelated repositories alone and reports
  malformed or incompatible city records.

No RSG or rsgdev component is required.

## Proportionate development applications

Residents bring needs, outcomes and observations, not engineered proposals.
Chief Planner screens against baseline materiality and adopted scoped local
rules: `lightweight`, `formal`, or `needs-clarification` with focused resident
questions. Ordinary new features are not automatically formal. Material new
projects/capabilities, architecture/boundaries, interfaces/migrations and significant
security/operational/cost/cross-project effects require formal applications.

Formal screening automatically assigns **Development Advisor** through City
Manager, without another assistance request. The Advisor develops only necessary
proposal, diagram, specification, project and study evidence with justified
non-applicability; Planner independently assesses the exact current packet.
No universal master plan or full impact matrix is required. Static findings are
not executed studies. Lightweight still requires delivery authorization.

The CLI adds `screen-development`, `application-record`, `assess-application`,
each `--root ABS --id WO-ID --data JSON [--apply]` (dry-run by default).
Under adopted development policy, Council-ready preparation and positive resident/
Council authorization require current screening and, when formal, complete Advisor
packet plus ready independent assessment. `status.workOrders.development` reports
questions, missing evidence, lifecycle state and `actionable` next actions.
Disabled policy, current authorized delivery (including blocked delivery) and
closed cases retain diagnostics with `actionable: false`, `next: null`. Ready
preapproval packets first need ordinary permitted lifecycle progression through
Manager; Council's actual decision handoff is only at `awaiting-approval`.
Existing `records-list/get` expose
all attached revisions. The runtime validates evidence structure and snapshots,
not policy semantics or identities. See the [complete contract and examples](./docs/development-applications.md).

New cities review the thirteen-office charter and development-applications policy
before adoption. Existing cities must explicitly merge/review the revised charter
appointment and policy, then `amend`; a policy-only addition is refused.
Installation/non-destructive `init` never implicitly reappoints offices. Older
policy sets remain valid; earlier delivery is not retroactively invalidated.

## Engineering workforce

The Engineering Manager is the engineering department's line manager; Human
Resources is a separate personnel office. The manager assigns an authorized
work order to an active engineer, or requests a specialist when no existing
engineer fits. HR reviews the requisition, the Engineering Manager approves or
declines the appointment under the adopted workforce delegation policy, and
HR then creates the approved specialist's files. The manager assigns and
dispatches the new engineer. The resident delegates this limited appointment
authority by adopting
[`workforce-delegation.md`](./templates/repository/.city/policies/workforce-delegation.md)
and may revoke it with an adopted amendment.

The sequence is `requisition` -> `review-requisition` -> `appoint` -> `hire` ->
`assign` -> `retire`. Every mutating command defaults to a dry-run; review its
full proposed output before requesting `--apply`. The hire creates a repository
agent in `.github/agents/`, a specialty skill and practice reference, a fixed
check runner and approved `checks.json` in `.github/skills/`, and a canonical
staff record in `.city/workforce/`. Files are created exclusively, never
overwritten. Agent definitions and check settings are local repository assets;
review them before applying the hire.

Generated engineers are limited to `read`, `search`, `edit`, and `execute`,
with no agent delegation. The check runner launches configured argument arrays
without a shell, but it is not a sandbox: those programs may still execute code,
access the network, install packages, or modify files. HR and the resident
should review each proposed command and its side effects; the runner itself
does not install tools. MCP servers may be proposed but are never installed automatically. Human Resources can retire a
staff record, while generated files are retained; deletion remains a separate
resident decision. File drift is reported by status and validation, not
enforced. Separation between office roles is expressed by instructions and is
not a security boundary: the Engineering Manager's host-level `agents: ["*"]`
cannot be restricted to a folder or staff directory, so its instructions limit
delegation to active staff, HR, and the Inspector. No hook guard is added.

## Install the plugin

Requires Node.js 22 or later on the execution host and a Copilot client that
supports Agent Plugins 1.0, including the Copilot-specific components you use.
Installing a plugin can enable executable hooks: review the package first.

### VS Code

1. Open **Chat: Open Customizations** and select **Plugins**.
2. Use **Install Plugin from Source**, or the equivalent Command Palette action.
3. Select this plugin's local folder, or its Git repository after publication.
4. Choose the intended scope, review trust prompts, and start a fresh session.
5. Confirm the city offices and skills appear for the intended harness.

Use the management interface in which you installed the plugin. Host policies
may restrict plugins, and plugin-management inventories can differ.

### If a hook blocks initialization

The enabled plugin runs `node` before tool calls, even in repositories without
a city. If `preToolUse` fails to launch, check `node --version` on the execution
host: Node.js >=22 must be on the PATH inherited by VS Code, not just activated
in an integrated terminal. After installing Node or changing PATH, fully exit
and restart VS Code, then start a fresh session.

On Windows with fnm, install a supported Node version and select a default.
Expose the stable default runtime directory (`%APPDATA%\fnm\aliases\default`)
on your user PATH, or launch VS Code from an fnm-activated shell after fully
exiting it. A PowerShell profile alone does not initialize non-interactive hooks.

If the hook instead returns a denial with `Cause:`, report that validation
code and message. An unenrolled repository should produce no decision; do not
delete city records or bypass validation to clear an enrolled-state denial.

### Copilot CLI

With the official CLI installed, register this local development marketplace:

```sh
copilot plugin marketplace add /absolute/path/to/city
copilot plugin install repository-city@repository-city-local
copilot plugin list
```

The current CLI still supports direct source installation:

```sh
copilot plugin install /absolute/path/to/city
copilot plugin list
```

Copilot CLI 1.0.105 warns that direct installs are deprecated, so prefer the
marketplace form. The included marketplace is for local development, not a
published or verified publisher.

Local marketplace plugins are loaded live from their source folder. Editing
that folder affects subsequent sessions. In this CLI version, uninstalling a
live plugin disables it without deleting its source; it may remain listed as
disabled until the marketplace is removed.

No GitHub repository or marketplace has been published for this project yet.
Local source installation does not require publishing an npm package.

See [compatibility and verification](./docs/compatibility.md) for what has actually
been tested. A valid package does not prove that every host executes its hooks
or supports its delegation configuration.

## Found a city in a repository

**Installation and city initialization are separate.** Merely installing the
plugin does not create records, adopt a charter, or authorize repository changes.

Invoke the `city-init` skill in a new Copilot session and select the target
repository explicitly. Actual slash-command qualification can vary by host.
The workflow previews changes, asks for confirmation, and only then creates
draft city paperwork.

You can inspect the same operation directly from the installed plugin folder:

```sh
node /absolute/path/to/city/scripts/city.mjs init \
  --root /absolute/path/to/target-repository --name "Harbour City"
```

The default is a JSON dry-run with no writes. After reviewing the proposal,
request the actual initialization:

```sh
node /absolute/path/to/city/scripts/city.mjs init \
  --root /absolute/path/to/target-repository --name "Harbour City" --apply
```

`--apply` requests a local write. It is **not** an identity check or an approval
mechanism. The resulting charter remains a draft. Do not equate initialization
with ratification or authorization of delivery.

The initializer preserves existing repository customizations. Its proposed
instruction fragment is stored inside the city's records; merging it into
existing Copilot instructions requires separate review. Agents and skills stay
in the plugin rather than being copied into every repository.

## Submit and inspect a petition

Register a distinct project directory before creating work orders. The command
records the boundary; it does not create, move, or authorize changes to project
files. Project paths must be normalized, non-overlapping repository-relative
directories outside `.city/` and `.git/`.

```sh
node /absolute/path/to/city/scripts/city.mjs project-add \
  --root /absolute/path/to/target-repository \
  --id personal-site --name "Personal Website" \
  --path projects/personal-site \
  --description "Justin's personal website."
```

Review the dry-run, then repeat with `--apply` to register the project.
Districts remain a separate ownership map. A work order may target multiple
registered projects by repeating `--project`; legacy work orders without
`projectIds` remain visible as unassigned, never silently mapped.

```sh
node /absolute/path/to/city/scripts/city.mjs petition \
  --root /absolute/path/to/target-repository \
  --title "Clarify setup instructions" \
  --request "New contributors cannot identify the required Node version." \
  --project personal-site \
  --criterion "The documented version matches the supported runtime."
```

Review the dry-run, then repeat with `--apply` to create the intake record.
Criteria may be omitted at intake, but must be clarified before a proposal.

## Steward shared infrastructure

The adopted [infrastructure-management policy](./templates/repository/.city/policies/infrastructure-management.md)
applies stewardship to shared build/test foundations, reusable libraries,
release configuration, data foundations, tooling, and recorded external
dependencies. It keeps asset/service records separate from work orders and
resident authorization. No monitor, scanner, external notice, operator
appointment, or background maintenance is implied.

Use the strict [asset schema](./schemas/infrastructure-asset.schema.json) to
record accountable ownership, actual operator coverage, services and dated
measurements, condition, supported baseline, maintenance obligations, findings,
deferrals, renewal and resilience evidence. All mutators default to dry-run:

The CLI syntax is `asset-register --root ABS --data JSON --recorded-by OFFICE
--reason TEXT`. Supply the complete strict record shape from the schema; preview
it, then repeat with `--apply`.

`asset-revise` requires the current `--revision`; `asset-review` appends dated
condition, service, obligation, or finding evidence. The
`infrastructure-programme-record` command maintains a rolling horizon and
explicitly identifies estimated work and unfunded needs; it does not allocate
resources. `status.infrastructure` reports due obligations, stale service
measurements, missing operating coverage, support deadlines, open findings,
deferrals, stale pinned work orders and programme review dates only from
recorded evidence.

Shared infrastructure work can omit `--project` only when `petition` includes
`--infrastructure` JSON with current asset IDs, exact local target paths, and
current due-obligation/open-finding references. The runtime snapshots revisions,
locators, baseline and criticality and rejects unsafe/symlinked targets. A linked
security finding requires an explicit resident-reserved decision; Council must
refer it. Ordinary lifecycle screening, assignment, delivery, independent
inspection and resident acceptance still apply. Review the
[asset-management skill](./skills/city-asset-management/SKILL.md) and
[infrastructure implementation notes](./docs/infrastructure-plan.md).

```sh
node /absolute/path/to/city/scripts/city.mjs status \
  --root /absolute/path/to/target-repository

node /absolute/path/to/city/scripts/city.mjs validate \
  --root /absolute/path/to/target-repository
```

## Find and exchange records

Use the read-only records commands to find exact canonical records without
creating request paperwork. `records-list` returns bounded metadata; `records-get`
fetches one or more exact IDs and may include first-degree links. These commands
read only supported `.city` records and do not search arbitrary repository files
or external stores.

```sh
node /absolute/path/to/city/scripts/city.mjs records-list \
  --root /absolute/path/to/target-repository \
  --type work-order --status inspection --limit 25

node /absolute/path/to/city/scripts/city.mjs records-get \
  --root /absolute/path/to/target-repository \
  --id WO-REPLACE-WITH-THE-WORK-ORDER-ID --linked
```

Only when the records are missing, ambiguous, or need a source-office response,
the Records Officer creates a durable request. Each `--item` is JSON with an
exact supported record type/ID and a short description:

```sh
node /absolute/path/to/city/scripts/city.mjs records-request \
  --root /absolute/path/to/target-repository \
  --requested-by "City: Building Inspector" \
  --source-office "City: Municipal Software Engineer" \
  --purpose "Confirm the inspection handoff evidence." \
  --related-work-order WO-REPLACE-WITH-THE-WORK-ORDER-ID \
  --item '{"type":"decision","id":"DEC-REPLACE-WITH-THE-DECISION-ID","description":"Authorization decision and linked evidence"}'
```

`--source-office` is optional routing context, not proof of custody or identity.
Review the dry-run before adding `--apply`. The Records Officer reports each
item as `found`, `not-found`, `withheld`, or `unavailable`; a `found` response
must cite a current record path and SHA-256 copied from records retrieval. Resolve
all requested items in one `records-resolve` command, or use `records-cancel`
when the requester withdraws the request. `status` lists open request summaries
for resumption across sessions.

Request-office labels and hashes are self-reported local evidence, not
authenticated identity or access control. A record request does not grant access
to restricted originals. Do not place secrets or restricted content in the
request, response, CLI arguments, or repository records. Existing cities without
request records remain valid; new city initialization creates an empty
`.city/records-requests/` directory.

To record a permitted lifecycle transition:

```sh
node /absolute/path/to/city/scripts/city.mjs transition \
  --root /absolute/path/to/target-repository \
  --id WO-REPLACE-WITH-THE-CREATED-ID \
  --to triaged --reason "Resident Services reviewed the request."
```

Again, preview first and add `--apply` only when the change is intended.
Run `node scripts/city.mjs --help` for the JSON command contract and bounds.

## Authorize and accept delivery

The lifecycle is `received -> triaged -> proposed -> awaiting-approval ->
authorized -> in-progress -> inspection -> awaiting-merge -> completed`, plus
`blocked`, `rejected`, `withdrawn`, and `reopened`. `authorized` is entered only
through `authorize` and `completed` only through `complete`; `transition` to
either fails with `AUTHORIZATION_REQUIRED`. Both commands require adopted
governance with no charter or policy drift.

The City Council decides orders awaiting approval under the adopted
[council delegation policy](./templates/repository/.city/policies/council-delegation.md):

When development-applications policy is adopted, first obtain current conclusive
screening and, for formal cases, Advisor preparation and independent ready Planner
assessment. These prerequisites apply to resident decisions too; `--routine-class`
is not an exemption. See [the JSON inputs](./docs/development-applications.md).

```sh
node /absolute/path/to/city/scripts/city.mjs authorize \
  --root /absolute/path/to/target-repository \
  --id WO-REPLACE-WITH-THE-CREATED-ID \
  --decided-by city-council --outcome authorize --reserved none \
  --routine-class documentation \
  --reason "Documentation-only fix within the work order's scope."
```

Outcomes are `authorize` (to `authorized`), `reject` (to `rejected`), `return`
(to `proposed`), and `refer` (no state change; `status` lists the order under
`awaitingResidentDecision`). `--reserved` is mandatory: `none` or a list of
`governance`, `security`, `deletion`, `deployment`, `publication`,
`expenditure`. The council cannot authorize a reserved matter
(`RESERVED_MATTER`) and must refer it. `--routine-class` (`documentation`,
`tests`, `in-scope-fix`, `dependency-patch`) records a pre-approved routine
class. Without the adopted delegation policy, council decisions fail with
`NO_DELEGATION`. The resident decides referrals, including reserved matters:

```sh
node /absolute/path/to/city/scripts/city.mjs authorize \
  --root /absolute/path/to/target-repository \
  --id WO-REPLACE-WITH-THE-CREATED-ID \
  --decided-by resident --outcome authorize --reserved security \
  --declared-by "Resident name" --evidence "Comment on issue #12" \
  --reason "Resident accepts the credential rotation."
```

The Engineering Manager assigns an active engineer to an authorized work order.
The output of an applied authorization routes to
`next: { actor: "engineering-manager", action: "assign-engineer" }`, and the
City Manager dispatches the Engineering Manager without another resident prompt.
The Engineering Manager assigns a fitting existing engineer or uses the
workforce workflow to hire and assign a specialist. Only then does it dispatch
the engineer, which delivers on a non-default branch. The Inspector moves the
order to `awaiting-merge` or back to `in-progress`, using `transition`.
`status.workOrders.readyForDelivery` shows assignment state; authorized previews,
`refer`, `return`, and `reject` never start delivery. After reviewing and
merging the pull request, the resident records acceptance:

```sh
node /absolute/path/to/city/scripts/city.mjs complete \
  --root /absolute/path/to/target-repository \
  --id WO-REPLACE-WITH-THE-CREATED-ID \
  --declared-by "Resident name" --evidence "Merged pull request #34" \
  --reason "Acceptance criteria met."
```

Preview each, then add `--apply`. Decisions are schemaVersion 2 records with
work-order, charter, and policy digests and `evidence.authenticated: false`.
Returning an order to `triaged`, `proposed`, or `reopened` voids its
authorization. Separation of duties (the council never edits code, the
Engineer never authorizes, the resident merges and accepts) is set by agent
definitions and tool lists, not enforced by the runtime.

## Automatic institutional review

The adopted [institutional-review policy](./templates/repository/.city/policies/institutional-review.md)
defines thresholds for recurring completed work, elapsed time, repeated Council
returns/rejections, failed inspections, referrals, and blocked work. `status`
evaluates those signals from canonical local records and reports
`institutionalReview.due`. At the start of each city-coordination run, the City
Manager dispatches the Performance and Innovation Officer to check `status` and
conduct a due review in the same run; residents do not need to invoke the
Officer. The CLI has no background scheduler, so checks happen during city
activity, not while the plugin is inactive.

The Officer compares applicable real-city practices, cites identifiable sources,
and recommends changes only. Administrative recommendations go to the Manager,
bounded work proposals go to Council, and reserved matters such as policy or
roster changes go to the resident. No recommendation is adopted or implemented
automatically. Thresholds come from the adopted policy; residents may petition
to change them and record a policy amendment.

The officer records a due review only after a dry-run:

```sh
node /absolute/path/to/city/scripts/city.mjs status \
  --root /absolute/path/to/target-repository
node /absolute/path/to/city/scripts/city.mjs review-record \
  --root /absolute/path/to/target-repository \
  --conducted-by "Performance and Innovation Officer" \
  --summary "Summarize the review window and evidence."
```

`review-record` refuses unless current adopted governance includes the policy
and at least one threshold is met. It is a dry-run by default; add `--apply` only
after reviewing the preview. Recommendations may be supplied as repeated
`--recommendation JSON` arguments and require cited sources. The resulting local
record documents a review, not the actor's identity or approval of its findings.

## Upgrading and recording charter adoption

Cities created before config schema version 2 stay valid (draft only), so the
hook keeps working. Upgrade them in place; only `.city/config.json` is
rewritten, and work orders, decisions, districts, charter, and policies are
left byte-for-byte unchanged:

```sh
node /absolute/path/to/city/scripts/city.mjs migrate \
  --root /absolute/path/to/target-repository
```

When a resident has declared the charter and policies adopted, record it:

```sh
node /absolute/path/to/city/scripts/city.mjs adopt \
  --root /absolute/path/to/target-repository \
  --adopted-on 2026-10-29 --declared-by "Resident name" \
  --evidence "Charter and policies record the resident's declarations." \
  --charter-version "1.0"
```

Preview each, then add `--apply`. `adopt` sets `governance: "adopted"` and
records the adoption date, the SHA-256 of `charter.md` (plus the optional
version label), digests of every policy, and evidence under the
`resident-declaration` rule: the charter treats repository access as the source
of authority, so a resident's declaration counts. The record always says
`authenticated: false`; the plugin cannot verify who declared it. Adoption is
a prerequisite for `authorize` and `complete`; council decisions additionally
need `policies/council-delegation.md` among the adopted policies. `status` and
`validate` report drift when the charter or policies no longer match the
adopted digests, and drift blocks delivery decisions (`GOVERNANCE_DRIFT`) until
`amend` records the revision.

### Upgrading a 0.1.0 city

Records written by 0.1.0 stay valid. To enable council delegation in an
existing city, copy `policies/council-delegation.md` and the updated
`charter.md` from the plugin's `templates/repository/.city/` into the city's
`.city/`, review them, and record the revision with `amend` (or `adopt` if
governance is still draft). `status` reports council availability under
`council`.

To enable specialist hiring, also copy `policies/workforce-delegation.md` and
the updated charter, review the thirteen-office roster and delegated appointment
authority, and record the revision with `amend` (or `adopt` while draft).
Workforce commands remain unavailable until this policy is adopted with no
governance drift.

To enable automatic institutional reviews in an existing city, copy the updated
`charter.md` and `policies/institutional-review.md` from the plugin templates,
review the thirteen-office roster and trigger thresholds, then record the
resident-approved revision with `amend` (or `adopt` while governance is draft).
Until that policy is adopted, status reports institutional review as unavailable.

## Amending an adopted charter

Once governance is adopted, `adopt` refuses with `ALREADY_ADOPTED`; use `amend`
instead to record a later resident declaration for a changed charter or policy:

```sh
node /absolute/path/to/city/scripts/city.mjs amend \
  --root /absolute/path/to/target-repository \
  --adopted-on 2026-11-05 --declared-by "Resident name" \
  --evidence "Charter and policies record the resident's declarations." \
  --summary "Correct outdated jurisdiction statement." \
  --charter-version "1.1"
```

Preview, then add `--apply`. `amend` refuses with `NOT_ADOPTED` while governance
is still draft, and with `NO_DRIFT` if the charter and policies already match
the current adoption, so it is never used to fabricate a revision that never
happened. On `--apply` it writes a new current `adoption` (new date, digests,
evidence) and appends the exact superseded revision, including the required
`--summary`, to `adoption.history`, oldest first. History is append-only:
earlier entries are never rewritten, and `validate` rejects a reordered,
discontinuous, or tampered history. Governance stays `adopted`; `amend` never
returns it to draft and never marks evidence `authenticated: true`.

## Records and governance

Every initialized repository has its own `.city/` directory, including JSON
configuration, district declarations, draft policies, work orders, and decision
records. JSON keeps the plugin runtime free of parser dependencies. City
records never belong in the shared plugin cache.

The Clerk records decisions, the Records Officer preserves institutional
memory, and the Auditor independently checks the evidence. The `.city/workforce/`
register links requisitions, HR reviews, Engineering Manager appointments,
staff, and assignments. Keep secrets and
unnecessary personal data out of repository history. Git is not a complete
backup strategy, and recorded decisions are not proof of who acted.

See the [governance guide](./docs/governance.md) and
[implementation plan](./PLAN.md).

## Limits, updates, and removal

- The city is session-driven, not a background autonomous government.
- Agents, tool lists, and hooks are not a filesystem sandbox or separate
  security identities. Terminal access remains powerful.
- The hook checks enrolled state; it does not authenticate decisions, confine
  every edit to a work order, or replace branch protection.
- Host hook timeouts may fail open. Disabled or uninstalled hooks do not run.
- Incompatible local records require explicit recovery or a reviewed migration;
  no automatic migration or adoption occurs. `migrate` upgrades config schema
  version 1 to 2 only when requested.
- Plugin updates must preserve repository-owned records. This pilot does not
  claim rollback compatibility: an adopted (schema version 2) config is not
  readable by earlier plugin builds, and once any `amend --apply` has added
  `adoption.history`, that config is also not readable by a plugin build from
  before `amend` existed. Plugin 0.1.0 cannot read 0.2.0 delivery states or
  schemaVersion 2 decisions; plugin 0.2.0 cannot read schemaVersion 2 project-
  scoped work orders. To roll back, restore
  `.city/` from a backup made before the first delivery decision.
- Disabling or uninstalling the plugin must not delete the city's local
  records. Review any separately adopted local instructions or CI checks when
  retiring a city.

## Develop and verify

Only development tests need npm dependencies; installed runtime scripts use
Node's standard library.

```sh
npm ci
npm test
npm run smoke
```

The smoke scenario uses disposable repositories, including paths with spaces,
and removes its own temporary data. To exercise a separately installed copy:

```sh
npm run smoke -- --plugin-root /absolute/path/to/installed/repository-city
```

No live city is automatically created in this source workspace. No remote,
branch protections, user profile, or plugin marketplace is modified by the
development tests.
