import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod, cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { artifactRecord, checkOrderUnchanged, institutionalReviewStatus, loadCity, permitStatus } from '../scripts/lib/city.mjs';
import { publishCity } from '../scripts/lib/filesystem.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(project, 'scripts/city.mjs');
const hook = path.join(project, 'scripts/city-hook.mjs');
const fixtures = [];
const boundary = /draft|unavailable|not.*authoriz/i;

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(name = 'repository with spaces') {
  const directory = path.join(project, `.runtime-test-${randomUUID()}`);
  const root = path.join(directory, name);
  fixtures.push(directory);
  await mkdir(root, { recursive: true });
  return { directory, root };
}

function run(args, script = cli) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: project,
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.ifError(result.error);
  return result;
}

function success(args, script) {
  const result = run(args, script);
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function failure(args, code) {
  const result = run(args);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(result.stdout, '');
  const output = JSON.parse(result.stderr);
  assert.equal(output.error.code, code);
  assert.equal(typeof output.error.message, 'string');
  return output;
}

function hookResult(payload, script = hook) {
  const result = spawnSync(process.execPath, [script], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    cwd: project,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

const payload = (cwd) => ({ cwd, toolName: 'edit', toolArgs: { secret: 'NEVER_ECHO_THIS_SECRET' } });

async function snapshot(root) {
  const entries = [];
  async function visit(directory, relative = '') {
    for (const name of (await readdir(directory)).sort()) {
      const location = path.join(directory, name);
      const key = path.join(relative, name);
      const info = await lstat(location);
      if (info.isSymbolicLink()) entries.push([key, 'symlink']);
      else if (info.isDirectory()) {
        entries.push([key, 'directory']);
        await visit(location, key);
      } else {
        entries.push([key, createHash('sha256').update(await readFile(location)).digest('hex')]);
      }
    }
  }
  await visit(root);
  return entries;
}

function init(root) {
  return success(['init', '--root', root, '--apply']);
}

function registerDefaultProject(root) {
  const projectId = 'default-project';
  const projects = success(['status', '--root', root]).projects;
  if (!projects.some((project) => project.id === projectId)) {
    success([
      'project-add', '--root', root, '--id', projectId, '--name', 'Default Project',
      '--path', 'projects/default-project', '--description', 'Default test project.', '--apply',
    ]);
  }
  return projectId;
}

function petition(root, criteria = ['The requested outcome is verifiable.']) {
  const projectId = registerDefaultProject(root);
  const workOrder = success([
    'petition', '--root', root, '--title', 'Make a bounded improvement',
    '--request', 'Record this request without authorizing any delivery.',
    '--project', projectId,
    ...criteria.flatMap((criterion) => ['--criterion', criterion]), '--apply',
  ]).workOrder;
  const zoning = success(['status', '--root', root]).zoning;
  if (zoning.enabled && zoning.configured) {
    success([
      'zoning-check', '--root', root, '--id', workOrder.id,
      '--data', JSON.stringify({
        changeTypes: ['bugfix'], reason: 'Contained repair in the registered project.',
        evidence: 'Reviewed the request and its declared project scope.',
      }), '--apply',
    ]);
  }
  return workOrder;
}

function infrastructureAssetData(today = new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
  return {
    name: 'Shared build foundation',
    purpose: 'Provides repeatable repository builds.',
    category: 'build-system',
    lifecycle: 'active',
    owner: 'City Manager',
    custodian: 'Engineering Manager',
    operator: { role: 'Repository maintainer', channel: 'Maintainer issue tracker', coverage: 'Business days', verifiedAt: null },
    services: [{
      id: 'builds', name: 'Reproducible builds', expectation: 'Builds complete reproducibly.',
      target: 'CI evidence', measurementSource: 'Recorded build results', maxAgeDays: 30, measurements: [],
    }],
    locators: ['.'], projectIds: [], dependencies: [],
    criticality: 'high',
    condition: { state: 'unknown', observedAt: null, method: 'Not yet assessed', evidence: 'No condition assessment recorded.' },
    baseline: { version: '1.0', compatibility: 'Repository-local tooling.', supportEnds: null },
    obligations: [{
      id: 'monthly-health-review', task: 'Review build health and dependency support.', owner: 'Engineering Manager',
      trigger: 'recurring', dueDate: today, recurrenceDays: 30, acceptanceEvidence: 'Dated review record.',
      status: 'open', nextReviewDate: null, history: [],
    }],
    findings: [{
      id: 'security-report', kind: 'security', source: 'Resident-supplied advisory',
      observedAt: today, affectedBaseline: '1.0', applicability: 'unknown', urgency: 'high',
      evidence: 'Applicability requires technical assessment.', status: 'open', workOrderId: null,
    }],
    deferrals: [],
    renewal: { description: 'Review build foundation and supported dependencies.', resourceEstimate: 'Engineering assessment required.' },
    resilience: {
      failureModes: ['Build provider unavailable.'], restorationOrder: 'Restore repository-local build capability.',
      recoveryPlan: 'Use documented local recovery steps.', lastExerciseAt: null, exerciseEvidence: 'No exercise recorded.',
    },
  };
}

function transition(root, id, to, apply = true) {
  // Existing lifecycle scenarios use a professionally screened contained repair.
  // Gate-specific scenarios below call the CLI directly to test missing preparation.
  if (to === 'awaiting-approval') {
    const status = success(['status', '--root', root]);
    const preparation = status.workOrders.development.find((item) => item.id === id);
    if (preparation.enabled && !preparation.ready) recordScreening(root, id);
  }
  return success([
    'transition', '--root', root, '--id', id, '--to', to,
    '--reason', `Draft routing to ${to}.`, ...(apply ? ['--apply'] : []),
  ]);
}

const recordPath = (root, id) => path.join(root, '.city/work-orders', `${id}.json`);
const configPath = (root) => path.join(root, '.city/config.json');
const readJSON = async (location) => JSON.parse(await readFile(location, 'utf8'));
const writeJSON = (location, value) => writeFile(location, `${JSON.stringify(value, null, 2)}\n`);

function screening(overrides = {}) {
  const result = {
    route: 'lightweight', projectIds: ['default-project'],
    scopeEvidence: 'The request concerns the registered default project only.',
    reason: 'Contained repair with no material effects.', evidence: 'Inspected project interfaces and tests.',
    impacts: [], questions: [],
    policyCitations: [{ path: 'policies/development-applications.md', section: 'Baseline materiality', projectIds: [] }],
    requirements: [],
    permit: { safetyClass: 1, structuralClass: 1, classRationale: 'Contained, reversible change with no cross-project effects.' },
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'permit')) {
    if (result.impacts.some((impact) => ['architecture', 'ownership-boundary', 'public-interface', 'data-migration', 'cross-project'].includes(impact))) {
      result.permit.structuralClass = 2;
    }
    if (result.impacts.includes('security')) result.permit.safetyClass = 2;
  }
  return result;
}

function developmentArgs(command, root, id, data, apply = false) {
  return [command, '--root', root, '--id', id, '--data', JSON.stringify(data), ...(apply ? ['--apply'] : [])];
}

function zoningMapArgs(root, zones, apply = false) {
  return ['zoning-map', '--root', root, '--data', JSON.stringify({ schemaVersion: 1, zones }), ...(apply ? ['--apply'] : [])];
}

function zoningZone(path, rules, id = 'repository') {
  return { id, name: id, path, description: `Zone for ${path}.`, rules };
}

function zoningRule(changeType, disposition, requirements = []) {
  return { changeType, disposition, requirements };
}

function zoningCheckArgs(root, id, changeTypes = ['bugfix'], apply = false) {
  return developmentArgs('zoning-check', root, id, {
    changeTypes, reason: 'Reviewed the proposed change against the mapped repository scope.',
    evidence: 'Checked the registered project directory and applicable zone rules.',
  }, apply);
}

function recordScreening(root, id, data = screening()) {
  return success(developmentArgs('screen-development', root, id, data, true));
}

test('unadopted zoning preserves pre-zoning snapshots and development readiness', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const order = petition(root);
  const city = await loadCity(root);
  const preZoningSnapshot = createHash('sha256').update(JSON.stringify({
    title: order.title, request: order.request, criteria: order.acceptanceCriteria,
    projectIds: order.projectIds,
    projects: city.projects.projects.filter((project) => order.projectIds.includes(project.id)),
    infrastructure: [], districts: city.districts, resets: [],
    adoption: city.config.adoption, governance: city.governanceDigests,
  })).digest('hex');
  const prepared = recordScreening(root, order.id);
  assert.equal(prepared.workOrder.development.screenings.at(-1).snapshot, preZoningSnapshot);

  success(zoningMapArgs(root, [zoningZone('projects/default-project', [
    zoningRule('bugfix', 'conditional', ['zoning feasibility study']),
  ])], true));
  const checked = success(zoningCheckArgs(root, order.id, ['bugfix'], true));
  assert.equal(checked.workOrder.development.zoningChecks.at(-1).outcome, 'conditional');
  assert.equal(checked.development.zoning.enabled, false);
  assert.equal(checked.development.stage, 'ready-lightweight');
  const lightweight = recordScreening(root, order.id);
  assert.equal(lightweight.workOrder.development.screenings.at(-1).snapshot, preZoningSnapshot);

  const formal = recordScreening(root, order.id, screening({
    route: 'formal', impacts: ['architecture'],
    requirements: [{
      id: 'boundary-diagram', kind: 'diagram',
      description: 'Document the component boundary.', reason: 'Needed for architecture review.',
    }],
  }));
  const application = success(developmentArgs('application-record', root, order.id, {
    screeningRevision: formal.workOrder.development.screenings.at(-1).revision,
    reason: 'Prepared the architecture evidence.', evidence: 'Reviewed the component boundary.',
    proposal: 'Adjust the internal component boundary without changing public interfaces.',
    answers: [],
    artifacts: [{
      requirementId: 'boundary-diagram', disposition: 'provided',
      evidence: 'Component boundary diagram included in the application.',
    }],
  }, true));
  const assessment = success(developmentArgs('assess-application', root, order.id, {
    applicationRevision: application.workOrder.development.applications.at(-1).revision,
    outcome: 'ready', reason: 'The architecture evidence meets the screening requirements.',
    evidence: 'Independently reviewed the component boundary diagram.',
  }, true));
  assert.equal(assessment.development.stage, 'ready-formal');
});

test('adopted zoning binds checks to scope and map, and blocks prohibited or unknown uses', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  transition(root, order.id, 'proposed');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].zoning.outcome, 'permitted');
  const mapRecord = success(['records-get', '--root', root, '--id', 'zoning']).records[0];
  assert.equal(mapRecord.path, '.city/zoning.json');
  assert.equal(success(['records-list', '--root', root, '--type', 'zoning']).records[0].id, 'zoning');

  const before = await snapshot(root);
  const prohibitedMap = [zoningZone('projects/default-project', [
    zoningRule('bugfix', 'prohibited'),
  ])];
  const preview = success(zoningMapArgs(root, prohibitedMap));
  assert.equal(preview.dryRun, true);
  assert.deepEqual(await snapshot(root), before);
  success(zoningMapArgs(root, prohibitedMap, true));
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'zoning-check-required');
  const prohibited = success(zoningCheckArgs(root, order.id, ['bugfix'], true));
  assert.equal(prohibited.zoning.outcome, 'prohibited');
  assert.equal(prohibited.development.ready, false);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval',
    '--reason', 'The prohibited change should not proceed.',
  ], 'DEVELOPMENT_NOT_READY');

  success(zoningMapArgs(root, [zoningZone('docs', [
    zoningRule('documentation', 'permitted'),
  ])], true));
  const unknown = success(zoningCheckArgs(root, order.id, ['bugfix'], true));
  assert.equal(unknown.zoning.outcome, 'unknown');
  assert.equal(unknown.development.stage, 'zoning-unknown');
  failure(zoningMapArgs(root, [
    zoningZone('projects', [zoningRule('bugfix', 'permitted')], 'projects'),
    zoningZone('projects/default-project', [zoningRule('bugfix', 'permitted')], 'app'),
  ], true), 'INVALID_RECORD');
});

test('adopted zoning without a map explicitly blocks readiness', async () => {
  const { root } = await fixture();
  init(root);
  await cp(
    path.join(project, 'templates/repository/.city/policy-drafts/zoning.md'),
    path.join(root, '.city/policies/zoning.md'),
  );
  success(adoptArgs(root, ['--apply']));
  const order = petition(root);
  transition(root, order.id, 'triaged');
  transition(root, order.id, 'proposed');
  const development = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(development.stage, 'zoning-map-required');
  assert.deepEqual(development.zoning.missing, ['.city/zoning.json']);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval',
    '--reason', 'A missing map must not be treated as permission.',
  ], 'DEVELOPMENT_NOT_READY');
});

test('conditional zoning requires named formal evidence and independent assessment', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  const requirement = 'security impact assessment';
  success(zoningMapArgs(root, [zoningZone('projects/default-project', [
    zoningRule('bugfix', 'conditional', [requirement]),
  ])], true));
  const check = success(zoningCheckArgs(root, order.id, ['bugfix'], true));
  assert.equal(check.zoning.outcome, 'conditional');
  failure(developmentArgs('screen-development', root, order.id, screening()), 'DEVELOPMENT_NOT_READY');

  const formal = screening({
    route: 'formal',
    impacts: ['security'],
    requirements: [{
      id: 'security-review', kind: 'study',
      description: `Provide a ${requirement}.`,
      reason: 'Required by the adopted conditional zone rule.',
    }],
  });
  failure(developmentArgs('screen-development', root, order.id, screening({
    ...formal, requirements: [{ ...formal.requirements[0], description: 'Unrelated review.' }],
  })), 'INVALID_ARGUMENT');
  const screened = recordScreening(root, order.id, formal);
  const application = success(developmentArgs('application-record', root, order.id, {
    screeningRevision: screened.workOrder.development.screenings.at(-1).revision,
    reason: 'Prepared the required evidence.',
    evidence: 'The application includes the named security review.',
    proposal: 'Implement the contained repair and document the reviewed security impact.',
    answers: [],
    artifacts: [{
      requirementId: 'security-review', disposition: 'provided',
      evidence: 'Security impact assessment completed and reviewed.',
    }],
  }, true));
  success(developmentArgs('assess-application', root, order.id, {
    applicationRevision: application.workOrder.development.applications.at(-1).revision,
    outcome: 'ready', reason: 'The formal application includes the conditional zoning evidence.',
    evidence: 'Verified the required artifact and scope.',
  }, true));
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'ready-formal');
});

test('adopted zoning and building permits retain independent readiness requirements', async () => {
  const { root } = await fixture();
  init(root);
  await cp(
    path.join(root, '.city/policy-drafts/zoning.md'),
    path.join(root, '.city/policies/zoning.md'),
  );
  const requirement = 'zoning impact assessment';
  success(zoningMapArgs(root, [zoningZone('projects/default-project', [
    zoningRule('bugfix', 'conditional', [requirement]),
  ])], true));
  success(adoptArgs(root, ['--apply']));
  const order = petition(root);
  transition(root, order.id, 'triaged');
  transition(root, order.id, 'proposed');
  failure(developmentArgs('screen-development', root, order.id, screening()), 'DEVELOPMENT_NOT_READY');

  const formal = screening({
    route: 'formal', impacts: ['architecture'],
    requirements: [{
      id: 'zoning-impact', kind: 'study', description: `Provide a ${requirement}.`,
      reason: 'Required by the conditional zone rule.',
    }],
    permit: {
      safetyClass: 1, structuralClass: 3,
      classRationale: 'The proposal changes an architectural boundary.',
    },
  });
  const { permit, ...unclassified } = formal;
  failure(developmentArgs('screen-development', root, order.id, unclassified), 'PERMIT_CLASSIFICATION_REQUIRED');
  const screened = recordScreening(root, order.id, formal);
  const application = success(developmentArgs('application-record', root, order.id, {
    screeningRevision: screened.workOrder.development.screenings.at(-1).revision,
    reason: 'Prepared the conditional zoning evidence.', evidence: 'Reviewed the architectural impact.',
    proposal: 'Change the internal boundary with the mapped impacts assessed.',
    answers: [], artifacts: [{
      requirementId: 'zoning-impact', disposition: 'provided',
      evidence: 'The zoning impact assessment is included in the application.',
    }],
  }, true));
  const assessed = success(developmentArgs('assess-application', root, order.id, {
    applicationRevision: application.workOrder.development.applications.at(-1).revision,
    outcome: 'ready', reason: 'The conditional zoning evidence meets the screening requirements.',
    evidence: 'Independently reviewed the impact assessment.',
  }, true));
  assert.equal(assessed.development.zoning.outcome, 'conditional');
  assert.equal(assessed.development.stage, 'professional-statement');
  assert.equal(assessed.development.ready, false);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval',
    '--reason', 'Zoning evidence cannot replace the required permit statement.',
  ], 'DEVELOPMENT_NOT_READY');

  success(zoningMapArgs(root, [zoningZone('projects/default-project', [
    zoningRule('bugfix', 'prohibited'),
  ])], true));
  const prohibited = success(zoningCheckArgs(root, order.id, ['bugfix'], true));
  assert.equal(prohibited.development.stage, 'zoning-prohibited');
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval',
    '--reason', 'Permit preparation cannot override prohibited zoning.',
  ], 'DEVELOPMENT_NOT_READY');
});

test('development screening is proportionate, dry-run, scope-aware and never delivery authority', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  transition(root, order.id, 'proposed');
  const args = ['transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval', '--reason', 'Ready?'];
  failure(args, 'DEVELOPMENT_NOT_READY');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'screening-required');
  const before = await snapshot(root);
  const preview = success(developmentArgs('screen-development', root, order.id, screening()));
  assert.equal(preview.development.stage, 'ready-lightweight');
  assert.deepEqual(await snapshot(root), before);
  failure(developmentArgs('screen-development', root, order.id, screening({ impacts: ['public-interface'] })), 'INVALID_ARGUMENT');
  failure(developmentArgs('screen-development', root, order.id, screening({ projectIds: [] })), 'INVALID_ARGUMENT');
  failure(developmentArgs('screen-development', root, order.id, screening({ projectIds: ['missing'] })), 'NOT_FOUND');
  failure(developmentArgs('screen-development', root, order.id, { ...screening(), unexpected: true }), 'INVALID_ARGUMENT');
  const uncertain = recordScreening(root, order.id, screening({
    route: 'needs-clarification', projectIds: [], questions: ['Which registered project should change?'],
  }));
  assert.equal(uncertain.development.next.actor, 'resident');
  assert.deepEqual(uncertain.development.questions, ['Which registered project should change?']);
  failure(args, 'DEVELOPMENT_NOT_READY');
  const result = recordScreening(root, order.id);
  assert.equal(result.workOrder.updatedAt, result.workOrder.history.at(-1).timestamp);
  assert.equal(result.workOrder.development.screenings.length, 2);
  success([...args, '--apply']);
  const awaiting = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(awaiting.status, 'awaiting-approval');
  assert.equal(awaiting.actionable, true);
  assert.deepEqual(awaiting.next, { actor: 'city-council', action: 'review-authorization' });
  failure(['transition', '--root', root, '--id', order.id, '--to', 'authorized', '--reason', 'No exemption'], 'AUTHORIZATION_REQUIRED');
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  const authorized = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(authorized.stage, 'ready-lightweight');
  assert.equal(authorized.ready, true);
  assert.equal(authorized.authorizationCurrent, true);
  assert.equal(authorized.actionable, false);
  assert.equal(authorized.next, null);
});

test('ready development packets require ordinary lifecycle progression before Council handoff', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  const managerNext = { actor: 'city-manager', action: 'arrange-lifecycle-progression' };
  const received = recordScreening(root, order.id).development;
  assert.equal(received.status, 'received');
  assert.equal(received.ready, true);
  assert.equal(received.actionable, true);
  assert.deepEqual(received.next, managerNext);
  transition(root, order.id, 'triaged');
  const triaged = recordScreening(root, order.id).development;
  assert.equal(triaged.status, 'triaged');
  assert.deepEqual(triaged.next, managerNext);
  transition(root, order.id, 'proposed');
  const proposed = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(proposed.ready, true);
  assert.deepEqual(proposed.next, managerNext);
  failure(authorizeArgs(root, order.id), 'INVALID_TRANSITION');
  transition(root, order.id, 'awaiting-approval');
  const awaiting = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(awaiting.status, 'awaiting-approval');
  assert.deepEqual(awaiting.next, { actor: 'city-council', action: 'review-authorization' });
});

