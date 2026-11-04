import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const agentsPath = path.join(root, 'com.github.copilot/agents');
const agentIds = [
  'building-inspector',
  'chief-planner',
  'city-auditor',
  'city-clerk',
  'city-council',
  'city-manager',
  'engineering-manager',
  'human-resources-officer',
  'municipal-software-engineer',
  'performance-and-innovation-officer',
  'records-officer',
  'resident-services-officer',
];
const professionalSkills = [
  'agenda-management',
  'case-management',
  'complaint-triage',
  'compliance-inspection',
  'delivery-authorization',
  'development-impact-assessment',
  'evidence-evaluation',
  'interdepartmental-coordination',
  'master-planning',
  'minute-taking',
  'plan-checking',
  'records-appraisal',
  'records-management',
  'risk-based-auditing',
  'software-development',
  'strategic-planning',
  'systems-integration',
  'institutional-review',
  'workforce-planning',
  'recruitment-and-onboarding',
].map((name) => `city-${name}`);
const lifecycleStates = [
  'received', 'triaged', 'proposed', 'awaiting-approval', 'authorized',
  'in-progress', 'inspection', 'awaiting-merge', 'completed', 'blocked',
  'rejected', 'withdrawn', 'reopened',
];
const reservedMatters = ['governance', 'security', 'deletion', 'deployment', 'publication', 'expenditure'];
const routineClasses = ['documentation', 'tests', 'in-scope-fix', 'dependency-patch'];
const policyTemplates = [
  'service-catalogue',
  'authority-and-policy',
  'council-delegation',
  'records-and-privacy',
  'resources-and-workforce',
  'workforce-delegation',
  'institutional-review',
  'continuity-and-accountability',
];
const residentSkills = [
  'city-appeal',
  'city-init',
  'city-petition',
  'city-status',
  'city-town-hall',
];

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

