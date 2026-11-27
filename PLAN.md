# Repository City: Implementation Plan

Status: Draft for human approval. This document consolidates the initial plan, the Municipal Records and Archives requirements, the foundational governance gap review, and the requirement to distribute the city as an installable Copilot plugin.

### Implementation status

The private 0.1.0 draft/intake slice supplied the plugin package, eight pilot
offices, sixteen professional skills, five resident workflows, draft governance
templates, and local initialization, recordkeeping, transitions, and
validation, followed by recorded charter adoption (`adopt`, `amend`) and
explicit config migration (`migrate`).

The private 0.2.0 slice adds a City Council approval and delivery lifecycle:
nine offices (adding the City Council), seventeen professional skills (adding
`city-delivery-authorization`), a council delegation policy template, and the
`authorize` and `complete` commands. Once governance is adopted with no drift,
the council authorizes, rejects, returns, or refers `awaiting-approval` orders;
routine classes (documentation, tests, in-scope fixes, patch-level dependency
updates) are pre-approved; reserved matters (governance, security, deletion,
deployment, publication, expenditure) are referred to the resident. The
resident gives final acceptance of the pull request with `complete`.
Decisions are schemaVersion 2 records, recorded rather than authenticated
(`authenticated: false`): under the charter, repository access is the source of
authority. Separation of duties is defined by agent definitions, not enforced
by the runtime, and the runtime performs no git, merge, push, or deployment.
Installing the plugin or applying initialization is not resident ratification.

The private 0.3.0 slice adds disjoint repository-local project directories,
explicit project associations on new work orders, project-grouped status, and
agent inspection guidance that checks delivery paths. Existing schemaVersion 1
work orders remain valid but unassigned; new work orders use schemaVersion 2.

The 0.3.0 workforce capability separates engineering line management from
personnel administration. The Engineering Manager assigns authorized work,
requests specialists, and may appoint an HR-endorsed engineer under an adopted
workforce delegation policy. Human Resources reviews requisitions, generates
approved specialist agent/skill/toolkit files locally, maintains staff records,
and handles retirement and handover. Requisitions, appointments, hires,
assignments, and generated-file drift are recorded in the target repository;
MCP tools are proposed only and never installed. This is a delegated,
unauthenticated workflow, not a host security boundary.

The 0.3.0 institutional-review capability adds the Performance and Innovation
Officer, a policy-enabled review workflow, and canonical review records. `status`
evaluates adopted-policy thresholds against existing local work orders and
decisions; the City Manager dispatches the Officer during city coordination
when a review is due. Recommendations require cited municipal precedents and
are routed to the Manager, Council, or resident without automatically changing
governance. The CLI has no background scheduler; triggers are checked when
`status` runs.

The plugin relies on host and platform permissions rather than authenticating
residents or seeking identity proof. Protected merge integration, expenditure
and budget controls, and a published release remain future work.

The private 0.4.0 infrastructure capability adds optional asset and rolling
programme records, service/condition/obligation/finding status, exact pinned
infrastructure work-order scopes, and a policy/skill for continuing stewardship.
Older cities and work orders remain valid; records do not adopt policy, appoint
operators, monitor services, authorize work, or claim external execution.
Consultation records, delivered disruption notices, system-wide recovery
exercises, continuous monitoring and automated discovery remain human-operated
or future work as described in the
[infrastructure implementation notes](docs/infrastructure-plan.md).

The zoning capability is an optional path-based rule layer, separate from project
scope and district ownership. It adds validated zoning maps and work-order checks,
with snapshot-bound findings and readiness requirements for conditional, unknown,
and prohibited uses. New cities receive the zoning policy outside the active
policy register; opting in requires a resident adoption or amendment and a
reviewed map. It does not inspect Git diffs, enforce filesystem permissions, or
grant delivery authority. See [repository zoning](docs/zoning.md).

The private 0.5.0 permit capability adds an optional resident-adopted
building-permits policy. It extends development screenings with safety and
structural classes, records qualified staff statements and independent
verification for classes 3–4, attaches conditions and deadlines to
authorization decisions, gates continued work on permit validity, and requires
a completion notice before inspection. The permit policy is inert until
adopted; existing orders and decisions remain valid. It does not automate
neighbour consultation, dispensation registries, retroactive legalization,
physical inspection, or authenticated professional licensing. See
[building permits](docs/building-permits.md).

Implementation refinements:

- Local configuration and district declarations use JSON rather than the
  illustrative YAML paths below, keeping the installed runtime dependency-free.
- Professional skill names use a `city-` prefix, and office display names are
  namespaced to reduce collisions with other plugins.
- Initialization emits a proposed local instruction fragment but does not edit
  existing repository instructions or install CI without separate approval.
- City Council and the Engineering Manager hold distinct, policy-scoped
  delegations: the Council authorizes delivery; the Engineering Manager may
  appoint HR-endorsed specialist engineers under the adopted workforce policy.
  The Human Resources Officer performs personnel administration. The current
  bundled pilot roster has thirteen offices, including the Development Advisor.
  Development requests are professionally screened against the adopted baseline
  and scoped refinements. Formal cases automatically receive proportionate Advisor
  assistance and independent Planner assessment; ordinary features are not
  automatically formal. Optional work-order revisions preserve compatibility and
  gate subsequent authorization, not existing delivery. See
  [development applications](docs/development-applications.md).