test('formal applications automatically route to Advisor and require exact independent ready assessment', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const formal = screening({
    route: 'formal', impacts: ['public-interface'],
    questions: ['Which compatibility window is acceptable?'],
    requirements: [
      { id: 'contract', kind: 'specification', description: 'Public API compatibility contract.', reason: 'Review consumer breakage.' },
      { id: 'study', kind: 'study', description: 'Compatibility evidence.', reason: 'Check affected consumers.' },
    ],
  });
  const screened = recordScreening(root, order.id, formal);
  assert.equal(screened.development.next.actor, 'development-advisor');
  transition(root, order.id, 'proposed');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'advisor-preparation');
  const packet = {
    screeningRevision: 1, reason: 'Resident-assisted contract proposal.', evidence: 'Source review; no runtime study performed.',
    proposal: 'Add a versioned API without changing existing consumers.',
    answers: [], artifacts: [{ requirementId: 'contract', disposition: 'provided', evidence: 'docs/api-contract.md, proposed v2 contract.' }],
  };
  const before = await snapshot(root);
  success(developmentArgs('application-record', root, order.id, packet));
  assert.deepEqual(await snapshot(root), before);
  success(developmentArgs('application-record', root, order.id, packet, true));
  const assess = { applicationRevision: 1, outcome: 'ready', reason: 'Independent plan check.', evidence: 'Reviewed application against scoped requirements.' };
  failure(developmentArgs('assess-application', root, order.id, assess), 'DEVELOPMENT_NOT_READY');
  const incomplete = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(incomplete.stage, 'advisor-preparation');
  assert.match(JSON.stringify(incomplete.missing), /study|compatibility window/);
  packet.answers = [{ question: formal.questions[0], answer: 'Keep existing consumers compatible indefinitely.' }];
  packet.artifacts.push({ requirementId: 'study', disposition: 'not-applicable', evidence: 'No runtime compatibility claim: additive static contract; consumer runtime verification is a delivery criterion.' });
  success(developmentArgs('application-record', root, order.id, packet, true));
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'independent-assessment');
  failure(developmentArgs('assess-application', root, order.id, { ...assess, sourceOffice: 'development-advisor' }), 'INVALID_ARGUMENT');
  failure(developmentArgs('assess-application', root, order.id, assess), 'STALE_DEVELOPMENT');
  const ready = success(developmentArgs('assess-application', root, order.id, { ...assess, applicationRevision: 2 }, true));
  assert.equal(ready.development.stage, 'ready-formal');
  assert.equal(ready.development.actionable, true);
  assert.deepEqual(ready.development.next, { actor: 'city-manager', action: 'arrange-lifecycle-progression' });
  success(['transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval', '--reason', 'Independent assessment ready.', '--apply']);
  assert.deepEqual(success(['status', '--root', root]).workOrders.development[0].next, {
    actor: 'city-council', action: 'review-authorization',
  });
  success(developmentArgs('application-record', root, order.id, packet, true));
  failure(authorizeArgs(root, order.id, { decidedBy: 'resident', extra: residentEvidence }), 'DEVELOPMENT_NOT_READY');
  success(authorizeArgs(root, order.id, { outcome: 'refer', extra: ['--apply'] }));
  success(authorizeArgs(root, order.id, { outcome: 'return', extra: ['--apply'] }));
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'screening-required');
  const saved = await readJSON(recordPath(root, order.id));
  assert.equal(saved.development.applications.length, 3);
  assert.equal(saved.development.assessments.length, 1);
  assert.equal(success(['records-get', '--root', root, '--id', order.id]).records[0].record.development.applications.length, 3);
});

test('screening snapshots invalidate scope, adopted policy, re-triage and reopening, but preserve legacy delivery', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  recordScreening(root, order.id);
  transition(root, order.id, 'proposed');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].ready, true);
  const localPolicy = path.join(root, '.city/policies/development-applications.md');
  await writeFile(localPolicy, `${await readFile(localPolicy, 'utf8')}\n## Default project refinement\nApplies only to default-project: explain compatibility.\n`);
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'governance-drift');
  success(amendArgs(root, ['--apply']));
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'screening-required');
  recordScreening(root, order.id, screening({ policyCitations: [
    { path: 'policies/development-applications.md', section: 'Baseline materiality', projectIds: [] },
    { path: 'policies/development-applications.md', section: 'Default project refinement: no public contract affected.', projectIds: ['default-project'] },
  ] }));
  transition(root, order.id, 'triaged');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].ready, false);
  recordScreening(root, order.id);
  const changed = await readJSON(recordPath(root, order.id));
  changed.request = 'Changed resident scope and outcome.';
  await writeJSON(recordPath(root, order.id), changed);
  assert.equal(success(['status', '--root', root]).workOrders.development[0].ready, false);
  recordScreening(root, order.id);
  transition(root, order.id, 'proposed');
  transition(root, order.id, 'awaiting-approval');
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  await writeFile(localPolicy, `${await readFile(localPolicy, 'utf8')}\nAdditional explanation.\n`);
  success(amendArgs(root, ['--apply']));
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) transition(root, order.id, state);
  success(completeArgs(root, order.id, ['--apply']));
  transition(root, order.id, 'reopened');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'screening-required');
  assert.equal((await readJSON(recordPath(root, order.id))).development.screenings.length, 4);
});

test('draft preparation is not adoption and older cities require explicit charter amendment to add advisor', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const unscreened = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(unscreened.enabled, false);
  assert.equal(unscreened.stage, 'screening-required');
  assert.equal(unscreened.actionable, false);
  assert.equal(unscreened.next, null);
  const draft = recordScreening(root, order.id);
  assert.equal(draft.development.enabled, false);
  assert.equal(draft.development.ready, true);
  assert.equal(draft.development.actionable, false);
  assert.equal(draft.development.next, null);
  const policyPath = path.join(root, '.city/policies/development-applications.md');
  const policy = await readFile(policyPath);
  await rm(policyPath);
  await rm(path.join(root, '.city/policies/building-permits.md'));
  success(adoptArgs(root, ['--apply']));
  const disabled = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.actionable, false);
  assert.equal(disabled.next, null);
  transition(root, order.id, 'proposed');
  transition(root, order.id, 'awaiting-approval');
  const legacy = success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  assert.equal(legacy.workOrder.status, 'authorized');
  await writeFile(policyPath, policy);
  failure(amendArgs(root, ['--apply']), 'CHARTER_AMENDMENT_REQUIRED');
  const charter = path.join(root, '.city/charter.md');
  await writeFile(charter, `${await readFile(charter, 'utf8')}\nResident explicitly appoints the Development Advisor in this revision.\n`);
  success(amendArgs(root, ['--apply']));
  transition(root, order.id, 'in-progress');
  assert.equal(success(['validate', '--root', root]).valid, true);
  transition(root, order.id, 'proposed');
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'screening-required');
});

test('development actionability excludes legacy delivery and closed cases after policy adoption', async () => {
  const { root } = await fixture();
  init(root);
  const policyPath = path.join(root, '.city/policies/development-applications.md');
  const policy = await readFile(policyPath);
  await rm(policyPath);
  await rm(path.join(root, '.city/policies/building-permits.md'));
  success(adoptArgs(root, ['--apply']));
  const authorized = awaitingOrder(root);
  success(authorizeArgs(root, authorized.id, { extra: ['--apply'] }));
  const blocked = awaitingOrder(root);
  success(authorizeArgs(root, blocked.id, { extra: ['--apply'] }));
  transition(root, blocked.id, 'blocked');
  const completed = awaitingOrder(root);
  success(authorizeArgs(root, completed.id, { extra: ['--apply'] }));
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) transition(root, completed.id, state);
  success(completeArgs(root, completed.id, ['--apply']));
  const rejected = petition(root);
  transition(root, rejected.id, 'rejected');
  const withdrawn = petition(root);
  transition(root, withdrawn.id, 'withdrawn');
  const orders = [authorized, blocked, completed, rejected, withdrawn];
  const records = await Promise.all(orders.map((order) => readFile(recordPath(root, order.id))));
  await writeFile(policyPath, policy);
  const charter = path.join(root, '.city/charter.md');
  await writeFile(charter, `${await readFile(charter, 'utf8')}\nResident explicitly appoints the Development Advisor in this revision.\n`);
  success(amendArgs(root, ['--apply']));
  const before = await snapshot(root);
  const statuses = success(['status', '--root', root]).workOrders.development;
  for (const [index, order] of orders.entries()) {
    const development = statuses.find((item) => item.id === order.id);
    assert.equal(development.enabled, true);
    assert.equal(development.status, ['authorized', 'blocked', 'completed', 'rejected', 'withdrawn'][index]);
    assert.equal(development.authorizationCurrent, index < 3);
    assert.equal(development.stage, 'screening-required');
    assert.equal(development.ready, false);
    assert.equal(development.actionable, false);
    assert.equal(development.next, null);
    failure(developmentArgs('screen-development', root, order.id, screening(), true), 'INVALID_TRANSITION');
    assert.deepEqual(await readFile(recordPath(root, order.id)), records[index]);
  }
  assert.deepEqual(await snapshot(root), before);
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) {
    transition(root, authorized.id, state);
    const development = success(['status', '--root', root]).workOrders.development.find((item) => item.id === authorized.id);
    assert.equal(development.status, state);
    assert.equal(development.authorizationCurrent, true);
    assert.equal(development.actionable, false);
    assert.equal(development.next, null);
  }
  transition(root, blocked.id, 'proposed');
  const returned = success(['status', '--root', root]).workOrders.development.find((item) => item.id === blocked.id);
  assert.equal(returned.authorizationCurrent, false);
  assert.equal(returned.actionable, true);
  assert.deepEqual(returned.next, { actor: 'chief-planner', action: 'screen-development' });
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('development screening accepts adopted project refinements using compatible policy filenames', async () => {
  const { root } = await fixture();
  init(root);
  await writeFile(path.join(root, '.city/policies/Website_API.v1.md'), [
    '# Website API refinement',
    'Applies only to default-project. Contained documentation repairs with no public contract change remain lightweight.',
    'Cite source review of the public interface; material interface changes still require formal assessment.',
    '',
  ].join('\n'));
  success(zoningMapArgs(root, [zoningZone('.', [
    ...['documentation', 'tests', 'bugfix', 'refactor', 'feature', 'public-interface',
      'dependency', 'data-migration', 'security', 'deletion', 'generated-code']
      .map((type) => zoningRule(type, 'permitted')),
  ])], true));
  await rm(path.join(root, '.city/policies/building-permits.md'));
  success(adoptArgs(root, ['--apply']));
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const input = screening({
    policyCitations: [
      ...screening().policyCitations,
      { path: 'policies/Website_API.v1.md', section: 'Website API refinement: reviewed public interface; no contract change.', projectIds: ['default-project'] },
    ],
  });
  const result = recordScreening(root, order.id, input);
  assert.equal(result.development.enabled, true);
  assert.equal(result.development.stage, 'ready-lightweight');
  assert.deepEqual(result.workOrder.development.screenings[0].policyCitations, input.policyCitations);
  const before = await snapshot(root);
  for (const unsafe of ['../Website_API.v1.md', 'policies/../Website_API.v1.md', 'policies/nested/Website_API.v1.md',
    'policies/.Website_API.v1.md', 'policies/Website_API.v1.md/escape', 'policies/Website_API.v1\\escape.md']) {
    failure(developmentArgs('screen-development', root, order.id, screening({
      policyCitations: [...screening().policyCitations, { path: unsafe, section: 'Unsafe', projectIds: ['default-project'] }],
    }), true), 'INVALID_ARGUMENT');
  }
  assert.deepEqual(await snapshot(root), before);
  transition(root, order.id, 'proposed');
  transition(root, order.id, 'awaiting-approval');
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('malformed development inputs fail without writes and canonical revisions remain strict', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const before = await snapshot(root);
  for (const patch of [
    { route: 'automatic' }, { impacts: ['unknown'] }, { impacts: ['cost', 'cost'] },
    { route: 'needs-clarification' }, { route: 'formal' }, { evidence: null },
    { projectIds: ['default-project', 'default-project'] },
    { policyCitations: [] }, { requirements: [{ id: 'x', kind: 'unperformed', description: 'Study', reason: 'Missing' }] },
    { policyCitations: [{ path: '../escape.md', section: 'Rules', projectIds: [] }] },
    { policyCitations: [{ path: 'policies/development-applications.md', section: 'Rules', projectIds: ['other-project'] }] },
  ]) {
    failure(developmentArgs('screen-development', root, order.id, screening(patch), true), 'INVALID_ARGUMENT');
  }
  failure(['screen-development', '--root', root, '--id', order.id, '--data', '{', '--apply'], 'MALFORMED_JSON');
  failure(['screen-development', '--root', root, '--id', order.id, '--data', '{}', '--data', '{}'], 'INVALID_ARGUMENT');
  assert.deepEqual(await snapshot(root), before);
  const recorded = recordScreening(root, order.id).workOrder;
  for (const corrupt of [
    (record) => { record.development.screenings[0].sourceOffice = 'development-advisor'; },
    (record) => { record.development.screenings[0].authenticated = true; },
    (record) => { record.development.screenings[0].revision = 2; },
    (record) => { record.development.screenings[0].snapshot = 'not-a-digest'; },
  ]) {
    const changed = structuredClone(recorded);
    corrupt(changed);
    await writeJSON(recordPath(root, order.id), changed);
    failure(['validate', '--root', root], 'INVALID_RECORD');
  }
  await writeJSON(recordPath(root, order.id), recorded);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('re-screening supersedes formal packets and assessments; reject stays usable without readiness', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const formal = screening({
    route: 'formal', impacts: ['architecture'],
    requirements: [{ id: 'diagram', kind: 'diagram', description: 'Component boundary diagram.', reason: 'Assess material boundary changes.' }],
  });
  recordScreening(root, order.id, formal);
  const application = {
    screeningRevision: 1, reason: 'Advisor proposal.', evidence: 'Static source investigation only.',
    proposal: 'A new boundary with compatibility preserved.', answers: [],
    artifacts: [{ requirementId: 'diagram', disposition: 'provided', evidence: 'Component diagram in the proposal.' }],
  };
  success(developmentArgs('application-record', root, order.id, application, true));
  const assessment = { applicationRevision: 1, outcome: 'ready', reason: 'Independent assessment.', evidence: 'Reviewed boundary diagram and criteria.' };
  const before = await snapshot(root);
  success(developmentArgs('assess-application', root, order.id, assessment));
  assert.deepEqual(await snapshot(root), before);
  success(developmentArgs('assess-application', root, order.id, assessment, true));
  transition(root, order.id, 'proposed');
  success(['transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval', '--reason', 'Ready formal case.', '--apply']);
  const originalCity = await loadCity(root);
  recordScreening(root, order.id, formal);
  const changedCity = await loadCity(root);
  assert.throws(() => checkOrderUnchanged(originalCity, changedCity, originalCity.workOrders.get(order.id)), { code: 'CONFLICT' });
  assert.equal(success(['status', '--root', root]).workOrders.development[0].stage, 'advisor-preparation');
  failure(developmentArgs('application-record', root, order.id, application), 'STALE_DEVELOPMENT');
  failure(developmentArgs('assess-application', root, order.id, assessment), 'STALE_DEVELOPMENT');
  failure(authorizeArgs(root, order.id), 'DEVELOPMENT_NOT_READY');
  success(authorizeArgs(root, order.id, { outcome: 'reject', extra: ['--apply'] }));
  const rejected = success(['status', '--root', root]).workOrders.development[0];
  assert.equal(rejected.stage, 'advisor-preparation');
  assert.match(JSON.stringify(rejected.missing), /diagram/);
  assert.equal(rejected.actionable, false);
  assert.equal(rejected.next, null);
  const saved = await readJSON(recordPath(root, order.id));
  assert.equal(saved.development.screenings.length, 2);
  assert.equal(saved.development.applications.length, 1);
  assert.equal(saved.development.assessments.length, 1);
});

test('legacy unassigned work orders can clarify and explicitly acquire registered screening scope', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const legacy = await readJSON(recordPath(root, order.id));
  delete legacy.projectIds;
  legacy.schemaVersion = 1;
  await writeJSON(recordPath(root, order.id), legacy);
  const uncertain = recordScreening(root, order.id, screening({
    route: 'needs-clarification', projectIds: [],
    questions: ['Which registered project is intended?'],
  }));
  assert.equal(uncertain.workOrder.schemaVersion, 1);
  assert.equal(uncertain.development.ready, false);
  const before = await snapshot(root);
  const preview = success(developmentArgs('screen-development', root, order.id, screening()));
  assert.equal(preview.scopeAssigned, true);
  assert.equal(preview.workOrder.schemaVersion, 2);
  assert.deepEqual(await snapshot(root), before);
  const scoped = recordScreening(root, order.id);
  assert.equal(scoped.development.stage, 'ready-lightweight');
  assert.equal(scoped.workOrder.updatedAt, legacy.updatedAt);
  assert.deepEqual(scoped.workOrder.projectIds, ['default-project']);
  assert.equal(scoped.workOrder.development.screenings.length, 2);
  transition(root, order.id, 'proposed');
  success(['transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval', '--reason', 'Explicit scope selected.', '--apply']);
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
});

test('concurrent screening and authorization cannot authorize a superseded incomplete formal packet', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const { spawn } = await import('node:child_process');
  const launch = (args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: project });
    child.stdout.resume();
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', resolve);
  });

  for (let round = 0; round < 3; round += 1) {
    const order = awaitingOrder(root);
    const formal = screening({
      route: 'formal', impacts: ['cost'],
      requirements: [{ id: 'cost-study', kind: 'study', description: 'Operational cost study.', reason: 'Material cost risk.' }],
    });
    await Promise.all([
      launch(developmentArgs('screen-development', root, order.id, formal, true)),
      launch(authorizeArgs(root, order.id, { extra: ['--apply'] })),
    ]);
    assert.equal(success(['validate', '--root', root]).valid, true);
    const saved = await readJSON(recordPath(root, order.id));
    if (saved.status === 'authorized') assert.equal(saved.development.screenings.at(-1).route, 'lightweight');
    else {
      assert.equal(saved.development.screenings.at(-1).route, 'formal');
      failure(authorizeArgs(root, order.id), 'DEVELOPMENT_NOT_READY');
    }
  }
});

test('help is JSON and explicitly refuses to equate apply with authority', () => {
  const output = success(['--help']);
  const help = JSON.stringify(output);
  assert.match(help, /--apply/);
  assert.match(help, /ratification/i);
  assert.match(help, /completion/i);
  assert.match(help, /not.*authoriz/i);
  assert.match(help, /timeout.*fail.open/i);
  assert.match(help, /\bamend\b/);
  assert.match(help, /project-add/);
  assert.match(help, /registered --project IDs/);
  assert.doesNotMatch(help, /no amendment command/i);
});

test('records can be listed and fetched in batches with linked provenance and hashes', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');

  const listed = success([
    'records-list', '--root', root, '--type', 'work-order', '--status', 'triaged',
  ]);
  assert.equal(listed.records.length, 1);
  assert.equal(listed.records[0].id, order.id);
  assert.equal(listed.records[0].type, 'work-order');
  assert.match(listed.records[0].sha256, /^[0-9a-f]{64}$/);

  const fetched = success([
    'records-get', '--root', root, '--id', order.id, '--linked',
  ]);
  assert.equal(fetched.records.length, 1);
  assert.equal(fetched.records[0].record.id, order.id);
  assert.equal(fetched.records[0].record.status, 'triaged');
  assert.equal(fetched.records[0].sha256, listed.records[0].sha256);
  assert.deepEqual(fetched.records[0].linked, []);
});

test('artifact library persists full documents, discovers case links and preserves superseded content', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const input = {
    title: 'API architecture', kind: 'architecture', format: 'markdown',
    content: '# API architecture\n\n  Preserve indentation and a final newline.\n',
    sourceOffice: 'municipal-software-engineer', workOrderId: order.id, supersedes: null,
    recordCategory: 'filed-work-product',
  };
  const args = ['artifact-record', '--root', root, '--data', JSON.stringify(input)];
  const before = await snapshot(root);
  const preview = success(args);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, false);
  assert.deepEqual(await snapshot(root), before);
  const saved = success([...args, '--apply']);
  assert.equal(saved.changed, true);
  assert.equal(saved.artifact.content, input.content);
  assert.equal(saved.artifact.authenticated, false);
  const originalBytes = await readFile(path.join(root, saved.path));
  const revised = success([
    'artifact-record', '--root', root, '--data',
    JSON.stringify({ ...input, content: '# Revised architecture\n', supersedes: saved.artifact.id }), '--apply',
  ]);
  assert.notEqual(revised.artifact.id, saved.artifact.id);
  assert.deepEqual(await readFile(path.join(root, saved.path)), originalBytes);
  assert.deepEqual(await readFile(recordPath(root, order.id)), Buffer.from(`${JSON.stringify(order, null, 2)}\n`));
  const listing = success([
    'records-list', '--root', root, '--type', 'artifact',
    '--work-order', order.id, '--project', 'default-project', '--limit', '1',
  ]);
  assert.equal(listing.total, 2);
  assert.equal(listing.nextOffset, 1);
  assert.equal(listing.records[0].label, input.title);
  assert.equal(listing.records[0].recordCategory, input.recordCategory);
  assert.equal(listing.records[0].status, null);
  assert.equal(success([
    'records-list', '--root', root, '--type', 'artifact', '--search', 'preserve indentation',
  ]).total, 1);
  assert.equal(success([
    'records-list', '--root', root, '--type', 'artifact', '--search', 'REVISED ARCHITECTURE',
  ]).total, 1);
  failure([
    'records-list', '--root', root, '--type', 'work-order', '--search', 'architecture',
  ], 'INVALID_ARGUMENT');
  assert.equal(success([
    'records-list', '--root', root, '--type', 'artifact', '--offset', '1', '--limit', '1',
  ]).records.length, 1);
  const fetched = success(['records-get', '--root', root, '--id', saved.artifact.id, '--linked']).records[0];
  assert.equal(fetched.record.content, input.content);
  assert.equal(fetched.sha256, createHash('sha256').update(originalBytes).digest('hex'));
  assert.ok(fetched.linked.some((record) => record.id === revised.artifact.id));
  const linkedOrder = success(['records-get', '--root', root, '--id', order.id, '--linked']).records[0];
  assert.equal(linkedOrder.linked.filter((record) => record.type === 'artifact').length, 2);
  const requested = success([
    'records-request', '--root', root, '--requested-by', 'City Manager',
    '--purpose', 'Retrieve the saved design.', '--item',
    JSON.stringify({ type: 'artifact', id: saved.artifact.id, description: input.title }), '--apply',
  ]);
  success([
    'records-resolve', '--root', root, '--id', requested.recordsRequest.id,
    '--resolved-by', 'Records Officer', '--reason', 'Retrieved full design.',
    '--response', JSON.stringify({
      item: 0, outcome: 'found',
      references: [{ type: fetched.type, id: fetched.id, path: fetched.path, sha256: fetched.sha256 }],
      explanation: 'Saved architecture document.',
    }), '--apply',
  ]);
  assert.equal(success(['validate', '--root', root]).records.artifacts, 2);
});

