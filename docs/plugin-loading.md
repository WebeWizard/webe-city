# Plugin loading and tool-error recovery

This guide is operational guidance for cities using the installed plugin.
It does not grant tools, change adopted governance, or turn plugin-source
development into a city procedure.

## Keep three locations separate

| Location | Contains | Must not be assumed |
| --- | --- | --- |
| Installed plugin root | `plugin.json`, `skills/`, `com.github.copilot/agents/`, `scripts/`, `docs/` | A copy inside the target repository, a fixed cache path, or a `city` executable on PATH |
| Explicitly selected repository/worktree root | `.city/` records and the governed project files | The plugin root, another worktree's records, or an inferred parent |
| Host session artifacts | Drafts, attachments and temporary handoff evidence | Canonical filed records or durable custody |

An installed plugin may be loaded live from a source folder rather than a cache.
Do not hardcode a user's installation path into repository instructions.

## Discover before reading or executing

1. Use the host's available plugin/customization metadata or the exact path of
   the installed agent or skill being loaded. Check the observed `plugin.json`
   and resource entries to identify the intended installation. If multiple
   enabled copies are plausible, resolve the ambiguity rather than selecting
   the first search result. Do not scan the whole home directory.
2. Use the host's exact listed skill or agent identifier, including any
   qualification. Follow that host's activation mechanism when it exists;
   reading `SKILL.md` as text is not necessarily activating the skill. Do not
   invent tool names or assume an agent can launch another agent.
3. Resolve relative Markdown links from the directory containing the installed
   file, never from the shell working directory or selected repository.
   For example, in `<plugin>/com.github.copilot/agents/city-manager.agent.md`,
   `../../skills/city-strategic-planning/SKILL.md` resolves to
   `<plugin>/skills/city-strategic-planning/SKILL.md`. From a skill's
   `<plugin>/skills/<name>/SKILL.md`, `../../scripts/city.mjs` resolves to
   `<plugin>/scripts/city.mjs`.
4. On a `Path does not exist` error, inspect the known parent once using an
   available read/search tool and correct the path from actual entries.
   Distinguish a mistaken base directory from a genuinely absent resource.
   If the installation cannot be discovered with available capabilities,
   report the missing metadata/path or access capability. Do not repeatedly
   guess directories, run unrelated executables, or copy plugin files into the city.
5. Re-discover after a plugin update, reload, session restart or changed host.
   Use the installed version's contract; a newer source checkout or an old
   conversation does not establish what the current installation supports.

The shipped layout is:

```text
<plugin>/plugin.json
<plugin>/skills/<skill-name>/SKILL.md
<plugin>/com.github.copilot/agents/<office>.agent.md
<plugin>/scripts/city.mjs
<plugin>/docs/
<repository>/.city/
```

Locally hired specialists are different: their files live in the selected
repository's `.github/agents/` and `.github/skills/`. They still discover the
installed city plugin separately; do not interpret their local skill paths as
the plugin's location.

## Inspect the installed command contract

Only an office with `execute` and permission for the scoped operation may run
these commands. Other offices send a complete inspection or filing request to
the permitted executor; a skill cannot grant terminal access.

```sh
node "<installed-plugin>/scripts/city.mjs" --help
node "<installed-plugin>/scripts/city.mjs" artifact-record --help
node "<installed-plugin>/scripts/city.mjs" status --root "<absolute-repository>"
node "<installed-plugin>/scripts/city.mjs" records-get --root "<absolute-repository>" --id "<WO-ID>"
```

