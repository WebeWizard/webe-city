# Public Information Office

Repository City can appoint a Public Information Officer to help with
resident-requested briefs, FAQs, guides, or notices. The office has no work
unless a resident makes a request, and it prepares the actual product only
after case-specific city approval. Installing the plugin or appointing the
office does not create a product, bulletin, publishing destination, or schedule.

## Municipal adaptation

[Copenhagen's press directory](https://www.kk.dk/om-kommunen/presse) identifies
departmental contacts separately from the city's [council and committee
agendas and minutes](https://www.kk.dk/dagsordener-og-referater). Repository City
similarly leaves facts with their source offices and official decisions with
the Clerk. [Singapore's Ministry of Digital Development and Information](https://www.mddi.gov.sg/what-we-do/public-comms-and-engagement/public-communications/)
coordinates plain-language public communications across ministries. Here the
Manager coordinates across offices when asked; the plugin does not copy the
standing distribution operation.

## Enable the office

1. Review the [optional policy](../templates/repository/.city/policy-drafts/public-information.md).
   In a city initialized with this plugin, it is under `.city/policy-drafts/`.
   For an older city without that file, use the bundled copy. Place the
   reviewed policy at `.city/policies/public-information.md`.
2. Add the policy's **additional appointment** to the city's charter without
   changing the default pilot roster. Record both changes with `adopt` for a
   draft city or a reviewed `amend` for an adopted city.
3. Confirm that `status` and `validate` describe current, non-drifted adopted
   governance for the selected root. The Manager and Officer check the adopted
   policy and appointment in their instructions; the CLI does not interpret
   their Markdown or authenticate decisions.

There is no publication configuration to set. Without the policy and
appointment, the new office is discoverable in the host but has no city mandate.

## Request, authorize, and hand off a product

For either route, Resident Services takes the request and the Manager coordinates
the case. The Officer can clarify purpose, audience, format, sources, and review
criteria before approval, but must not draft the product yet.

| Request | Authorization and delivery |
|---|---|
| Change a repository file, such as updating a project's guide | Use the normal project-scoped work order. The Council can decide only within its adopted delegation; reserved matters go to the resident. After an applied authorization for that case, the Officer may give editorial support. The Engineering Manager still assigns implementation, independent inspection remains required, and the resident accepts after merge. |
| Prepare a standalone product, such as a brief for a resident meeting | File a minimized `information-case` brief in the [artifact library](./artifact-library.md), with `workOrderId: null`. The resident decides on that exact brief. The Clerk documents and cites the actual decision; the Manager verifies its scope and evidence before assigning production. Review and acceptance of the exact product revision are separately documented. Do not fabricate a project, work order, or merge. |

For a standalone case, use the initial `ART-` ID as the stable case reference.
The brief records the request and agreed audience, format, scope, and review
criteria. For subsequent case entries, preserve that initial ID in the content,
set `supersedes` to the preceding case entry, and record the decision-maker,
date, outcome, brief or product revision, scope, and an evidence reference.
Ask the Clerk to reconcile conflicting or stale entries before proceeding.
Use `records-get --id ART-ID --linked` with an explicit `--root` to retrieve
saved entries. A case entry documents a real decision; neither the library
nor its record categories confer approval or guarantee identity.

The Officer returns the draft through the Manager, who coordinates fact
checking with the source office, checks of official citations with the Clerk,
and classification and custody review with the Records Officer. File suitable
material as an `information-product` artifact that cites the case and decision.
File copy only when the repository's actual visibility matches the audience;
otherwise use an approved controlled location and a safe reference. Hand off
only the reviewed and accepted revision to the approved audience. Recheck
authorization when scope or audience changes.

**External release is a separate resident decision.** If requested, the
resident approves the accepted revision, audience, and destination and
arranges any release outside this office. Preparing, reviewing, accepting,
or filing copy does not authorize publication. The office has no publishing
tools, and the plugin never posts the product. Corrections follow the same
request and approval route and link to the prior revision.