test('artifact input rejects missing sources, bad links, formats and oversized encoded documents without writes', async () => {
  const { root } = await fixture();
  init(root);
  const input = {
    title: 'City-wide plan', kind: 'plan', format: 'text', content: 'A complete plan.\n',
    sourceOffice: 'chief-planner', workOrderId: null, supersedes: null,
    recordCategory: 'proposed-instrument',
  };
  const saved = success(['artifact-record', '--root', root, '--data', JSON.stringify(input), '--apply']);
  const order = petition(root);
  const before = await snapshot(root);
  for (const [changes, code] of [
    [{ sourceOffice: '' }, 'INVALID_ARGUMENT'],
    [{ recordCategory: 'approved' }, 'INVALID_ARGUMENT'],
    [{ recordCategory: undefined }, 'INVALID_RECORD'],
    [{ content: ' \n ' }, 'INVALID_ARGUMENT'],
    [{ format: 'html' }, 'INVALID_ARGUMENT'],
    [{ format: 'json', content: '{' }, 'MALFORMED_JSON'],
    [{ workOrderId: `WO-${randomUUID()}` }, 'NOT_FOUND'],
    [{ supersedes: `ART-${randomUUID()}` }, 'NOT_FOUND'],
    [{ supersedes: saved.artifact.id, workOrderId: order.id }, 'INVALID_ARGUMENT'],
    [{ supersedes: '../outside' }, 'INVALID_ARGUMENT'],
    [{ approval: true }, 'INVALID_RECORD'],
  ]) {
    failure(['artifact-record', '--root', root, '--data', JSON.stringify({ ...input, ...changes }), '--apply'], code);
  }
  const oversized = JSON.stringify({ ...input, content: '\\'.repeat(130900) });
  assert.ok(Buffer.byteLength(oversized) < 256 * 1024, 'Input fits but encoded record metadata exceeds the bound.');
  await assert.rejects(
    artifactRecord(root, { data: oversized, apply: true }),
    { code: 'SIZE_LIMIT' },
  );
  assert.deepEqual(await snapshot(root), before);
});

test('artifact validation rejects broken revision links and unsafe library paths', async () => {
  const { root } = await fixture();
  init(root);
  const input = {
    title: 'Design', kind: 'plan', format: 'text', content: 'Full design.',
    sourceOffice: 'chief-planner', workOrderId: null, supersedes: null,
    recordCategory: 'working-draft',
  };
  const saved = success(['artifact-record', '--root', root, '--data', JSON.stringify(input), '--apply']);
  const record = saved.artifact;
  await writeFile(path.join(root, saved.path), JSON.stringify({ ...record, supersedes: record.id }));
  failure(['validate', '--root', root], 'INVALID_RECORD');
  await writeFile(path.join(root, saved.path), JSON.stringify(record));
  const { root: other } = await fixture('unsafe library');
  init(other);
  await symlink(path.join(root, '.city/artifacts'), path.join(other, '.city/artifacts'), 'dir');
  failure(['artifact-record', '--root', other, '--data', JSON.stringify(input), '--apply'], 'UNSAFE_PATH');
});

test('legacy artifacts remain readable and are not silently assigned a category', async () => {
  const { root } = await fixture();
  init(root);
  const input = {
    title: 'Legacy plan', kind: 'plan', format: 'text', content: 'Original content.',
    sourceOffice: 'chief-planner', workOrderId: null, supersedes: null,
    recordCategory: 'working-draft',
  };
  const saved = success(['artifact-record', '--root', root, '--data', JSON.stringify(input), '--apply']);
  const artifactPath = path.join(root, '.city/artifacts', `${saved.artifact.id}.json`);
  const legacy = { ...saved.artifact };
  delete legacy.recordCategory;
  await writeJSON(artifactPath, legacy);
  assert.equal(success(['validate', '--root', root]).records.artifacts, 1);
  const listed = success(['records-list', '--root', root, '--type', 'artifact']);
  assert.equal(listed.records[0].recordCategory, 'legacy-unclassified');
  const fetched = success(['records-get', '--root', root, '--id', saved.artifact.id]).records[0];
  assert.equal(fetched.record.recordCategory, undefined);
  assert.equal(fetched.record.content, input.content);
});

test('institutional reviews are policy-gated, due from adopted thresholds, previewed, recorded and reset', async () => {
  const { root } = await fixture();
  init(root);
  const draft = success(['status', '--root', root]).institutionalReview;
  assert.equal(draft.available, false);
  assert.match(draft.policyError, /not been adopted/i);
  failure([
    'review-record', '--root', root, '--conducted-by', 'Performance and Innovation Officer',
    '--summary', 'Review the city structure.',
  ], 'REVIEW_UNAVAILABLE');

  success(adoptArgs(root, ['--apply']));
  const config = await readJSON(configPath(root));
  const adoptionTime = new Date(Date.now() - (100 * 24 * 60 * 60 * 1000)).toISOString();
  config.createdAt = adoptionTime;
  config.adoption.adoptedOn = adoptionTime.slice(0, 10);
  config.adoption.recordedAt = adoptionTime;
  await writeJSON(configPath(root), config);

  const due = success(['status', '--root', root]).institutionalReview;
  assert.equal(due.available, true);
  assert.equal(due.due, true);
  assert.equal(due.windowStart, adoptionTime);
  assert.equal(due.triggers.find((trigger) => trigger.name === 'periodic-time').threshold, 90);
  assert.equal(due.triggers.find((trigger) => trigger.name === 'periodic-time').due, true);

  const args = [
    'review-record', '--root', root, '--conducted-by', 'Performance and Innovation Officer',
    '--summary', 'The governance and operational structure were reviewed.',
  ];
  const before = await snapshot(root);
  const preview = success(args);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, false);
  assert.deepEqual(await snapshot(root), before);
  const reservedRecommendation = JSON.stringify({
    title: 'Adopt a new office',
    rationale: 'The current structure has an observed gap.',
    precedent: 'A peer city assigns this function to a dedicated office.',
    sources: ['Official municipal organizational chart, https://example.gov/org'],
    route: 'council',
    reservedMatters: ['governance'],
  });
  failure([...args, '--recommendation', reservedRecommendation], 'INVALID_RECORD');

  const recommendation = JSON.stringify({
    title: 'Review how recurring blocked work is coordinated',
    rationale: 'Repeated blocked work may indicate a coordination gap.',
    precedent: 'Peer-city practices are context and may not transfer directly.',
    sources: ['Official municipal performance report, https://example.gov/performance'],
    route: 'administrative',
    reservedMatters: [],
  });
  const applied = success([...args, '--recommendation', recommendation, '--apply']);
  assert.equal(applied.changed, true);
  assert.match(applied.institutionalReview.id, /^IR-/);
  assert.equal(applied.institutionalReview.recommendations.length, 1);
  const listed = success(['records-list', '--root', root, '--type', 'institutional-review']);
  assert.equal(listed.total, 1);
  assert.equal(listed.records[0].id, applied.institutionalReview.id);
  const retrieved = success(['records-get', '--root', root, '--id', applied.institutionalReview.id]);
  assert.equal(retrieved.records[0].record.id, applied.institutionalReview.id);
  assert.equal(retrieved.records[0].record.recommendations[0].route, 'administrative');
  const after = success(['status', '--root', root]).institutionalReview;
  assert.equal(after.due, false);
  assert.equal(after.lastReview.id, applied.institutionalReview.id);
  assert.equal(after.triggers.find((trigger) => trigger.name === 'periodic-time').observed, 0);
  assert.equal(success(['validate', '--root', root]).records.institutionalReviews, 1);
  failure(args, 'REVIEW_NOT_DUE');
});

test('institutional-review thresholds are read from adopted policy and malformed policy is unavailable', async () => {
  const { root } = await fixture();
  init(root);
  const policyPath = path.join(root, '.city/policies/institutional-review.md');
  const policy = await readFile(policyPath, 'utf8');
  await writeFile(policyPath, policy.replace(
    '| periodic-time | 90 | elapsed days |',
    '| periodic-time | 120 | elapsed days |',
  ));
  success(adoptArgs(root, ['--apply']));
  const status = success(['status', '--root', root]).institutionalReview;
  assert.equal(status.available, true);
  assert.equal(status.triggers.find((trigger) => trigger.name === 'periodic-time').threshold, 120);

  const malformed = await fixture();
  init(malformed.root);
  await writeFile(path.join(malformed.root, '.city/policies/institutional-review.md'), '# No threshold table\n');
  success(adoptArgs(malformed.root, ['--apply']));
  const unavailable = success(['status', '--root', malformed.root]).institutionalReview;
  assert.equal(unavailable.available, false);
  assert.match(unavailable.policyError, /threshold table is missing/i);
});

test('institutional-review status counts every canonical trigger only within its review window', async () => {
  const policy = await readFile(
    path.join(project, 'templates/repository/.city/policies/institutional-review.md'), 'utf8',
  );
  const windowStart = '2025-01-01T00:00:00.000Z';
  const now = new Date('2025-05-01T00:00:00.000Z');
  const inWindow = '2025-04-15T00:00:00.000Z';
  const beforeWindow = '2024-12-31T23:59:59.999Z';
  const afterNow = '2025-05-02T00:00:00.000Z';
  const order = (id, history) => [id, { value: { id, status: 'triaged', projectIds: [], title: id, history } }];
  const historyEvent = (from, to, timestamp) => ({ from, to, timestamp });
  const orders = new Map([
    ...Array.from({ length: 10 }, (_, index) => order(`completed-${index}`, [
      historyEvent('awaiting-merge', 'completed', inWindow),
    ])),
    order('completed-before', [historyEvent('awaiting-merge', 'completed', beforeWindow)]),
    order('completed-after', [historyEvent('awaiting-merge', 'completed', afterNow)]),
    ...Array.from({ length: 3 }, (_, index) => order(`inspection-${index}`, [
      historyEvent('inspection', 'in-progress', inWindow),
    ])),
    order('inspection-after', [historyEvent('inspection', 'in-progress', afterNow)]),
    ...Array.from({ length: 3 }, (_, index) => order(`blocked-${index}`, [
      historyEvent('triaged', 'blocked', inWindow),
    ])),
    order('blocked-before', [historyEvent('triaged', 'blocked', beforeWindow)]),
  ]);
  const outcomes = [
    'return', 'return', 'reject', 'reject',
    'refer', 'refer', 'refer', 'refer', 'return', 'refer',
  ];
  const decisions = new Map(outcomes.map((outcome, index) => [
    `decision-${index}`,
    { value: {
      schemaVersion: 2, id: `decision-${index}`, kind: 'authorization', outcome,
      decidedBy: index >= 8 ? 'resident' : 'city-council',
      createdAt: index === 3 ? beforeWindow : (index === 7 ? afterNow : inWindow),
    } },
  ]));
  const city = {
    config: {
      governance: 'adopted',
      adoption: {
        recordedAt: windowStart,
        policies: [{ path: 'policies/institutional-review.md' }],
      },
    },
    drift: { matchesAdoptedRevision: true },
    institutionalReviewPolicy: policy,
    institutionalReviews: new Map(),
    workOrders: orders,
    decisions,
  };
  const result = institutionalReviewStatus(city, now);
  assert.equal(result.available, true);
  assert.equal(result.windowStart, windowStart);
  assert.equal(result.due, true);
  assert.deepEqual(Object.fromEntries(result.triggers.map(({ name, observed, threshold, due }) => [
    name, { observed, threshold, due },
  ])), {
    'periodic-volume': { observed: 10, threshold: 10, due: true },
    'periodic-time': { observed: 120, threshold: 90, due: true },
    'returned-or-rejected': { observed: 3, threshold: 3, due: true },
    'inspection-failures': { observed: 3, threshold: 3, due: true },
    referrals: { observed: 3, threshold: 3, due: true },
    blocked: { observed: 3, threshold: 3, due: true },
  });
});

test('records requests are previewed, persisted, resolved per item, visible, and retrievable', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const item = JSON.stringify({
    type: 'work-order', id: order.id, description: 'Current order and recorded history',
  });
  const requestArgs = [
    'records-request', '--root', root,
    '--requested-by', 'City: Building Inspector',
    '--purpose', 'Confirm the inspection handoff evidence.',
    '--item', item,
  ];

  const preview = success(requestArgs);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, false);
  assert.deepEqual(await readdir(path.join(root, '.city/records-requests')), []);

  const created = success([...requestArgs, '--apply']);
  const request = created.recordsRequest;
  assert.equal(request.status, 'open');
  assert.equal(request.requestedBy, 'City: Building Inspector');
  assert.equal(request.sourceOffice, null);
  assert.equal(request.sourceOffice, null);
  assert.equal(request.items.length, 1);
  assert.equal(success(['status', '--root', root]).recordsRequests.open, 1);

  const response = JSON.stringify({
    item: 0,
    outcome: 'found',
    references: [{
      type: 'work-order', id: order.id, path: `.city/work-orders/${order.id}.json`,
      sha256: success(['records-list', '--root', root, '--id', order.id]).records[0].sha256,
    }],
    explanation: 'Retrieved from the repository record register.',
  });
  const resolutionArgs = [
    'records-resolve', '--root', root, '--id', request.id,
    '--resolved-by', 'City: Records Officer',
    '--response', response,
    '--reason', 'All requested items were accounted for.',
  ];
  assert.equal(success(resolutionArgs).dryRun, true);
  const resolved = success([...resolutionArgs, '--apply']).recordsRequest;
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.responses[0].outcome, 'found');
  assert.equal(success(['status', '--root', root]).recordsRequests.open, 0);

  const fetched = success(['records-get', '--root', root, '--id', request.id]);
  assert.equal(fetched.records[0].record.status, 'resolved');
});

test('record retrieval rejects unknown IDs and malformed record request references', async () => {
  const { root } = await fixture();
  init(root);
  failure(['records-get', '--root', root, '--id', 'arbitrary/path'], 'INVALID_ARGUMENT');
  failure([
    'records-request', '--root', root,
    '--requested-by', 'Inspector',
    '--purpose', 'Find one record.',
    '--item', JSON.stringify({ type: 'work-order', id: 'arbitrary/path', description: 'No path reads' }),
  ], 'INVALID_ARGUMENT');
});

test('record responses reject stale digests, cancellation is explicit, and old cities stay readable', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const item = JSON.stringify({
    type: 'work-order', id: order.id, description: 'Current work order',
  });
  const request = success([
    'records-request', '--root', root, '--requested-by', 'Inspector', '--source-office', 'Building Inspector',
    '--purpose', 'Check current work-order evidence.', '--item', item, '--apply',
  ]).recordsRequest;
  assert.equal(request.sourceOffice, 'Building Inspector');
  const listed = success(['records-list', '--root', root, '--id', order.id]).records[0];
  await writeJSON(recordPath(root, order.id), { ...order, title: 'Updated canonical title' });

  const staleResponse = JSON.stringify({
    item: 0,
    outcome: 'found',
    references: [{
      type: 'work-order', id: order.id, path: listed.path, sha256: listed.sha256,
    }],
    explanation: 'This reference was fetched before the source changed.',
  });
  failure([
    'records-resolve', '--root', root, '--id', request.id,
    '--resolved-by', 'Records Officer', '--response', staleResponse,
    '--reason', 'The stale reference must not be recorded.',
  ], 'STALE_REFERENCE');
  assert.equal(success(['records-get', '--root', root, '--id', request.id]).records[0].record.status, 'open');

  const cancelled = success([
    'records-cancel', '--root', root, '--id', request.id,
    '--cancelled-by', 'Records Officer', '--reason', 'Requester withdrew the request.', '--apply',
  ]).recordsRequest;
  assert.equal(cancelled.status, 'cancelled');

  await rm(path.join(root, '.city/records-requests'), { recursive: true });
  assert.equal(success(['status', '--root', root]).recordsRequests.total, 0);
  const recreated = success([
    'records-request', '--root', root, '--requested-by', 'Inspector',
    '--purpose', 'Request after upgrade.', '--item', item, '--apply',
  ]).recordsRequest;
  assert.equal(recreated.status, 'open');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('init dry-run writes nothing, including customizations and package assets', async () => {
  const { root } = await fixture();
  await mkdir(path.join(root, '.github/agents'), { recursive: true });
  await writeFile(path.join(root, '.github/agents/existing.agent.md'), 'Do not replace me.\n');
  const before = await snapshot(root);
  const packageBefore = await snapshot(path.join(project, 'scripts'));
  const output = success(['init', '--root', root, '--name', 'Harbour City']);
  assert.equal(output.dryRun, true);
  assert.equal(output.changed, false);
  assert.equal(output.wouldWrite, true);
  assert.equal(output.config.name, 'Harbour City');
  assert.match(JSON.stringify(output), boundary);
  assert.deepEqual(await snapshot(root), before);
  assert.deepEqual(await snapshot(path.join(project, 'scripts')), packageBefore);
});

test('init applies blank templates with fixed not-adopted metadata and is exactly repeatable', async () => {
  const { root } = await fixture();
  await mkdir(path.join(root, '.github'), { recursive: true });
  await writeFile(path.join(root, '.github/copilot-instructions.md'), 'Existing instructions.\n');
  const output = init(root);
  assert.equal(output.changed, true);
  assert.equal(output.dryRun, false);
  const config = await readJSON(configPath(root));
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.adoption, null);
  assert.deepEqual(config.plugin, { name: 'repository-city', version: '0.5.0' });
  assert.match(config.cityId, /^[0-9a-f-]{36}$/);
  assert.equal(config.governance, 'draft');
  assert.equal(config.createdAt, new Date(config.createdAt).toISOString());
  assert.equal(config.name, path.basename(root));
  assert.deepEqual(await readdir(path.join(root, '.city/work-orders')), []);
  assert.deepEqual(await readdir(path.join(root, '.city/decisions')), []);
  const districts = await readJSON(path.join(root, '.city/districts.json'));
  assert.equal(districts.schemaVersion, 1);
  assert.ok(districts.districts.length >= 1);
  assert.deepEqual(await readJSON(path.join(root, '.city/projects.json')), { schemaVersion: 1, projects: [] });
  for (const name of ['charter.md', 'instruction-fragment.md']) {
    assert.equal(
      await readFile(path.join(root, '.city', name), 'utf8'),
      await readFile(path.join(project, 'templates/repository/.city', name), 'utf8'),
    );
  }
  const governanceDocuments = [
    'charter.md',
    ...(await readdir(path.join(root, '.city/policies'))).map((name) => `policies/${name}`),
  ];
  for (const name of governanceDocuments) {
    const contents = await readFile(path.join(root, '.city', name), 'utf8');
    assert.match(contents, /Initialization status: Not adopted\./, name);
    assert.doesNotMatch(contents, /\b(?:draft|template)\b/i, name);
  }
  await writeFile(path.join(root, '.city/charter.md'), '# Local draft amendment\n');
  const before = await snapshot(root);
  const repeated = success(['init', '--root', root, '--name', 'Never reset this city', '--apply']);
  assert.equal(repeated.existing, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(await snapshot(root), before);
  assert.equal((await readJSON(configPath(root))).name, config.name);
  assert.equal((await readdir(root)).some((name) => name.startsWith('.city-stage-')), false);
});

test('all commands reject unknown flags, duplicates, missing roots and malformed input', async () => {
  const { root } = await fixture();
  for (const args of [
    ['init', '--root', root, '--approve'],
    ['init', '--root', root, '--root', root],
    ['init'],
    ['status', '--root', '.'],
    ['init', '--root', path.join(root, 'missing')],
    ['init', '--root', root, '--name', '   '],
    ['petition', '--root', root, '--title', '', '--request', 'A request'],
    ['petition', '--root', root, '--title', 'A title', '--request', '  '],
    ['transition', '--root', root, '--id', '../outside', '--to', 'triaged', '--reason', 'A reason'],
    ['transition', '--root', root, '--id', `WO-${randomUUID()}`, '--to', 'triaged', '--reason', ' '],
    ['status', '--root', root, '--apply'],
    ['unknown-command', '--root', root],
  ]) {
    const result = run(args);
    assert.notEqual(result.status, 0, JSON.stringify(args));
    assert.equal(result.stdout, '');
    assert.equal(typeof JSON.parse(result.stderr).error.message, 'string');
  }
  assert.deepEqual(await readdir(root), []);
});

test('status is inert for an unenrolled repository, while validate reports not enrolled', async () => {
  const { root } = await fixture();
  const before = await snapshot(root);
  const output = success(['status', '--root', root]);
  assert.equal(output.enrolled, false);
  failure(['validate', '--root', root], 'NOT_ENROLLED');
  assert.deepEqual(await snapshot(root), before);
});

test('partial, malformed and incompatible cities are never overwritten', async () => {
  for (const mode of ['partial', 'malformed', 'version', 'governance', 'adopted-without-record', 'provenance', 'extra']) {
    const { root } = await fixture(mode);
    if (mode === 'partial') await mkdir(path.join(root, '.city'));
    else {
      init(root);
      if (mode === 'malformed') await writeFile(configPath(root), '{broken json');
      else {
        const config = await readJSON(configPath(root));
        if (mode === 'version') config.schemaVersion = 3;
        if (mode === 'governance') config.governance = 'ratified';
        if (mode === 'adopted-without-record') config.governance = 'adopted';
        if (mode === 'provenance') config.plugin.version = '99.0.0';
        if (mode === 'extra') config.approve = true;
        await writeJSON(configPath(root), config);
      }
    }
    const before = await snapshot(root);
    for (const command of ['init', 'status', 'validate']) {
      const result = run([command, '--root', root, ...(command === 'init' ? ['--apply'] : [])]);
      assert.notEqual(result.status, 0, mode);
      if (mode === 'version') assert.equal(JSON.parse(result.stderr).error.code, 'UNKNOWN_SCHEMA_VERSION');
    }
    assert.deepEqual(await snapshot(root), before);
  }
});

test('petitions are dry-run by default, exclusive on apply and independently scoped', async () => {
  const first = await fixture('first city');
  const second = await fixture('second city');
  init(first.root);
  init(second.root);
  registerDefaultProject(first.root);
  registerDefaultProject(second.root);
  const before = await snapshot(first.root);
  const dryRun = success([
    'petition', '--root', first.root, '--title', 'A petition', '--request', 'A resident request',
    '--project', 'default-project',
    '--criterion', 'One measurable outcome', '--criterion', 'Another measurable outcome',
  ]);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.changed, false);
  assert.equal(dryRun.workOrder.status, 'received');
  assert.deepEqual(dryRun.workOrder.acceptanceCriteria, ['One measurable outcome', 'Another measurable outcome']);
  assert.deepEqual(await snapshot(first.root), before);
  const firstOrder = petition(first.root);
  const secondOrder = petition(second.root);
  assert.notEqual(firstOrder.id, secondOrder.id);
  assert.notEqual(firstOrder.cityId, secondOrder.cityId);
  assert.equal(firstOrder.schemaVersion, 2);
  assert.equal(firstOrder.history.length, 1);
  assert.equal(firstOrder.history[0].from, null);
  assert.equal(firstOrder.history[0].to, 'received');
  assert.deepEqual(await readJSON(recordPath(first.root, firstOrder.id)), firstOrder);
  assert.equal(success(['status', '--root', first.root]).workOrders.total, 1);
  failure([
    'transition', '--root', second.root, '--id', firstOrder.id, '--to', 'triaged',
    '--reason', 'Cannot cross city boundaries', '--apply',
  ], 'NOT_FOUND');
});

