---
name: city-minute-taking
description: "Use when recording municipal deliberation, resident statements, meeting minutes, dissent, reasons, actions, corrections, or decision provenance."
user-invocable: false
---

# Minute Taking

## Competency and application

Professional minutes preserve what material business occurred and why, without
inventing a transcript. For Repository City, distinguish resident statements from
agent proposals and distinguish a record of discussion from authenticated approval.

## Triggers and inputs

- Use after actual deliberation, for a supplied transcript, or to correct a record.
- Require explicit root, meeting/case references, agenda, source statements,
  known participants, procedural rules, and the requested record status.
- Read relevant decisions and records policy. Mark absent timestamps, uncertain
  speakers, and incomplete source material rather than filling gaps.

## Procedure

1. Establish the source and coverage of the record: complete transcript, excerpts,
   contemporaneous notes, or a participant's later account.
2. Organize by agenda item. Capture the issue, options considered, material
   reasons, conflicts disclosed, questions, and dissent.
3. Attribute resident statements only where supported. Do not turn an agent's
   recommendation into a resident motion, vote, signature, or consent.
4. State outcomes precisely: discussion only, proposal, reported resident choice,
   deferred question, or unresolved disagreement.
5. Record an action's proposed owner, scope, and dependency, not an implied
   implementation authorization. Do not invent deadlines or commitments.
6. Minimize personal data and avoid copying secrets from source material.
   Preserve bounded source references and explain necessary exclusions.
7. Label the minutes draft; request resident review where procedure requires it.
   A supplied statement of acceptance is still not an authenticated approval channel.
8. Correct through an attributed addendum or superseding record that preserves
   the original, its status, the change, and the reason.

## Persistent meeting records

Use [records capture](../city-records-capture/SKILL.md) for substantive agendas,
minutes and supporting papers. Mark unapproved minutes `working-draft` and
decision papers `proposed-instrument`; retain actual adopted decisions in their
canonical structured register. Filing alone never records a vote or adoption.

## Structured result and evidence

Return draft minutes with source/coverage, participants as evidenced, agenda items,
discussion summary, attributed resident statements, dissent, reported outcomes,
proposed actions, unresolved matters, and correction history.
For official record edits, use only existing supported schema fields and return
exact paths; otherwise provide a records-ready draft for City Clerk.

## Escalation and limits

- Disputed attribution stays disputed pending resident clarification.
  Do not resolve it by majority vote among agents.
- No skill grants edit or execute permissions. Never hand-edit approval flags or
  delivery states to make minutes appear effective.
- Recorded discussion does not ratify a city or authorize implementation; only a
  CLI `authorize` decision does, recorded with `authenticated: false`. Minute
  Council decisions and resident referrals exactly as recorded.
