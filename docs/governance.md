# Governance and institutional memory

**DRAFT — 0.3.0 pilot.** The supplied templates propose responsibilities; none is adopted policy, an appointed employee, a human decision, or permission to deliver until a resident adopts them. Plugin installation is not city founding. Local initialization is paperwork, not enrollment or proof of consent. Once governance is adopted, the runtime records delivery authorization and acceptance decisions; those decisions are recorded, not authenticated.

## What is provided, and what is not

The [charter template](../templates/repository/.city/charter.md) proposes resident sovereignty, limited jurisdiction, proportional administration, independent inspection/audit, privacy, and appeals. It defines a default roster of twelve pilot offices, including the Engineering Manager, Human Resources Officer, and Performance and Innovation Officer, appointed to the bundled agent definitions only upon valid adoption of that exact charter. The initial resident's identity remains unverified: the charter treats repository access as the source of authority. These appointments grant no actual tool permissions; delivery authority arises only from a recorded authorization decision for a specific work order.

| Proposed foundation | Template |
|---|---|
| Resident identity, deliberation, jurisdiction, policy precedence/lifecycle | [Authority and policy](../templates/repository/.city/policies/authority-and-policy.md) |
| Service ownership, eligibility, commitments, priorities, portfolio/backlog | [Service catalogue](../templates/repository/.city/policies/service-catalogue.md) |
| Identifiers, provenance, classification, access, retention, correction, appeals | [Records and privacy](../templates/repository/.city/policies/records-and-privacy.md) |
| Capacity, resource reconciliation, personnel/delegation, assets/suppliers | [Resources and workforce](../templates/repository/.city/policies/resources-and-workforce.md) |
| HR review and delegated specialist-engineer appointments | [Workforce delegation](../templates/repository/.city/policies/workforce-delegation.md) |
| Bounded emergencies, backups/recovery, ethics, independent audit, verified learning | [Continuity and accountability](../templates/repository/.city/policies/continuity-and-accountability.md) |
| Council delegation of delivery authorization, routine classes, reserved matters | [Council delegation](../templates/repository/.city/policies/council-delegation.md) |
| Periodic and event-driven institutional review, recommendation routing, and evidence | [Institutional review](../templates/repository/.city/policies/institutional-review.md) |

The City Manager coordinates functions whose specialists are not installed, with explicit competence limits. A missing specialist, independent reviewer, resource limit, or authorization is a reason to pause affected work, not to manufacture expertise or consent.

**Delivery and staffing authority.** When adopted, the [council delegation policy](../templates/repository/.city/policies/council-delegation.md) delegates authorization to start delivery to the City Council. The council may authorize, reject, return, or refer each `awaiting-approval` work order, and routine classes (`documentation`, `tests`, `in-scope-fix`, `dependency-patch`) are pre-approved within scope. Reserved matters — `governance`, `security`, `deletion`, `deployment`, `publication`, `expenditure` — are always referred to the resident. The [workforce delegation policy](../templates/repository/.city/policies/workforce-delegation.md) separately delegates specialist engineering appointments to the Engineering Manager after independent HR endorsement. HR creates the files only after that appointment; the manager assigns and dispatches the engineer. These office-specific sequencing limits are instruction-level, not authenticated security boundaries. The assigned Engineer delivers on a non-default branch, the Building Inspector reviews it, and the resident reviews and merges the pull request before recording final acceptance with `complete`. An applied authorization routes to the Engineering Manager; it does not dispatch an engineer before assignment.

**Specialist workforce records.** `requisition` -> `review-requisition` -> `appoint` -> `hire` -> `assign` -> `retire`. Requisitions, appointments, staff, and assignments are local `.city/workforce/` records. A hire previews and then creates `.github/agents/` and `.github/skills/` files plus a staff record; it never overwrites existing files. Generated specialists receive only `read`, `search`, `edit`, and `execute`. The fixed check runner launches configured argument arrays with `shell: false`, but is not a sandbox: a configured program may execute code, access the network, install packages, or modify files, so HR and the resident should review each command and its side effects. MCP servers remain proposals only. Missing or edited generated files are reported as drift, not enforced. Retired staff files are retained; deletion is a separate resident decision.

**Not supplied:** authenticated identity, a trusted external approval verifier, protected merge integration, runtime-enforced separation of duties, or operational recovery arrangements. Separation of duties is defined by agent definitions and tool lists, not enforced by the runtime. The runtime never runs git, merges, pushes, or deploys; branch protection and review controls remain the repository's own. A hand-edited decision file or “approved” field is not a decision: `validate` requires every entry into `authorized` or `completed` to match exactly one decision record, and vice versa.