test('transitions preserve append-only history and default to no writes', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const before = await snapshot(root);
  const dryRun = transition(root, order.id, 'triaged', false);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.workOrder.status, 'triaged');
  assert.deepEqual(await snapshot(root), before);
  let previous = order;
  for (const state of ['triaged', 'proposed', 'awaiting-approval', 'blocked', 'triaged', 'rejected', 'reopened', 'triaged', 'withdrawn', 'reopened']) {
    const output = transition(root, order.id, state);
    assert.deepEqual(output.workOrder.history.slice(0, -1), previous.history);
    assert.equal(output.workOrder.history.at(-1).from, previous.status);
    assert.equal(output.workOrder.history.at(-1).to, state);
    assert.equal(output.workOrder.createdAt, order.createdAt);
    previous = output.workOrder;
  }
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.valid, true);
  assert.equal(validated.records.workOrders, 1);
});

test('criteria and the small transition graph are enforced without self-approval', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root, []);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'proposed', '--reason', 'Skip triage', '--apply',
  ], 'INVALID_TRANSITION');
  transition(root, order.id, 'triaged');
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'proposed', '--reason', 'No criteria', '--apply',
  ], 'CRITERIA_REQUIRED');
  for (const [to, code] of [
    ['authorized', 'AUTHORIZATION_REQUIRED'], ['completed', 'AUTHORIZATION_REQUIRED'],
    ['in-progress', 'INVALID_TRANSITION'], ['made-up', 'INVALID_STATE'],
  ]) {
    failure([
      'transition', '--root', root, '--id', order.id, '--to', to, '--reason', 'I approve myself', '--apply',
    ], code);
  }
  transition(root, order.id, 'withdrawn');
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'triaged', '--reason', 'Must reopen first', '--apply',
  ], 'INVALID_TRANSITION');
  const before = await snapshot(root);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'reopened',
    '--reason', 'Self-approval flag is not an interface', '--approve', '--apply',
  ], 'INVALID_ARGUMENT');
  assert.equal(success([
    'records-list', '--root', root, '--type', 'requisition',
  ]).total, 0);
  assert.deepEqual(await snapshot(root), before);
});

test('strict records reject tampered history, foreign cities, authority claims and unknown versions', async () => {
  for (const mode of ['history', 'foreign', 'approval', 'authorized', 'version', 'provenance', 'filename', 'criteria']) {
    const { root } = await fixture(mode);
    init(root);
    const order = petition(root);
    if (mode === 'history') order.history[0].to = 'triaged';
    if (mode === 'foreign') order.cityId = randomUUID();
    if (mode === 'approval') order.approve = true;
    if (mode === 'authorized') order.status = 'authorized';
    if (mode === 'version') order.schemaVersion = 55;
    if (mode === 'provenance') order.provenance.source = 'verified-human';
    if (mode === 'criteria') order.acceptanceCriteria = ['   '];
    if (mode === 'filename') {
      await rm(recordPath(root, order.id));
      await writeJSON(recordPath(root, `WO-${randomUUID()}`), order);
    } else await writeJSON(recordPath(root, order.id), order);
    const before = await snapshot(root);
    const result = run(['validate', '--root', root]);
    assert.notEqual(result.status, 0, mode);
    if (mode === 'version') assert.equal(JSON.parse(result.stderr).error.code, 'UNKNOWN_SCHEMA_VERSION');
    assert.notEqual(run([
      'petition', '--root', root, '--title', 'Another', '--request', 'Must validate first', '--apply',
    ]).status, 0, mode);
    assert.deepEqual(await snapshot(root), before);
  }
});

test('malformed records and unrecognized record files are not silently skipped', async () => {
  for (const [directory, name, content] of [
    ['work-orders', `WO-${randomUUID()}.json`, '{"schemaVersion":1,'],
    ['decisions', `DEC-${randomUUID()}.json`, 'not JSON'],
    ['work-orders', 'unexpected.txt', 'Not a valid record'],
  ]) {
    const { root } = await fixture();
    init(root);
    await writeFile(path.join(root, '.city', directory, name), content);
    const result = run(['status', '--root', root]);
    assert.notEqual(result.status, 0);
    assert.equal(typeof JSON.parse(result.stderr).error.message, 'string');
  }
});

test('district declarations and timestamps are validated, not just parsed', async () => {
  const { root } = await fixture();
  init(root);
  const location = path.join(root, '.city/districts.json');
  const original = await readJSON(location);
  for (const invalid of [
    { ...original, schemaVersion: 5 },
    { ...original, districts: [] },
    { ...original, districts: [original.districts[0], original.districts[0]] },
    { ...original, districts: [{ ...original.districts[0], path: '../outside' }] },
    { ...original, districts: [{ ...original.districts[0], extra: true }] },
  ]) {
    await writeJSON(location, invalid);
    assert.notEqual(run(['validate', '--root', root]).status, 0);
  }
  await writeJSON(location, original);
  const config = await readJSON(configPath(root));
  await writeJSON(configPath(root), { ...config, createdAt: '+012026-10-29T00:00:00.000Z' });
  assert.notEqual(run(['validate', '--root', root]).status, 0, 'timestamps must match the shipped four-digit-year ISO schema');
});

test('projects are explicitly registered with normalized non-overlapping repository paths', async () => {
  const { root } = await fixture();
  init(root);
  const before = await snapshot(root);
  const dryRun = success([
    'project-add', '--root', root, '--id', 'website', '--name', 'Personal Website',
    '--path', 'projects/website', '--description', 'Personal site.', 
  ]);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.changed, false);
  assert.deepEqual(await snapshot(root), before);
  const applied = success([
    'project-add', '--root', root, '--id', 'website', '--name', 'Personal Website',
    '--path', 'projects/website', '--description', 'Personal site.', '--apply',
  ]);
  assert.equal(applied.changed, true);
  assert.deepEqual(await readJSON(path.join(root, '.city/projects.json')), {
    schemaVersion: 1,
    projects: [{
      id: 'website', name: 'Personal Website', path: 'projects/website', description: 'Personal site.',
    }],
  });
  for (const [id, projectPath] of [
    ['nested', 'projects/website/assets'],
    ['case-conflict', 'PROJECTS/WEBSITE/assets'],
    ['parent', 'projects'],
    ['metadata', '.city/private'],
    ['traversal', 'projects/../outside'],
    ['root', '.'],
  ]) {
    const result = run([
      'project-add', '--root', root, '--id', id, '--name', id,
      '--path', projectPath, '--description', 'Invalid project.',
    ]);
    assert.notEqual(result.status, 0, projectPath);
  }
  await writeFile(path.join(root, 'not-a-directory'), 'file');
  assert.notEqual(run([
    'project-add', '--root', root, '--id', 'child', '--name', 'Child',
    '--path', 'not-a-directory/child', '--description', 'Invalid ancestor.',
  ]).status, 0);
  const { directory } = await fixture('path fixture');
  const external = path.join(directory, 'external-project');
  await mkdir(external);
  await symlink(external, path.join(root, 'linked-project'));
  assert.notEqual(run([
    'project-add', '--root', root, '--id', 'linked', '--name', 'Linked',
    '--path', 'linked-project/site', '--description', 'Symlinked path.',
  ]).status, 0);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('pre-0.3 cities can create their first project register without rewriting records', async () => {
  const { root } = await fixture();
  init(root);
  const legacyOrder = petition(root);
  const legacyRecord = await readJSON(recordPath(root, legacyOrder.id));
  delete legacyRecord.projectIds;
  legacyRecord.schemaVersion = 1;
  await writeJSON(recordPath(root, legacyOrder.id), legacyRecord);
  const register = path.join(root, '.city/projects.json');
  await rm(register);
  const before = await snapshot(root);
  assert.deepEqual(success(['status', '--root', root]).projects, []);
  assert.equal(success(['status', '--root', root]).workOrders.unassigned.total, 1);
  const preview = success([
    'project-add', '--root', root, '--id', 'site', '--name', 'Site',
    '--path', 'projects/site', '--description', 'Website project.',
  ]);
  assert.equal(preview.dryRun, true);
  assert.deepEqual(await snapshot(root), before);
  success([
    'project-add', '--root', root, '--id', 'site', '--name', 'Site',
    '--path', 'projects/site', '--description', 'Website project.', '--apply',
  ]);
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.valid, true);
  assert.equal(validated.records.workOrders, 1);
  assert.equal(success(['status', '--root', root]).workOrders.unassigned.total, 1);
});

test('new work orders require a registered project and status groups legacy work separately', async () => {
  const { root } = await fixture();
  init(root);
  const missingProject = run([
    'petition', '--root', root, '--title', 'Missing project',
    '--request', 'A new work order without a project must fail.', '--apply',
  ]);
  assert.notEqual(missingProject.status, 0);
  const unknownProject = run([
    'petition', '--root', root, '--title', 'Unknown project',
    '--request', 'A new work order for an unknown project must fail.',
    '--project', 'unknown', '--apply',
  ]);
  assert.notEqual(unknownProject.status, 0);

  const first = petition(root);
  const withoutProjects = await readJSON(recordPath(root, first.id));
  delete withoutProjects.projectIds;
  await writeJSON(recordPath(root, first.id), withoutProjects);
  assert.notEqual(run(['validate', '--root', root]).status, 0, 'version 2 requires project IDs');
  await writeJSON(recordPath(root, first.id), first);
  success([
    'project-add', '--root', root, '--id', 'docs', '--name', 'Documentation',
    '--path', 'projects/docs', '--description', 'Documentation project.', '--apply',
  ]);
  const second = success([
    'petition', '--root', root, '--title', 'Document the service',
    '--request', 'Update documentation in its own project.',
    '--project', 'docs', '--criterion', 'The guide is accurate.', '--apply',
  ]).workOrder;
  assert.deepEqual(first.projectIds, ['default-project']);
  assert.deepEqual(second.projectIds, ['docs']);
  const status = success(['status', '--root', root]);
  const crossProject = success([
    'petition', '--root', root, '--title', 'Coordinate project work',
    '--request', 'This work explicitly spans both projects.',
    '--project', 'default-project', '--project', 'docs', '--criterion', 'Both scopes are coordinated.', '--apply',
  ]).workOrder;
  assert.deepEqual(crossProject.projectIds, ['default-project', 'docs']);
  const grouped = success(['status', '--root', root]);
  assert.deepEqual(grouped.workOrders.byProject.map(({ projectId, total }) => [projectId, total]), [
    ['default-project', 2], ['docs', 2],
  ]);
  assert.equal(grouped.workOrders.unassigned.total, 0);
  assert.equal(status.workOrders.total, 2);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('infrastructure records report stewardship, create pinned work, reserve security authority, and reject scope drift', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  await writeFile(path.join(root, 'shared-build.json'), '{"build":true}\n');
  const data = infrastructureAssetData();
  const registerArgs = [
    'asset-register', '--root', root, '--data', JSON.stringify(data),
    '--recorded-by', 'City Manager', '--reason', 'Register shared build service.',
  ];
  const preview = success(registerArgs);
  assert.equal(preview.dryRun, true);
  assert.equal(success(['status', '--root', root]).infrastructure.assets, 0);
  const registered = success([...registerArgs, '--apply']).asset;
  assert.match(registered.id, /^IA-/);
  const programme = success([
    'infrastructure-programme-record', '--root', root, '--revision', '0',
    '--data', JSON.stringify({
      horizon: { startYear: new Date().getUTCFullYear(), endYear: new Date().getUTCFullYear() + 5 },
      reviewDue: new Date().toISOString().slice(0, 10),
      summary: 'Rolling review of shared repository foundations.',
      assets: [{ assetId: registered.id, revision: registered.revision }],
      activities: [],
      unfundedNeeds: [{
        id: 'build-provider-review', description: 'Assess provider continuity.',
        consequence: 'Recovery options remain uncertain.', reviewDate: new Date().toISOString().slice(0, 10),
      }],
    }),
    '--recorded-by', 'Chief Planner', '--reason', 'Establish a rolling review.', '--apply',
  ]);
  assert.equal(programme.programme.revision, 1);
  assert.deepEqual(
    await readJSON(path.join(root, '.city/infrastructure/programme.json')), programme.programme,
    'Applied programme output must match the persisted record.',
  );
  const infrastructureStatus = success(['status', '--root', root]).infrastructure;
  assert.equal(infrastructureStatus.assets, 1);
  assert.equal(infrastructureStatus.dueObligations[0].assetId, registered.id);
  assert.equal(infrastructureStatus.staleServices[0].serviceId, 'builds');
  assert.equal(infrastructureStatus.missingOperatingCoverage[0], registered.id);
  assert.equal(infrastructureStatus.programme.unfundedNeeds, 1);

  const infrastructure = {
    assets: [registered.id],
    targets: [{ assetId: registered.id, path: 'shared-build.json' }],
    obligations: [{
      assetId: registered.id, obligationId: 'monthly-health-review',
      dueDate: data.obligations[0].dueDate,
    }],
    findings: [{ assetId: registered.id, findingId: 'security-report' }],
  };
  const order = success([
    'petition', '--root', root, '--title', 'Review shared build security',
    '--request', 'Assess the supplied security report and maintain the shared build service.',
    '--infrastructure', JSON.stringify(infrastructure),
    '--criterion', 'Assessment and any authorized change are inspected and documented.', '--apply',
  ]).workOrder;
  assert.equal(order.schemaVersion, 3);
  assert.equal(Object.hasOwn(order, 'projectIds'), false);
  assert.equal(success(['validate', '--root', root]).valid, true);
  success(zoningCheckArgs(root, order.id, ['security'], true));
  transition(root, order.id, 'triaged');
  transition(root, order.id, 'proposed');
  recordScreening(root, order.id, screening({
    projectIds: [], scopeEvidence: 'Pinned shared-build.json target and asset revision.',
  }));
  success([
    'transition', '--root', root, '--id', order.id, '--to', 'awaiting-approval',
    '--reason', 'Exact infrastructure scope is screened.', '--apply',
  ]);
  const councilDecision = [
    'authorize', '--root', root, '--id', order.id, '--decided-by', 'city-council',
    '--outcome', 'authorize', '--reserved', 'security', '--reason', 'Routine delivery.',
  ];
  failure(councilDecision, 'RESERVED_MATTER');
  const residentAuthorization = success([
    'authorize', '--root', root, '--id', order.id, '--decided-by', 'resident',
    '--outcome', 'authorize', '--reserved', 'security', '--reason', 'Resident decision on security work.',
    '--declared-by', 'Repository resident', '--evidence', 'Security authority recorded in the review.',
    '--apply',
  ]);
  assert.equal(residentAuthorization.workOrder.status, 'authorized');

  const revised = { ...registered, lifecycle: 'deprecated' };
  success([
    'asset-revise', '--root', root, '--id', registered.id, '--revision', '1',
    '--data', JSON.stringify(revised), '--recorded-by', 'City Manager',
    '--reason', 'Record lifecycle change for drift test.', '--apply',
  ]);
  assert.equal(success(['status', '--root', root]).infrastructure.staleWorkOrders[0].id, order.id);
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'in-progress',
    '--reason', 'Attempt delivery against stale asset scope.',
  ], 'STALE_INFRASTRUCTURE');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('infrastructure no-change reviews preserve recurring and event-driven obligations', async () => {
  const { root } = await fixture();
  init(root);
  const data = infrastructureAssetData();
  data.obligations.push({
    ...data.obligations[0], id: 'event-review', trigger: 'event-driven',
    dueDate: null, recurrenceDays: null,
  });
  let asset = success([
    'asset-register', '--root', root, '--data', JSON.stringify(data),
    '--recorded-by', 'City Manager', '--reason', 'Register maintenance obligations.', '--apply',
  ]).asset;
  for (const original of data.obligations) {
    asset = success([
      'asset-review', '--root', root, '--id', asset.id, '--revision', String(asset.revision),
      '--data', JSON.stringify({
        kind: 'obligation', obligationId: original.id, outcome: 'no-change',
        date: new Date().toISOString().slice(0, 10), evidence: 'No accepted maintenance work yet.',
        workOrderId: null, reviewDate: null, riskOwner: null, authorityReference: null,
      }),
      '--recorded-by', 'Engineering Manager', '--reason', 'Record review without completion.', '--apply',
    ]).asset;
    const reviewed = asset.obligations.find((obligation) => obligation.id === original.id);
    assert.equal(reviewed.status, original.status);
    assert.equal(reviewed.dueDate, original.dueDate);
    assert.equal(reviewed.nextReviewDate, original.nextReviewDate);
    assert.deepEqual(reviewed.history.map((entry) => entry.outcome), ['no-change']);
    assert.deepEqual(
      await readJSON(path.join(root, '.city/infrastructure/assets', `${asset.id}.json`)), asset,
      'Applied review output must match the persisted record.',
    );
  }
  const status = success(['status', '--root', root]).infrastructure;
  assert.equal(status.dueObligations[0].id, data.obligations[0].id);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('infrastructure deferrals preserve the original obligation and survive no-change reviews', async () => {
  const { root } = await fixture();
  init(root);
  const data = infrastructureAssetData();
  let asset = success([
    'asset-register', '--root', root, '--data', JSON.stringify(data),
    '--recorded-by', 'City Manager', '--reason', 'Register a maintenance obligation.', '--apply',
  ]).asset;
  const reviewDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  asset = success([
    'asset-review', '--root', root, '--id', asset.id, '--revision', String(asset.revision),
    '--data', JSON.stringify({
      kind: 'obligation', obligationId: data.obligations[0].id, outcome: 'deferred',
      date: new Date().toISOString().slice(0, 10), evidence: 'Capacity is unavailable until review.',
      workOrderId: null, reviewDate, riskOwner: 'City Manager', authorityReference: 'Recorded capacity decision.',
    }),
    '--recorded-by', 'City Manager', '--reason', 'Record maintenance deferral.', '--apply',
  ]).asset;
  assert.match(asset.deferrals[0].id, /^[a-z][a-z0-9-]{0,63}$/u);
  assert.equal(asset.deferrals[0].originalDueDate, data.obligations[0].dueDate);
  assert.equal(asset.deferrals[0].riskOwner, 'City Manager');
  assert.equal(asset.deferrals[0].reviewDate, reviewDate);
  assert.deepEqual(
    await readJSON(path.join(root, '.city/infrastructure/assets', `${asset.id}.json`)), asset,
    'Applied deferral output must match the persisted record.',
  );
  asset = success([
    'asset-review', '--root', root, '--id', asset.id, '--revision', String(asset.revision),
    '--data', JSON.stringify({
      kind: 'obligation', obligationId: data.obligations[0].id, outcome: 'no-change',
      date: new Date().toISOString().slice(0, 10), evidence: 'Capacity is still unavailable.',
      workOrderId: null, reviewDate: null, riskOwner: null, authorityReference: null,
    }),
    '--recorded-by', 'City Manager', '--reason', 'Retain the recorded deferral.', '--apply',
  ]).asset;
  assert.equal(asset.obligations[0].status, 'deferred');
  assert.equal(asset.obligations[0].dueDate, data.obligations[0].dueDate);
  assert.equal(asset.obligations[0].nextReviewDate, reviewDate);
  assert.deepEqual(asset.obligations[0].history.map((entry) => entry.outcome), ['deferred', 'no-change']);
  assert.equal(asset.deferrals.length, 1);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('legacy work orders without project IDs remain valid and project references are checked', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const location = recordPath(root, order.id);
  const current = await readJSON(location);
  delete current.projectIds;
  current.schemaVersion = 1;
  await writeJSON(location, current);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.equal(success(['status', '--root', root]).workOrders.unassigned.total, 1);
  await writeJSON(location, { ...current, projectId: 'missing-project' });
  assert.notEqual(run(['validate', '--root', root]).status, 0);
});

test('decision records can only describe proposals, never adoption or verified approval', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const decision = {
    schemaVersion: 1,
    id: `DEC-${randomUUID()}`,
    cityId: order.cityId,
    kind: 'proposal',
    status: 'proposed',
    title: 'Consider a draft option',
    proposal: 'This proposal is not an adopted policy or authorization.',
    workOrderIds: [order.id],
    createdAt: new Date().toISOString(),
    provenance: order.provenance,
  };
  const location = path.join(root, '.city/decisions', `${decision.id}.json`);
  await writeJSON(location, decision);
  assert.equal(success(['validate', '--root', root]).records.decisions, 1);
  for (const invalid of [
    { ...decision, status: 'adopted' },
    { ...decision, approve: true },
    { ...decision, workOrderIds: [`WO-${randomUUID()}`] },
    { ...decision, schemaVersion: 2 },
  ]) {
    await writeJSON(location, invalid);
    assert.notEqual(run(['validate', '--root', root]).status, 0);
  }
});

test('symlinked city, directories and record/config files are refused without touching targets', async () => {
  for (const target of ['.city', '.city/work-orders', '.city/decisions', '.city/config.json', 'record']) {
    const { directory, root } = await fixture();
    const external = path.join(directory, 'external');
    await mkdir(external);
    init(root);
    let location = path.join(root, target);
    let destination = external;
    if (target === '.city') {
      await cp(location, path.join(external, 'city'), { recursive: true });
      destination = path.join(external, 'city');
    } else if (target === '.city/config.json') {
      destination = path.join(external, 'config.json');
      await cp(location, destination);
    } else if (target === 'record') {
      const order = petition(root);
      location = recordPath(root, order.id);
      destination = path.join(external, `${order.id}.json`);
      await cp(location, destination);
    }
    await rm(location, { recursive: true });
    await symlink(destination, location);
    const externalBefore = await snapshot(external);
    assert.notEqual(run(['validate', '--root', root]).status, 0, target);
    assert.notEqual(run(['init', '--root', root, '--apply']).status, 0, target);
    assert.deepEqual(await snapshot(external), externalBefore);
    const denied = hookResult(payload(root));
    assert.equal(denied.permissionDecision, 'deny');
  }
});

test('exclusive mutation locks fail closed and are never removed by another writer', async () => {
  const { root } = await fixture();
  init(root);
  const lock = path.join(root, '.city/.mutation-lock');
  registerDefaultProject(root);
  await writeFile(lock, 'Existing mutation; inspect before recovery.\n');
  const before = await snapshot(root);
  failure([
    'petition', '--root', root, '--title', 'Concurrent', '--request', 'Do not override a writer',
    '--project', 'default-project', '--apply',
  ], 'CONFLICT');
  assert.deepEqual(await snapshot(root), before);
});

test('concurrent transitions never clobber one another or lose history', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const command = [
    'transition', '--root', root, '--id', order.id, '--to', 'triaged',
    '--reason', 'Concurrent routing', '--apply',
  ];
  const { spawn } = await import('node:child_process');
  const results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...command], { cwd: project });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  })));
  assert.equal(results.filter((result) => result.status === 0).length, 1);
  const persisted = await readJSON(recordPath(root, order.id));
  assert.equal(persisted.status, 'triaged');
  assert.equal(persisted.history.length, 2);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.equal((await readdir(path.join(root, '.city'))).some((name) => name.startsWith('.pending-') || name === '.mutation-lock'), false);
});

