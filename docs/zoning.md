# Repository zoning

## Municipal concept and repository adaptation

Municipal zoning regulates land uses and development standards under an adopted
plan. In Repository City, zoning is a separate, opt-in rule layer that assigns
permitted, conditional, or prohibited **change types** to repository paths.
Paths are a limited land-use analogy; the map grants no filesystem permissions
and is not a sandbox.

Keep the registers distinct:

- `.city/projects.json` defines delivery-scope directories.
- `.city/districts.json` describes declared ownership.
- `.city/zoning.json` classifies which kinds of change are permitted in those
  repository areas.

This pilot does not implement overlays, variances, or grandfathered/nonconforming
uses. A prohibited or unknown finding must be resolved through a plan or map
amendment; it cannot be waived by the zoning check.

## Map format

`schemas/zoning.schema.json` defines the strict JSON shape. Each zone has a safe
ID, name, normalized repository-relative path, description, and rules. Zone
paths must be disjoint; use `"."` only for a single zone covering the repository.
Paths cannot include `.city`, `.git`, traversal, absolute paths, or Windows
separators.

Supported change types are `documentation`, `tests`, `bugfix`, `refactor`,
`feature`, `public-interface`, `dependency`, `data-migration`, `security`,
`deletion`, and `generated-code`. Each rule uses one disposition:

- `permitted`: no additional zoning review.
- `conditional`: lists at least one named requirement; requires a formal
  development application and an independent ready assessment.
- `prohibited`: not ready for authorization.

An omitted change-type rule, unmatched path, or missing map is **unknown**, not
permitted. A minimal example:

```json
{
  "schemaVersion": 1,
  "zones": [
    {
      "id": "documentation",
      "name": "Documentation",
      "path": "docs",
      "description": "Repository documentation.",
      "rules": [
        { "changeType": "documentation", "disposition": "permitted", "requirements": [] },
        { "changeType": "feature", "disposition": "prohibited", "requirements": [] }
      ]
    }
  ]
}
```

The map is not inferred from project or district ownership. Every project root
or infrastructure target in the work order is matched to one zone, and each
selected change type is evaluated in every matched area.

## CLI and readiness

All commands require an explicit absolute `--root`; mutators default to dry-run.
`--apply` requests a local write, not authenticated consent.

Record or replace a validated map:

```sh
node "<installed-plugin>/scripts/city.mjs" zoning-map --root "<repository>" --data '<map JSON>'
```

Record a professional classification and check:

```sh
node "<installed-plugin>/scripts/city.mjs" zoning-check --root "<repository>" --id "<WO-ID>" --data '{"changeTypes":["documentation"],"reason":"Contained documentation change.","evidence":"Reviewed the request and its registered project scope."}'
```

Both require `--apply` to persist. The zoning finding records the classified
change types, each declared path's zone and determination, reason, evidence,
unauthenticated source role, and a snapshot of the map and scope. When zoning is
adopted, changes to the map, scope, or assessed change types make the previous
development screening stale.
The CLI checks declared project directories and exact infrastructure targets;
it does not inspect or infer changed files.

When the policy is adopted, zoning map and check readiness join the existing
development gate before authorization. `conditional` requires formal screening,
an application covering its named requirements, and an independent ready
assessment. `prohibited` and `unknown` remain not ready. A `permitted` finding
does not authorize work or replace existing development, Council/resident,
inspection, or acceptance steps.

## Governance, records, and limits

New cities receive this policy at `.city/policy-drafts/zoning.md`, outside the
active policy register. Ordinary charter adoption therefore does not enable
zoning. To opt in before first adoption, copy it to `.city/policies/zoning.md`.
Existing cities must copy it into that policy directory, amend the charter, and
record the revision with `amend`; policy-only additions are refused. Zoning must
be adopted alongside `policies/development-applications.md`, which provides the
conditional-review route. If adopted without a map, zoning readiness reports
that the map is missing; record a reviewed map before seeking authorization.
Unadopted maps and findings do not invalidate existing development preparation
or impose conditional-review requirements.

The Chief Planner proposes and assesses; Council or the resident decides;
the Clerk records; and the Building Inspector checks actual delivered changes
against the adopted map. The `zoning-map` command only records a JSON map. It
does not verify a Council/resident decision, authenticate an office, or enforce
the municipal separation of duties. Map amendments should follow the ordinary
work-order and decision process, preserving the decision reference and evidence.
An independent audit may review how rules are applied and whether map amendments
are being used to evade them.
