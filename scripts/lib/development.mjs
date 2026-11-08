import { createHash } from 'node:crypto';
import { DEVELOPMENT_POLICY, PERMIT_POLICY, WORKFORCE_DELEGATION_POLICY } from './constants.mjs';
import { fail } from './errors.mjs';
import { applicationMissing, authorizationCurrent } from './validation.mjs';

export function developmentEnabled(city) {
  return city.config.governance === 'adopted'
    && city.config.adoption.policies.some((policy) => policy.path === DEVELOPMENT_POLICY);
}

export function permitPolicyEnabled(city) {
  if (city.config.governance !== 'adopted') return false;
  const adoptedPolicies = new Set(city.config.adoption.policies.map((policy) => policy.path));
  return adoptedPolicies.has(PERMIT_POLICY)
    && adoptedPolicies.has(DEVELOPMENT_POLICY)
    && adoptedPolicies.has(WORKFORCE_DELEGATION_POLICY);
}

export function developmentSnapshot(city, order) {
  // Normal triaged -> proposed progression is not a new planning cycle.
  const resets = order.history.filter((entry) => ['triaged', 'reopened'].includes(entry.to)
    || (entry.to === 'proposed' && entry.from !== 'triaged'));
  const scope = {
    title: order.title, request: order.request, criteria: order.acceptanceCriteria,
    projectIds: order.projectIds ?? [],
    projects: city.projects.projects.filter((project) => order.projectIds?.includes(project.id)),
    infrastructure: (order.infrastructure?.assets ?? []).map((pin) => {
      const current = city.infrastructure.assets.get(pin.assetId)?.value;
      return {
        assetId: pin.assetId, pinnedRevision: pin.revision,
        current: current ? {
          lifecycle: current.lifecycle, locators: current.locators,
          baseline: current.baseline, criticality: current.criticality,
        } : null,
      };
    }),
    districts: city.districts, resets,
    adoption: city.config.adoption ?? null, governance: city.governanceDigests,
  };
  return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

export function currentScreening(city, order) {
  const screening = order.development?.screenings.at(-1);
  return screening?.snapshot === developmentSnapshot(city, order) ? screening : null;
}

export function developmentPreparationAllowed(order) {
  return !authorizationCurrent(order.history)
    && ['received', 'triaged', 'proposed', 'awaiting-approval', 'blocked', 'reopened'].includes(order.status);
}

export function developmentStatus(city, order) {
  const enabled = developmentEnabled(city) || permitPolicyEnabled(city);
  const actionable = enabled && developmentPreparationAllowed(order);
  const result = (stage, actor, action, extra = {}) => ({
    enabled, status: order.status, authorizationCurrent: authorizationCurrent(order.history),
    actionable, stage, ready: ['ready-lightweight', 'ready-formal'].includes(stage),
    next: actionable ? { actor, action } : null, questions: [], missing: [], ...extra,
  });
  const ready = (stage) => order.status === 'awaiting-approval'
    ? result(stage, 'city-council', 'review-authorization')
    : result(stage, 'city-manager', 'arrange-lifecycle-progression');
  if (enabled && !city.drift.matchesAdoptedRevision) {
    return result('governance-drift', 'city-clerk', 'resolve-policy-revision');
  }
  const screening = currentScreening(city, order);
  if (!screening) return result('screening-required', 'chief-planner', 'screen-development');
  if (permitPolicyEnabled(city)) {
    if (!screening.permit) {
      return result('permit-classification-required', 'chief-planner', 'screen-development');
    }
    if (screening.route === 'lightweight'
      && Math.max(screening.permit.safetyClass, screening.permit.structuralClass) > 2) {
      return result('permit-classification-required', 'chief-planner', 'screen-development', {
        missing: ['Lightweight route is limited to permit classes 1 and 2.'],
      });
    }
  }
  if (screening.route === 'needs-clarification') {
    return result('resident-clarification', 'resident', 'answer-screening-questions', { questions: screening.questions });
  }
  if (screening.route === 'lightweight') return ready('ready-lightweight');
  const application = order.development.applications.at(-1);
  if (!application || application.screeningRevision !== screening.revision) {
    return result('advisor-preparation', 'development-advisor', 'prepare-application', {
      questions: screening.questions, missing: screening.requirements.map((requirement) => `${requirement.id}: ${requirement.description}`),
    });
  }
  const missing = applicationMissing(screening, application);
  if (missing.length) {
    return result('advisor-preparation', 'development-advisor', 'complete-application', {
      missing, questions: screening.questions.filter((question) => !application.answers.some((answer) => answer.question === question)),
    });
  }
  const assessment = order.development.assessments.at(-1);
  if (!assessment || assessment.applicationRevision !== application.revision) {
    return result('independent-assessment', 'chief-planner', 'assess-application');
  }
  if (assessment.outcome !== 'ready') {
    return result('advisor-preparation', 'development-advisor', 'revise-application', { missing: [assessment.reason] });
  }
  if (permitPolicyEnabled(city)) {
    for (const dimension of ['safety', 'structural']) {
      const riskClass = screening.permit[`${dimension}Class`];
      if (riskClass < 3) continue;
      const statement = (order.development.statements ?? []).find((item) => item.dimension === dimension
        && item.class === riskClass && item.screeningRevision === screening.revision);
      if (!statement) {
        return result('professional-statement', 'engineering-manager', 'record-permit-statement', {
          missing: [`${dimension} class ${riskClass} requires a qualified professional statement.`],
        });
      }
      if (riskClass === 4) {
        const verification = (order.development.verifications ?? []).find((item) => item.statementRevision === statement.revision
          && item.outcome === 'verified');
        if (!verification) {
          return result('third-party-verification', 'city-auditor', 'record-permit-verification', {
            missing: [`${dimension} class 4 statement requires independent verification.`],
          });
        }
      }
    }
  }
  return ready('ready-formal');
}

export function assertDevelopmentReady(city, order) {
  if (!developmentEnabled(city) && !permitPolicyEnabled(city)) return;
  const readiness = developmentStatus(city, order);
  if (!readiness.ready) {
    const next = readiness.next ? `${readiness.next.actor} / ${readiness.next.action}` : 'No automatic preparation action';
    fail('DEVELOPMENT_NOT_READY', `Development preparation is not current and ready (${readiness.stage}). Next: ${next}. ${[...readiness.questions, ...readiness.missing].join('; ')}`);
  }
}