test('concurrent initialization exclusively publishes a single city without leftover staging', async () => {
  const { root } = await fixture();
  const { spawn } = await import('node:child_process');
  const results = await Promise.all(['One', 'Two', 'Three'].map((name) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'init', '--root', root, '--name', name, '--apply'], { cwd: project });
    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout }));
  })));
  const applied = results.filter((result) => result.status === 0 && JSON.parse(result.stdout).changed);
  assert.equal(applied.length, 1);
  const config = await readJSON(configPath(root));
  assert.deepEqual(config, JSON.parse(applied[0].stdout).config);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.deepEqual(await readdir(root), ['.city']);
});

test('the installed plugin works from paths with spaces and never enrolls itself', async () => {
  const { directory, root } = await fixture();
  const installed = path.join(directory, 'installed plugin with spaces');
  await mkdir(installed);
  for (const name of ['scripts', 'schemas', 'templates']) {
    await cp(path.join(project, name), path.join(installed, name), { recursive: true });
  }
  const before = await snapshot(installed);
  const installedCLI = path.join(installed, 'scripts/city.mjs');
  success(['init', '--root', root, '--apply'], installedCLI);
  assert.equal(success(['status', '--root', root], installedCLI).enrolled, true);
  assert.deepEqual(hookResult(payload(root), path.join(installed, 'scripts/city-hook.mjs')), {});
  assert.deepEqual(await snapshot(installed), before);
});

test('city publication preserves existing destinations and removes its staging directory', async () => {
  for (const kind of ['file', 'empty-directory', 'nonempty-directory']) {
    const { root } = await fixture();
    const destination = path.join(root, '.city');
    if (kind === 'file') await writeFile(destination, 'Existing content.\n');
    else {
      await mkdir(destination);
      if (kind === 'nonempty-directory') {
        await writeFile(path.join(destination, 'resident-record.txt'), 'Existing record.\n');
      }
    }
    const before = await snapshot(root);
    await assert.rejects(
      publishCity(root, new Map([['config.json', '{"proposed":true}\n']])),
      { code: 'CONFLICT' },
      kind,
    );
    assert.deepEqual(await snapshot(root), before, kind);
  }
});

test('hook is inert outside a city and for valid draft cities, with no allow override', async () => {
  const { root } = await fixture();
  await mkdir(path.join(root, '.git'));
  const before = await snapshot(root);
  assert.deepEqual(hookResult(payload(root)), {});
  assert.deepEqual(await snapshot(root), before);
  init(root);
  const enrolledBefore = await snapshot(root);
  assert.deepEqual(hookResult(payload(root)), {});
  assert.deepEqual(await snapshot(root), enrolledBefore);
});

test('hook discovers physical ancestors, stops at nested git boundaries and isolates cities', async () => {
  const first = await fixture('first');
  const second = await fixture('second');
  init(first.root);
  init(second.root);
  await mkdir(path.join(first.root, '.git'));
  const nested = path.join(first.root, 'components/deep');
  const innerRepo = path.join(first.root, 'vendor/independent');
  await mkdir(nested, { recursive: true });
  await mkdir(innerRepo, { recursive: true });
  await writeFile(path.join(innerRepo, '.git'), 'gitdir: ../worktree-metadata\n');
  await writeFile(configPath(first.root), '{corrupt');
  assert.equal(hookResult(payload(nested)).permissionDecision, 'deny');
  assert.deepEqual(hookResult(payload(innerRepo)), {});
  assert.deepEqual(hookResult(payload(second.root)), {});
  const alias = path.join(first.directory, 'alias-to-second');
  await symlink(second.root, alias);
  assert.deepEqual(hookResult(payload(alias)), {});
  const unenrolled = path.join(first.directory, 'unrelated');
  await mkdir(path.join(unenrolled, '.git'), { recursive: true });
  assert.deepEqual(hookResult(payload(unenrolled)), {});
});

test('hook explicitly denies partial, unknown-version and malformed enrolled records', async () => {
  for (const mode of ['partial', 'unknown', 'record', 'not-directory']) {
    const { root } = await fixture();
    if (mode === 'partial') await mkdir(path.join(root, '.city'));
    else if (mode === 'not-directory') await writeFile(path.join(root, '.city'), 'not a directory');
    else {
      init(root);
      if (mode === 'unknown') {
        const config = await readJSON(configPath(root));
        config.schemaVersion = 999;
        await writeJSON(configPath(root), config);
      }
      if (mode === 'record') {
        const order = petition(root);
        await writeFile(recordPath(root, order.id), '{malformed');
      }
    }
    const before = await snapshot(root);
    const result = hookResult(payload(root));
    assert.equal(result.permissionDecision, 'deny', mode);
    assert.match(result.permissionDecisionReason, /^City /);
    assert.match(result.permissionDecisionReason, /repair|restore|recover/i);
    assert.doesNotMatch(JSON.stringify(result), /NEVER_ECHO_THIS_SECRET/);
    assert.deepEqual(await snapshot(root), before);
  }
});

test('hook denies inaccessible enrollment rather than treating it as unenrolled', async (context) => {
  const { root } = await fixture();
  init(root);
  const location = configPath(root);
  await chmod(location, 0o000);
  try {
    let readable = false;
    try {
      await readFile(location);
      readable = true;
    } catch (error) {
      assert.equal(error.code, 'EACCES');
    }
    if (readable) {
      context.skip('Current filesystem identity bypasses mode restrictions.');
      return;
    }
    const result = hookResult(payload(root));
    assert.equal(result.permissionDecision, 'deny');
    assert.match(result.permissionDecisionReason, /repair|restore/i);
  } finally {
    await chmod(location, 0o600);
  }
});

test('hook refuses ambiguous symlinked git boundaries even beside an enrolled city', async () => {
  const { directory, root } = await fixture();
  init(root);
  const outsideGit = path.join(directory, 'git-metadata');
  await mkdir(outsideGit);
  await symlink(outsideGit, path.join(root, '.git'));
  const result = hookResult(payload(root));
  assert.equal(result.permissionDecision, 'deny');
  assert.match(result.permissionDecisionReason, /repair|restore/i);
});

test('bad hook payloads, snake_case names and oversized input receive explicit denial', async () => {
  const { root } = await fixture();
  for (const value of [
    '{invalid', 'null', '[]', '{}',
    { cwd: '.', toolName: 'edit', toolArgs: {} },
    { cwd: path.join(root, 'missing'), toolName: 'edit', toolArgs: {} },
    { cwd: root, tool_name: 'edit', tool_input: {} },
    { cwd: root, toolName: '', toolArgs: {} },
    { cwd: root, toolName: 'edit' },
    { cwd: root, toolName: 'edit', toolArgs: null },
    { cwd: root, toolName: 'edit', toolArgs: ['NEVER_ECHO_THIS_SECRET'] },
    { cwd: root, toolName: 'edit', toolArgs: 42 },
    { cwd: root, toolName: 'edit', toolArgs: true },
    JSON.stringify({ ...payload(root), padding: 'x'.repeat(1024 * 1024 + 1) }),
  ]) {
    const result = hookResult(value);
    assert.equal(result.permissionDecision, 'deny');
    assert.match(result.permissionDecisionReason, /^City /);
    assert.match(result.permissionDecisionReason, /repair|restore|recover/i);
    assert.doesNotMatch(JSON.stringify(result), /NEVER_ECHO_THIS_SECRET/);
  }
});

test('hook accepts plain-text patch arguments and still validates enrolled state', async () => {
  const { root } = await fixture();
  const patch = (cwd) => ({
    cwd,
    toolName: 'apply_patch',
    toolArgs: '*** Begin Patch\n*** Update File: .city/policies/x.md\n+NEVER_ECHO_THIS_SECRET\n*** End Patch\n',
  });
  assert.deepEqual(hookResult(patch(root)), {});
  init(root);
  assert.deepEqual(hookResult(patch(root)), {});
  const config = await readJSON(configPath(root));
  config.schemaVersion = 999;
  await writeJSON(configPath(root), config);
  const denied = hookResult(patch(root));
  assert.equal(denied.permissionDecision, 'deny');
  assert.doesNotMatch(JSON.stringify(denied), /NEVER_ECHO_THIS_SECRET/);
});

test('hook denial reports the specific validation cause', async () => {
  const { root } = await fixture();
  const bad = hookResult({ cwd: root, toolName: 'edit', toolArgs: 42 });
  assert.match(bad.permissionDecisionReason, /Cause: BAD_PAYLOAD: Hook toolArgs must be a JSON object or a string\./);
  const relative = hookResult({ cwd: '.', toolName: 'edit', toolArgs: {} });
  assert.match(relative.permissionDecisionReason, /Cause: BAD_PAYLOAD: Hook cwd must be absolute\./);
});

test('published schemas are strict, draft-only and versioned without runtime dependencies', async () => {
  for (const [name, version] of [['config', 2], ['config.v1', 1], ['districts', 1], ['projects', 1]]) {
    const schema = await readJSON(path.join(project, 'schemas', `${name}.schema.json`));
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.schemaVersion.const, version);
  }
  for (const name of ['config', 'config.v1']) {
    const schema = await readJSON(path.join(project, 'schemas', `${name}.schema.json`));
    assert.deepEqual(schema.properties.plugin.properties.version.enum, ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0']);
  }
  const config = await readJSON(path.join(project, 'schemas/config.schema.json'));
  assert.deepEqual(config.properties.governance.enum, ['draft', 'adopted']);
  const adoption = config.properties.adoption.oneOf[1];
  assert.equal(adoption.properties.evidence.properties.rule.const, 'resident-declaration');
  assert.equal(adoption.properties.evidence.properties.authenticated.const, false);
  assert.ok(adoption.properties.history, 'adoption.properties.history must exist');
  assert.equal(adoption.required.includes('history'), false);
  const historyEntry = adoption.properties.history.items;
  assert.equal(historyEntry.properties.evidence.properties.authenticated.const, false);
  const order = await readJSON(path.join(project, 'schemas/work-order.schema.json'));
  assert.ok(order.properties.projectIds, 'work orders expose project associations');
  assert.equal(order.properties.projectIds.minItems, 1);
  assert.deepEqual(order.properties.schemaVersion.enum, [1, 2, 3]);
  assert.deepEqual(order.allOf[0].then.required, ['projectIds']);
  const projectSchema = await readJSON(path.join(project, 'schemas/projects.schema.json'));
  assert.deepEqual(projectSchema.required, ['schemaVersion', 'projects']);
  assert.deepEqual(projectSchema.properties.projects.items.required, ['id', 'name', 'path', 'description']);
  assert.deepEqual(order.properties.status.enum, [
    'received', 'triaged', 'proposed', 'awaiting-approval',
    'authorized', 'in-progress', 'inspection', 'awaiting-merge', 'completed',
    'blocked', 'rejected', 'withdrawn', 'reopened',
  ]);
  assert.deepEqual(order.properties.provenance.properties.plugin.properties.version.enum, ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0']);
  assert.equal(order.$defs.development.properties.permitExtensions.items.$ref, '#/$defs/permitExtension');
  assert.deepEqual(order.$defs.permitExtension.properties.decidedBy.enum, ['city-council', 'resident']);
  const decision = await readJSON(path.join(project, 'schemas/decision.schema.json'));
  assert.deepEqual(decision.properties.schemaVersion.enum, [1, 2]);
  const { proposal, delivery } = decision.$defs;
  for (const [variant, version] of [[proposal, 1], [delivery, 2]]) {
    assert.equal(variant.type, 'object');
    assert.equal(variant.additionalProperties, false);
    assert.equal(variant.properties.schemaVersion.const, version);
  }
  assert.equal(proposal.properties.status.const, 'proposed');
  assert.deepEqual(delivery.properties.kind.enum, ['authorization', 'acceptance']);
  assert.equal(delivery.properties.evidence.properties.authenticated.const, false);
  assert.deepEqual(delivery.properties.reservedMatters.items.enum, [
    'governance', 'security', 'deletion', 'deployment', 'publication', 'expenditure',
  ]);
  assert.deepEqual(delivery.properties.routineClass.enum, ['documentation', 'tests', 'in-scope-fix', 'dependency-patch', null]);
});

async function legacyCity(root) {
  init(root);
  const config = await readJSON(configPath(root));
  config.schemaVersion = 1;
  delete config.adoption;
  await writeJSON(configPath(root), config);
  return config;
}

const adoptArgs = (root, extra = []) => [
  'adopt', '--root', root, '--adopted-on', new Date().toISOString().slice(0, 10),
  '--declared-by', 'Initial resident', '--evidence', 'Charter and policies record the resident declaration.',
  ...extra,
];

const amendArgs = (root, extra = []) => [
  'amend', '--root', root, '--adopted-on', new Date().toISOString().slice(0, 10),
  '--declared-by', 'Returning resident', '--evidence', 'Charter and policies record the resident declaration.',
  ...(extra.includes('--summary') ? [] : ['--summary', 'Correct outdated jurisdiction statement.']),
  ...extra,
];

test('legacy schemaVersion 1 cities stay valid and the hook stays inert before migration', async () => {
  const { root } = await fixture();
  await legacyCity(root);
  const order = petition(root);
  assert.equal(success(['validate', '--root', root]).city.migrationAvailable, true);
  assert.deepEqual(hookResult(payload(root)), {});
  failure(adoptArgs(root), 'MIGRATION_REQUIRED');
  const config = await readJSON(configPath(root));
  config.governance = 'adopted';
  await writeJSON(configPath(root), config);
  assert.match(failure(['validate', '--root', root], 'INVALID_RECORD').error.message, /migrate/);
  assert.equal(hookResult(payload(root)).permissionDecision, 'deny');
  assert.ok(order.id);
});

test('migrate is dry-run by default and upgrades only config, preserving every record', async () => {
  const { root } = await fixture();
  const legacy = await legacyCity(root);
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const before = await snapshot(root);
  const dry = success(['migrate', '--root', root]);
  assert.equal(dry.dryRun, true);
  assert.equal(dry.wouldWrite, true);
  assert.deepEqual(dry.plan.preserve['work-orders'], [order.id]);
  assert.deepEqual(await snapshot(root), before);
  const applied = success(['migrate', '--root', root, '--apply']);
  assert.equal(applied.changed, true);
  const config = await readJSON(configPath(root));
  assert.deepEqual(config, { ...legacy, schemaVersion: 2, adoption: null });
  const after = await snapshot(root);
  const withoutConfig = (entries) => entries.filter(([key]) => key !== path.join('.city', 'config.json'));
  assert.deepEqual(withoutConfig(after), withoutConfig(before));
  const repeated = success(['migrate', '--root', root, '--apply']);
  assert.equal(repeated.changed, false);
  assert.deepEqual(await snapshot(root), after);
  assert.deepEqual(hookResult(payload(root)), {});
});

test('adopt records date, exact charter revision and resident-declaration evidence', async () => {
  const { root } = await fixture();
  init(root);
  const order = petition(root);
  const before = await snapshot(root);
  const dry = success(adoptArgs(root, ['--charter-version', '1.0']));
  assert.equal(dry.dryRun, true);
  assert.deepEqual(await snapshot(root), before);
  const output = success(adoptArgs(root, ['--charter-version', '1.0', '--apply']));
  assert.equal(output.governance, 'adopted');
  assert.match(output.notice, /does not authenticate/);
  assert.match(output.notice, /recorded, not authenticated/);
  assert.match(output.notice, /no git, merge/);
  const config = await readJSON(configPath(root));
  assert.equal(config.governance, 'adopted');
  const charter = createHash('sha256').update(await readFile(path.join(root, '.city/charter.md'))).digest('hex');
  assert.equal(config.adoption.charter.sha256, charter);
  assert.equal(config.adoption.charter.version, '1.0');
  assert.equal(config.adoption.policies.length, (await readdir(path.join(root, '.city/policies'))).length);
  assert.equal(config.adoption.policies.some((policy) => policy.path === 'policies/zoning.md'), false);
  assert.deepEqual(config.adoption.evidence, {
    rule: 'resident-declaration',
    declaredBy: 'Initial resident',
    reference: 'Charter and policies record the resident declaration.',
    authenticated: false,
  });
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.governance, 'adopted');
  assert.equal(validated.city.adoption.drift.matchesAdoptedRevision, true);
  assert.equal(success(['status', '--root', root]).zoning.enabled, false);
  assert.deepEqual(hookResult(payload(root)), {});
  assert.equal(transition(root, order.id, 'triaged').governance, 'adopted');
  failure(['transition', '--root', root, '--id', order.id, '--to', 'in-progress', '--reason', 'Deliver'], 'INVALID_TRANSITION');
  failure(adoptArgs(root, ['--apply']), 'ALREADY_ADOPTED');
});

