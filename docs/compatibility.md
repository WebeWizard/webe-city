# Compatibility and verification

This is an experimental, private pilot. Do not infer host support from the
manifest version alone.

## Package contract

The package uses Agent Plugins 1.0:

- Root `plugin.json` declares the canonical 1.0.0 schema.
- Portable skills are immediate subdirectories of `skills/`.
- Copilot-specific agents live in `com.github.copilot/agents/`.
- The native Copilot hook configuration is
  `com.github.copilot/hooks/hooks.json`, using `version: 1`,
  `preToolUse`, `timeoutSec`, and an installation-relative `PLUGIN_ROOT`.
- No MCP server, automatic prompt submission, or always-running service is
  required.

The City Manager can reuse a delegate for related follow-ups on the same work
order when the host exposes multi-turn subagent messaging. Coordinators prefer
background delegation where supported, track returned handles and launch modes,
and wait for results; independent work may run concurrently but conflicting
record writes are serialized. If background dispatch is unavailable, the caller
routes handoffs returned by synchronous delegates. Bundled offices have separately named
`list_agents` and `write_agent` tools to message available peers directly without
the broader `agent` tool. Host support, peer visibility and handle lifetime vary;
where direct communication is unavailable, the Manager routes the handoff.
Listings may include the caller itself, synchronous agents, or stale handles;
they do not establish a distinct messageable peer. An explicit sync-mode
rejection is not delivery, so return the complete request and attributed draft
to the caller for routing. Uncertain delivery must be resolved before retrying
or dispatching duplicate work. The plugin cannot enforce a host's launch mode,
identify the caller without host-provided identity, or guarantee message delivery.
Adopted charters or policies may require Manager routing even when messaging
works; existing cities must amend them through their normal governance process
before using a newly permitted direct handoff. Plugin updates do not amend them.
Messages are not canonical records.

### Engineering task continuity

