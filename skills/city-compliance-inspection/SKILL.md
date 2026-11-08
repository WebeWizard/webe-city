---
name: city-compliance-inspection
description: "Use when independently inspecting existing changes, testing conformity, documenting deviations, evaluating check output, or returning evidence-based pass, fail, or blocked findings."
user-invocable: false
---

# Compliance Inspection

## Competency and application

Municipal inspection compares actual work with applicable plans and standards.
For software, inspect the exact change and its evidence independently from the
author, without fixing defects or treating a passing test as authorization.

## Triggers and inputs

- Use for an existing diff, supplied implementation evidence, or a conformity check.
- Require root, case, inspected revision, criteria, plan, applicable standards,
  relevant existing checks, and source evidence for claimed authority.
- If no implementation exists, perform plan checking instead; do not invent one.

## Procedure

1. Identify the exact artifact/revision and the reviewer's authorship conflicts.
   A different agent name alone does not establish independent judgment or identity.
2. Map each criterion to source evidence and the smallest meaningful check.
   A missing or unlinked authorization decision blocks delivery-level clearance.
3. Read the actual change and surrounding behavior. Compare scope, error handling,
   interfaces, tests, and operational assumptions with the stated requirements.
   When zoning is adopted, compare actual changed paths and change types with the
   current map and recorded zoning finding; a CLI scope check does not inspect the
   diff or replace this independent review.
4. If execute is available, inspect commands and project scripts for side effects
   before running existing relevant checks. Avoid installs, auto-fix, formatters,
   migrations, arbitrary case commands, and writes to inspected artifacts.
5. If safe execution controls or prerequisites are unavailable, mark the check
   not run and explain why. Do not imply that a static read is a passing test.
6. Record command, scope, result/exit status, inspected revision, and relevant output.
   Preserve only necessary evidence, excluding secrets and excessive logs.
7. Classify each criterion `pass`, `fail`, or `blocked`; distinguish advisory issues
   and unreviewed areas. Never change a requirement to obtain a pass.
8. Return reproducible findings for Clerk recording. Do not edit source, tests,
   plans, records, or controls, even through terminal commands.

## Structured result and evidence

Return root/case/revision, review type, criterion-to-evidence matrix, commands and
observed results, not-run checks, file-specific findings, conflicts, gaps,
and an overall scoped verdict.
For a failure, give expected versus observed behavior and a reproduction description,
not an implemented repair.

## Escalation and limits

- Skills grant no permissions. Terminal access can write files despite no edit
  tool; this restriction is not a sandbox. Unsafe inspection stops as blocked.
- Local approvals and `--apply` do not authenticate authority; decisions are
  recorded with `authenticated: false`.
- For an order in `inspection`, a full pass moves it to `awaiting-merge`; any
  failure returns it to `in-progress`. Never run `complete` or mark work accepted;
  the resident accepts the pull request.