test('charter amendments after adoption are reported as drift without blocking the hook', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# Amended charter\n');
  await writeFile(path.join(root, '.city/policies/new-policy.md'), '# New policy\n');
  const drift = success(['status', '--root', root]).city.adoption.drift;
  assert.deepEqual(drift, {
    matchesAdoptedRevision: false, charterMatches: false, changedPolicies: ['policies/new-policy.md'],
  });
  assert.deepEqual(hookResult(payload(root)), {});
});

test('adopt rejects bad arguments and forged adoption records are invalid', async () => {
  const { root } = await fixture();
  init(root);
  const before = await snapshot(root);
  for (const date of ['2026-02-30', '29-10-2026', '2999-01-01', '2000-01-01']) {
    const result = run(['adopt', '--root', root, '--adopted-on', date, '--declared-by', 'R', '--evidence', 'E', '--apply']);
    assert.notEqual(result.status, 0, date);
  }
  failure(['adopt', '--root', root, '--adopted-on', '2026-01-01', '--evidence', 'E'], 'INVALID_ARGUMENT');
  failure(['adopt', '--root', root, '--adopted-on', '2026-01-01', '--declared-by', ' ', '--evidence', 'E'], 'INVALID_ARGUMENT');
  assert.deepEqual(await snapshot(root), before);
  success(adoptArgs(root, ['--apply']));
  const adopted = await readJSON(configPath(root));
  for (const forge of [
    (config) => { config.adoption.evidence.authenticated = true; },
    (config) => { config.adoption.evidence.rule = 'external-approval'; },
    (config) => { config.adoption.charter.sha256 = 'not-a-digest'; },
    (config) => { config.adoption.policies = []; },
    (config) => {
      const developmentPolicy = config.adoption.policies
        .find((policy) => policy.path === 'policies/development-applications.md');
      developmentPolicy.path = 'policies/zoning.md';
    },
    (config) => { config.adoption.approvedForDelivery = true; },
    (config) => { config.governance = 'draft'; },
    (config) => { config.adoption = null; },
  ]) {
    const config = structuredClone(adopted);
    forge(config);
    await writeJSON(configPath(root), config);
    failure(['validate', '--root', root], 'INVALID_RECORD');
    assert.equal(hookResult(payload(root)).permissionDecision, 'deny');
  }
});

test('amend refuses before any charter has been adopted', async () => {
  const { root } = await fixture();
  init(root);
  const before = await snapshot(root);
  failure(amendArgs(root), 'NOT_ADOPTED');
  failure(amendArgs(root, ['--apply']), 'NOT_ADOPTED');
  assert.deepEqual(await snapshot(root), before);
});

test('amend on an unmodified legacy schemaVersion 1 draft city requires migration first', async () => {
  const { root } = await fixture();
  await legacyCity(root);
  const before = await snapshot(root);
  failure(amendArgs(root), 'MIGRATION_REQUIRED');
  failure(amendArgs(root, ['--apply']), 'MIGRATION_REQUIRED');
  assert.deepEqual(await snapshot(root), before);
});

test('amend refuses when the charter and policies already match the adopted revision', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const before = await snapshot(root);
  failure(amendArgs(root), 'NO_DRIFT');
  failure(amendArgs(root, ['--apply']), 'NO_DRIFT');
  assert.deepEqual(await snapshot(root), before);
});

test('amend dry-run reports the charter and policy diff without writing', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# Amended charter\n');
  await writeFile(path.join(root, '.city/policies/new-policy.md'), '# New policy\n');
  const before = await snapshot(root);
  const dry = success(amendArgs(root));
  assert.equal(dry.dryRun, true);
  assert.equal(dry.changed, false);
  assert.equal(dry.changes.charter, true);
  assert.deepEqual(dry.changes.policies, { added: ['policies/new-policy.md'], removed: [], modified: [] });
  assert.deepEqual(await snapshot(root), before);
});

test('amend --apply writes a new adoption revision and appends the superseded one to history', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const originalConfig = await readJSON(configPath(root));
  await writeFile(path.join(root, '.city/charter.md'), '# Amended charter\n');
  await writeFile(path.join(root, '.city/policies/new-policy.md'), '# New policy\n');
  const output = success(amendArgs(root, ['--charter-version', '1.1', '--apply']));
  assert.equal(output.governance, 'adopted');
  assert.equal(output.changed, true);
  const config = await readJSON(configPath(root));
  assert.equal(config.governance, 'adopted');
  const newCharterHash = createHash('sha256').update(await readFile(path.join(root, '.city/charter.md'))).digest('hex');
  assert.equal(config.adoption.charter.sha256, newCharterHash);
  assert.equal(config.adoption.charter.version, '1.1');
  assert.equal(Object.hasOwn(config.adoption, 'history'), true);
  assert.equal(config.adoption.history.length, 1);
  assert.deepEqual(config.adoption.history[0].charter, originalConfig.adoption.charter);
  assert.deepEqual(config.adoption.history[0].policies, originalConfig.adoption.policies);
  assert.equal(config.adoption.history[0].adoptedOn, originalConfig.adoption.adoptedOn);
  assert.equal(config.adoption.history[0].recordedAt, originalConfig.adoption.recordedAt);
  assert.equal(config.adoption.history[0].summary, 'Correct outdated jurisdiction statement.');
  assert.equal(config.adoption.history[0].evidence.authenticated, false);
  assert.equal(config.adoption.history[0].supersededAt, config.adoption.recordedAt);
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.city.adoption.drift.matchesAdoptedRevision, true);
  assert.deepEqual(hookResult(payload(root)), {});
});

test('two amendments accumulate full provenance without rewriting earlier history', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# First amendment\n');
  success(amendArgs(root, ['--apply']));
  const afterFirst = await readJSON(configPath(root));
  await writeFile(path.join(root, '.city/charter.md'), '# Second amendment\n');
  success(amendArgs(root, ['--summary', 'Second revision for a new obligation.', '--apply']));
  const afterSecond = await readJSON(configPath(root));
  assert.equal(afterSecond.adoption.history.length, 2);
  assert.deepEqual(afterSecond.adoption.history[0], afterFirst.adoption.history[0]);
  assert.equal(afterSecond.adoption.history[1].summary, 'Second revision for a new obligation.');
  assert.equal(afterFirst.adoption.history[0].supersededAt, afterSecond.adoption.history[1].recordedAt);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('amend keeps recordedAt strictly increasing even if the previous record is clock-skewed into the future', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const config = await readJSON(configPath(root));
  const future = '2099-01-01T00:00:00.000Z';
  config.adoption.recordedAt = future;
  await writeJSON(configPath(root), config);
  assert.equal(success(['validate', '--root', root]).valid, true);
  await writeFile(path.join(root, '.city/charter.md'), '# Amended after clock skew\n');
  const output = success(amendArgs(root, ['--apply']));
  assert.ok(output.config.adoption.recordedAt > future);
  assert.equal(output.config.adoption.history[0].supersededAt, output.config.adoption.recordedAt);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('amend --apply fails closed on an existing mutation lock and leaves state unchanged', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# Amended charter\n');
  const lock = path.join(root, '.city/.mutation-lock');
  await writeFile(lock, 'Existing mutation; inspect before recovery.\n');
  const before = await snapshot(root);
  failure(amendArgs(root, ['--apply']), 'CONFLICT');
  assert.deepEqual(await snapshot(root), before);
});

test('concurrent amend --apply calls never corrupt or lose adoption history', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# Concurrently amended charter\n');
  const command = amendArgs(root, ['--apply']);
  const { spawn } = await import('node:child_process');
  const results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...command], { cwd: project });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  })));
  assert.equal(results.filter((result) => result.status === 0).length, 1);
  const config = await readJSON(configPath(root));
  assert.equal(config.adoption.history.length, 1);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.equal((await readdir(path.join(root, '.city'))).some((name) => name.startsWith('.pending-') || name === '.mutation-lock'), false);
});

test('tampered adoption history is rejected by validate', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# First amendment\n');
  success(amendArgs(root, ['--apply']));
  await writeFile(path.join(root, '.city/charter.md'), '# Second amendment\n');
  success(amendArgs(root, ['--summary', 'Second revision for a new obligation.', '--apply']));
  const amended = await readJSON(configPath(root));
  for (const forge of [
    (config) => { delete config.adoption.history[0].summary; },
    (config) => { config.adoption.history[0].supersededAt = config.adoption.history[0].recordedAt; },
    (config) => { config.adoption.history.reverse(); },
    (config) => { config.adoption.history.push({ ...config.adoption.history[0], adoptedOn: '2000-01-01' }); },
  ]) {
    const config = structuredClone(amended);
    forge(config);
    await writeJSON(configPath(root), config);
    failure(['validate', '--root', root], 'INVALID_RECORD');
  }
});

test('adoption history longer than the supported bound is rejected', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const config = await readJSON(configPath(root));
  config.adoption.history = Array.from({ length: 1001 }, () => ({}));
  await writeJSON(configPath(root), config);
  failure(['validate', '--root', root], 'INVALID_RECORD');
});

