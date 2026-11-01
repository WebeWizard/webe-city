---
name: city-init
description: "Use when a resident explicitly requests Repository City initialization, city-init, founding drafts, enrollment inspection, or a preview of repository-local governance files."
user-invocable: true
disable-model-invocation: true
---

# Initialize a Draft City

## Purpose and inputs

Prepare repository-local governance drafts only after an explicit resident request.
Plugin installation is not enrollment, charter ratification, or authorization.
Require an explicitly selected absolute repository root and an optional city name.
In a multi-root workspace, have the resident select the target; never guess.

## Resolve the installed tooling

- Discover the [packaged CLI](../../scripts/city.mjs) relative to this installed
  skill. Resolve its actual installed filesystem location before executing.
- In examples, replace `<installed-plugin>` and `<absolute-repository>` with the
  resolved package and selected target. Quote paths, including spaces; do not
  assume the current directory is either root or rely on Markdown variable expansion.
- Require Node.js >=22 (`node --version`). No runtime `npm install` is needed.
- A skill grants no execute permission. If the active role lacks it, return the
  preview procedure to the resident/permitted operator; do not bypass it by editing.

## Procedure

1. Inspect the target, existing `.city`, and existing repository customizations
   without modifying them. An unrelated repository must remain unaffected.
2. If city state already exists, use `status` and `validate` with this explicit root.
   Report existing drafts, conflicts, or incompatibility; do not reset records,
   silently migrate, or treat a malformed city as unenrolled.
3. Preview initialization; omit `--name` if no name was supplied:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" init --root "<absolute-repository>" --name "<name>"
   ```

4. Explain the exact preview: `.city/config.json`, `.city/districts.json`,
   `.city/projects.json` (initially empty), draft charter/policies and records
   structure, and `.city/instruction-fragment.md`. Check for collisions and
   preserve existing content. Project directories are registered separately
   before intake.
5. Explain that governance starts **draft**. Owner procedures, records-only privacy,
   resident sovereignty, and recovery proposals still need resident review.
6. Require actual resident confirmation of the reviewed files and target before
   repeating the same arguments with `--apply`:

   ```sh
   node "<installed-plugin>/scripts/city.mjs" init --root "<absolute-repository>" --name "<name>" --apply
   ```

7. Without that confirmation, stop at the preview. `--apply` is only a write request,
   not an authentication mechanism or verified consent. Never fabricate confirmation.
8. After an actual apply, run the packaged `validate --root "<absolute-repository>"`
   and `status --root "<absolute-repository>"`; report observed results or failures.
9. Treat `.city/instruction-fragment.md` as a proposal to merge after separate review.
   Do not automatically touch `.github`, merge instructions, enable CI, or copy
   the plugin's agents/skills into the repository.

## Return and boundaries

Return target root, resolved CLI location, Node version, preview/applied distinction,
actual changed paths, validation/status results, collisions, and remaining decisions.
Do not write canonical records into the installed plugin.
This command cannot ratify the city, verify approval, authorize delivery, merge
changes, or authenticate adoption. Council authorization needs adopted governance
that includes `policies/council-delegation.md`. Conclude **draft city only**.