Launch mode is not inherited by nested agents. Engineering Manager must
explicitly select background mode on its engineer's own launch (`mode:
"background"` with the host's `task` tool), then retain the returned handle,
launch mode and assignment for related design, plan and implementation
iterations. City Manager retains that mapping but routes engineering follow-ups
through Engineering Manager; a resident-review pause is not a staffing failure.
This adapts a municipal line manager's continuing assignment to session-local
host tasks, not a new appointment or persistent runtime worker.

When the host cannot resume or message a delegate, the caller routes its
synchronous handoff. A replacement requires confirmation that the prior task
finished or delivery was explicitly rejected; uncertain delivery must first be
resolved. The replacement receives the latest complete handoff, artifact
revisions, resident choices and confirmation evidence, current assignment and
remaining task, rather than restarting intake or initial planning. All approval
gates remain in force. Plugin updates do not convert existing synchronous
agents into background agents or rewrite generated specialists.

The runtime requires Node.js 22 or later. No runtime npm installation is
necessary. Development tests use the `yaml` package to parse actual frontmatter
rather than testing it with text matching alone.

The hook's Node runtime must be on the execution host's inherited PATH.
VS Code's embedded runtime and terminal-only version-manager activation do not
make `node` available to hook subprocesses. See the
[hook startup troubleshooting](../README.md#if-a-hook-blocks-initialization).

Initialization publishes a staged directory over an exclusively reserved,
identity-checked empty destination, without overwriting existing enrollment.
Windows permits a directory to replace a file but not an empty directory, so
the reservation is a file on Windows and a directory on other platforms.
This platform adaptation retains collision checks and identity-checked cleanup.

## Verification scope

Plugin 0.13.2 ships thirteen default pilot offices, an opt-in Public Information
Officer, 30 skills, explicit project registration,
project-scoped work orders, and the engineering workforce offices. The 0.2.0
release added the City Council and delivery decisions, including
`city-delivery-authorization`. The 0.3.0 workforce process separates line
management from HR, records requisitions/reviews/appointments/assignments,
and creates specialist agent, skill, toolkit, and staff files locally after
the recorded approval sequence. Automated package/runtime tests and the
packaged smoke scenario cover the recorded delivery lifecycle, project
registration/scoping, and specialist hiring/assignment. These records and
office separations do not authenticate the agent that invoked a command, and
the feature does not add a hook guard. Institutional review thresholds are
evaluated from the adopted policy and local records when the City Manager
coordinates work; no background scheduler runs while the plugin is inactive.
Development screening and Advisor preparation append optional metadata to work-order
versions 1/2 without migration. Adopted development policy gates subsequent
authorization; old policy sets and earlier delivery remain valid. Automated tests
and smoke cover lightweight and formal Advisor/independent-Planner routes. Office
sources and policy citations are professional unauthenticated evidence, not an NLP
classifier, runtime-verified identity or external permit.
The optional building-permits policy extends those records without changing
work-order or decision schema versions: it records two risk classes, qualified
staff statements and independent verification for higher classes, permit
conditions and deadlines, and a completion notice before inspection. The policy
is inert until adopted; old authorizations remain valid. Structured
dispensations, neighbour consultation, retroactive legalization and physical
inspection are not implemented. See the
[building-permits guide](./building-permits.md).
The [Public Information Office](./public-information.md) is an instructional
workflow over the existing records. Installation and ordinary adoption create no
information products or distribution channels. There is no new CLI or hook
guard for commissioning or release.
The host observations below were made
with the 0.1.0 package (eight offices, 21 skills) and have not yet been
repeated for 0.2.0 through 0.13.2.

The 0.13.0 loading changes add a shared operational guide, read-only scoped
command help and machine-readable contracts, and bounded artifact file/stdin
input. Automated coverage exercises help without city access, content-preserving
preview/apply/retrieval, invalid inputs without writes, resource links and
packaged recovery from an unrelated working directory with absent empty registers.
These checks do not prove model-driven skill activation or successful office
handoffs in a fresh host session. A current-version clean-profile host exercise
remains required before claiming those behaviors are observed. Existing
instructions and generated specialists are not automatically rewritten.
See [plugin loading and recovery](./plugin-loading.md).

The 0.13.1 background-first handoff guidance is instruction-based. Package
checks cannot establish that a host follows it, identifies self-listings, or
delivers messages; a fresh host exercise is still required.
The 0.13.2 guidance makes nested engineer launch mode explicit and preserves
same-assignment continuity and replacement context. Content checks cover these
instructions, not model compliance; fresh host verification remains necessary.

Observed on macOS with Node.js 22.23.2 and official Copilot CLI 1.0.105:

- Canonical manifest, actual YAML frontmatter, delegation references, resource
  links, and distributable contents pass automated checks.
- Both direct local installation and the included local marketplace register
  successfully. Marketplace installation and the host's `skill list` discover
  all 21 city skills in a clean personal-home context, without inherited
  organization-specific skills.
- The packaged plugin, without development dependencies, completes the actual
  draft initialization, petition, transition, and validation scenario in two
  isolated workspaces.
- Hook subprocess tests observe inert output for unrelated workspaces and a
  denial for malformed or incompatible enrolled state. `toolArgs` may be a
  JSON object or opaque text (as sent by patch-style tools); text is never
  parsed or echoed. Denials name the specific validation cause when it is a
  known city error; unexpected filesystem errors stay generic.
- The Engineering Manager's `agents: ["*"]` is an instruction-constrained
  delegation list, not a folder or staff-directory boundary. The host/runtime
  cannot enforce that it invokes only active staff, Human Resources, and the
  Inspector; no tool guard is installed for these hires.
- Specialist agent and skill definitions are created in the target repository
  only after adopted workforce delegation, HR endorsement, and an Engineering
  Manager appointment. Generated check scripts use configured argument arrays
  without a shell, but are not a sandbox: commands may still execute code,
  access the network, install packages, or modify files. Proposed MCP servers
  are not installed.
- Actual CLI disable, enable, and uninstall operations preserve every byte of
  an initialized city's records and leave live plugin source intact. Disabled
  city skills no longer appear in the host's available skill list.

All CLI registration and lifecycle checks used isolated Copilot configuration
and cache locations, not the developer's normal plugin inventory.

### Local development behavior

CLI 1.0.105 warns that direct source installs are deprecated. Prefer the
included `repository-city-local` marketplace.

A local marketplace plugin is loaded **live from its source directory**.
The host does not necessarily copy it into an installation cache; edits become
available in subsequent sessions. Use a reviewed source revision and do not
treat a local development directory as an immutable release.

In this CLI version, uninstalling a live local plugin disables it and leaves
its source discoverable in the marketplace. `plugin list` can therefore still
show the plugin with `enabled: false`. This is not deletion of source or city
records. Remove the local marketplace separately if you no longer want it
registered.

| Surface | Required evidence |
|---|---|
| Node runtime | Actual initialization, petition creation, guarded transitions, adoption, `authorize`, `complete`, bounded record list/get, records-request create/resolve/cancel, validation, and hook subprocess outputs |
| Installed package | Install from source into an isolated plugin inventory, list the plugin, then run its installed scripts |
| VS Code host | Observe the offices and skills in the intended harness and exercise the workflows in a fresh session |
| Hook enforcement | Observe that the target host invokes the hook and honors its denial, not merely that the script emits JSON |
| Delivery decisions | Recorded with `authenticated: false`; host and platform permissions control access. No identity verification claimed |
| Protected merges and deployment | Not performed by the runtime; the resident merges. Use the hosting platform's branch protection |

Automated tests and a CLI installation do not establish VS Code UI discovery,
model-driven delegation (including council referral), actual hook invocation,
or authenticated human identity. These require their own evidence. No VS Code minimum version
or harness compatibility is claimed until observed.

## Adoption checklist

1. Use a disposable repository and a clean profile or isolated Copilot home.
2. Review publisher and executable hook contents before enabling the plugin.
3. Install through one documented interface and record the client version.
4. Start a fresh session and inspect the effective agents and skills.
5. Confirm there are no duplicate development copies or inherited substitutes.
6. Exercise the resident initialization and intake workflows.
7. Test a malformed city record and verify the host actually honors the hook.
8. Disable and remove the plugin; verify repository records remain.

Other agents, skills, hooks, and repository instructions may coexist with the
plugin. The plugin cannot silently remove or override them. Use a clean profile
when proving the absence of unwanted organization-specific customizations.

## Record compatibility

Records written by 0.1.0 through 0.13.1 remain valid under 0.13.2.
Plugin 0.13.2 changes engineering task continuity guidance without changing
record shapes or governance gates. Earlier plugins reject 0.13.2 provenance;
use a compatible backup to roll back.
Plugin 0.13.1 changes coordination guidance without changing record shapes or
governance gates. Earlier plugins reject 0.13.1 provenance; use a compatible
backup to roll back.
Plugin 0.13.0 changes CLI input/help and operational guidance without changing
record shapes or governance gates. Earlier plugins reject 0.13.0 provenance;
use a compatible backup to roll back. No charter amendment is required merely
for the new input/help support; adopted policies remain in force.
Plugin 0.12.1 permits completion notices for active authorized permits even
when later governance changes make the planning screening stale. Earlier plugins
reject 0.12.1 provenance; use a compatible backup to roll back.
Plugin 0.12.0 adds the `awaiting-acceptance` work-order state for inspection
after merge. Earlier plugins cannot read records using the new state or 0.12.0
provenance; roll back only by restoring a compatible backup. Existing adopted
charters and policies still apply until explicitly amended; installation alone
does not authorize a different merge sequence.
Plugin 0.10.0
allows null resident attribution and references in adoption, amendment, decisions,
and permit extensions. Earlier plugins may reject records with these null values;
restore a compatible backup to roll back. Existing adopted charter and policies
are not silently rewritten: review changes and use `amend` to adopt them.
Plugin 0.11.0 optionally records `list_agents` and `write_agent` in specialist
workforce records; earlier versions reject those records. Existing generated
staff files are not changed. An existing city must amend its workforce policy
to enable the new opt-in marker before requesting or hiring specialists with
those tools.
Plugin 0.9.0 adds optional petition revision history and case snapshots. Earlier plugins reject
orders containing `requestRevisions`; do not alternate plugin versions after
using that feature. Snapshot digests are local coordination aids, not authority.
Plugin 0.8.2
improves the completeness of Planner revision feedback without changing record shapes.
Plugin 0.8.1 improved resident consultation on planning blockers without changing
record shapes. Plugin 0.8.0 added
[development CLI preview summaries and file/stdin input](./development-applications.md)
without changing record shapes; new provenance records the current plugin version.
Plugin 0.7.0 added
optional work-order `fileParts` with `.city/work-order-parts/` and optional
statement `supersedes`, `correctionReason` and `evidenceArtifactId`. No migration
is required. Earlier plugins reject cities that use them explicitly as unknown
fields; see [file parts and statement corrections](./work-order-file-parts.md). Plugin 0.1.0 cannot read
0.2.0 delivery states (`authorized` through `completed`) or schemaVersion 2
decisions, and its hook denies such a city. Plugin 0.2.0 cannot read schemaVersion
2 work orders, which require project IDs; 0.4.0 also adds schemaVersion 3
infrastructure work orders. Plugins before 0.4.0 cannot read those records;
roll back only by restoring
`.city/` from a backup. Existing cities enable council delegation by copying
the new policy and charter from the templates and recording them with `amend`;
see the [README](../README.md#upgrading-a-010-city).

## Official references

- [VS Code plugin installation](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [Agent plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)
- [Copilot CLI plugin authoring](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [Copilot hook contract](https://docs.github.com/en/copilot/reference/hooks-reference)