test('a plain adopt leaves adoption.history absent, not an empty array', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const config = await readJSON(configPath(root));
  assert.equal(Object.hasOwn(config.adoption, 'history'), false);
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('amend --apply refuses to write an oversized config and leaves state unchanged', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const config = await readJSON(configPath(root));
  const base = config.adoption;
  const history = [];
  let recordedAt = new Date(Date.parse(base.recordedAt) + 1000).toISOString();
  const encodedSize = (value) => Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`);
  // Fill history until one more superseded entry would exceed the 256 KiB file bound.
  for (let index = 0; ; index += 1) {
    const supersededAt = new Date(Date.parse(recordedAt) + 1000).toISOString();
    const entry = {
      adoptedOn: base.adoptedOn,
      recordedAt,
      charter: { path: 'charter.md', sha256: createHash('sha256').update(String(index)).digest('hex'), version: null },
      policies: base.policies,
      evidence: base.evidence,
      supersededAt,
      summary: 'x',
    };
    const candidate = { ...config, adoption: { ...base, recordedAt: supersededAt, history: [...history, entry] } };
    if (encodedSize(candidate) > 256 * 1024) break;
    history.push(entry);
    recordedAt = supersededAt;
  }
  config.adoption = { ...base, recordedAt, history };
  await writeJSON(configPath(root), config);
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.valid, true);
  await writeFile(path.join(root, '.city/charter.md'), '# Oversized amendment trigger\n');
  const before = await snapshot(root);
  failure(amendArgs(root, ['--apply']), 'SIZE_LIMIT');
  assert.deepEqual(await snapshot(root), before);
});

const decisionPath = (root, id) => path.join(root, '.city/decisions', `${id}.json`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function authorizeArgs(root, id, {
  decidedBy = 'city-council', outcome = 'authorize', reserved = 'none', extra = [],
} = {}) {
  return [
    'authorize', '--root', root, '--id', id, '--decided-by', decidedBy, '--outcome', outcome,
    '--reserved', reserved, '--reason', 'Reviewed against the charter, policies and acceptance criteria.', ...extra,
  ];
}

const residentEvidence = ['--declared-by', 'Repository resident', '--evidence', 'Resident decision recorded in the review thread.'];

const completeArgs = (root, id, extra = []) => [
  'complete', '--root', root, '--id', id, ...residentEvidence,
  '--reason', 'Pull request reviewed and merged by the resident.', ...extra,
];

test('adopted building permits classify, record conditions, lapse, and gate inspection on completion notice', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const order = awaitingOrder(root);
  const classification = screening({ permit: {
    safetyClass: 1, structuralClass: 1,
    classRationale: 'Contained, reversible change with no cross-project effects.',
  } });
  failure(developmentArgs('screen-development', root, order.id, {
    ...classification, permit: { ...classification.permit, classRationale: ' ' },
  }), 'INVALID_ARGUMENT');
  failure(authorizeArgs(root, order.id, { extra: ['--apply'] }), 'PERMIT_TERMS_REQUIRED');
  const terms = {
    conditions: [{ id: 'compatibility', description: 'Preserve the documented interface.' }],
    rightOfWay: [],
  };
  const authorized = success(authorizeArgs(root, order.id, {
    extra: ['--permit', JSON.stringify(terms), '--apply'],
  }));
  assert.equal(authorized.decision.permit.safetyClass, 1);
  assert.equal(authorized.decision.permit.structuralClass, 1);
  assert.equal(authorized.decision.permit.inactivityDays, 30);
  assert.equal(success(['status', '--root', root]).permits.byState.active, 1);
  transition(root, order.id, 'in-progress');
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'inspection',
    '--reason', 'Ready to inspect.',
  ], 'COMPLETION_NOTICE_REQUIRED');
  const notice = {
    permitId: authorized.decision.permit.permitId,
    conditions: [{ id: 'compatibility', status: 'met', evidence: 'Interface tests pass.' }],
    evidence: 'The condition was checked against the delivered change.',
  };
  failure(developmentArgs('completion-notice', root, order.id, { ...notice, evidence: null }, true), 'INVALID_ARGUMENT');
  success(developmentArgs('completion-notice', root, order.id, notice, true));
  const city = await loadCity(root);
  const currentOrder = city.workOrders.get(order.id).value;
  assert.equal(permitStatus(city, currentOrder).state, 'active');
  assert.equal(permitStatus(city, currentOrder, new Date(Date.now() + 31 * 86400000)).state, 'lapsed');
  const extendArgs = ['permit-extend', '--root', root, '--id', order.id,
    '--permit-id', authorized.decision.permit.permitId, '--days', '30',
    '--decided-by', 'city-council', '--reason', 'A reviewed dependency delayed commencement.'];
  const extensionPreview = success(extendArgs);
  assert.equal(extensionPreview.permit.extensionsRemaining, 1);
  assert.equal(extensionPreview.extension.evidence, null);
  const orderSchema = await readJSON(path.join(project, 'schemas/work-order.schema.json'));
  assert.deepEqual(Object.keys(extensionPreview.extension).sort(), [...orderSchema.$defs.permitExtension.required].sort());
  assert.deepEqual(Object.keys(extensionPreview.extension).sort(), Object.keys(orderSchema.$defs.permitExtension.properties).sort());
  success([...extendArgs, '--apply']);
  success([...extendArgs, '--apply']);
  failure([...extendArgs, '--apply'], 'PERMIT_EXTENSION_LIMIT');
  transition(root, order.id, 'inspection');
  transition(root, order.id, 'in-progress');
  failure([
    'transition', '--root', root, '--id', order.id, '--to', 'inspection',
    '--reason', 'The revised result is ready to inspect.',
  ], 'COMPLETION_NOTICE_REQUIRED');
  success(developmentArgs('completion-notice', root, order.id, notice, true));
  transition(root, order.id, 'inspection');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('higher-risk development requires matching professional statements before permit readiness', async () => {
  const { root } = await fixture();
  init(root);
  success(adoptArgs(root, ['--apply']));
  const order = petition(root);
  transition(root, order.id, 'triaged');
  const formal = screening({
    route: 'formal',
    impacts: ['architecture'],
    requirements: [{ id: 'design-evidence', kind: 'diagram', description: 'Show the affected module boundaries.', reason: 'Confirm the structural impact.' }],
    permit: { safetyClass: 1, structuralClass: 3, classRationale: 'The change affects the architecture boundary.' },
  });
  recordScreening(root, order.id, formal);
  success(developmentArgs('application-record', root, order.id, {
    screeningRevision: 1, reason: 'Proportionate design package.', evidence: 'Boundary diagram reviewed.',
    proposal: 'Change one module boundary.', answers: [],
    artifacts: [{ requirementId: 'design-evidence', disposition: 'provided', evidence: 'docs/design.md' }],
  }, true));
  success(developmentArgs('assess-application', root, order.id, {
    applicationRevision: 1, outcome: 'ready', reason: 'All requirements are addressed.',
    evidence: 'Checked the diagram against the affected modules.',
  }, true));
  const readiness = success(['status', '--root', root]).workOrders.development.find((item) => item.id === order.id);
  assert.equal(readiness.stage, 'professional-statement');
  assert.deepEqual(readiness.next, { actor: 'engineering-manager', action: 'record-permit-statement' });
  failure(developmentArgs('permit-statement', root, order.id, {
    dimension: 'structural', class: 3, staffId: 'unknown-staff', screeningRevision: 1,
    scope: 'Module boundary', evidence: 'Reviewed the design.',
  }, true), 'QUALIFIED_STAFF_REQUIRED');
});

async function adoptedCity(root) {
  init(root);
  await cp(
    path.join(project, 'templates/repository/.city/policy-drafts/zoning.md'),
    path.join(root, '.city/policies/zoning.md'),
  );
  success([
    'zoning-map', '--root', root, '--data', JSON.stringify({
      schemaVersion: 1,
      zones: [{
        id: 'repository', name: 'Repository', path: '.',
        description: 'Test fixture zone covering the repository.',
        rules: ['documentation', 'tests', 'bugfix', 'refactor', 'feature', 'public-interface',
          'dependency', 'data-migration', 'security', 'deletion', 'generated-code']
          .map((changeType) => ({ changeType, disposition: 'permitted', requirements: [] })),
      }],
    }), '--apply',
  ]);
  await rm(path.join(root, '.city/policies/building-permits.md'));
  success(adoptArgs(root, ['--apply']));
}

function awaitingOrder(root) {
  const order = petition(root);
  for (const state of ['triaged', 'proposed', 'awaiting-approval']) transition(root, order.id, state);
  return order;
}

test('missing empty record directories allow tools and are created only by confirmed writes', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  registerDefaultProject(root);
  for (const name of ['work-orders', 'decisions', 'records-requests']) {
    await rm(path.join(root, '.city', name), { recursive: true });
  }
  const before = await snapshot(root);
  assert.deepEqual(hookResult(payload(root)), {});
  assert.equal(success(['validate', '--root', root]).records.decisions, 0);
  assert.equal(success(['records-list', '--root', root, '--type', 'work-order']).total, 0);
  success(['init', '--root', root, '--apply']);
  const petitionArgs = [
    'petition', '--root', root, '--title', 'First case', '--request', 'Create a case.',
    '--project', 'default-project', '--criterion', 'The case exists.',
  ];
  success(petitionArgs);
  assert.deepEqual(await snapshot(root), before, 'reads, hook and previews must not repair directories');
  const order = success([...petitionArgs, '--apply']).workOrder;
  assert.ok((await lstat(path.join(root, '.city/work-orders'))).isDirectory());
  success([
    'zoning-check', '--root', root, '--id', order.id, '--data',
    JSON.stringify({ changeTypes: ['bugfix'], reason: 'A bounded change.', evidence: 'Reviewed the case scope.' }),
    '--apply',
  ]);
  for (const state of ['triaged', 'proposed', 'awaiting-approval']) transition(root, order.id, state);
  const authorization = authorizeArgs(root, order.id);
  success(authorization);
  await assert.rejects(lstat(path.join(root, '.city/decisions')), { code: 'ENOENT' });
  success([...authorization, '--apply']);
  assert.ok((await lstat(path.join(root, '.city/decisions'))).isDirectory());
  assert.equal(success(['validate', '--root', root]).records.decisions, 1);
  success([
    'records-request', '--root', root, '--requested-by', 'City Manager',
    '--purpose', 'Find the first case.', '--item',
    JSON.stringify({ type: 'work-order', id: order.id, description: 'First case' }), '--apply',
  ]);
  assert.ok((await lstat(path.join(root, '.city/records-requests'))).isDirectory());
  await rm(path.join(root, '.city/decisions'), { recursive: true });
  assert.equal(hookResult(payload(root)).permissionDecision, 'deny', 'lost referenced decisions remain corruption');
});

test('missing-directory support still refuses symlinks and non-directory record paths', async () => {
  for (const name of ['work-orders', 'decisions']) {
    for (const unsafe of ['symlink', 'file']) {
      const { root, directory } = await fixture();
      init(root);
      const location = path.join(root, '.city', name);
      await rm(location, { recursive: true });
      if (unsafe === 'symlink') await symlink(directory, location, 'dir');
      else await writeFile(location, 'Not a record directory.');
      const before = await snapshot(root);
      failure(['validate', '--root', root], 'UNSAFE_PATH');
      assert.equal(hookResult(payload(root)).permissionDecision, 'deny');
      assert.deepEqual(await snapshot(root), before);
    }
  }
});

test('a council-authorized order completes the full delivery lifecycle with linked, unauthenticated decisions', async () => {
  const { root } = await fixture();
  await mkdir(path.join(root, '.git'));
  await adoptedCity(root);
  const council = success(['status', '--root', root]).council;
  assert.equal(council.delegationAvailable, true);
  assert.equal(council.delegationPolicyAdopted, true);
  const order = awaitingOrder(root);
  const orderBytes = await readFile(recordPath(root, order.id));
  const before = await snapshot(root);
  const dry = success(authorizeArgs(root, order.id));
  assert.equal(dry.dryRun, true);
  assert.equal(dry.changed, false);
  assert.equal(dry.workOrder.status, 'authorized');
  assert.deepEqual(dry.plan.replace, [`.city/work-orders/${order.id}.json`]);
  assert.deepEqual(await snapshot(root), before);
  const applied = success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  assert.equal(applied.changed, true);
  const decision = await readJSON(decisionPath(root, applied.decision.id));
  assert.deepEqual(decision, applied.decision);
  assert.equal(decision.schemaVersion, 2);
  assert.equal(decision.kind, 'authorization');
  assert.equal(decision.outcome, 'authorize');
  assert.equal(decision.decidedBy, 'city-council');
  assert.equal(decision.basis, 'council-delegation');
  assert.equal(decision.routineClass, null);
  assert.deepEqual(decision.reservedMatters, []);
  assert.deepEqual(decision.workOrderIds, [order.id]);
  assert.deepEqual(decision.evidence, { declaredBy: null, reference: null, authenticated: false });
  assert.deepEqual(decision.provenance, { source: 'local-draft', plugin: { name: 'repository-city', version: '0.5.0' } });
  assert.equal(decision.subject.workOrderSha256, sha256(orderBytes));
  assert.equal(decision.subject.charterSha256, sha256(await readFile(path.join(root, '.city/charter.md'))));
  assert.equal(
    decision.subject.delegationPolicySha256,
    sha256(await readFile(path.join(root, '.city/policies/council-delegation.md'))),
  );
  const authorized = await readJSON(recordPath(root, order.id));
  assert.equal(authorized.status, 'authorized');
  assert.deepEqual(dry.next, { actor: 'engineering-manager', action: 'assign-engineer' });
  assert.deepEqual(applied.next, { actor: 'engineering-manager', action: 'assign-engineer' });
  assert.deepEqual(success(['status', '--root', root]).workOrders.readyForDelivery, [{
    id: order.id, title: order.title, projectIds: order.projectIds,
    authorizedBy: decision.id, decidedBy: 'city-council', assignedTo: null,
  }]);
  assert.equal(authorized.history.at(-1).timestamp, decision.createdAt);
  assert.match(authorized.history.at(-1).reason, new RegExp(decision.id));
  assert.deepEqual(hookResult(payload(root)), {});
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) {
    transition(root, order.id, state);
    assert.deepEqual(hookResult(payload(root)), {});
  }
  const merging = await snapshot(root);
  assert.deepEqual(success(['status', '--root', root]).workOrders.readyForDelivery, []);
  const dryComplete = success(completeArgs(root, order.id));
  assert.equal(dryComplete.workOrder.status, 'completed');
  assert.deepEqual(await snapshot(root), merging);
  const completed = success(completeArgs(root, order.id, ['--apply']));
  assert.equal(completed.decision.kind, 'acceptance');
  assert.equal(completed.next, null);
  assert.equal(completed.decision.outcome, 'accept');
  assert.equal(completed.decision.decidedBy, 'resident');
  assert.equal(completed.decision.basis, 'resident-decision');
  assert.deepEqual(completed.decision.evidence, {
    declaredBy: 'Repository resident', reference: 'Resident decision recorded in the review thread.', authenticated: false,
  });
  assert.equal((await readJSON(recordPath(root, order.id))).status, 'completed');
  assert.deepEqual(hookResult(payload(root)), {});
  const validated = success(['validate', '--root', root]);
  assert.equal(validated.records.decisions, 2);
  const status = success(['status', '--root', root]);
  assert.equal(status.workOrders.byStatus.completed, 1);
  assert.deepEqual(status.decisions.byKind, { proposal: 0, authorization: 1, acceptance: 1 });
  assert.equal(status.decisions.byOutcome.authorize, 1);
  assert.equal(status.decisions.byOutcome.accept, 1);
  assert.match(status.notice, /recorded, not authenticated/);
  failure(['transition', '--root', root, '--id', order.id, '--to', 'in-progress', '--reason', 'Reopen first'], 'INVALID_TRANSITION');
  assert.equal(transition(root, order.id, 'reopened').workOrder.status, 'reopened');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('the council must refer reserved matters, which the resident may then authorize', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const before = await snapshot(root);
  failure(authorizeArgs(root, order.id, { reserved: 'security,deployment', extra: ['--apply'] }), 'RESERVED_MATTER');
  assert.deepEqual(await snapshot(root), before);
  const referred = success(authorizeArgs(root, order.id, {
    outcome: 'refer', reserved: 'deployment,security', extra: ['--apply'],
  }));
  assert.deepEqual(referred.decision.reservedMatters, ['security', 'deployment']);
  assert.deepEqual(referred.plan.replace, []);
  assert.deepEqual(referred.next, { actor: 'resident', action: 'decide-referral' });
  assert.deepEqual(success(['status', '--root', root]).workOrders.readyForDelivery, []);
  assert.equal((await readJSON(recordPath(root, order.id))).status, 'awaiting-approval');
  const waiting = success(['status', '--root', root]).workOrders.awaitingResidentDecision;
  assert.deepEqual(waiting, [{
    id: order.id, title: order.title, referredBy: referred.decision.id, reservedMatters: ['security', 'deployment'],
  }]);
  failure(authorizeArgs(root, order.id, { decidedBy: 'resident', reserved: 'security' }), 'RESIDENT_EVIDENCE_REQUIRED');
  failure(authorizeArgs(root, order.id, { reserved: 'none', extra: residentEvidence }), 'INVALID_ARGUMENT');
  const resident = success(authorizeArgs(root, order.id, {
    decidedBy: 'resident', reserved: 'security,deployment', extra: [...residentEvidence, '--apply'],
  }));
  assert.equal(resident.decision.basis, 'resident-decision');
  assert.equal(resident.decision.evidence.authenticated, false);
  assert.ok(resident.decision.createdAt > referred.decision.createdAt);
  assert.equal((await readJSON(recordPath(root, order.id))).status, 'authorized');
  const status = success(['status', '--root', root]);
  assert.deepEqual(status.workOrders.awaitingResidentDecision, []);
  assert.deepEqual(resident.next, { actor: 'engineering-manager', action: 'assign-engineer' });
  assert.deepEqual(status.workOrders.readyForDelivery, [{
    id: order.id, title: order.title, projectIds: order.projectIds,
    authorizedBy: resident.decision.id, decidedBy: 'resident', assignedTo: null,
  }]);
  assert.equal(status.decisions.byOutcome.refer, 1);
  assert.equal(status.decisions.byOutcome.authorize, 1);
});

test('reject and return outcomes write linked decisions and the matching state change', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const rejectedOrder = awaitingOrder(root);
  const rejected = success(authorizeArgs(root, rejectedOrder.id, { outcome: 'reject', extra: ['--apply'] }));
  assert.equal(rejected.workOrder.status, 'rejected');
  assert.deepEqual(rejected.next, { actor: null, action: 'none' });
  const returnedOrder = awaitingOrder(root);
  const returned = success(authorizeArgs(root, returnedOrder.id, { outcome: 'return', extra: ['--apply'] }));
  assert.equal(returned.workOrder.status, 'proposed');
  assert.deepEqual(returned.next, { actor: 'chief-planner', action: 'revise-proposal' });
  assert.equal(returned.workOrder.history.at(-1).timestamp, returned.decision.createdAt);
  failure(authorizeArgs(root, returnedOrder.id), 'INVALID_TRANSITION');
  assert.equal(success(['validate', '--root', root]).records.decisions, 2);
});

test('routine classes need a council authorize with no reserved matters', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const routine = ['--routine-class', 'documentation'];
  failure(authorizeArgs(root, order.id, { reserved: 'deletion', extra: routine }), 'RESERVED_MATTER');
  failure(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'deletion', extra: routine }), 'INVALID_ARGUMENT');
  failure(authorizeArgs(root, order.id, { decidedBy: 'resident', extra: [...routine, ...residentEvidence] }), 'INVALID_ARGUMENT');
  failure(authorizeArgs(root, order.id, { extra: ['--routine-class', 'major-upgrade'] }), 'INVALID_ARGUMENT');
  const output = success(authorizeArgs(root, order.id, { extra: [...routine, '--apply'] }));
  assert.equal(output.decision.basis, 'routine-policy');
  assert.equal(output.decision.routineClass, 'documentation');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('authorize and complete refuse draft governance, drift and missing council delegation', async () => {
  const draft = await fixture('draft');
  init(draft.root);
  const draftOrder = awaitingOrder(draft.root);
  assert.equal(success(['status', '--root', draft.root]).council.delegationAvailable, false);
  failure(authorizeArgs(draft.root, draftOrder.id), 'NOT_ADOPTED');
  failure(authorizeArgs(draft.root, draftOrder.id, { decidedBy: 'resident', extra: residentEvidence }), 'NOT_ADOPTED');
  failure(completeArgs(draft.root, draftOrder.id), 'NOT_ADOPTED');

  const drifted = await fixture('drifted');
  await adoptedCity(drifted.root);
  const driftOrder = awaitingOrder(drifted.root);
  await writeFile(path.join(drifted.root, '.city/policies/council-delegation.md'), '# Council may decide everything\n');
  const before = await snapshot(drifted.root);
  assert.equal(success(['status', '--root', drifted.root]).council.delegationAvailable, false);
  failure(authorizeArgs(drifted.root, driftOrder.id, { extra: ['--apply'] }), 'GOVERNANCE_DRIFT');
  failure(authorizeArgs(drifted.root, driftOrder.id, { decidedBy: 'resident', extra: [...residentEvidence, '--apply'] }), 'GOVERNANCE_DRIFT');
  failure(completeArgs(drifted.root, driftOrder.id, ['--apply']), 'GOVERNANCE_DRIFT');
  assert.deepEqual(await snapshot(drifted.root), before);

  const undelegated = await fixture('undelegated');
  init(undelegated.root);
  await rm(path.join(undelegated.root, '.city/policies/building-permits.md'));
  await rm(path.join(undelegated.root, '.city/policies/council-delegation.md'));
  success(zoningMapArgs(undelegated.root, [zoningZone('.', [
    zoningRule('bugfix', 'permitted'),
  ])], true));
  success(adoptArgs(undelegated.root, ['--apply']));
  const order = awaitingOrder(undelegated.root);
  const council = success(['status', '--root', undelegated.root]).council;
  assert.equal(council.delegationAvailable, false);
  assert.equal(council.residentDecisionsAvailable, true);
  failure(authorizeArgs(undelegated.root, order.id, { extra: ['--apply'] }), 'NO_DELEGATION');
  const resident = success(authorizeArgs(undelegated.root, order.id, {
    decidedBy: 'resident', extra: [...residentEvidence, '--apply'],
  }));
  assert.equal(resident.decision.subject.delegationPolicySha256, null);
  assert.equal(success(['validate', '--root', undelegated.root]).valid, true);
});

test('transition cannot enter authorized or completed, and complete needs awaiting-merge and evidence', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  failure(['transition', '--root', root, '--id', order.id, '--to', 'authorized', '--reason', 'Self-approval', '--apply'], 'AUTHORIZATION_REQUIRED');
  failure(completeArgs(root, order.id), 'INVALID_TRANSITION');
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  transition(root, order.id, 'in-progress');
  failure(completeArgs(root, order.id), 'INVALID_TRANSITION');
  transition(root, order.id, 'inspection');
  transition(root, order.id, 'awaiting-merge');
  failure(['transition', '--root', root, '--id', order.id, '--to', 'completed', '--reason', 'Merged', '--apply'], 'AUTHORIZATION_REQUIRED');
  failure(['complete', '--root', root, '--id', order.id, '--reason', 'Merged', '--apply'], 'INVALID_ARGUMENT');
  failure(['complete', '--root', root, '--id', order.id, '--declared-by', ' ', '--evidence', 'E', '--reason', 'R'], 'INVALID_ARGUMENT');
  failure(['complete', '--root', root, '--id', order.id, ...residentEvidence, '--reason', 'R', '--decided-by', 'city-council'], 'INVALID_ARGUMENT');
  for (const args of [
    ['authorize', '--root', root, '--id', order.id, '--decided-by', 'city-council', '--outcome', 'authorize', '--reason', 'No reserved flag'],
    authorizeArgs(root, order.id, { reserved: 'secrets' }),
    authorizeArgs(root, order.id, { reserved: 'security,security' }),
    authorizeArgs(root, order.id, { decidedBy: 'engineer' }),
    authorizeArgs(root, order.id, { outcome: 'approve' }),
  ]) failure(args, 'INVALID_ARGUMENT');
  assert.equal((await readJSON(recordPath(root, order.id))).status, 'awaiting-merge');
});

test('failed inspection loops back to in-progress and blocked work resumes only while authorized', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  for (const state of ['blocked', 'in-progress', 'inspection', 'in-progress', 'inspection', 'blocked', 'in-progress', 'inspection', 'awaiting-merge', 'in-progress']) {
    assert.equal(transition(root, order.id, state).workOrder.status, state);
  }
  failure(['transition', '--root', root, '--id', order.id, '--to', 'awaiting-merge', '--reason', 'Skip inspection'], 'INVALID_TRANSITION');
  for (const state of ['blocked', 'proposed', 'awaiting-approval', 'blocked']) transition(root, order.id, state);
  failure(['transition', '--root', root, '--id', order.id, '--to', 'in-progress', '--reason', 'Resume stale authorization'], 'INVALID_TRANSITION');
  assert.equal(success(['validate', '--root', root]).valid, true);
});

test('returning an authorized order to proposed voids its authorization', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  transition(root, order.id, 'in-progress');
  transition(root, order.id, 'proposed');
  transition(root, order.id, 'awaiting-approval');
  failure(['transition', '--root', root, '--id', order.id, '--to', 'in-progress', '--reason', 'Old authorization'], 'INVALID_TRANSITION');
  success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  assert.equal(transition(root, order.id, 'in-progress').workOrder.status, 'in-progress');
  assert.equal(success(['status', '--root', root]).decisions.byOutcome.authorize, 2);
  // A forged history that skips re-authorization is rejected on load.
  const forged = await fixture('forged resume');
  await adoptedCity(forged.root);
  const other = awaitingOrder(forged.root);
  success(authorizeArgs(forged.root, other.id, { extra: ['--apply'] }));
  for (const state of ['blocked', 'proposed', 'awaiting-approval', 'blocked']) transition(forged.root, other.id, state);
  const record = await readJSON(recordPath(forged.root, other.id));
  const at = record.updatedAt;
  record.history.push({ from: 'blocked', to: 'in-progress', reason: 'Forged resume', timestamp: at });
  record.status = 'in-progress';
  await writeJSON(recordPath(forged.root, other.id), record);
  failure(['validate', '--root', forged.root], 'INVALID_TRANSITION');
});

test('forged, orphaned and mismatched delivery decisions are rejected and the hook denies them', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const awaitingBytes = await readFile(recordPath(root, order.id));
  const applied = success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  const decision = applied.decision;
  const authorizedBytes = await readFile(recordPath(root, order.id));
  const restore = async () => {
    for (const name of await readdir(path.join(root, '.city/decisions'))) await rm(path.join(root, '.city/decisions', name));
    await writeJSON(decisionPath(root, decision.id), decision);
    await writeFile(recordPath(root, order.id), authorizedBytes);
    assert.equal(success(['validate', '--root', root]).valid, true);
  };
  const cases = [
    ['orphan history', async () => { await rm(decisionPath(root, decision.id)); }],
    ['orphan decision', async () => { await writeFile(recordPath(root, order.id), awaitingBytes); }],
    ['timestamp', async () => {
      await writeJSON(decisionPath(root, decision.id), {
        ...decision, createdAt: new Date(Date.parse(decision.createdAt) + 1).toISOString(),
      });
    }],
    ['duplicate', async () => {
      const id = `DEC-${randomUUID()}`;
      await writeJSON(decisionPath(root, id), { ...decision, id });
    }],
    ['outcome', async () => { await writeJSON(decisionPath(root, decision.id), { ...decision, outcome: 'reject' }); }],
    ['authenticated', async () => {
      await writeJSON(decisionPath(root, decision.id), { ...decision, evidence: { ...decision.evidence, authenticated: true } });
    }],
    ['reserved', async () => {
      await writeJSON(decisionPath(root, decision.id), { ...decision, reservedMatters: ['security'] });
    }],
    ['council evidence', async () => {
      await writeJSON(decisionPath(root, decision.id), {
        ...decision, evidence: { declaredBy: 'Council', reference: 'Self-declared', authenticated: false },
      });
    }],
    ['basis', async () => { await writeJSON(decisionPath(root, decision.id), { ...decision, basis: 'resident-decision' }); }],
    ['unknown field', async () => { await writeJSON(decisionPath(root, decision.id), { ...decision, verified: true }); }],
    ['refer outside approval', async () => {
      const id = `DEC-${randomUUID()}`;
      await writeJSON(decisionPath(root, id), {
        ...decision, id, outcome: 'refer', createdAt: new Date(Date.parse(decision.createdAt) + 5000).toISOString(),
      });
    }],
    ['history only', async () => {
      const record = JSON.parse(awaitingBytes.toString('utf8'));
      const timestamp = new Date(Date.parse(record.updatedAt) + 1).toISOString();
      record.history.push({ from: 'awaiting-approval', to: 'authorized', reason: 'Forged', timestamp });
      record.status = 'authorized';
      record.updatedAt = timestamp;
      await rm(decisionPath(root, decision.id));
      await writeJSON(recordPath(root, order.id), record);
    }],
  ];
  for (const [label, tamper] of cases) {
    await tamper();
    const result = run(['validate', '--root', root]);
    assert.notEqual(result.status, 0, label);
    assert.equal(JSON.parse(result.stderr).error.code, 'INVALID_RECORD', label);
    assert.equal(hookResult(payload(root)).permissionDecision, 'deny', label);
    await restore();
  }
});

test('concurrent authorize --apply records exactly one decision without leftovers', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const { spawn } = await import('node:child_process');
  const results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...authorizeArgs(root, order.id, { extra: ['--apply'] })], { cwd: project });
    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout }));
  })));
  assert.equal(results.filter((result) => result.status === 0).length, 1);
  assert.equal((await readdir(path.join(root, '.city/decisions'))).length, 1);
  const persisted = await readJSON(recordPath(root, order.id));
  assert.equal(persisted.status, 'authorized');
  assert.equal(persisted.history.filter((entry) => entry.to === 'authorized').length, 1);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.equal((await readdir(path.join(root, '.city'))).some((name) => name.startsWith('.pending-') || name === '.mutation-lock'), false);
});

test('authorize --apply fails closed on an existing mutation lock and leaves state unchanged', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  await writeFile(path.join(root, '.city/.mutation-lock'), 'Existing mutation; inspect before recovery.\n');
  const before = await snapshot(root);
  failure(authorizeArgs(root, order.id, { extra: ['--apply'] }), 'CONFLICT');
  assert.deepEqual(await snapshot(root), before);
});

test('records written by plugin 0.1.0 still load and can enter the delivery lifecycle', async () => {
  const { root } = await fixture();
  init(root);
  await rm(path.join(root, '.city/policies/development-applications.md'));
  success(adoptArgs(root, ['--apply']));
  const order = awaitingOrder(root);
  const legacy = { source: 'local-draft', plugin: { name: 'repository-city', version: '0.1.0' } };
  const record = await readJSON(recordPath(root, order.id));
  delete record.projectIds;
  await writeJSON(recordPath(root, order.id), { ...record, schemaVersion: 1, provenance: legacy });
  const config = await readJSON(configPath(root));
  await writeJSON(configPath(root), { ...config, plugin: legacy.plugin });
  const proposal = {
    schemaVersion: 1,
    id: `DEC-${randomUUID()}`,
    cityId: order.cityId,
    kind: 'proposal',
    status: 'proposed',
    title: 'Earlier draft proposal',
    proposal: 'A proposal recorded by plugin 0.1.0.',
    workOrderIds: [order.id],
    createdAt: new Date().toISOString(),
    provenance: legacy,
  };
  await writeJSON(decisionPath(root, proposal.id), proposal);
  assert.equal(success(['validate', '--root', root]).records.decisions, 1);
  assert.deepEqual(hookResult(payload(root)), {});
  const output = success(authorizeArgs(root, order.id, { extra: ['--apply'] }));
  assert.deepEqual(output.workOrder.provenance, legacy);
  assert.equal(output.decision.provenance.plugin.version, '0.5.0');
  const status = success(['status', '--root', root]);
  assert.deepEqual(status.decisions.byKind, { proposal: 1, authorization: 1, acceptance: 0 });
  assert.equal(status.decisions.proposed, 1);
  await writeJSON(configPath(root), { ...config, plugin: { ...legacy.plugin, version: '9.9.9' } });
  failure(['validate', '--root', root], 'INCOMPATIBLE_PLUGIN');
});

test('help documents delivery commands, command-only states and honest limits', () => {
  const output = success(['--help']);
  assert.equal(output.plugin.version, '0.5.0');
  assert.ok(output.usage.some((line) => line.includes(' authorize --root ABS')));
  assert.ok(output.usage.some((line) => line.includes(' complete --root ABS')));
  assert.ok(output.usage.some((line) => line.includes(' zoning-map --root ABS')));
  assert.ok(output.usage.some((line) => line.includes(' zoning-check --root ABS')));
  assert.deepEqual(output.commandOnlyStates, { authorized: 'authorize', completed: 'complete' });
  assert.deepEqual(output.transitions['awaiting-approval'], ['proposed', 'authorized', 'blocked', 'rejected', 'withdrawn']);
  assert.deepEqual(output.transitions.completed, ['reopened']);
  const notes = output.notes.join('\n');
  for (const pattern of [/recorded, not authenticated/, /not by this runtime/, /never runs git/, /AUTHORIZATION_REQUIRED/, /RESERVED_MATTER/, /NO_DELEGATION/, /RESIDENT_EVIDENCE_REQUIRED/, /GOVERNANCE_DRIFT/, /NOT_ADOPTED/, /zoning-check/, /unknown, not permitted/]) {
    assert.match(notes, pattern);
  }
});

test('a referral recorded after a transition was prepared makes the transition fail closed', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const before = await loadCity(root);
  const original = before.workOrders.get(order.id);
  assert.doesNotThrow(() => checkOrderUnchanged(before, before, original));
  success(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'security', extra: ['--apply'] }));
  const after = await loadCity(root);
  assert.ok(after.workOrders.get(order.id).bytes.equals(original.bytes), 'a referral leaves the order bytes unchanged');
  assert.throws(() => checkOrderUnchanged(before, after, original), { code: 'CONFLICT' });
});

test('transitions are never timestamped before an existing referral, keeping the city valid', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  // Model a referral from a writer whose clock runs ahead, or one that raced a prepared transition.
  const referral = success(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'security' })).decision;
  referral.createdAt = new Date(Date.now() + 60_000).toISOString();
  await writeJSON(decisionPath(root, referral.id), referral);
  assert.equal(success(['validate', '--root', root]).valid, true);
  const moved = transition(root, order.id, 'proposed').workOrder;
  assert.ok(moved.history.at(-1).timestamp >= referral.createdAt);
  assert.equal(success(['validate', '--root', root]).valid, true);
  assert.deepEqual(hookResult(payload(root)), {});
});

test('concurrent referral and transition always leave a valid city', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const { spawn } = await import('node:child_process');
  const launch = (args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: project });
    child.stdout.resume();
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', resolve);
  });
  for (let round = 0; round < 4; round += 1) {
    const order = awaitingOrder(root);
    await Promise.all([
      launch(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'security', extra: ['--apply'] })),
      launch(['transition', '--root', root, '--id', order.id, '--to', 'proposed', '--reason', 'Scope change', '--apply']),
    ]);
    assert.equal(success(['validate', '--root', root]).valid, true, `round ${round}`);
  }
  assert.equal((await readdir(path.join(root, '.city'))).some((name) => name.startsWith('.pending-') || name === '.mutation-lock'), false);
});

test('status lists only referrals from the current awaiting-approval period', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = awaitingOrder(root);
  const first = success(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'deletion', extra: ['--apply'] })).decision;
  assert.deepEqual(success(['status', '--root', root]).workOrders.awaitingResidentDecision.map((entry) => entry.referredBy), [first.id]);
  transition(root, order.id, 'proposed');
  transition(root, order.id, 'awaiting-approval');
  assert.deepEqual(success(['status', '--root', root]).workOrders.awaitingResidentDecision, []);
  const second = success(authorizeArgs(root, order.id, { outcome: 'refer', reserved: 'deletion', extra: ['--apply'] })).decision;
  assert.deepEqual(success(['status', '--root', root]).workOrders.awaitingResidentDecision.map((entry) => entry.referredBy), [second.id]);
});

function workforceRequisitionArgs(root, order, staffId = 'website-specialist', tools = ['edit']) {
  return [
    'requisition', '--root', root, '--work-order', order.id, '--staff-id', staffId,
    '--title', 'Website Specialist', '--reason', 'A specialist is needed for bounded website work.',
    '--duties', 'Improve the registered website project while preserving existing behavior.',
    '--competency', 'Accessible responsive design', '--standard', 'Preserve existing behavior.',
    ...tools.flatMap((tool) => ['--tool', tool]), '--check', '["node","-e","process.exit(0)"]',
    '--mcp-proposal', 'Propose an optional design review server; install nothing.',
  ];
}

async function authorizedWorkforceOrder(root) {
  const order = awaitingOrder(root);
  success([...authorizeArgs(root, order.id), '--apply']);
  return order;
}

test('workforce records are optional and status exposes the bundled general engineer', async () => {
  const { root } = await fixture();
  init(root);
  const status = success(['status', '--root', root]);
  assert.equal(status.workforce.delegationAvailable, false);
  assert.deepEqual(status.workforce.staff, [{
    id: 'municipal-software-engineer',
    agentName: 'City: Municipal Software Engineer',
    status: 'active',
    bundled: true,
  }]);
  assert.deepEqual(status.workforce.requisitions.byStatus, {
    requested: 0, endorsed: 0, declined: 0, approved: 0, filled: 0,
  });
  assert.deepEqual(status.workforce.assignments, []);
  assert.deepEqual(status.workOrders.deliveryWithoutAssignment, []);
  const validated = success(['validate', '--root', root]);
  assert.deepEqual(validated.records, {
    projects: 0, workOrders: 0, decisions: 0, recordsRequests: 0,
    requisitions: 0, staff: 0, assignments: 0, institutionalReviews: 0, artifacts: 0,
    infrastructureAssets: 0, infrastructureProgramme: 0, zoningMap: 0,
  });
  assert.deepEqual(validated.workforce.drift, []);
  await assert.rejects(lstat(path.join(root, '.city/workforce')), { code: 'ENOENT' });
});

test('workforce mutators require adopted, drift-free delegation and validate arguments', async () => {
  const draft = await fixture();
  init(draft.root);
  const draftOrder = petition(draft.root);
  const args = workforceRequisitionArgs(draft.root, draftOrder);
  failure(args, 'NOT_ADOPTED');

  const missingPolicy = await fixture();
  init(missingPolicy.root);
  await rm(path.join(missingPolicy.root, '.city/policies/workforce-delegation.md'));
  success(adoptArgs(missingPolicy.root, ['--apply']));
  const undelegatedOrder = petition(missingPolicy.root);
  const undelegated = failure(workforceRequisitionArgs(missingPolicy.root, undelegatedOrder), 'NO_DELEGATION');
  assert.match(undelegated.error.message, /workforce-delegation\.md/);

  const drifted = await fixture();
  await adoptedCity(drifted.root);
  const driftOrder = petition(drifted.root);
  await writeFile(path.join(drifted.root, '.city/policies/workforce-delegation.md'), '# Changed after adoption\n');
  failure(workforceRequisitionArgs(drifted.root, driftOrder), 'GOVERNANCE_DRIFT');

  const valid = await fixture();
  await adoptedCity(valid.root);
  const validOrder = petition(valid.root);
  const base = workforceRequisitionArgs(valid.root, validOrder);
  const invalidStaff = [...base];
  invalidStaff[6] = 'Municipal-engineer';
  failure(invalidStaff, 'INVALID_ARGUMENT');
  failure([...base, '--tool', 'agent'], 'INVALID_ARGUMENT');
  failure([...base, '--tool', 'edit'], 'INVALID_ARGUMENT');
  failure([...base, '--check', 'not-json'], 'INVALID_ARGUMENT');
  failure([...base, '--check', '["../node","-e",""]'], 'INVALID_ARGUMENT');
  failure([...base, '--competency', 'two\nlines'], 'INVALID_ARGUMENT');
  const invalidTitle = [...base];
  invalidTitle[8] = 'Invalid title!';
  failure(invalidTitle, 'INVALID_ARGUMENT');
  assert.equal(success(['status', '--root', valid.root]).workforce.requisitions.byStatus.requested, 0);
});

test('HR declines and appointment declines are terminal history transitions', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  const first = success([...workforceRequisitionArgs(root, order, 'specialist-one'), '--apply']).record;
  const reviewDeclined = success([
    'review-requisition', '--root', root, '--id', first.id, '--outcome', 'decline',
    '--reason', 'The staffing need is not established.', '--apply',
  ]);
  assert.equal(reviewDeclined.record.status, 'declined');
  assert.equal(reviewDeclined.next, null);
  failure([
    'review-requisition', '--root', root, '--id', first.id, '--outcome', 'endorse',
    '--reason', 'A terminal requisition cannot be reviewed twice.',
  ], 'INVALID_TRANSITION');

  const second = success([...workforceRequisitionArgs(root, order, 'specialist-two'), '--apply']).record;
  success([
    'review-requisition', '--root', root, '--id', second.id, '--outcome', 'endorse',
    '--reason', 'The role is needed and the proposed scope is least-privilege.', '--apply',
  ]);
  const appointmentDeclined = success([
    'appoint', '--root', root, '--id', second.id, '--outcome', 'decline',
    '--reason', 'The appointment cannot be justified for this requisition.', '--apply',
  ]);
  assert.equal(appointmentDeclined.record.status, 'declined');
  assert.equal(appointmentDeclined.record.appointment, null);
  assert.deepEqual(success(['validate', '--root', root]).records, {
    projects: 1, workOrders: 1, decisions: 0, recordsRequests: 0,
    requisitions: 2, staff: 0, assignments: 0, institutionalReviews: 0, artifacts: 0,
    infrastructureAssets: 0, infrastructureProgramme: 0,
    zoningMap: 1,
  });
  assert.equal(success(['status', '--root', root]).workforce.requisitions.byStatus.declined, 2);
});

test('concurrent requisitions for one staff ID serialize without leaving duplicate records', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = petition(root);
  const args = [...workforceRequisitionArgs(root, order), '--apply'];
  const { spawn } = await import('node:child_process');
  const results = await Promise.all(Array.from({ length: 2 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: project });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  })));
  assert.equal(results.filter((result) => result.status === 0).length, 1);
  const failureResult = results.find((result) => result.status !== 0);
  assert.equal(JSON.parse(failureResult.stderr).error.code, 'CONFLICT');
  assert.equal((await readdir(path.join(root, '.city/workforce/requisitions'))).length, 1);
  assert.equal(success(['validate', '--root', root]).records.requisitions, 1);
  assert.equal((await readdir(path.join(root, '.city'))).includes('.mutation-lock'), false);
});

test('requisition, HR review, delegated appointment, hire preview and exclusive generation work end to end', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = await authorizedWorkforceOrder(root);
  const args = workforceRequisitionArgs(root, order);
  const before = await snapshot(root);
  const preview = success(args);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, false);
  assert.deepEqual(preview.next, { actor: 'human-resources', action: 'review-requisition' });
  assert.deepEqual(await snapshot(root), before);
  const requested = success([...args, '--apply']).record;
  assert.equal(requested.status, 'requested');
  assert.equal(requested.appointment, null);
  assert.deepEqual(requested.history[0], {
    from: null, to: 'requested', actor: 'engineering-manager',
    reason: requested.reason, timestamp: requested.createdAt,
  });
  assert.equal(requested.tools.join(','), 'read,search,edit');
  assert.deepEqual(requested.checks, [['node', '-e', 'process.exit(0)']]);
  failure(args, 'CONFLICT');

  const reviewArgs = [
    'review-requisition', '--root', root, '--id', requested.id, '--outcome', 'endorse',
    '--reason', 'The need, duties and least-privilege scope are supported.',
  ];
  assert.equal(success(reviewArgs).record.status, 'endorsed');
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'requested');
  const endorsed = success([...reviewArgs, '--apply']).record;
  assert.equal(endorsed.status, 'endorsed');
  const endorsedBytes = await readFile(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`));
  const appointArgs = [
    'appoint', '--root', root, '--id', requested.id, '--outcome', 'approve',
    '--reason', 'The endorsed appointment is justified by the authorized website work.',
  ];
  const appointmentPreview = success(appointArgs);
  assert.equal(appointmentPreview.record.status, 'approved');
  assert.equal(appointmentPreview.record.appointment.authenticated, false);
  assert.equal(appointmentPreview.record.appointment.subject.requisitionSha256, sha256(endorsedBytes));
  assert.equal(appointmentPreview.record.appointment.subject.charterSha256,
    sha256(await readFile(path.join(root, '.city/charter.md'))));
  assert.equal(appointmentPreview.record.appointment.subject.delegationPolicySha256,
    sha256(await readFile(path.join(root, '.city/policies/workforce-delegation.md'))));
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'endorsed');
  const approved = success([...appointArgs, '--apply']).record;
  assert.equal(approved.status, 'approved');
  const hiringArgs = ['hire', '--root', root, '--id', requested.id];
  const hiringPreview = success(hiringArgs);
  assert.equal(hiringPreview.dryRun, true);
  assert.equal(hiringPreview.files.length, 6);
  assert.ok(hiringPreview.files.every((file) => typeof file.content === 'string'));
  const agentFile = hiringPreview.files.find((file) => file.path.endsWith('.agent.md'));
  assert.match(agentFile.content, /agents: \[\]/u);
  assert.match(agentFile.content, /tools: \["read","search","edit"\]/u);
  assert.match(agentFile.content, /You do not have `execute`/u);
  assert.match(agentFile.content, /complete author-attributed filing request/u);
  assert.match(agentFile.content, /status\.workforce\.assignments/u);
  assert.match(agentFile.content, /never authorize, complete/u);
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'approved');

  const occupiedAgent = path.join(root, '.github/agents/city-engineer-website-specialist.agent.md');
  await mkdir(path.dirname(occupiedAgent), { recursive: true });
  await writeFile(occupiedAgent, 'resident-owned content\n');
  failure([...hiringArgs, '--apply'], 'CONFLICT');
  assert.equal(await readFile(occupiedAgent, 'utf8'), 'resident-owned content\n');
  assert.equal((await readdir(path.join(root, '.github/agents'))).length, 1);
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'approved');
  await rm(occupiedAgent);

  const hired = success([...hiringArgs, '--apply']);
  const staff = hired.record;
  assert.equal(staff.id, 'website-specialist');
  assert.equal(staff.status, 'active');
  assert.equal(staff.files.length, 5);
  assert.deepEqual(staff.files.map((file) => file.path), staff.files.map((file) => file.path).slice().sort());
  for (const file of staff.files) {
    assert.equal(sha256(await readFile(path.join(root, file.path))), file.sha256, file.path);
  }
  assert.equal(
    await readFile(path.join(root, '.github/skills/city-engineering-website-specialist/scripts/run-checks.mjs'), 'utf8'),
    await readFile(path.join(project, 'templates/workforce/run-checks.mjs'), 'utf8'),
  );
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'filled');
  assert.equal(success(['validate', '--root', root]).records.staff, 1);
  assert.deepEqual(success(['status', '--root', root]).workforce.drift, []);

  const assignmentArgs = [
    'assign', '--root', root, '--work-order', order.id, '--staff', staff.id,
    '--reason', 'Assign the authorized website work to its appointed specialist.',
  ];
  failure([
    'assign', '--root', root, '--work-order', order.id, '--staff', 'unknown-specialist',
    '--reason', 'No matching staff record exists.',
  ], 'NOT_FOUND');
  assert.equal(success(assignmentArgs).dryRun, true);
  const firstAssignment = success([...assignmentArgs, '--apply']);
  assert.deepEqual(firstAssignment.next, { actor: 'City Engineer: Website Specialist', action: 'start-delivery' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  success([
    'assign', '--root', root, '--work-order', order.id, '--staff', 'municipal-software-engineer',
    '--reason', 'Reassign delivery to the bundled engineer.', '--apply',
  ]);
  const reassignedStatus = success(['status', '--root', root]);
  assert.equal(reassignedStatus.workOrders.readyForDelivery[0].assignedTo, 'municipal-software-engineer');
  assert.equal(reassignedStatus.workforce.assignments[0].staffId, 'municipal-software-engineer');
  const unassignedOrder = petition(root);
  failure([
    'assign', '--root', root, '--work-order', unassignedOrder.id, '--staff', 'municipal-software-engineer',
    '--reason', 'Not yet authorized.', '--apply',
  ], 'INVALID_TRANSITION');
  for (const state of ['triaged', 'proposed', 'awaiting-approval']) transition(root, unassignedOrder.id, state);
  success([...authorizeArgs(root, unassignedOrder.id), '--apply']);
  transition(root, unassignedOrder.id, 'in-progress');
  assert.deepEqual(success(['status', '--root', root]).workOrders.deliveryWithoutAssignment, [{
    id: unassignedOrder.id, title: unassignedOrder.title,
  }]);
  const listed = success(['records-list', '--root', root, '--type', 'staff']);
  assert.equal(listed.total, 1);
  assert.equal(success(['records-get', '--root', root, '--id', staff.id]).records[0].record.id, staff.id);

  const retired = success([
    'retire', '--root', root, '--staff', staff.id, '--reason', 'The specialist engagement has ended.',
    '--handover', 'Transfer current work-order notes to the municipal engineer.',
  ]);
  assert.equal(retired.record.status, 'retired');
  assert.deepEqual(retired.plan.preserve, staff.files.map((file) => file.path));
  success([
    'retire', '--root', root, '--staff', staff.id, '--reason', 'The specialist engagement has ended.',
    '--handover', 'Transfer current work-order notes to the municipal engineer.', '--apply',
  ]);
  failure([
    'retire', '--root', root, '--staff', 'municipal-software-engineer',
    '--reason', 'Reserved general staff remain available.', '--handover', 'No handover is required.',
  ], 'INVALID_TRANSITION');
  failure(assignmentArgs.concat('--apply'), 'STAFF_INACTIVE');
  failure(workforceRequisitionArgs(root, order), 'ALREADY_STAFFED');
  assert.ok(await lstat(path.join(root, staff.files[0].path)));

  const executeOrder = await authorizedWorkforceOrder(root);
  const executeRequest = workforceRequisitionArgs(root, executeOrder, 'document-specialist', ['edit', 'execute']);
  const executeRequisition = success([...executeRequest, '--apply']).record;
  success([
    'review-requisition', '--root', root, '--id', executeRequisition.id,
    '--outcome', 'endorse', '--reason', 'The specialist scope is appropriately bounded.', '--apply',
  ]);
  success([
    'appoint', '--root', root, '--id', executeRequisition.id,
    '--outcome', 'approve', '--reason', 'Approve the specialist appointment under delegation.', '--apply',
  ]);
  const executePreview = success(['hire', '--root', root, '--id', executeRequisition.id]);
  const executeAgent = executePreview.files.find((file) => file.path.endsWith('.agent.md'));
  assert.match(executeAgent.content, /tools: \["read","search","edit","execute"\]/u);
  assert.match(executeAgent.content, /active assignment explicitly authorizes changes to `\.city\/artifacts\/`/u);
  assert.match(executeAgent.content, /prepare the complete author-attributed filing request/u);

  const generatedAgentPath = path.join(root, staff.files.find((file) => file.path.endsWith('.agent.md')).path);
  const missingFilePath = path.join(root, staff.files.find((file) => file.path.endsWith('practice.md')).path);
  await writeFile(generatedAgentPath, 'hand-edited agent\n');
  await rm(missingFilePath);
  const status = success(['status', '--root', root]);
  assert.deepEqual(status.workforce.drift, [{
    staffId: staff.id,
    changed: [staff.files.find((file) => file.path.endsWith('.agent.md')).path],
    missing: [staff.files.find((file) => file.path.endsWith('practice.md')).path],
  }]);
  assert.deepEqual(success(['validate', '--root', root]).workforce.drift, status.workforce.drift);
  const changedRequisition = await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`));
  changedRequisition.title = 'Different title';
  await writeJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`), changedRequisition);
  failure(['validate', '--root', root], 'INVALID_RECORD');
});