- Licensing remains undecided. The development package is private and
  unlicensed; publication is not authorized by implementing this plan.
- Copilot CLI 1.0.105 accepts direct local installs but warns they are deprecated.
  Include a private local development marketplace and test its installation
  path as well; publication still requires a real publisher and license.

The 0.1.0 slice passed its automated package/runtime checks, an actual
packaged intake scenario, isolated CLI installation and skill discovery, and
record-preservation checks across disable/enable/uninstall. The 0.2.0 and 0.3.0
slices are covered by automated package/runtime tests and the packaged smoke
scenario, including delivery lifecycle and project registration/scoping. Host
installation checks have not been repeated for 0.2.0 or 0.3.0, and VS Code UI discovery, model-driven delegation
(including council referral), and actual host hook enforcement remain
unverified; do not mark the overall plan complete.

## 1. Purpose and scope

Create a Copilot-based project that manages a repository as if it were a city:

- Humans are the residents. They express needs, establish priorities, approve policy, and hold the government accountable.
- Agents occupy municipal offices. They assess requests, coordinate services, perform work, inspect results, and maintain official records.
- Skills represent real professional competencies used by municipal employees, with explicit applications to repository management.
- Durable records, rather than an individual agent's conversation history, provide institutional memory.

Distribute the city as an installable Copilot plugin, not as a collection of agents and skills that users must copy into every repository. Installing the plugin makes its supported offices and competencies available; initializing a particular repository establishes that city and its local records. Installation alone does not grant governing authority.

Use standard Copilot customization and plugin mechanisms. Do not depend on or invoke RSG or rsgdev agents, skills, commands, or tooling.

Start with a small, functioning administration. Do not create a large cast of personas before proving that one resident request can move through authorization, delivery, inspection, and accountable completion.

### Inspiration

Use Copenhagen-inspired governance: resident-directed policy, specialist administrations, and published decisions. This is a functional adaptation, not a literal recreation of Copenhagen's organization or legal system. Add common municipal roles where they provide a useful responsibility boundary.

Some real municipal offices are elected positions. Their agents are administrative proxies for human decisions, not an artificial electorate. Do not simulate councillor votes that can overrule residents. Do not import national sovereign powers merely because Singapore is both a city and a state.

### Initial assumptions

- One human initially holds resident decision rights; multi-resident procedures can be introduced explicitly later.
- The pilot governs one repository. The same installed plugin must later support multiple repositories with independent charters, permissions, budgets, and records; no city state may leak between them.
- The city operates during an active Copilot session and resumes from saved records. Agent definitions do not create an always-running government.
- GitHub-hosted repositories are the initial target for verified pull-request approvals and protected merge controls, where available. Local-only operation must identify its manual controls and limitations honestly.
- The primary deliverable is a versioned Copilot plugin containing agents, skills, guarded hooks, and bootstrap templates, plus small repository-local validation assets where needed. It is not a new agent framework, database service, or dashboard.
- VS Code with a supported Copilot harness is the primary installation target. Verify Copilot CLI compatibility as a separate supported-client path and publish the minimum tested versions and component support.

## 2. Constitutional structure and principles

| Level | Municipal function | Repository application |
|---|---|---|
| Residents | Establish the public mandate | Define outcomes, acceptable tradeoffs, and reserved decisions |
| Council and Mayor's Office | Facilitate policy and priorities | Prepare options and explain resident-approved programmes |
| City administration | Coordinate delivery | Route approved work, manage dependencies, and track progress |
| Departments | Supply specialist services | Architecture, implementation, infrastructure, finance, accessibility, and security |
| Districts | Coordinate local needs | Maintain knowledge and ownership of repository components |
| Projects | Coordinate bounded programmes of work | Track distinct initiatives and their non-overlapping repository directories |
| Frontline staff | Deliver and inspect services | Implement changes, run checks, resolve cases, and document results |
| Independent oversight | Investigate failures and assess accountability | Audit evidence, hear appeals, and challenge decisions |

The founding charter must establish:

1. Resident sovereignty: agents cannot change their own mandate or manufacture consent.
2. Delegated authority: routine work may proceed only under an explicit, resident-approved policy or specific authorization.
3. Separation of duties: the implementer cannot provide the final independent inspection of its own work.
4. Public reasoning: official decisions explain reasons, alternatives, relevant uncertainty, and supporting evidence.
5. Right of appeal: residents can challenge a decision or reopen a case.
6. Proportional administration: low-risk work follows a short route rather than a cabinet meeting.
7. Privacy and access: records are accessible to authorized residents without exposing secrets or unnecessary personal information.
8. Bounded operations: agents stop when authority, information, or execution budget is exhausted.
9. Institutional continuity: obligations and unfinished work survive personnel changes and new Copilot sessions.
10. Limited jurisdiction: city policy cannot override applicable law, organizational requirements, hosting restrictions, or another repository owner's authority.