async function customization(filename) {
  const contents = await readFile(filename, 'utf8');
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${filename}: missing YAML frontmatter`);
  const { parse } = await import('yaml');
  return { metadata: parse(match[1]), body: contents.slice(match[0].length) };
}

async function markdownLinksExist(filename) {
  const contents = await readFile(filename, 'utf8');
  for (const match of contents.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    assert.ok(!path.isAbsolute(target), `${filename}: machine-specific link ${target}`);
    const resolved = path.resolve(path.dirname(filename), decodeURI(target));
    assert.ok(
      resolved === root.replace(/\/$/, '') || resolved.startsWith(root),
      `${filename}: reference escapes the plugin: ${target}`,
    );
    assert.ok(existsSync(resolved), `${filename}: broken reference ${target}`);
  }
}

test('manifest uses the documented Agent Plugins 1.0 format', async () => {
  const manifest = await json('plugin.json');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'repository-city');
  assert.equal(manifest.version, '0.3.0');
  assert.ok(manifest.description.length >= 30);
  const allowed = new Set([
    '$schema', 'name', 'version', 'description', 'author', 'homepage',
    'repository', 'license', 'keywords', 'extensions',
  ]);
  for (const key of Object.keys(manifest)) {
    assert.ok(allowed.has(key), `Nonstandard manifest field: ${key}`);
  }
});

test('development package is private and the runtime has no package dependencies', async () => {
  const pkg = await json('package.json');
  const manifest = await json('plugin.json');
  assert.equal(pkg.name, manifest.name);
  assert.equal(pkg.version, manifest.version);
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.ok(pkg.files.includes('plugin.json'));
  assert.ok(pkg.files.includes('com.github.copilot/'));
  assert.ok(pkg.files.includes('skills/'));
  assert.ok(pkg.files.includes('templates/'));
});

test('the local development marketplace points to the same versioned plugin', async () => {
  const marketplace = await json('marketplace.json');
  const manifest = await json('plugin.json');
  assert.equal(marketplace.name, 'repository-city-local');
  assert.ok(marketplace.owner.name.length > 0);
  assert.equal(marketplace.plugins.length, 1);
  const entry = marketplace.plugins[0];
  assert.equal(entry.name, manifest.name);
  assert.equal(entry.version, manifest.version);
  assert.equal(path.resolve(root, entry.source), root.replace(/\/$/, ''));
});

test('the twelve pilot offices have distinct identities and explicit least-tool contracts', async () => {
  const files = (await readdir(agentsPath)).filter((name) => name.endsWith('.agent.md')).sort();
  assert.deepEqual(files, agentIds.map((name) => `${name}.agent.md`));
  const identities = new Set();
  const definitions = new Map();
  for (const filename of files) {
    const definition = await customization(path.join(agentsPath, filename));
    const { metadata, body } = definition;
    assert.equal(typeof metadata.name, 'string', filename);
    assert.match(metadata.name, /^(City:|Repository City)/, filename);
    assert.ok(!identities.has(metadata.name), `Duplicate agent name: ${metadata.name}`);
    identities.add(metadata.name);
    assert.ok(metadata.description.length >= 40, filename);
    assert.ok(Array.isArray(metadata.tools), filename);
    assert.ok(Array.isArray(metadata.agents), filename);
    assert.equal(metadata['user-invocable'], true, filename);
    assert.equal(metadata.model, undefined, 'Use the resident-selected model');
    assert.ok(body.length > 700, `${filename}: missing substantive operating instructions`);
    definitions.set(filename, metadata);
  }
  const manager = definitions.get('city-manager.agent.md');
  assert.ok(manager.tools.includes('agent'));
  assert.ok(!manager.tools.includes('edit'));
  assert.ok(!manager.tools.includes('execute'));
  for (const target of manager.agents) {
    assert.ok(identities.has(target), `Unknown delegated office: ${target}`);
    assert.notEqual(target, manager.name, 'No recursive manager delegation');
  }
  for (const [filename, metadata] of definitions) {
    if (filename === 'engineering-manager.agent.md') {
      assert.deepEqual(metadata.agents, ['*'], filename);
      assert.deepEqual(metadata.tools, ['read', 'search', 'execute', 'agent'], filename);
    } else if (filename !== 'city-manager.agent.md') assert.deepEqual(metadata.agents, [], filename);
  }
  assert.ok(manager.agents.includes('City: City Council'), 'Manager routes approvals to the council');
  assert.ok(manager.agents.includes('City: Performance and Innovation Officer'));
  assert.match(await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8'), /check for institutional reviews automatically/i);
  for (const filename of ['building-inspector.agent.md', 'city-auditor.agent.md', 'city-council.agent.md']) {
    assert.ok(!definitions.get(filename).tools.includes('edit'), filename);
  }
  assert.ok(!definitions.get('city-auditor.agent.md').tools.includes('execute'));
  const council = definitions.get('city-council.agent.md');
  assert.equal(council.name, 'City: City Council');
  assert.deepEqual(council.tools, ['read', 'search', 'execute']);
  const engineer = definitions.get('municipal-software-engineer.agent.md');
  assert.ok(engineer.tools.includes('edit') && engineer.tools.includes('execute'));
  const records = definitions.get('records-officer.agent.md');
  assert.ok(records.tools.includes('execute'), 'Records Officer runs the scoped records CLI workflow');
  const improvement = definitions.get('performance-and-innovation-officer.agent.md');
  assert.deepEqual(improvement.tools, ['read', 'search', 'execute']);
  assert.deepEqual(improvement.agents, []);
  const hr = definitions.get('human-resources-officer.agent.md');
  assert.deepEqual(hr.tools, ['read', 'search', 'execute']);
  const engineeringManager = definitions.get('engineering-manager.agent.md');
  assert.ok(engineeringManager.tools.includes('agent'));
});

test('offices describe the council delivery lifecycle and its honest limits', async () => {
  const read = (id) => readFile(path.join(agentsPath, `${id}.agent.md`), 'utf8');
  const council = await read('city-council');
  assert.match(council, /authorize --root/);
  assert.match(council, /--decided-by city-council/);
  assert.match(council, /untrusted/i);
  assert.match(council, /council-delegation\.md/);
  assert.match(council, /authenticated: false/);
  for (const matter of reservedMatters) assert.match(council, new RegExp(matter), `council: ${matter}`);
  for (const heading of ['Decision', 'Basis', 'Reasons', 'Reserved-matter check']) {
    assert.ok(council.includes(`**${heading}:**`), `council return: ${heading}`);
  }
  const engineer = await read('municipal-software-engineer');
  assert.match(engineer, /non-default branch/);
  assert.match(engineer, /work order's\s+`projectIds`/);
  assert.match(engineer, /--to in-progress/);
  assert.match(engineer, /--to inspection/);
  assert.match(engineer, /Never run `authorize` or `complete`/);
  assert.match(engineer, /begin delivery at once/);
  const manager = await read('city-manager');
  assert.match(manager, /Start authorized delivery automatically/);
  assert.match(manager, /every `projectIds` entry/);
  assert.match(manager, /readyForDelivery/);
  assert.match(manager, /Never auto-dispatch after a preview, `refer`/);
  assert.match(council, /starts the Engineering Manager automatically/);
  const inspector = await read('building-inspector');
  assert.match(inspector, /awaiting-merge\|in-progress/);
  assert.match(inspector, /each changed path is inside/);
  assert.match(await read('city-auditor'), /authorization linkage/i);
  const engineeringManager = await read('engineering-manager');
  for (const command of ['requisition', 'appoint', 'assign']) assert.match(engineeringManager, new RegExp(`\\b${command}\\b`));
  assert.match(engineeringManager, /Human Resources Officer/);
  assert.match(engineeringManager, /Prefer an active specialist/i);
  assert.match(engineeringManager, /React specialist/i);
  assert.match(engineeringManager, /agents: \["\*"\]/);
  const hr = await read('human-resources-officer');
  for (const command of ['review-requisition', 'hire', 'retire']) assert.match(hr, new RegExp(`\\b${command}\\b`));
  assert.match(hr, /authenticated: false/);
  assert.match(hr, /general capability does not disqualify a\s+specialist requisition/i);
  assert.match(hr, /never install MCP/i);
  for (const id of agentIds) {
    const contents = await read(id);
    assert.doesNotMatch(contents, /authorization checkpoint|intake\/preapproval|not production ready|no trusted .*(?:authorization|delivery)/i, id);
  }
});

test('workforce policy favors required specialization over generalist capability', async () => {
  const workforcePlanning = await readFile(path.join(root, 'skills/city-workforce-planning/SKILL.md'), 'utf8');
  const recruitment = await readFile(path.join(root, 'skills/city-recruitment-and-onboarding/SKILL.md'), 'utf8');
  const delegation = await readFile(path.join(root, 'templates/repository/.city/policies/workforce-delegation.md'), 'utf8');
  assert.match(workforcePlanning, /if a work order requires specialized expertise and no active specialist has\s+it, that is a gap/i);
  assert.match(recruitment, /general capability alone does not count\s+as a fit/i);
  assert.match(delegation, /building a\s+React website requires React expertise/i);
});

test('every listed lifecycle names the full set of runtime states', async () => {
  const { STATUSES } = await import('../scripts/lib/constants.mjs');
  assert.deepEqual([...STATUSES].sort(), [...lifecycleStates].sort());
  const files = [
    ...agentIds.map((id) => path.join(agentsPath, `${id}.agent.md`)),
    ...[...professionalSkills, ...residentSkills].map((name) => path.join(root, 'skills', name, 'SKILL.md')),
  ];
  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    if (!contents.includes('`reopened`')) continue;
    for (const state of lifecycleStates) assert.ok(contents.includes(`\`${state}\``), `${file}: missing ${state}`);
  }
});

