import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { 'plugin-root': { type: 'string' } },
});
const pluginRoot = values['plugin-root'] ?? fileURLToPath(new URL('../', import.meta.url));
assert.ok(path.isAbsolute(pluginRoot), '--plugin-root must be absolute');
const cli = path.join(pluginRoot, 'scripts/city.mjs');
const hook = path.join(pluginRoot, 'scripts/city-hook.mjs');

function command(script, args, { input, failure = false } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    input,
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.notEqual(result.signal, 'SIGTERM', 'Scenario command timed out');
  if (failure) {
    assert.notEqual(result.status, 0, 'Unsafe operation unexpectedly succeeded');
    assert.ok(result.stderr.trim(), 'Failures must explain the problem');
    return result;
  }
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function development(commandName, root, id, data, apply = true) {
  return command(cli, [commandName, '--root', root, '--id', id, '--data', JSON.stringify(data), ...(apply ? ['--apply'] : [])]);
}

function screen(root, id, projectId, extra = {}) {
  return development('screen-development', root, id, {
    route: 'lightweight', projectIds: [projectId],
    scopeEvidence: 'The request is contained in the selected registered project.',
    reason: 'Contained documentation repair without material effects.',
    evidence: 'Reviewed existing source interfaces and project facts.',
    impacts: [], questions: [], requirements: [],
    policyCitations: [{ path: 'policies/development-applications.md', section: 'Baseline materiality', projectIds: [] }],
    ...extra,
  });
}

async function prepareZoning(root) {
  await cp(
    path.join(root, '.city/policy-drafts/zoning.md'),
    path.join(root, '.city/policies/zoning.md'),
  );
  const changeTypes = [
    'documentation', 'tests', 'bugfix', 'refactor', 'feature', 'public-interface',
    'dependency', 'data-migration', 'security', 'deletion', 'generated-code',
  ];
  return command(cli, [
    'zoning-map', '--root', root,
    '--data', JSON.stringify({
      schemaVersion: 1,
      zones: [{
        id: 'repository', name: 'Repository', path: '.',
        description: 'Smoke-test zone covering the repository.',
        rules: changeTypes.map((changeType) => ({
          changeType, disposition: 'permitted', requirements: [],
        })),
      }],
    }), '--apply',
  ]);
}

function checkZoning(root, id, changeType) {
  const result = development('zoning-check', root, id, {
    changeTypes: [changeType], reason: 'Reviewed the proposed change against its declared scope.',
    evidence: 'Checked the registered project directory and current zone rules.',
  });
  assert.equal(result.zoning.enabled, true);
  assert.equal(result.zoning.current, true);
  assert.equal(result.zoning.outcome, 'permitted');
  return result;
}

const temporary = path.join(pluginRoot, `.smoke-${randomUUID()}`);
try {
  await mkdir(temporary);
  const first = path.join(temporary, 'Harbour City');
  const second = path.join(temporary, 'Garden City');
  const third = path.join(temporary, 'Council City');
  const reviewCity = path.join(temporary, 'Institutional Review City');
  const unrelated = path.join(temporary, 'Unenrolled workspace');
  await Promise.all([mkdir(first), mkdir(second), mkdir(third), mkdir(reviewCity), mkdir(unrelated)]);
  await mkdir(path.join(first, '.github'));
  const instructions = '# Existing contributor instructions\n\nPreserve this content.\n';
  await writeFile(path.join(first, '.github/copilot-instructions.md'), instructions);

  command(cli, ['init', '--root', first, '--name', 'Harbour City']);
  assert.equal(existsSync(path.join(first, '.city')), false, 'Dry-run wrote city state');
  command(cli, ['init', '--root', first, '--name', 'Harbour City', '--apply']);
  const configPath = path.join(first, '.city/config.json');
  const configText = await readFile(configPath, 'utf8');
  const config = JSON.parse(configText);
  assert.equal(config.governance, 'draft');
  const charter = await readFile(path.join(first, '.city/charter.md'), 'utf8');
  command(cli, ['init', '--root', first, '--apply']);
  assert.equal(await readFile(configPath, 'utf8'), configText);
  assert.equal(await readFile(path.join(first, '.city/charter.md'), 'utf8'), charter);
  assert.equal(await readFile(path.join(first, '.github/copilot-instructions.md'), 'utf8'), instructions);

  const petition = [
    'project-add', '--root', first, '--id', 'runtime-guide', '--name', 'Runtime Guide',
    '--path', 'projects/runtime-guide', '--description', 'Contributor runtime documentation.', '--apply',
  ];
  command(cli, petition);
  const petitionArgs = [
    'petition', '--root', first,
    '--title', 'Explain the supported runtime',
    '--request', 'New contributors need an unambiguous Node.js requirement.',
    '--project', 'runtime-guide',
    '--criterion', 'The documented version matches the supported runtime.',
  ];
  command(cli, petitionArgs);
  const records = path.join(first, '.city/work-orders');
  assert.equal((await readdir(records)).length, 0, 'Petition dry-run wrote a record');
  command(cli, [...petitionArgs, '--apply']);
  const files = (await readdir(records)).filter((file) => file.endsWith('.json'));
  assert.equal(files.length, 1);
  const recordPath = path.join(records, files[0]);
  const received = JSON.parse(await readFile(recordPath, 'utf8'));
  assert.equal(received.status, 'received');
  assert.deepEqual(received.acceptanceCriteria, ['The documented version matches the supported runtime.']);

  const recordItem = JSON.stringify({
    type: 'work-order', id: received.id, description: 'Current order and lifecycle history',
  });
  const recordRequestArgs = [
    'records-request', '--root', first, '--requested-by', 'City: Building Inspector',
    '--purpose', 'Confirm the work-order lifecycle before inspection.',
    '--related-work-order', received.id, '--item', recordItem,
  ];
  assert.equal(command(cli, recordRequestArgs).dryRun, true, 'Records request preview wrote no record');
  const createdRequest = command(cli, [...recordRequestArgs, '--apply']).recordsRequest;
  const record = command(cli, [
    'records-get', '--root', first, '--id', received.id,
  ]).records[0];
  assert.equal(record.record.id, received.id);
  const response = JSON.stringify({
    item: 0,
    outcome: 'found',
    references: [{
      type: 'work-order', id: record.id, path: record.path, sha256: record.sha256,
    }],
    explanation: 'Retrieved from the canonical local register.',
  });
  command(cli, [
    'records-resolve', '--root', first, '--id', createdRequest.id,
    '--resolved-by', 'City: Records Officer', '--response', response,
    '--reason', 'The requested work order was retrieved.',
  ]);
  const resolvedRequest = command(cli, [
    'records-resolve', '--root', first, '--id', createdRequest.id,
    '--resolved-by', 'City: Records Officer', '--response', response,
    '--reason', 'The requested work order was retrieved.', '--apply',
  ]).recordsRequest;
  assert.equal(resolvedRequest.status, 'resolved');
  assert.equal(command(cli, ['status', '--root', first]).recordsRequests.open, 0);

  for (const state of ['triaged', 'proposed', 'awaiting-approval']) {
    command(cli, [
      'transition', '--root', first, '--id', received.id,
      '--to', state, '--reason', `Smoke scenario: ${state}`, '--apply',
    ]);
  }
  const awaitingText = await readFile(recordPath, 'utf8');
  const awaiting = JSON.parse(awaitingText);
  assert.equal(awaiting.status, 'awaiting-approval');
  assert.ok(awaiting.history.length >= 4, 'Earlier official actions were lost');
  command(cli, [
    'transition', '--root', first, '--id', received.id,
    '--to', 'authorized', '--reason', 'A flag is not human authorization.', '--apply',
  ], { failure: true });
  const draftAuthorization = command(cli, [
    'authorize', '--root', first, '--id', received.id, '--decided-by', 'city-council',
    '--outcome', 'authorize', '--reserved', 'none', '--reason', 'Draft governance cannot delegate.', '--apply',
  ], { failure: true });
  assert.equal(JSON.parse(draftAuthorization.stderr).error.code, 'NOT_ADOPTED');
  assert.equal(await readFile(recordPath, 'utf8'), awaitingText);
  command(cli, ['validate', '--root', first]);
  command(cli, ['status', '--root', first]);

  const hookInput = (cwd) => JSON.stringify({
    cwd,
    toolName: 'shell',
    toolArgs: { command: 'This input is inspected, never executed.' },
  });
  assert.deepEqual(command(hook, [], { input: hookInput(first) }), {});
  assert.deepEqual(command(hook, [], { input: hookInput(unrelated) }), {});
  assert.equal(existsSync(path.join(unrelated, '.city')), false);

  await writeFile(configPath, `${JSON.stringify({ ...config, schemaVersion: 999 }, null, 2)}\n`);
  const denied = command(hook, [], { input: hookInput(first) });
  assert.equal(denied.permissionDecision, 'deny');
  assert.ok(denied.permissionDecisionReason.length > 10);
  command(cli, ['validate', '--root', first], { failure: true });
  await writeFile(configPath, configText);

  command(cli, ['init', '--root', second, '--name', 'Garden City', '--apply']);
  const secondConfig = JSON.parse(await readFile(path.join(second, '.city/config.json'), 'utf8'));
  assert.notEqual(secondConfig.cityId, config.cityId);
  assert.equal((await readdir(path.join(second, '.city/work-orders'))).length, 0);
  assert.equal(await readFile(recordPath, 'utf8'), awaitingText);
  command(cli, ['validate', '--root', first]);
  command(cli, ['validate', '--root', second]);

  const adoptedOn = new Date().toISOString().slice(0, 10);
  await prepareZoning(second);
  const adoptArgs = [
    'adopt', '--root', second, '--adopted-on', adoptedOn,
    '--declared-by', 'Smoke resident', '--evidence', 'Charter and policies record the resident declaration.',
  ];
  command(cli, adoptArgs);
  command(cli, [...adoptArgs, '--apply']);
  const adoptedConfig = JSON.parse(await readFile(path.join(second, '.city/config.json'), 'utf8'));
  assert.equal(adoptedConfig.governance, 'adopted');
  assert.equal(Object.hasOwn(adoptedConfig.adoption, 'history'), false);

  command(cli, [
    'project-add', '--root', second, '--id', 'website', '--name', 'Website',
    '--path', 'projects/website', '--description', 'Public website improvements.', '--apply',
  ]);
  const websiteOrder = command(cli, [
    'petition', '--root', second, '--title', 'Improve the website',
    '--request', 'Make the website pages clearer and more accessible.',
    '--project', 'website', '--criterion', 'The existing website content is preserved.', '--apply',
  ]).workOrder;
  checkZoning(second, websiteOrder.id, 'feature');
  for (const state of ['triaged', 'proposed', 'awaiting-approval']) {
    if (state === 'proposed') screen(second, websiteOrder.id, 'website');
    command(cli, [
      'transition', '--root', second, '--id', websiteOrder.id, '--to', state,
      '--reason', `Website workforce smoke: ${state}`, '--apply',
    ]);
  }
  command(cli, [
    'authorize', '--root', second, '--id', websiteOrder.id, '--decided-by', 'city-council',
    '--outcome', 'authorize', '--reserved', 'none', '--reason', 'Website scope is routine and bounded.', '--apply',
  ]);
  const requisitionArgs = [
    'requisition', '--root', second, '--work-order', websiteOrder.id, '--staff-id', 'website-specialist',
    '--title', 'Website Specialist', '--reason', 'The website work requires focused frontend expertise.',
    '--duties', 'Improve the registered website project while preserving its existing structure.',
    '--competency', 'Accessible responsive design', '--standard', 'Preserve existing behavior.',
    '--tool', 'edit', '--check', '["node","-e","process.exit(0)"]',
  ];
  assert.equal(command(cli, requisitionArgs).dryRun, true);
  const requisition = command(cli, [...requisitionArgs, '--apply']).record;
  command(cli, [
    'review-requisition', '--root', second, '--id', requisition.id, '--outcome', 'endorse',
    '--reason', 'The specialist need and least-privilege scope are supported.', '--apply',
  ]);
  command(cli, [
    'appoint', '--root', second, '--id', requisition.id, '--outcome', 'approve',
    '--reason', 'The endorsed appointment is justified by this work order.', '--apply',
  ]);
  const hiringPreview = command(cli, ['hire', '--root', second, '--id', requisition.id]);
  assert.equal(hiringPreview.dryRun, true);
  assert.equal(hiringPreview.files.length, 6);
  const hireResult = command(cli, ['hire', '--root', second, '--id', requisition.id, '--apply']);
  const checksScript = path.join(second, '.github/skills/city-engineering-website-specialist/scripts/run-checks.mjs');
  assert.equal(
    await readFile(checksScript, 'utf8'),
    await readFile(path.join(pluginRoot, 'templates/workforce/run-checks.mjs'), 'utf8'),
  );
  const checksResult = command(checksScript, ['--root', second]);
  assert.equal(checksResult.root, second);
  assert.equal(checksResult.passed, true);
  assert.equal(checksResult.checks[0].status, 0);
  assert.deepEqual(checksResult.checks[0].command, ['node', '-e', 'process.exit(0)']);
  const assignment = command(cli, [
    'assign', '--root', second, '--work-order', websiteOrder.id, '--staff', hireResult.record.id,
    '--reason', 'Assign the authorized website delivery to its appointed specialist.', '--apply',
  ]);
  assert.equal(assignment.record.staffId, 'website-specialist');
  assert.equal(command(cli, ['status', '--root', second]).workOrders.readyForDelivery[0].assignedTo, 'website-specialist');

  await writeFile(path.join(second, '.city/charter.md'), '# Amended charter for the smoke scenario\n');
  const amendArgs = [
    'amend', '--root', second, '--adopted-on', adoptedOn,
    '--declared-by', 'Smoke resident', '--evidence', 'Charter and policies record the resident declaration.',
    '--summary', 'Smoke scenario amendment for a corrected jurisdiction statement.',
  ];
  command(cli, amendArgs);
  command(cli, [...amendArgs, '--apply']);
  const amendedConfig = JSON.parse(await readFile(path.join(second, '.city/config.json'), 'utf8'));
  assert.equal(amendedConfig.governance, 'adopted');
  assert.equal(amendedConfig.adoption.history.length, 1);
  assert.equal(amendedConfig.adoption.history[0].charter.sha256, adoptedConfig.adoption.charter.sha256);
  command(cli, ['validate', '--root', second]);

  await mkdir(path.join(third, '.git'));
  command(cli, ['init', '--root', third, '--name', 'Council City', '--apply']);
  await prepareZoning(third);
  command(cli, ['adopt', '--root', third, '--adopted-on', adoptedOn,
    '--declared-by', 'Smoke resident', '--evidence', 'Charter, policies and council delegation adopted by the resident.', '--apply']);
  assert.equal(command(cli, ['status', '--root', third]).council.delegationAvailable, true);
  command(cli, [
    'project-add', '--root', third, '--id', 'docs', '--name', 'Documentation',
    '--path', 'projects/docs', '--description', 'Project for documentation.', '--apply',
  ]);
  const delivery = command(cli, [
    'petition', '--root', third, '--title', 'Document the delivery lifecycle',
    '--request', 'Contributors need the council delivery lifecycle explained.',
    '--project', 'docs',
    '--criterion', 'The README lists every delivery state.', '--apply',
  ]).workOrder;
  checkZoning(third, delivery.id, 'documentation');
  const deliveryPath = path.join(third, '.city/work-orders', `${delivery.id}.json`);
  const move = (state) => command(cli, [
    'transition', '--root', third, '--id', delivery.id, '--to', state, '--reason', `Smoke scenario: ${state}`, '--apply',
  ]);
  move('triaged');
  assert.equal(screen(third, delivery.id, 'docs').development.stage, 'ready-lightweight');
  for (const state of ['proposed', 'awaiting-approval']) move(state);
  const authorizeArgs = [
    'authorize', '--root', third, '--id', delivery.id, '--decided-by', 'city-council', '--outcome', 'authorize',
    '--reserved', 'none', '--routine-class', 'documentation', '--reason', 'Routine documentation within delegated scope.',
  ];
  const awaitingDelivery = await readFile(deliveryPath, 'utf8');
  assert.equal(command(cli, authorizeArgs).dryRun, true);
  assert.equal(await readFile(deliveryPath, 'utf8'), awaitingDelivery);
  const authorization = command(cli, [...authorizeArgs, '--apply']).decision;
  assert.equal(authorization.basis, 'routine-policy');
  assert.equal(authorization.evidence.authenticated, false);
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) {
    move(state);
    assert.deepEqual(command(hook, [], { input: hookInput(third) }), {});
  }
  const merging = await readFile(deliveryPath, 'utf8');
  command(cli, [
    'transition', '--root', third, '--id', delivery.id, '--to', 'completed', '--reason', 'Merged without acceptance', '--apply',
  ], { failure: true });
  assert.equal(await readFile(deliveryPath, 'utf8'), merging);
  const acceptance = command(cli, [
    'complete', '--root', third, '--id', delivery.id, '--declared-by', 'Smoke resident',
    '--evidence', 'Pull request reviewed and merged by the resident.', '--reason', 'Acceptance criteria met.', '--apply',
  ]).decision;
  assert.equal(acceptance.kind, 'acceptance');
  assert.equal(JSON.parse(await readFile(deliveryPath, 'utf8')).status, 'completed');
  assert.equal(command(cli, ['validate', '--root', third]).records.decisions, 2);
  const deliveryStatus = command(cli, ['status', '--root', third]);
  assert.equal(deliveryStatus.workOrders.byStatus.completed, 1);
  assert.deepEqual(deliveryStatus.decisions.byKind, { proposal: 0, authorization: 1, acceptance: 1 });
  assert.deepEqual(command(hook, [], { input: hookInput(third) }), {});

  const formal = command(cli, [
    'petition', '--root', third, '--title', 'Define a versioned public documentation contract',
    '--request', 'Consumers need a new stable machine-readable documentation interface.',
    '--project', 'docs', '--criterion', 'Existing consumers retain their contract.', '--apply',
  ]).workOrder;
  checkZoning(third, formal.id, 'public-interface');
  const formalMove = (state) => command(cli, [
    'transition', '--root', third, '--id', formal.id, '--to', state,
    '--reason', `Formal development smoke: ${state}`, '--apply',
  ]);
  formalMove('triaged');
  const routed = screen(third, formal.id, 'docs', {
    route: 'formal', impacts: ['public-interface'],
    reason: 'The new public contract has material consumer compatibility effects.',
    questions: ['Must existing consumers remain compatible?'],
    requirements: [{ id: 'contract', kind: 'specification', description: 'Versioned public contract.', reason: 'Assess consumer compatibility.' }],
  });
  assert.equal(routed.development.next.actor, 'development-advisor');
  formalMove('proposed');
  const notReady = command(cli, [
    'transition', '--root', third, '--id', formal.id, '--to', 'awaiting-approval',
    '--reason', 'Missing Advisor packet and assessment.', '--apply',
  ], { failure: true });
  assert.equal(JSON.parse(notReady.stderr).error.code, 'DEVELOPMENT_NOT_READY');
  const application = {
    screeningRevision: 1, reason: 'Advisor-assisted versioned proposal.',
    evidence: 'Static source and contract review only; runtime checks remain delivery criteria.',
    proposal: 'Add a separate versioned contract without changing the existing interface.',
    answers: [{ question: 'Must existing consumers remain compatible?', answer: 'Yes, preserve them indefinitely.' }],
    artifacts: [{ requirementId: 'contract', disposition: 'provided', evidence: 'Proposed v2 contract and compatibility specification in the application proposal.' }],
  };
  assert.equal(development('application-record', third, formal.id, application, false).dryRun, true);
  assert.equal(command(cli, ['records-get', '--root', third, '--id', formal.id]).records[0].record.development.applications.length, 0);
  development('application-record', third, formal.id, application);
  assert.equal(command(cli, ['status', '--root', third]).workOrders.development.find((item) => item.id === formal.id).stage, 'independent-assessment');
  assert.equal(development('assess-application', third, formal.id, {
    applicationRevision: 1, outcome: 'ready', reason: 'Independent Planner assessment.',
    evidence: 'Reviewed current contract requirement and resident compatibility choice.',
  }).development.stage, 'ready-formal');
  formalMove('awaiting-approval');
  command(cli, [
    'authorize', '--root', third, '--id', formal.id, '--decided-by', 'city-council',
    '--outcome', 'authorize', '--reserved', 'none', '--reason', 'Current formal packet and independent assessment support delivery.', '--apply',
  ]);
  for (const state of ['in-progress', 'inspection', 'awaiting-merge']) formalMove(state);
  command(cli, [
    'complete', '--root', third, '--id', formal.id, '--declared-by', 'Smoke resident',
    '--evidence', 'Resident-reviewed pull request, no runtime study claimed.',
    '--reason', 'Versioned contract and criteria independently inspected.', '--apply',
  ]);
  command(cli, ['validate', '--root', third]);

  command(cli, ['init', '--root', reviewCity, '--name', 'Institutional Review City', '--apply']);
  const reviewPolicyPath = path.join(reviewCity, '.city/policies/institutional-review.md');
  const reviewPolicy = await readFile(reviewPolicyPath, 'utf8');
  await writeFile(reviewPolicyPath, reviewPolicy.replace(
    '| periodic-time | 90 | elapsed days |',
    '| periodic-time | 1 | elapsed days |',
  ));
  command(cli, [
    'adopt', '--root', reviewCity, '--adopted-on', adoptedOn,
    '--declared-by', 'Smoke resident', '--evidence', 'Institutional review policy adopted.',
    '--apply',
  ]);
  const reviewConfigPath = path.join(reviewCity, '.city/config.json');
  const reviewConfig = JSON.parse(await readFile(reviewConfigPath, 'utf8'));
  const reviewStart = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString();
  reviewConfig.createdAt = reviewStart;
  reviewConfig.adoption.adoptedOn = reviewStart.slice(0, 10);
  reviewConfig.adoption.recordedAt = reviewStart;
  await writeFile(reviewConfigPath, `${JSON.stringify(reviewConfig, null, 2)}\n`);
  const reviewStatus = command(cli, ['status', '--root', reviewCity]).institutionalReview;
  assert.equal(reviewStatus.available, true);
  assert.equal(reviewStatus.due, true);
  const reviewArgs = [
    'review-record', '--root', reviewCity,
    '--conducted-by', 'Performance and Innovation Officer',
    '--summary', 'The scheduled institutional review was completed.',
    '--recommendation', JSON.stringify({
      title: 'Clarify the review reporting route',
      rationale: 'Make the evidence handoff explicit.',
      precedent: 'A peer city assigns a management analyst to recurring performance reviews.',
      sources: ['Official municipal performance office page, https://example.gov/performance'],
      route: 'administrative',
      reservedMatters: [],
    }),
  ];
  assert.equal(command(cli, reviewArgs).dryRun, true);
  const institutionalReview = command(cli, [...reviewArgs, '--apply']).institutionalReview;
  assert.match(institutionalReview.id, /^IR-/);
  assert.equal(command(cli, ['records-get', '--root', reviewCity, '--id', institutionalReview.id])
    .records[0].record.id, institutionalReview.id);
  assert.equal(command(cli, ['status', '--root', reviewCity]).institutionalReview.due, false);
  command(cli, ['validate', '--root', first]);
  command(cli, ['validate', '--root', reviewCity]);

  console.log(JSON.stringify({
    result: 'passed',
    pluginRoot,
    scenarios: [
      'read-only initialization preview',
      'repeatable draft initialization preserving existing instructions',
      'project registration and project-scoped petition',
      'petition preview and durable intake record',
      'preapproval transitions preserving history',
      'refusal of transition-flag authorization and of council authorization under draft governance',
      'native hook denial for incompatible city state',
      'two-city isolation and an unaffected unenrolled workspace',
      'adopt then amend a drifted charter, recording superseded history',
      'website specialist requisition, appointment, toolkit check and assignment',
      'adopted council delegation: routine authorization, delivery, inspection, awaiting merge and resident completion',
      'lightweight screening remains subject to authorization',
      'formal screening automatically routes to Advisor; current packet and independent Planner assessment gate delivery',
      'policy-enabled institutional review trigger, dry-run, canonical record and reset',
    ],
    boundary: 'Delivery decisions were recorded, not authenticated. No git operation, merge, push or deployment was performed.',
  }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