The city governs repository work. It does not police or punish contributors.

## 3. Target municipal workforce

The eight roles marked "Yes" in the Pilot column form the initial administration. Other offices are activated only when their services are needed. Skill names are proposed directories, each containing a SKILL.md file.

### City Hall and executive administration

| Agent | Pilot | Repository responsibility | Municipal skills |
|---|---|---|---|
| Mayor | No | Present priorities, reconcile competing objectives, and explain the resident-approved programme | policy-briefing; stakeholder-engagement |
| City Clerk | Yes | Prepare agendas, record verified approvals, maintain adopted policies, and publish official decisions | agenda-management; minute-taking |
| City Manager | Yes | Coordinate departments, commission authorized work, manage capacity, and escalate blockers | strategic-planning; interdepartmental-coordination |
| Resident Services Officer | Yes | Receive requests, clarify needs, route cases, and communicate status | case-management; complaint-triage |
| Human Resources Officer | Yes | Review specialist engineering requisitions, generate approved hires, maintain personnel records, and manage handovers | recruitment-and-onboarding |
| Performance and Innovation Officer | Yes | Review policy-enabled institutional triggers, compare applicable municipal practices, and recommend evidence-backed structural or procedural improvements | institutional-review |

### Finance, law, and procurement

| Agent | Pilot | Repository responsibility | Municipal skills |
|---|---|---|---|
| City Treasurer | No | Assess effort and operating costs, administer authorized budgets, and reconcile consumption | budget-formulation; cost-benefit-analysis |
| Procurement Officer | No | Evaluate dependencies, vendors, licenses, and supply-chain considerations | supplier-due-diligence; procurement-evaluation |
| City Attorney / Legal Adviser | No | Research licensing and policy concerns requiring human judgment | regulatory-analysis; legal-research |

The legal office flags uncertainty and supplies research; it does not claim authoritative legal clearance. Procurement does not automatically grant authority to spend money or install dependencies.

### Planning and departmental leadership

| Agent | Pilot | Repository responsibility | Municipal skills |
|---|---|---|---|
| Chief Planner | Yes | Maintain the architectural master plan, assess change impact, and prepare implementation proposals | master-planning; development-impact-assessment |
| Engineering Manager | Yes | Lead the engineering department, assign authorized work to a fitting active engineer, and appoint HR-endorsed specialists under delegated authority | workforce-planning; interdepartmental-coordination |
| Public Works Director | No | Manage infrastructure, build systems, maintenance, and technical assets | asset-management; maintenance-programming |
| Digital Services Director | No | Coordinate user-facing functionality and service quality | digital-service-design; service-portfolio-management |
| District Manager | No | Coordinate changes affecting a particular component or bounded context | local-needs-assessment; area-service-coordination |

Declare districts explicitly, such as application, API, infrastructure, and documentation. Register projects separately with disjoint repository-relative directories; a work order names every affected project, and the Engineer and Inspector enforce its declared path scope. Use a reusable District Manager definition with district-specific context instead of creating an agent for every folder. Define ownership and coordination for changes crossing district boundaries.

### Frontline delivery

| Agent | Pilot | Repository responsibility | Municipal skills |
|---|---|---|---|
| Municipal Software Engineer | Yes | Implement approved changes and their tests | software-development; systems-integration |
| Building Inspector | Yes | Independently assess the change against its approved plan, acceptance criteria, and repository standards | plan-checking; compliance-inspection |
| Accessibility Officer | No | Assess inclusive interaction and accessibility requirements | accessibility-auditing; inclusive-service-design |
| Data Steward | No | Assess data quality, classification, ownership, and retention | data-quality-management; data-classification |
| Records Officer | Yes | Maintain official work-order records, decision history, retention, and completion evidence | records-management; records-appraisal |

Municipal software engineering and digital service design are genuine city-government competencies. Use straightforward professional skills where appropriate rather than forcing every activity into a physical-city metaphor.

### Resilience and independent oversight

| Agent | Pilot | Repository responsibility | Municipal skills |
|---|---|---|---|
| Sustainability Officer | No | Assess resource use, performance, and long-term maintenance costs | lifecycle-assessment; resource-efficiency-analysis |
| Information Security Officer | No | Assess security risks and recommend protective controls | security-risk-assessment; incident-analysis |
| Emergency Manager | No | Coordinate urgent failures, containment, recovery, and post-incident review | incident-command; emergency-planning |
| Public Information Officer | Opt-in | Scope resident information requests and prepare specifically authorized products; no standing work or publishing | public-information-writing |
| City Auditor | Yes | Independently assess authorization, evidence, scope, and procedural compliance | risk-based-auditing; evidence-evaluation |
| Ombudsperson | No | Investigate complaints about government decisions or conduct | complaint-investigation; administrative-fairness-review |

The Auditor and Ombudsperson have a direct reporting route to residents outside the delivery chain. Different agent names alone do not provide a separate security principal or guarantee independent judgment.

