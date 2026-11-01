---
name: city-complaint-triage
description: "Use when triaging resident complaints, service failures, urgency, unequal impact, disputed conduct, evidence gaps, or escalation routes in Repository City."
user-invocable: false
---

# Complaint Triage

## Competency and application

Municipal complaint triage makes a fair initial assessment of service impact and
appropriate routing. In a repository, distinguish a defect or service request
from a complaint about a decision, procedure, or an officer's conduct.

## Triggers and inputs

- Use for a complaint, repeated failure, claimed unfairness, or urgent service impact.
- Require root, the resident's account, affected service, time/extent if known,
  existing cases, requested remedy, and any supplied evidence.
- Read the applicable charter, complaint policy, and relevant case history.
  Do not demand unnecessary personal or sensitive evidence to open intake.

## Procedure

1. Acknowledge the reported impact without declaring disputed allegations proven.
   Separate what was observed from what is inferred.
2. Classify the issue as service failure, new need, procedural complaint, conduct
   concern, disputed decision, or a combination. Preserve multiple routes if needed.
3. Assess impact and urgency independently: breadth, ongoing disruption,
   reversibility, and effect on people with fewer alternatives.
4. If immediate real-world danger is reported, advise an appropriate human emergency
   channel; do not pretend repository agents provide emergency response.
5. Identify missing facts with focused questions. Do not delay straightforward
   intake merely because root cause or remedy is not yet known.
6. Route technical analysis to the Planner/Engineer via City Manager; direct
   procedural evidence concerns to the Clerk or Auditor as appropriate.
7. Use [city-appeal](../city-appeal/SKILL.md) for a disputed city decision.
   Create a new linked intake case; do not promise an installed Ombudsperson.
8. Explain the route, uncertainty, and next contact. Preserve the original account,
   material dissent, and evidence references with minimal personal data.

## Structured result and evidence

Return a triage note with complaint type, alleged/observed distinction,
impact, urgency, rationale, evidence references, requested remedy, missing facts,
related cases, recommended office, and next resident action.
State whether a new case is merely drafted or has actually been persisted.

## Escalation and limits

- Urgency is not authority to change code, bypass controls, or approve spending.
  Suspected misconduct is not a finding of guilt.
- Escalate conflicts or unresolved routing after two coordination rounds to the
  resident; retain the complaint rather than manufacturing closure.
- Skills grant no powers. Local files and write confirmation cannot authorize
  delivery; only a recorded City Council or resident `authorize` decision does,
  and it is recorded with `authenticated: false`. Report the case as intake only.