## Runtime and initialization contract

The first-slice runtime is a Node.js 22, zero-third-party-dependency local CLI. Every command uses an explicit absolute `--root ABS` selecting the target repository; the installed plugin root and the city-state root are different.

| Command | Scope, not authority |
|---|---|
| `init` | Propose/initialize draft local paperwork and templates; preserve existing customizations and records |
| `status` | Read local state and report its observed condition |
| `validate` | Check supported local structure/invariants, not human identity, lawful authority, or external acceptance |
| `project-add` | Register a disjoint repository-relative project directory; does not create or move project files |
| `petition` | Prepare/record an intake request associated with one or more registered projects, not authorize implementation |
| `transition` | Change a permitted lifecycle state; cannot enter `authorized` or `completed`, adopt policy, or bypass review |
| `migrate` | Upgrade a schema version 1 config to version 2 in place, preserving every record; governance stays draft |
| `adopt` | Record a resident's declaration that the current charter and policies are adopted, not authenticate it or authorize delivery |
| `amend` | Record a resident's declaration that a later charter/policy revision is adopted once governance is already adopted, appending the superseded revision to `adoption.history`; `adopt` refuses once adopted and points to `amend` instead |
| `authorize` | Record a City Council or resident decision (authorize, reject, return, refer) on an `awaiting-approval` order; not authenticated |
| `complete` | Record the resident's acceptance of an `awaiting-merge` order after the pull request is merged, with evidence; not authenticated and does not merge |
| `requisition` / `review-requisition` | Record an Engineering Manager staffing request and an independent HR endorsement/decline under the adopted workforce delegation policy |
| `appoint` / `hire` | Record the Engineering Manager's delegated appointment after HR endorsement, then let HR preview and create the specialist's local agent, skill, toolkit, and staff record |
| `assign` / `retire` | Assign an authorized order to an active engineer, or have HR record retirement and handover without deleting generated files |
| `records-list` | Read bounded metadata for supported canonical local records, optionally filtered by type, exact ID, work order, project, or status |
| `records-get` | Read a batch of exact canonical record IDs and optionally their first-degree links; never searches arbitrary repository paths or external stores |
| `review-record` | Preview or record a due institutional review and its cited recommendations; it refuses unless current adopted policy enables a trigger and does not approve any recommendation |
| `records-request` | Preview or record a specific cross-office request for missing/ambiguous records under `.city/records-requests/` |
| `records-resolve` / `records-cancel` | Resolve every request item with an explicit outcome and current record references, or cancel an open request; writes require preview plus `--apply` |

For mutating commands, review the proposed changes and obtain explicit confirmation **before** supplying `--apply`. Without it, writes are not permitted. This flag signals permission for the local paperwork operation; it is **not authentication** and cannot prove that a human confirmed anything. `status` and `validate` are read-only. Use runtime help for exact arguments, states, and transitions. `authorized` is entered only through `authorize` and `completed` only through `complete` (`AUTHORIZATION_REQUIRED` otherwise). Both require adopted governance (`NOT_ADOPTED`) with no drift (`GOVERNANCE_DRIFT`); council decisions also require the adopted delegation policy (`NO_DELEGATION`), cannot authorize reserved matters (`RESERVED_MATTER`), and take no resident declaration. Resident decisions require `--declared-by` and `--evidence`. Returning an order to `triaged`, `proposed`, or `reopened` voids its authorization; `blocked` orders resume delivery only while authorization is current.

Local configuration, districts, and projects use `.city/config.json`, `.city/districts.json`, and `.city/projects.json`, rather than the plan's illustrative YAML names, to use Node's built-in JSON parser without a parser dependency. Districts describe ownership; projects describe disjoint delivery directories. The runtime initializes these files dynamically; the template bundle does not precreate configuration, districts, live records, or decisions.

**Records exchange.** Offices use `records-list` and `records-get` for routine discovery and retrieval; successful reads do not create requests. When records are missing or need a source-office response, the City Manager routes a precise request to the Records Officer. A request records the requester label, purpose, optional related work order, exact requested items, and append-only `open` to `resolved` or `cancelled` history. Resolution reports every item as `found`, `not-found`, `withheld`, or `unavailable`; `found` references must match a supported canonical path and current SHA-256 digest. These are local provenance checks only: office labels and hashes do not authenticate identity, establish access permission, or preserve immutable historical bytes. Requests are not work orders and do not authorize delivery. Existing cities without `.city/records-requests/` remain valid; initialization creates it for new cities, and an applied records request creates it for older cities if needed.