test('the delivery authorization skill covers reserved matters, routine classes, and outcomes', async () => {
  const { body } = await customization(path.join(root, 'skills/city-delivery-authorization/SKILL.md'));
  for (const term of [...reservedMatters, ...routineClasses, 'authorize', 'reject', 'return', 'refer']) {
    assert.match(body, new RegExp(`\`${term}\``), term);
  }
  assert.match(body, /council-delegation\.md/);
  assert.match(body, /authenticated: false/);
  for (const name of [...professionalSkills, ...residentSkills]) {
    const contents = await readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(contents, /authorization checkpoint|intake\/preapproval|not production ready|first slice|this slice/i, name);
  }
  assert.match(await readFile(path.join(root, 'skills/city-petition/SKILL.md'), 'utf8'), /City Council/);
  assert.match(await readFile(path.join(root, 'skills/city-status/SKILL.md'), 'utf8'), /referral/i);
});

test('the default charter appoints the bundled pilot roster upon valid adoption', async () => {
  const charter = await readFile(path.join(root, 'templates/repository/.city/charter.md'), 'utf8');
  const roster = [
    ['City Manager', 'city-manager.agent.md'],
    ['Engineering Manager', 'engineering-manager.agent.md'],
    ['Human Resources', 'human-resources-officer.agent.md'],
    ['City Clerk', 'city-clerk.agent.md'],
    ['City Council', 'city-council.agent.md'],
    ['Resident Services', 'resident-services-officer.agent.md'],
    ['Chief Planner', 'chief-planner.agent.md'],
    ['City Engineer', 'municipal-software-engineer.agent.md'],
    ['City Inspector', 'building-inspector.agent.md'],
    ['Records Officer', 'records-officer.agent.md'],
    ['City Auditor', 'city-auditor.agent.md'],
    ['Performance and Innovation Officer', 'performance-and-innovation-officer.agent.md'],
  ];

  assert.match(charter, /default appointed pilot roster/i);
  assert.match(charter, /appointments take effect only when .*validly adopts/i);
  assert.match(charter, /grants no actual tool permissions/i);
  for (const [office, definition] of roster) {
    assert.ok(charter.includes(`| ${office} | \`${definition}\` |`), `Missing default appointment: ${office}`);
  }
  assert.match(charter, /twelve pilot offices/);
  assert.match(charter, /\(policies\/council-delegation\.md\)/);
  assert.match(charter, /resident remains sovereign/i);
  assert.match(charter, /final acceptance/i);
  for (const matter of reservedMatters) assert.match(charter, new RegExp(matter), `charter: ${matter}`);
  assert.doesNotMatch(charter, /paused in the first slice|First-slice boundary/);
});