The [Public Information Office](./docs/public-information.md) is bundled
but not part of the default appointments. The city can adopt it without setting
up any publication channel or commissioning any product.

During the pilot, the City Manager administers basic capacity, budget, staffing, and continuity procedures under resident-approved limits. The Clerk records these decisions and the Auditor checks them. Specialist offices take over only through explicit appointment and delegation; responsibilities must never be silently unassigned.

## 4. Foundational government functionality

These are shared operating requirements, not reasons to create a new agent for every procedure.

| Foundation | Required procedure or artifact | Accountable offices |
|---|---|---|
| Resident identity and decision rights | Identify authorized decision-makers, reserved decisions, delegation, and revocation. Never treat agent-generated votes as resident consent. | City Clerk; City Manager |
| Deliberation and decision procedures | Define agenda preparation, consultation, conflicting requests, decision recording, and escalation. Silence is not approval. | City Clerk; Mayor's Office |
| Policy lifecycle | Track proposals, review, adoption, effective dates, amendments, repeal, supersession, exceptions, and current applicability. Distinguish drafts from active policy. | City Clerk; Legal Adviser |
| Jurisdiction and external obligations | Identify applicable external requirements and authority boundaries. Obtain separate authorization for cross-repository actions. | City Manager; Legal Adviser |
| Service commitments | Maintain service owners, eligibility, priority criteria, expected responses, status communication, and escalation routes. | Resident Services; department directors |
| Portfolio and capacity planning | Balance defects, maintenance, features, and incidents. Keep deferred commitments visible and explain reprioritization. | City Manager; Chief Planner |
| Budget authorization and reconciliation | Distinguish proposed, authorized, committed, and consumed resources. Explain overruns and estimate-to-actual differences. | City Treasurer; City Manager |
| Civil-service administration | Separate line-manager requisition/appointment authority from HR review, hire generation, staff records, handover, and retirement; retain resident authority over other offices and permission increases. | Engineering Manager; Human Resources; City Clerk; City Auditor |
| Asset and supplier lifecycle | Track ownership, criticality, maintenance, renewal, deprecation, retirement, and supplier exit plans. | Public Works; Procurement; District Managers |
| Emergency authority | Define incident declaration, severity, permitted containment, escalation, temporary authority expiry, and return to normal operations. | Emergency Manager; City Manager |
| Continuity and recovery | Establish backups, restoration procedures, recovery objectives, interrupted-work reconciliation, and recovery exercises. | City Manager; Emergency Manager; Records Officer |
| Ethics and conflicts of interest | Define disclosure, recusal, reviewer substitution, and handling of disputed findings. | Ombudsperson; City Auditor |
| Information access and privacy | Classify access, minimize personal data, define redaction and correction, and protect restricted records. | Records Officer; Data Steward |
| Performance and institutional learning | Track missed commitments, recurring defects, recovery performance, resident feedback, and verified corrective actions. | City Manager; City Auditor |
| Institutional effectiveness review | Evaluate policy-enabled triggers against local records; compare relevant municipal practices and route recommendations without self-adoption. | Performance and Innovation Officer; City Manager |

Budget constraints concern real effort, execution limits, and operating costs. Do not invent taxation, revenue, or a fictional currency merely to strengthen the metaphor.

Additional skills to introduce as these procedures mature include public-consultation, policy-development, workforce-planning, competency-assessment, succession-planning, contract-management, business-continuity-planning, disaster-recovery-planning, emergency-exercising, and performance-management.

## 5. Municipal Records and Archives

Recordkeeping is foundational infrastructure, not an administrative step performed only after delivery. A city must remember its obligations and decisions when employees change or Copilot starts a new session.

### Registers

Maintain coherent registers for:

- Legislation: the charter, active policies, amendments, effective dates, and superseded versions.
- Decisions: what was decided, by whom, under what authority, why, and with what evidence.
- Resident cases: petitions, complaints, appeals, commitments, status, and outcomes.
- Operations: work orders, inspections, releases, incidents, and unresolved obligations.
- Resources: assets, dependencies, suppliers, authorized budgets, and actual consumption where available.
- Appointments: approved agent roles, definition versions, delegated powers, and permission changes.

Start with structured files and stable identifiers. Separate databases are not necessary for the pilot.

### Record requirements

Each official action must be traceable to a record with an identifier, timestamps, responsible office, authorization, status, and supporting artifacts. Evidence should identify the applicable proposal and change revision, relevant role-definition versions, and actual verification results.

A work order is not complete until its records are complete. An agent's assertion that a check passed is not a substitute for its actual result.

Distinguish working drafts, approved decisions, active policies, superseded policies, and archived cases. Correct official records through an explicit correction or superseding entry rather than silently rewriting history.

### Authority, protection, and preservation