Every new work order selects one or more registered project IDs. Runtime validation checks project declarations and work-order references, and status reports counts by project. The project path is a declared scope, not a filesystem sandbox; the Engineer must keep edits inside those directories and the independent Inspector checks changed paths. Existing work orders without project IDs remain valid and are reported as unassigned. They are never automatically assigned based on their title or file locations. In a previously initialized city without `projects.json`, the first `project-add` writes that register after the resident reviews its dry-run.

A `.city/config.json` marked `governance: "draft"` means no adoption has been recorded. Editing that field by hand cannot promote governance: validation rejects `"adopted"` without a complete adoption record, and the hook then denies tool calls.

`governance: "adopted"` (config schema version 2, first written by `adopt` and later updated by `amend`) records the adoption date, the SHA-256 and optional version label of `charter.md`, digests of every policy, the declaring resident, and an evidence reference. **Evidence rule:** the record uses `rule: "resident-declaration"`, matching the charter's position that repository access is the source of authority, and always `authenticated: false`. It is a recorded declaration, not authenticated identity or verified adoption. Under the default charter, valid adoption includes appointment of the listed pilot roster; the CLI cannot verify that condition or grant actual permissions. Adoption is the prerequisite for delivery decisions, not itself an authorization. `status` and `validate` report drift if the charter or policies change after adoption; drift never locks the repository or the hook, but it blocks `authorize` and `complete` until the revision is recorded. A resident can record that drift as a deliberate amendment with `amend --summary TEXT --apply`, which writes a new current `adoption` revision and appends the exact superseded revision (its own date, digests, evidence, and the resident's `--summary`) to `adoption.history`, oldest first; history entries are never rewritten or reordered, and `validate` rejects a tampered or discontinuous history. A successful validation still cannot authenticate an approval, and `amend` never returns governance to draft or marks any evidence authenticated.

Schema version 1 decision entries remain proposal-only (`kind: "proposal"`, `status: "proposed"`). Schema version 2 entries, written only by `authorize` and `complete`, are `kind: "authorization"` or `"acceptance"` and record the decider (`city-council` or `resident`), basis (`council-delegation`, `routine-policy`, or `resident-decision`), outcome, reserved matters, reason, SHA-256 digests of the work order, charter, and delegation policy, and `evidence.authenticated: false`. They are recorded decisions under the charter, not verified consent. `status` reports council availability under `council` and referred orders under `workOrders.awaitingResidentDecision`.

**Existing cities.** Records from 0.1.0 and 0.2.0 remain valid. A city initialized before 0.3.0 can add `.city/projects.json` with its first reviewed `project-add`; existing schemaVersion 1 work orders remain unassigned and are not rewritten. New petitions create schemaVersion 2 work orders with required project IDs. Plugin 0.2.0 cannot read these new work orders, so do not alternate old and new plugin versions against a city after creating one. To enable council delegation, copy `policies/council-delegation.md` and the updated `charter.md` from the plugin templates into `.city/`, review them, and record the revision with `amend` (or `adopt` while still draft).

To enable specialist hiring in an existing city, similarly copy
`policies/workforce-delegation.md` and the updated `charter.md` from the plugin
templates into `.city/`, review the new appointment authority and eleven-office
roster, then record the policy revision with `amend` (or `adopt` while still
draft). The records-only `status` and `validate` reports do not enforce which
agent is invoked: the host's wildcard delegation cannot be restricted to a
folder or staff directory, and this feature adds no hook guard.

The proposed [instruction fragment](../templates/repository/.city/instruction-fragment.md) may be copied to `.city/instruction-fragment.md` as paperwork. It is **PROPOSED**, not automatically active. Only after separate explicit approval may users merge suitable text into their existing `.github/copilot-instructions.md`; initialization does not edit `.github/` or grant powers. No project license is selected by initialization or these templates.

## Storage separation and institutional memory