test('all twenty-five skills are discoverable, substantive, and correctly scoped', async () => {
  const expected = [...professionalSkills, ...residentSkills].sort();
  const entries = await readdir(path.join(root, 'skills'), { withFileTypes: true });
  const actual = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(actual, expected);
  for (const name of expected) {
    const { metadata, body } = await customization(path.join(root, 'skills', name, 'SKILL.md'));
    assert.equal(metadata.name, name);
    assert.ok(name.length <= 64);
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(metadata.description.length >= 40, name);
    assert.ok(metadata.description.length <= 1024, name);
    assert.equal(metadata['user-invocable'], residentSkills.includes(name), name);
    assert.ok(body.length > 900, `${name}: missing a practical procedure`);
    assert.ok(body.split('\n').length < 500, `${name}: keep discovery context bounded`);
  }
  const init = await customization(path.join(root, 'skills/city-init/SKILL.md'));
  assert.equal(init.metadata['disable-model-invocation'], true);
  const improvement = await customization(path.join(root, 'skills/city-institutional-review/SKILL.md'));
  assert.equal(improvement.metadata['user-invocable'], false);
  assert.match(improvement.body, /recommendations only/i);
});

test('bundled hooks use the native Copilot contract and an installation-relative script', async () => {
  const hooks = await json('com.github.copilot/hooks/hooks.json');
  assert.equal(hooks.version, 1);
  assert.deepEqual(Object.keys(hooks.hooks), ['preToolUse']);
  const entries = hooks.hooks.preToolUse;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'command');
  assert.equal(entries[0].command, 'node "${PLUGIN_ROOT}/scripts/city-hook.mjs"');
  assert.equal(entries[0].timeoutSec, 10);
  assert.ok((await stat(path.join(root, 'scripts/city-hook.mjs'))).isFile());
});

test('founding documents remain unadopted without draft or template labels', async () => {
  assert.equal(existsSync(path.join(root, '.city')), false);
  const template = path.join(root, 'templates/repository/.city');
  for (const file of ['charter.md', 'instruction-fragment.md', ...policyTemplates.map((name) => `policies/${name}.md`)]) {
    const contents = await readFile(path.join(template, file), 'utf8');
    assert.ok(contents.length > 500, `${file}: missing foundational procedure`);
  }
  for (const file of ['charter.md', ...policyTemplates.map((name) => `policies/${name}.md`)]) {
    const contents = await readFile(path.join(template, file), 'utf8');
    assert.match(contents, /Initialization status: Not adopted\./, file);
    assert.doesNotMatch(contents, /\b(?:draft|template)\b/i, file);
  }
  assert.deepEqual(await json('templates/repository/.city/projects.json'), { schemaVersion: 1, projects: [] });
  assert.equal(existsSync(path.join(template, 'config.json')), false);
});