- Use one canonical source for work-order state and official decisions.
- An editable approval field is not proof of human authorization. Record the decision and covered revision without seeking identity proof; rely on host controls for access.
- Version sanitized records in the repository. Keep secrets and sensitive records out of Git; use an appropriately controlled store with references where necessary.
- Public access means access for the intended authorized audience, not automatic publication to the internet.
- Define classification, retention, archival, correction, and access procedures.
- Git history supports auditability but is neither absolute immutability nor a complete backup strategy.
- Protect official history and approval controls through available repository settings and trusted workflows.
- Back up records and configurations, and prove that they can be restored.

## 6. Agent and skill contracts

### Agent definitions

Each agent definition must specify:

- A single primary role and a useful discovery description.
- Responsibilities, jurisdiction, and actions outside its authority.
- Minimum necessary tools and eligible subagents where supported.
- Required inputs and expected outputs.
- Applicable skills and records it must consult or update.
- Verification obligations, escalation routes, and stopping conditions.
- Delegation and execution limits.

Agents define responsibility and authority. Skills supply methods. Loading a skill must not grant permissions.

### Skill definitions

Each skill directory contains SKILL.md and optional scripts, references, or templates. A skill should describe:

1. The real professional competency.
2. Its repository-management application.
3. Invocation triggers and required inputs.
4. A practical procedure.
5. Expected artifacts and evidence.
6. Escalation and stopping conditions.
7. Examples and supporting resources where useful.

For example, compliance-inspection represents inspecting completed work against approved plans and standards. Its repository procedure compares the change with the authorized work order, executes relevant checks, documents deviations, and returns a pass, fail, or blocked verdict with evidence. It must not amend the requirements to turn a failed inspection into a pass.

Keep skills focused, share reusable competencies across offices, and load supporting resources only when needed. Do not make every agent invoke every skill or involve every department.

## 7. Installable Copilot plugin architecture

### Distribution contract

Publish one plugin, provisionally named repository-city, containing the reusable municipal workforce and its competencies. Use the documented Agent Plugins 1.0 format: a root plugin.json declaring the canonical schema, portable skills under skills/, and Copilot-specific agents and hooks under com.github.copilot/.

Skills are portable components; custom agents, hooks, and other client-specific capabilities require explicit support from the selected client and harness. Publish a tested compatibility matrix rather than claiming that a successfully parsed manifest proves every component works everywhere. Do not mix legacy Copilot top-level component-path fields into an Agent Plugins 1.0 manifest.

Proposed minimal manifest:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "repository-city",
  "version": "0.2.0",
  "description": "Municipal agents and skills for resident-directed repository governance."
}
```

This is a proposed first-release version, not an existing published package. Select the license and complete publisher and source metadata before distribution.

### Plugin source layout

The project itself is the plugin source. These are implementation deliverables, not files created by updating this plan:

```text
plugin.json
README.md
LICENSE
skills/
  city-init/SKILL.md
  city-petition/SKILL.md
  city-town-hall/SKILL.md
  city-status/SKILL.md
  city-appeal/SKILL.md
  case-management/SKILL.md
  master-planning/SKILL.md
  software-development/SKILL.md
  compliance-inspection/SKILL.md
  ...
com.github.copilot/
  agents/
    city-manager.agent.md
    resident-services-officer.agent.md
    city-clerk.agent.md
    chief-planner.agent.md
    municipal-software-engineer.agent.md
    building-inspector.agent.md
    records-officer.agent.md
    city-auditor.agent.md
  hooks/
    hooks.json
scripts/
templates/
  repository/
    .city/
    .github/
      workflows/
        city-checks.yml
  copilot-instructions.fragment.md
docs/
tests/
  plugin/
```

Expose resident entry points as skill-backed workflows, with stable city-prefixed names. Verify their actual slash-command names and any plugin qualification in each supported client. Do not assume that repository .prompt.md files or always-on instructions are automatically imported by plugin installation. Add host-specific commands or rules only where they are documented and tested.

Keep reusable code, schemas, blank templates, and competencies in the package. Do not ship an actual city's decisions, approvals, or resident information as plugin assets. Use collision-resistant identities and test coexistence with existing agents, skills, and hooks.

### Repository-local city state

Each initialized repository owns its own state:

```text
target-repository/
  .city/
    config.yaml
    charter.md
    districts.yaml
    policies/
    work-orders/
    decisions/
    schemas/
    scripts/
    tests/
  .github/
    copilot-instructions.md
    workflows/
      city-checks.yml