| Location | Ownership and purpose |
|---|---|
| Installed plugin | Shared definitions, skills, runtime, and templates; not the canonical store for any city's records |
| Selected repository's `.city/` | Repository-owned charter/policies, configuration, and supported canonical intake and decision records; independent across repositories and plugin updates/removal |
| Separately controlled storage | Necessary restricted records, secrets in their approved secret system, and independently protected authorization evidence; repository records contain only safe references |
| Separate backup destination | Approved, appropriately protected recovery copies with distinct failure/access boundaries; Git history alone is insufficient |

Durable linked records, not an individual agent's memory or conversation, preserve decisions and unfinished obligations. The proposed logical registers cover legislation, decisions, cases, operations, resources, and appointments. They do not require new databases or one directory per function, and this slice does not implement every register/workflow.

Use stable identifiers, actual timestamps, responsible offices, clear status, revision/provenance links, and actual verification evidence. Keep one canonical source per matter. Issues and external presentations should link to it rather than maintain competing work-order state. Missing evidence stays missing; an assertion that a check passed is not its result.

| Proposed custodian | Distinct duty |
|---|---|
| City Clerk | Identify actual decision rights; maintain agendas, adoption/decision provenance, policy applicability, and linked registers |
| Records Officer | Manage classification, appropriate access/storage, lawful retention, preservation, correction, archives, and recovery evidence |
| City Auditor | Independently assess completeness/integrity and conflicts; report directly to the resident and verify corrective actions without editing evidence to approve itself |

These duties do not take effect before valid adoption of the default charter, and none grants arbitrary access or makes an editable record immutable. Preserve originals and linked corrections/supersessions where lawful; protect restricted originals and handle lawful redaction/erasure without reproducing removed data. Distinguish **draft**, adopted-but-not-effective, **current**, and **superseded/repealed** policy from open/closed cases and archived records.

## Privacy and real control boundaries

Public reasoning is for the intended authorized audience, not automatic internet publication. Minimize personal data; keep secrets and restricted originals out of Git, CLI arguments, prompts, and logs. A public repository cannot hold material intended only for a restricted resident audience. Until suitable storage/access and a lawful basis are approved, do not collect restricted material in intake.

Human-approved classification, retention/deletion rules, access owners, backup arrangements, RPO/RTO, and restoration exercises remain **TBD**. No SLA, recovery promise, budget, passing exercise, or completed audit should be inferred. The policies require actual evidence and owned, independently verified corrective actions.

Instructions and tool allowlists are not filesystem sandboxes; terminal access may still modify files. Plugin hooks are not a complete enforcement boundary: host timeouts can fail open and disabled/uninstalled plugins do not enforce anything. Structural local validation cannot prove consent, prevent arbitrary edits, or protect remote merges. Repository permissions, protected workflows/branches, independent verification, and appropriate execution isolation require real implementation by their authorized owners. Remote merge protection alone does not prevent local filesystem changes.

## Manual adoption and later phase gates

1. **Approve paperwork separately.** An actual repository-authorized human selects the target, reviews initialization changes, and confirms local draft writes. Installation or `init --root ABS --apply` does not adopt the charter or enroll the human as a resident.
2. **Resolve the proposed institution.** Establish the real initial resident's identity/rights and external obligations. Review the exact charter/policy revisions, reserved decisions, roles/permissions, resource limits, service commitments, retention/access, and recovery needs. Leave unresolved items visibly pending, not automatically approved.
3. **Decide what repository controls you need.** Decisions are recorded under the charter's rule that repository access is the source of authority. If you need stronger assurance — authenticated approvals, required reviews, protected branches — configure them in the hosting platform; this plugin does not provide them.
4. **Adopt.** The resident reviews the exact revisions, including the council delegation policy if wanted, and records adoption with `adopt` (later changes with `amend`), including evidence references and effective dates. Adoption of the unmodified default charter includes its listed pilot appointments; changes to that roster or appointments to other offices require separate explicit authority. Filing an adoption claim or changing a JSON field is not that process.
5. **Run a controlled service.** With adoption and a recorded authorization, a request proceeds through delivery on a branch, independent inspection, resident merge, and `complete`. Verify recovery and corrective actions with actual evidence. Introduce specialists or multi-resident procedures only by separate justified approval.

Delivery decisions are recorded, not authenticated, and are unlocked only by recorded adoption, never by a plain `transition`. Existing repository workflows are not replaced or granted authority by this plugin.

No CI placeholder is included here. Future repository-local validation/CI assets must be self-contained, tested against the matching runtime/state version, explicitly approved, and independent of a developer's installed plugin cache. Do not imply that a missing CI check or approval integration already protects the repository.