Replace placeholders with verified absolute paths and quote paths containing
spaces. The hook's `PLUGIN_ROOT` is not guaranteed in an agent shell.
If Node is unavailable, report the execution-host runtime gap rather than
interpreting it as missing city records. See
[hook startup troubleshooting](../README.md#if-a-hook-blocks-initialization).

From plugin 0.13.0, `<command> --help` returns a read-only JSON `contract`,
without requiring `--root`. Global help includes `commandContracts`.
Flag names omit the leading `--`; the contract lists allowed, required,
boolean and repeated flags, data sources, source exclusivity, file/stdin
limits and default dry-run behavior. Help cannot apply a mutation. Additional
arguments alongside subcommand `--help` remain invalid.

For older installations use global `--help`. Input modes are command-specific:
0.13.0 adds file/stdin input to `artifact-record`; older releases require its
inline `--data JSON`. Do not extrapolate development-command flags to every
record command. `status` still takes only `--root`; use `records-get --id` for
exact records or select a case from returned status in memory.

For a supplied artifact payload in 0.13.0:

```sh
node "<installed-plugin>/scripts/city.mjs" artifact-record \
  --root "<absolute-repository>" --data-file "<absolute-payload-path>"
```

Use exactly one of `--data JSON` or `--data-file PATH`; `--data-file -` reads
stdin. Relative payload paths resolve from the executor's working directory,
not `--root` or the plugin. File/stdin input is bounded to 256 KiB.
Inspect the preview and reuse the same reviewed content for confirmed
`--apply`. A preview is not filing or approval.

## Recover once; preserve real blockers

For a path or syntax error, inspect the observed parent or relevant command
contract and make one corrected attempt when existing permissions allow.
Never retry an unchanged failing command. If still blocked, report the exact
operation, sanitized error code/message, attempted correction, last confirmed
state and the intervention needed. Do not expose payload secrets in diagnostics.

Prefer bounded `records-list` and exact-ID `records-get` over reads of guessed
register paths. Absent optional empty record directories are normal after a
Git checkout: reads and previews do not create them, and a confirmed write
creates its destination safely. No manual `mkdir`, reinitialization or hook
bypass is needed.

Missing required governance, referenced records, malformed state, symlinks,
non-directory register paths, incompatible provenance, access failures,
missing authority and stale required evidence are real blockers. They require
the appropriate reviewed recovery or decision, not a success-shaped fallback.
An unavailable record is not an empty register.

Do not silently change worktrees when records are absent. Ask for the explicit
canonical records checkout or an authorized, reviewed handoff. Session drafts
and uncommitted records in another checkout are not automatically available
in the selected root. Recovery never broadens scope, creates approval, or
permits otherwise prohibited writes.

## Carry verified context through handoffs

Give each delegate the verified plugin path and observed version, canonical
records checkout, exact installed resource or record references, relevant
command/input mode, current case/revision, existing authority and tool limits,
and a stopping condition. Distinguish confirmed writes from drafts and previews.
Read/search-only offices route execution rather than claiming it happened.
Do not hand off unresolved path guesses as established installation facts.

## Optional instructions for an existing city

After separate review, merge an appropriate version of this snippet into the
city's existing instructions, preserving existing content and higher
requirements. Do not automatically overwrite `AGENTS.md` or
`.github/copilot-instructions.md`. Updating operational guidance does not
silently amend the charter, appoint offices, or authorize delivery.

```markdown
## Installed Repository City resources

- Discover the intended installed plugin through host metadata or the exact
  loaded customization path. Do not assume a cache location or local /skills.
- Resolve plugin links relative to the containing installed file. Bundled
  offices are in com.github.copilot/agents/; skills are in skills/<name>/SKILL.md.
- Follow the installed docs/plugin-loading.md guide. Use exact host-listed
  skill/agent identifiers and their supported activation mechanism.
- When execution is permitted, invoke the verified absolute scripts/city.mjs
  path through Node with quoted paths and the separately selected --root.
  Inspect installed help for supported flags; do not assume a city PATH command.
- Prefer records-list/get for canonical records. Optional absent empty registers
  are normal; missing governance/referenced records and invalid state are not.
- Correct an observed path or syntax error once within existing permissions.
  Never repeat unchanged failures, bypass validation, or silently switch worktrees.
- Pass verified plugin/version, records checkout, case/revision and tool/authority
  limits to delegates. Re-discover after updates; installation grants no authority.
```

Existing generated engineers and repository instruction files are not
automatically rewritten by a plugin update.