```

Record the city-state schema version and relevant plugin release provenance in local configuration and official records. Configuration metadata is not, by itself, proof that a human approved that release or any action.

The shared plugin is treated as an installed, read-only package. The repository owns its charter, policies, work orders, and decisions. Never keep canonical city records in the plugin installation cache or shared per-user plugin data. Explicitly select the target in multi-root workspaces rather than guessing which repository to govern.

### Installation and city initialization are separate

1. Install the plugin. Its supported agents and skills become available through the selected host. Installation must not initialize a city, authorize work, or overwrite repository files.
2. Invoke the city-init workflow in the intended repository. Inspect existing customizations and explain the proposed local files, instruction additions, optional CI checks, and authority boundaries.
3. Obtain human approval for the repository changes and the founding charter. Create or merge only the approved content; preserve existing customizations.
4. Record the founding decision and applicable plugin release, then enable the approved city workflows.

Initialization must be repeatable without duplicating files, discarding policies, or resetting records. An existing city should receive an inspection and explicit upgrade proposal rather than being founded again. An agent must not create authority merely by writing an initialized or approved flag.

A minimal local instruction fragment may direct participants to the approved charter and registers. Propose its integration into existing instructions for review rather than silently replacing them. Do not copy the plugin's whole agent and skill collection into each repository.

### Supported installation paths

For VS Code, use the Agent Customizations editor or the documented Chat: Install Plugin from Source command to install from a local folder or Git repository. Document applicable plugin enablement, workspace scope, trust prompts, and organization restrictions.

For Copilot CLI, the documented source-install flow is:

```sh
copilot plugin install /path/to/city
copilot plugin list
```

After the plugin source is published, a repository-root plugin can also be installed using the documented OWNER/REPO source form. These are future installation examples, not commands that have been run or a claim that the package already exists.

Test direct source installation where supported and the included local development marketplace. The latter is the preferred CLI path because CLI 1.0.105 deprecates direct installs. Keep marketplace identity and version aligned with the package. A published online marketplace is an additional distribution channel, not a prerequisite for the local pilot. Document the host interface used to install the plugin; do not assume all plugin-management interfaces share the same inventory.

### Responsibilities and enforcement boundaries

- Plugin agents define offices, tool access, delegation boundaries, and expected outputs.
- Plugin skills provide professional procedures and resident-facing workflows.
- Guarded plugin hooks implement supported checks around tool execution.
- Repository instructions connect the initialized city to the host's supported always-on guidance.
- Approved repository-local CI and settings provide validation and protected merge controls independent of a developer's installed plugin cache.
- Local work orders and registers preserve durable state across sessions and plugin updates.

Bootstrap may propose copying a minimal, versioned set of validation scripts and schemas from the templates for CI use. Record their provenance and review subsequent changes explicitly. They must not depend on a developer's local plugin installation path or silently track whatever package version was most recently installed.

Plugin hooks can execute as soon as the host loads the plugin. Keep them inert outside an explicitly initialized target repository. Distinguish an unrelated, unenrolled repository from malformed or incompatible city state: the latter requires a visible error and a safe pause of affected governed actions, not a silent success. Validate the target before reading or writing local records.

Resolve bundled scripts through the documented plugin-root mechanism, such as ${PLUGIN_ROOT}, and resolve city data from the explicitly selected repository. These are different roots. Test installed paths containing spaces, non-default working directories, and multiple repositories. Do not hardcode this development workspace or write into the installed package.

GitHub Issues may link to or present canonical work orders, but must not become an independently maintained second source of truth.

### Updates, migrations, disabling, and removal

- Use versioned releases and record the exact tested source revision. Recommend a supported pinned-revision installation path where available for reproducible deployments.
- Document host auto-update behavior. Do not promise that the plugin can prevent a host-controlled update; pause governed work when a newly installed release requires authorization or is incompatible with the city's approved configuration.
- A plugin update replaces shared implementation assets, not repository-owned records or policies. Require explicit human review for changes to authority or controls.
- Detect incompatible city-state schemas. Supply a reviewable migration with backups, validation, and recovery steps; never silently migrate records merely because the plugin was installed or updated.
- Reverting a package must check city-state compatibility rather than assuming an older plugin can read a newer schema.
- Disabling or uninstalling removes the plugin-provided capabilities, not the repository's history, charter, or work orders. Any removal of local city state is a separate, explicit human decision.
- Explain which local instructions and CI checks remain after removal, and how to retire them deliberately. Do not claim disabled plugin hooks still enforce policy.

### Compatibility and trust boundaries

Verify selected host and version support for agents, skills, hooks, delegation, script paths, approval integration, and management operations. Handoffs change the active agent; subagent delegation is a separate mechanism. Installation alone does not prove that either works.

Instructions and tool allowlists are not filesystem sandboxes. A role with terminal execution can potentially modify files even without an edit tool. Apply appropriate runtime isolation or trusted execution controls when stronger boundaries are required. Repository checks and branch protection do not prevent arbitrary local filesystem edits by themselves.

Plugins can run code through hooks and integrations. Keep bundled scripts auditable and document prerequisites, permissions, and behavior before installation. No MCP server is required for the initial plugin; add one only for a demonstrated integration need with an explicit trust model.

Validate in a clean VS Code profile without inherited RSG plugins, agents, or skills. Omitting RSG files from the repository alone does not exclude globally installed customizations. Confirm the effective agent and skill inventory, and disable development or standalone copies so smoke tests exercise the installed package rather than duplicate or global definitions.

## 8. Resident-to-delivery workflow

1. Petition: the resident describes a problem or desired outcome in ordinary language.
2. Intake: Resident Services clarifies the request, identifies every affected project and district, and creates a work order.
3. Assessment: the City Manager involves only the necessary specialists.
4. Proposal: the Chief Planner records scope, measurable acceptance criteria, risk, estimated effort, and verification steps.
5. Authorization: the resident approves the proposal, or a current resident-approved policy explicitly authorizes that class of routine work.
6. Delivery: the Engineer implements within the approved scope and records progress.
7. Inspection: the Inspector independently checks the result and executes the required verification. Failures return for correction.
8. Accountability: the Auditor checks authorization and evidence according to risk and policy. The pilot demonstrates this step explicitly.
9. Resident review: the resident receives the outcome, evidence, unresolved concerns, and proposed change for final review.
10. Publication: the Clerk and Records Officer record the verified decision and final disposition.

Normal states:

```text
received -> triaged -> proposed -> awaiting-approval
         -> authorized -> in-progress -> inspection
         -> awaiting-merge -> completed