test('hire refuses symlinked destination components without writing outside the repository', async () => {
  const { root } = await fixture();
  await adoptedCity(root);
  const order = await authorizedWorkforceOrder(root);
  const requested = success([...workforceRequisitionArgs(root, order), '--apply']).record;
  success([
    'review-requisition', '--root', root, '--id', requested.id, '--outcome', 'endorse',
    '--reason', 'The specialist scope is supported.', '--apply',
  ]);
  success([
    'appoint', '--root', root, '--id', requested.id, '--outcome', 'approve',
    '--reason', 'The appointment is within delegated authority.', '--apply',
  ]);
  const target = path.join(root, 'symlink-target');
  await mkdir(target);
  await symlink(target, path.join(root, '.github'));
  failure(['hire', '--root', root, '--id', requested.id], 'UNSAFE_PATH');
  assert.deepEqual(await readdir(target), []);
  assert.equal((await readJSON(path.join(root, '.city/workforce/requisitions', `${requested.id}.json`))).status, 'approved');
});

test('workforce check toolkit runs argv without a shell and reports pass, failure and invalid input', async () => {
  const { root } = await fixture();
  const scripts = path.join(root, '.github/skills/city-engineering-demo/scripts');
  await mkdir(scripts, { recursive: true });
  const script = path.join(scripts, 'run-checks.mjs');
  await cp(path.join(project, 'templates/workforce/run-checks.mjs'), script);
  const checksPath = path.join(scripts, 'checks.json');
  await writeJSON(checksPath, {
    schemaVersion: 1,
    checks: [['node', '-e', 'process.stdout.write(process.argv[1])', 'literal; no shell']],
  });
  const passed = run(['--root', root], script);
  assert.equal(passed.status, 0, passed.stderr);
  const passedOutput = JSON.parse(passed.stdout);
  assert.equal(passedOutput.passed, true);
  assert.equal(passedOutput.checks[0].stdoutTail, 'literal; no shell');
  assert.equal(passedOutput.checks[0].status, 0);

  await writeJSON(checksPath, { schemaVersion: 1, checks: [['node', '-e', 'process.exit(4)']] });
  const failed = run(['--root', root], script);
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).passed, false);

  await writeJSON(checksPath, {
    schemaVersion: 1,
    checks: [[`no-such-check-${randomUUID()}`]],
  });
  const unavailable = run(['--root', root], script);
  assert.equal(unavailable.status, 1);
  const unavailableOutput = JSON.parse(unavailable.stdout);
  assert.equal(unavailableOutput.passed, false);
  assert.match(unavailableOutput.checks[0].executionError, /ENOENT/u);

  await writeJSON(checksPath, { schemaVersion: 1, checks: [['../node', '-e', 'process.exit(0)']] });
  const invalid = run(['--root', root], script);
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, '');
  assert.match(JSON.parse(invalid.stderr).error, /valid command arrays/u);
});
