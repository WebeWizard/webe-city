---
name: city-agenda-management
description: "Use when preparing a municipal meeting agenda, town hall, resident decision packet, order of business, consent proposal, or deferred-item register."
user-invocable: false
---

# Agenda Management

## Competency and application

Agenda management gives decision-makers timely, understandable business with a
clear purpose and supporting papers. In Repository City, prepare a draft resident
decision packet rather than stage a council of agents that votes on its own work.

## Triggers and inputs

- Use for `city-town-hall`, a policy discussion, competing proposals, or deferred items.
- Require root, purpose, participating residents if known, case references,
  decisions sought, available papers, time constraints, and relevant procedures.
- Consult charter and meeting policies. Do not invent a quorum, notice period,
  public-meeting requirement, or adopted procedure where none is established.

## Procedure

1. List the decisions actually requiring resident judgment. Separate information,
   consultation, and decision items.
2. Check each item's case link, proposal owner, requested action, evidence packet,
   alternatives, impacts, and unresolved questions.
3. Identify conflicts of interest, accessibility needs, privacy-sensitive materials,
   and missing evidence before proposing an order of business.
4. Prioritize dependencies and resident impact, leaving speculative or incomplete
   proposals visibly deferred rather than presenting them as ready to adopt.
5. Give each item a plain-language question, suggested discussion time, and
   preparation materials. Agents may recommend; residents decide.
6. Make charter amendments, appointments, and budget changes explicit standalone
   decision requests. Do not hide them in a routine consent bundle.
7. Include an avenue for dissent, questions, and deferral. Record changes to the
   draft agenda and their reasons without pretending the meeting already occurred.
8. Hand the packet to the resident and the Clerk for actual deliberation and minutes.

## Structured result and evidence

Produce a **draft agenda** with purpose, proposed participants, procedural
assumptions, and ordered items.
Each item contains case ID, category, decision sought, options, evidence links,
known impacts, missing evidence, and proposed next actor.
Add a deferred-items list and a private-materials exclusion note.

## Escalation and limits

- A generated agenda, consent item, or decision packet is not adoption, a vote,
  verified attendance, or authenticated resident approval.
- Missing procedure or disputed authority goes to the resident; no agent may
  appoint a council, change the charter, or grant itself voting rights.
- Skills grant no permissions. Delivery authorization is a City Council or
  resident decision recorded by the CLI `authorize` command, not an agenda item's
  outcome. Recorded decisions carry `authenticated: false`; they are not proof of identity.