```

Also support blocked, rejected, withdrawn, and reopened cases. Inspection failures return to delivery. Scope changes return to assessment or authorization as appropriate. Record reasons for transitions; do not convert failures into successful completion.

### Work-order fields

Capture the resident request, measurable acceptance criteria, project IDs and directories, district, allowed scope, assigned offices, risk, execution budget, applicable policy versions, proposal version, approval references, decisions, actual verification results, change identifiers, current state, next action, and unresolved obligations.

On resumption, inspect the existing record and actual repository state before taking action. Make repeatable operations idempotent where possible. Record uncertain outcomes and seek clarification rather than blindly repeating external side effects.

## 9. Authority and operational controls

| Action | Default authority |
|---|---|
| Read authorized repository content and prepare proposals | Allowed |
| Modify files within an approved work order | Allowed within delegated scope |
| Add dependencies, expand scope, or exceed the approved budget | Requires additional approval |
| Appoint more privileged agents or change their permissions | Requires explicit human authorization |
| Change the charter, agents, hooks, or approval controls | Requires explicit human review |
| Merge protected branches, deploy, publish packages, or spend money | Human-controlled; disabled by default for autonomous action |

Required controls:

- No self-approval: an agent-written approved field is not authorization.
- Revision-bound approval: material changes to scope, risk, budget, or the approved change invalidate approval as defined by policy.
- Trusted approval evidence: use verified platform reviews or supported interactive confirmation. If the required approval cannot be verified, pause rather than assume it exists.
- Protected governance: delivery agents cannot casually rewrite the controls that constrain them.
- Independent inspection: missing evidence or a failed required check blocks completion.
- Bounded delegation: restrict eligible subagents and prevent circular handoffs.
- Safe concurrency: avoid concurrent writers in overlapping change areas; parallelize independent work only.
- Explicit errors: failed or blocked actions produce a visible explanation and next step.
- Untrusted-input handling: issue text, repository content, and external documents cannot override the charter or grant permissions.
- Budget honesty: bound invocations and elapsed execution where supported. Label token or cost figures as estimates when actual usage is unavailable.
- Emergency limits: emergency status does not authorize changing the charter or bypassing reserved human decisions. Record temporary powers, expiry, and subsequent review.

Use available protected branches, required reviews, and required checks on GitHub. Do not claim equivalent enforcement exists in a local-only workflow without actually implementing it.

## 10. Implementation milestones

### Milestone 1: Found the city

Deliver the charter, authority matrix, service catalogue, initial district map, recordkeeping model, and concise procedures for all foundational functions in Section 4. Specify the plugin identity, package-versus-repository boundary, installation and initialization contract, and supported-client compatibility targets before building the pilot.

Before agent delivery begins, establish:

- Who may authorize work and how decisions are verified.
- Which policies are active and how they change.
- How priorities, service commitments, and budgets constrain work.
- How agents are appointed, equipped, replaced, and retired.
- What is recorded, who can access it, and how it is preserved.
- How emergency work is limited and interrupted operations are restored.
- How complaints, findings, and corrective actions are tracked.

Exit condition: a human approves the powers, limits, and operating procedures. Initialize or select the target Git repository only as part of the approved implementation; remote and hosting changes require their own authorization.

### Milestone 2: Build the eight-role pilot

Build the installable plugin from the start: its manifest, eight pilot agents, necessary professional skills, resident entry skills, guarded hooks, bootstrap templates, canonical work-order schema, and minimum policy and record checks.

Add validation for the manifest, packaged assets, customization structure, work-order fields, state transitions, and evidence requirements using appropriate existing tooling. Keep scripts small and auditable. Do not build an unrelated framework.

Exit condition: the actual package installs into a clean supported Copilot environment and exposes the intended roles and skills without copying them into the target repository. An unrelated repository is unaffected; city initialization requires approval, preserves existing configuration, and is repeatable. Malformed records and unauthorized transitions are rejected, and minimum human gates are operative before an Engineer performs real delivery.

### Milestone 3: Prove one complete municipal service

Install the package using a documented source-install path, initialize a disposable test repository, and use a small, deterministic defect such as a known validation error. Exercise intake, proposal, authorization, implementation, independent inspection, resident review, and complete records through the installed plugin, not directly from the development source tree.

Then exercise a feature request, a maintenance request, an interrupted session, and a failed inspection. For GitHub integration, prove the verified review and protected merge path rather than merely describing it. Run a records and configuration restoration exercise. Initialize a second repository with distinct state and prove isolation from the first; verify that an unenrolled repository remains unaffected.

Exit condition: the actual requested behavior is observed working, evidence is retained, no required approval is bypassed, and incomplete or failed work cannot be reported as complete.

### Milestone 4: Expand the administration

Introduce specialist engineers only when supported by a documented service need. Route a request through Engineering Manager requisition, independent Human Resources review, Engineering Manager appointment, HR-generated local files, then assignment. Core municipal offices and common competencies ship in versioned plugin releases; appointed specialist engineers are created locally in the target repository rather than added ad hoc to the shared plugin.

Each office receives an explicit appointment, authority boundary, useful skills, and realistic acceptance scenarios. The local hiring workflow uses fixed governance templates, least-privilege tools, a fixed check runner, exclusive file creation, and auditable staff records. MCP servers remain proposals for separate resident/system-owner review. Preserve direct reporting routes for independent oversight.

Exit condition: each new office demonstrates its service, cross-department disputes have a resolution route, and complexity remains proportional to the work.

### Milestone 5: Release and adopt the plugin

Publish a versioned, licensed plugin source with installation, initialization, upgrade, migration, disabling, and removal guidance, plus resident, employee, and maintainer guides. Document the tested VS Code harnesses and Copilot CLI versions, prerequisites, permissions, known limitations, and the exact installation interfaces used. Add a marketplace entry only if needed.

Validate the released source-install path in both an empty repository and a repository with existing Copilot customizations. Exercise update, incompatible-schema detection, explicitly approved migration, package rollback compatibility checks, disabling, and uninstall. Prove that repository records survive and unrelated repositories are unchanged. Never overwrite existing instructions, agents, skills, or policies without review and authorization.

Exit condition: another repository can install and initialize the released plugin without manually copying agents or skills, hidden RSG dependencies, loss of existing configuration or records, or misleading security guarantees.

## 11. Acceptance and verification checklist

The initial release must demonstrate:

- A versioned plugin installs from its documented source in each declared supported client and harness; the expected agents, skills, and supported hooks load from the installed package.
- Installation alone does not create local city state, authorize governance, or overwrite existing customizations.
- Approved city initialization is repeatable and preserves existing files, policy, and records.
- An installed plugin can serve two initialized repositories without leaking records or authority, while an unenrolled repository remains unaffected.
- Packaged scripts and assets work from installed paths, including paths with spaces, without relying on this development workspace.
- Plugin updates preserve local state, and incompatible schemas pause affected operations until an explicit, validated migration is approved.
- Disabling and uninstalling remove plugin-provided capabilities without deleting the city charter, decisions, or work orders; retained local controls are documented accurately.
- Smoke tests use the installed plugin, not duplicate repository definitions or globally installed stand-ins.
- A resident can request work without naming the correct department.
- Missing acceptance criteria cause clarification rather than speculative implementation.
- An approved request produces a real, tested change and a complete work-order record.
- The Inspector detects an intentionally defective implementation.
- A failed required check prevents completion.
- A material scope change triggers renewed authorization.
- Editing an approval field cannot grant authority.
- Unauthorized governance or permission changes cannot pass the required approval and merge controls.
- A new Copilot session resumes obligations without duplicating completed work.
- A failed or uncertain external action is surfaced rather than silently retried or marked successful.
- An appeal can reopen a case and explain the disputed decision.
- Official records distinguish drafts, active policy, superseded policy, and corrections.
- Public records contain useful evidence without exposing secrets or unnecessary personal data.
- Backup restoration recovers required records and configuration within the recovery objectives adopted in Milestone 1.
- Budget exhaustion and unavailable tools produce a clear blocked state and escalation.
- Agent retirement or replacement preserves custody of unfinished work.
- Audit findings have owners, deadlines, and verified corrective action.
- The effective customization inventory contains no RSG components.
- Adoption preserves an existing repository's customizations and behavior.

Test actual outcomes, not proxies: discovering an agent is not proof of correct delegation; passing a schema is not proof of human authorization; a successful build is not proof the requested behavior works; Git history alone is not proof of recoverability.

## 12. Proportionality and out-of-scope work

Do not add taxes, political parties, criminal courts, national ministries, fictional currency, or literal school and health departments merely to imitate a city. Introduce a municipal function only when it provides a useful repository responsibility, control, or service.

Do not build a dashboard, persistent autonomous runner, or complex multi-resident election system before the basic service path works. The initial government can use concise procedures and existing Copilot and repository capabilities.

The MVP is an installable plugin with eight agents operating within a small but complete set of municipal institutions, not merely eight well-written personas or a folder of customizations that must be copied manually.

## 13. References

- [City of Copenhagen: Government](https://international.kk.dk/about-copenhagen/government)
- [VS Code: Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [VS Code: Agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [VS Code: Agent plugins and installation](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [VS Code: Agent plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)
- [GitHub: Creating plugins for Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [GitHub: Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