test('project data contracts keep project directories distinct from districts', async () => {
  const projectSchema = await json('schemas/projects.schema.json');
  assert.equal(projectSchema.additionalProperties, false);
  assert.deepEqual(projectSchema.required, ['schemaVersion', 'projects']);
  assert.deepEqual(projectSchema.properties.projects.items.required, ['id', 'name', 'path', 'description']);
  const orderSchema = await json('schemas/work-order.schema.json');
  assert.equal(orderSchema.properties.projectIds.minItems, 1);
  assert.equal(orderSchema.required.includes('projectIds'), false, 'legacy orders remain readable');
  const requestSchema = await json('schemas/records-request.schema.json');
  assert.equal(requestSchema.additionalProperties, false);
  assert.deepEqual(requestSchema.required, [
    'schemaVersion', 'id', 'cityId', 'requestedBy', 'sourceOffice', 'purpose', 'relatedWorkOrderId',
    'items', 'status', 'createdAt', 'updatedAt', 'history', 'responses', 'provenance',
  ]);
  assert.deepEqual(requestSchema.properties.status.enum, ['open', 'resolved', 'cancelled']);
  const reviewSchema = await json('schemas/institutional-review.schema.json');
  assert.equal(reviewSchema.additionalProperties, false);
  assert.ok(reviewSchema.required.includes('triggers'));
  assert.ok(reviewSchema.required.includes('recommendations'));
  assert.deepEqual(reviewSchema.properties.recommendations.items.properties.route.enum, [
    'administrative', 'council', 'resident',
  ]);
});

test('all bundled customization resource links resolve within the package', async () => {
  const files = agentIds.map((id) => path.join(agentsPath, `${id}.agent.md`));
  for (const name of [...professionalSkills, ...residentSkills]) {
    files.push(path.join(root, 'skills', name, 'SKILL.md'));
  }
  for (const file of files) await markdownLinksExist(file);
});

test('resident documentation and founding templates have no broken local references', async () => {
  const files = [
    'README.md',
    'docs/governance.md',
    'docs/compatibility.md',
    'templates/repository/.city/charter.md',
    'templates/repository/.city/instruction-fragment.md',
    ...policyTemplates.map((name) => `templates/repository/.city/policies/${name}.md`),
  ];
  for (const file of files) await markdownLinksExist(path.join(root, file));
});

test('agent and skill definitions do not invoke external organization-specific workflows', async () => {
  const files = agentIds.map((id) => path.join(agentsPath, `${id}.agent.md`));
  for (const name of [...professionalSkills, ...residentSkills]) {
    files.push(path.join(root, 'skills', name, 'SKILL.md'));
  }
  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    assert.doesNotMatch(contents, /\brsg(?:dev|-)/i, file);
    assert.doesNotMatch(contents, /\/Users\/|\.copilot\/session-state/, file);
  }
});

test('the distributable contains runtime resources but no development profile or dependencies', () => {
  const packed = JSON.parse(execFileSync('npm', [
    'pack', '--dry-run', '--json', '--ignore-scripts',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  }));
  assert.equal(packed.length, 1);
  const files = new Set(packed[0].files.map((entry) => entry.path));
  for (const required of [
    'plugin.json',
    'marketplace.json',
    'README.md',
    'PLAN.md',
    'scripts/city.mjs',
    'scripts/city-hook.mjs',
    'scripts/smoke.mjs',
    'schemas/projects.schema.json',
    'schemas/records-request.schema.json',
    'schemas/requisition.schema.json',
    'schemas/staff.schema.json',
    'schemas/assignment.schema.json',
    'schemas/institutional-review.schema.json',
    'templates/repository/.city/charter.md',
    'templates/repository/.city/instruction-fragment.md',
    'templates/repository/.city/projects.json',
    'templates/workforce/agent.md',
    'templates/workforce/skill.md',
    'templates/workforce/practice.md',
    'templates/workforce/run-checks.mjs',
    ...policyTemplates.map((name) => `templates/repository/.city/policies/${name}.md`),
    'docs/governance.md',
    'docs/compatibility.md',
    ...agentIds.map((id) => `com.github.copilot/agents/${id}.agent.md`),
    ...[...professionalSkills, ...residentSkills].map((name) => `skills/${name}/SKILL.md`),
  ]) {
    assert.ok(files.has(required), `Missing packaged asset: ${required}`);
  }
  for (const filename of files) {
    assert.doesNotMatch(filename, /^(node_modules|\.vscode|\.city|tests)\//, filename);
  }
});
