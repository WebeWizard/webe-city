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
  'development-advisor',
  'engineering-manager',
  'human-resources-officer',
  'municipal-software-engineer',
  'performance-and-innovation-officer',
  'public-information-officer',
  'records-officer',
  'resident-services-officer',
];
const professionalSkills = [
  'agenda-management',
  'asset-management',
  'case-management',
  'complaint-triage',
  'compliance-inspection',
  'delivery-authorization',
  'development-impact-assessment',
  'development-applications',
  'evidence-evaluation',
  'interdepartmental-coordination',
  'master-planning',
  'minute-taking',
  'plan-checking',
  'public-information-writing',
  'records-appraisal',
  'records-capture',
  'records-management',
  'risk-based-auditing',
  'software-development',
  'strategic-planning',
  'systems-integration',
  'institutional-review',
  'workforce-planning',
  'building-permits',
  'recruitment-and-onboarding',
].map((name) => `city-${name}`);
const lifecycleStates = [
  'received', 'triaged', 'proposed', 'awaiting-approval', 'authorized',
  'in-progress', 'inspection', 'awaiting-merge', 'awaiting-acceptance', 'completed', 'blocked',
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
  'development-applications',
  'continuity-and-accountability',
  'infrastructure-management',
  'building-permits',
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
  assert.equal(manifest.version, '0.12.1');
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
  const lock = await json('package-lock.json');
  const { PLUGIN } = await import('../scripts/lib/constants.mjs');
  assert.equal(pkg.name, manifest.name);
  assert.equal(pkg.version, manifest.version);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.equal(PLUGIN.version, manifest.version);
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
  assert.equal(marketplace.metadata.version, manifest.version);
  assert.equal(path.resolve(root, entry.source), path.resolve(root));
});

test('bundled offices have distinct identities and explicit least-tool contracts', async () => {
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
    } else if (filename !== 'city-manager.agent.md') {
      assert.deepEqual(metadata.agents, [], filename);
      assert.ok(metadata.tools.includes('list_agents') && metadata.tools.includes('write_agent'), filename);
      assert.ok(!metadata.tools.includes('agent'), filename);
    }
  }
  assert.ok(manager.agents.includes('City: City Council'), 'Manager routes approvals to the council');
  assert.ok(manager.agents.includes('City: Development Advisor'));
  assert.deepEqual(definitions.get('development-advisor.agent.md').tools, ['read', 'search', 'edit', 'execute', 'list_agents', 'write_agent']);
  assert.deepEqual(definitions.get('chief-planner.agent.md').tools, ['read', 'search', 'edit', 'execute', 'list_agents', 'write_agent']);
  assert.ok(manager.agents.includes('City: Performance and Innovation Officer'));
  const information = definitions.get('public-information-officer.agent.md');
  assert.equal(information.name, 'City: Public Information Officer');
  assert.ok(manager.agents.includes(information.name));
  assert.deepEqual(information.tools, ['read', 'search', 'list_agents', 'write_agent']);
  assert.match(await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8'), /check for institutional reviews automatically/i);
  for (const filename of ['building-inspector.agent.md', 'city-auditor.agent.md', 'city-council.agent.md']) {
    assert.ok(!definitions.get(filename).tools.includes('edit'), filename);
  }
  assert.ok(!definitions.get('city-auditor.agent.md').tools.includes('execute'));
  const council = definitions.get('city-council.agent.md');
  assert.equal(council.name, 'City: City Council');
  assert.deepEqual(council.tools, ['read', 'search', 'execute', 'list_agents', 'write_agent']);
  const engineer = definitions.get('municipal-software-engineer.agent.md');
  assert.ok(engineer.tools.includes('edit') && engineer.tools.includes('execute'));
  const records = definitions.get('records-officer.agent.md');
  assert.ok(records.tools.includes('execute'), 'Records Officer runs the scoped records CLI workflow');
  const improvement = definitions.get('performance-and-innovation-officer.agent.md');
  assert.deepEqual(improvement.tools, ['read', 'search', 'execute', 'list_agents', 'write_agent']);
  assert.deepEqual(improvement.agents, []);
  const hr = definitions.get('human-resources-officer.agent.md');
  assert.deepEqual(hr.tools, ['read', 'search', 'execute', 'list_agents', 'write_agent']);
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
  assert.match(engineer, /detailed implementation plan\s+before editing implementation files/);
  assert.match(engineer, /resident confirmation before coding/);
  assert.match(engineer, /existing authorization as covering\s+the expansion/);
  const manager = await read('city-manager');
  assert.match(manager, /Start authorized delivery automatically/);
  assert.match(manager, /every `projectIds` entry/);
  assert.match(manager, /readyForDelivery/);
  assert.match(manager, /resident plan-review\s+handoff/);
  assert.match(manager, /do not automatically continue\s+to implementation/);
  assert.match(manager, /Never auto-dispatch after a preview,\s*`refer`/);
  const specialistTemplate = await readFile(path.join(root, 'templates/workforce/agent.md'), 'utf8');
  assert.match(specialistTemplate, /Do not implement\s+until the resident confirms the in-scope plan/);
  assert.match(council, /starts the Engineering Manager automatically/);
  const inspector = await read('building-inspector');
  assert.match(inspector, /awaiting-merge\|awaiting-acceptance\|in-progress/);
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
  const permits = await readFile(path.join(root, 'templates/repository/.city/policies/building-permits.md'), 'utf8');
  const permitSkill = await readFile(path.join(root, 'skills/city-building-permits/SKILL.md'), 'utf8');
  assert.match(workforcePlanning, /if a work order requires specialized expertise and no active specialist has\s+it, that is a gap/i);
  assert.match(recruitment, /general capability alone does not count\s+as a fit/i);
  assert.match(delegation, /building a\s+React website requires React expertise/i);
  assert.match(permits, /For class-3 delivery, assess implementation staffing separately from statement\s+preparation/i);
  assert.match(permits, /read\/search-only specialist hired for pre-authorization\s+safety preparation cannot implement the work/i);
  assert.match(permitSkill, /For class-3 work, assess delivery staffing separately from statement\s+preparation/i);
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

test('shipped trust guidance relies on host permissions without seeking identity proof', async () => {
  const charter = await readFile(path.join(root, 'templates/repository/.city/charter.md'), 'utf8');
  const policy = await readFile(path.join(root, 'templates/repository/.city/policies/authority-and-policy.md'), 'utf8');
  const manager = await readFile(path.join(root, 'com.github.copilot/agents/city-manager.agent.md'), 'utf8');
  const delivery = await readFile(path.join(root, 'skills/city-delivery-authorization/SKILL.md'), 'utf8');
  assert.match(charter, /does not authenticate residents or seek identity proof/);
  assert.match(policy, /host and platform permissions/i);
  assert.match(policy, /does not itself establish a specific decision/);
  assert.match(manager, /never bypass a denial or invent a resident decision/);
  assert.match(delivery, /optional context, not identity proof/);
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
    ['Development Advisor', 'development-advisor.agent.md'],
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
  assert.match(charter, /thirteen pilot offices/);
  assert.doesNotMatch(charter, /public-information-officer\.agent\.md/, 'The optional officer is not a default appointment');
  assert.match(charter, /\(policies\/council-delegation\.md\)/);
  assert.match(charter, /resident remains sovereign/i);
  assert.match(charter, /final acceptance/i);
  for (const matter of reservedMatters) assert.match(charter, new RegExp(matter), `charter: ${matter}`);
  assert.doesNotMatch(charter, /paused in the first slice|First-slice boundary/);
});

test('all thirty skills are discoverable, substantive, and correctly scoped', async () => {
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
  const zoningDraft = await readFile(path.join(template, 'policy-drafts/zoning.md'), 'utf8');
  assert.match(zoningDraft, /Initialization status: Not adopted\./);
  const informationDraft = await readFile(path.join(template, 'policy-drafts/public-information.md'), 'utf8');
  assert.match(informationDraft, /Initialization status: Not adopted\./);
  assert.equal(existsSync(path.join(template, 'policies/public-information.md')), false);
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
  const assetSchema = await json('schemas/infrastructure-asset.schema.json');
  const programmeSchema = await json('schemas/infrastructure-programme.schema.json');
  assert.equal(assetSchema.additionalProperties, false);
  assert.equal(programmeSchema.additionalProperties, false);
  assert.deepEqual(orderSchema.allOf.find((entry) => entry.if.properties.schemaVersion.const === 3).then.required, ['infrastructure']);
  const requestSchema = await json('schemas/records-request.schema.json');
  assert.equal(requestSchema.additionalProperties, false);
  assert.deepEqual(requestSchema.required, [
    'schemaVersion', 'id', 'cityId', 'requestedBy', 'sourceOffice', 'purpose', 'relatedWorkOrderId',
    'items', 'status', 'createdAt', 'updatedAt', 'history', 'responses', 'provenance',
  ]);
  assert.deepEqual(requestSchema.properties.status.enum, ['open', 'resolved', 'cancelled']);
  const artifactSchema = await json('schemas/artifact.schema.json');
  assert.equal(artifactSchema.additionalProperties, false);
  assert.deepEqual(artifactSchema.properties.recordCategory.enum, [
    'working-draft', 'filed-work-product', 'proposed-instrument',
  ]);
  assert.equal(artifactSchema.required.includes('recordCategory'), false, 'legacy records remain schema-readable');
  const reviewSchema = await json('schemas/institutional-review.schema.json');
  assert.equal(reviewSchema.additionalProperties, false);
  assert.ok(reviewSchema.required.includes('triggers'));
  assert.ok(reviewSchema.required.includes('recommendations'));
  assert.deepEqual(reviewSchema.properties.recommendations.items.properties.route.enum, [
    'administrative', 'council', 'resident',
  ]);
});

test('all offices and generated engineers require durable document handoffs', async () => {
  for (const name of agentIds) {
    const contents = await readFile(path.join(root, `com.github.copilot/agents/${name}.agent.md`), 'utf8');
    const { metadata } = await customization(path.join(root, `com.github.copilot/agents/${name}.agent.md`));
    assert.match(contents, /city-records-capture\/SKILL\.md/, name);
    assert.match(contents, /persistence\s+pending|mark it pending/, name);
    if (metadata.tools.includes('execute')) {
      assert.match(contents, /artifact-record|artifact[\s-]+CLI|filing request/i, name);
    } else {
      assert.match(contents, /filing request/i, name);
    }
  }
  const generated = await readFile(path.join(root, 'templates/workforce/agent.md'), 'utf8');
  assert.match(generated, /{{ARTIFACT_CAPTURE}}/);
  assert.match(generated, /city-records-capture/);
  const workforce = await readFile(path.join(root, 'scripts/lib/workforce.mjs'), 'utf8');
  assert.match(workforce, /requisition\.tools\.includes\('execute'\)/);
  assert.match(workforce, /filing request/);
  assert.match(workforce, /active assignment explicitly authorizes changes/);
  assert.match(workforce, /You do not have `execute`/);
});

test('development contracts preserve compatible work orders and distinct professional roles', async () => {
  const { DEVELOPMENT_IMPACTS, DEVELOPMENT_ARTIFACTS } = await import('../scripts/lib/constants.mjs');
  const schema = await json('schemas/work-order.schema.json');
  assert.deepEqual(schema.properties.schemaVersion.enum, [1, 2, 3]);
  assert.equal(schema.required.includes('development'), false);
  assert.deepEqual(schema.$defs.development.required, ['screenings', 'applications', 'assessments']);
  assert.ok(schema.$defs.development.properties.zoningChecks);
  assert.deepEqual(schema.$defs.screening.properties.impacts.items.enum, DEVELOPMENT_IMPACTS);
  assert.deepEqual(schema.$defs.screening.properties.requirements.items.properties.kind.enum, DEVELOPMENT_ARTIFACTS);
  const policyPath = new RegExp(schema.$defs.screening.properties.policyCitations.items.properties.path.pattern, 'u');
  assert.equal(policyPath.test('policies/Website_API.v1.md'), true);
  for (const unsafe of ['../Website_API.v1.md', 'policies/../Website_API.v1.md', 'policies/nested/Website_API.v1.md']) {
    assert.equal(policyPath.test(unsafe), false);
  }
  for (const [kind, office] of [['screening', 'chief-planner'], ['application', 'development-advisor'], ['assessment', 'chief-planner']]) {
    assert.equal(schema.$defs[kind].additionalProperties, false);
    assert.equal(schema.$defs[kind].properties.sourceOffice.const, office);
    assert.equal(schema.$defs[kind].properties.authenticated.const, false);
  }
  const advisor = await customization(path.join(agentsPath, 'development-advisor.agent.md'));
  assert.deepEqual(advisor.metadata.tools, ['read', 'search', 'edit', 'execute', 'list_agents', 'write_agent']);
  assert.deepEqual(advisor.metadata.agents, []);
  assert.match(advisor.body, /independent Chief Planner/);
  assert.match(advisor.body, /through City Manager/);
  assert.match(advisor.body, /not an executed runtime/);
  assert.match(advisor.body, /gh repo view/);
  assert.match(advisor.body, /explicit GET/);
  assert.match(advisor.body, /does not authenticate the resident/);
  assert.match(advisor.body, /execute is not\s+a read-only sandbox/);
  assert.match(advisor.body, /including `--apply`/);
  const planner = await customization(path.join(agentsPath, 'chief-planner.agent.md'));
  assert.deepEqual(planner.metadata.agents, []);
  assert.match(planner.body, /gh repo view/);
  assert.match(planner.body, /explicit GET/);
  assert.match(planner.body, /does not authenticate the resident/);
  assert.match(planner.body, /execute is not\s+a read-only sandbox/);
  assert.match(planner.body, /including `--apply`/);
  assert.match(planner.body, /Records Officer for persistence, directly when available/);
  const policy = await readFile(path.join(root, 'templates/repository/.city/policies/development-applications.md'), 'utf8');
  assert.match(policy, /Ordinary new features/);
  assert.match(policy, /never silently\s+waive/);
  assert.match(policy, /needs-clarification/);
});

test('Advisor prepares evidence-based plans and addresses class-3 revision findings', async () => {
  const advisor = await readFile(path.join(agentsPath, 'development-advisor.agent.md'), 'utf8');
  const skill = await readFile(path.join(root, 'skills/city-development-applications/SKILL.md'), 'utf8');
  assert.match(advisor, /prior applications, Planner findings, resident decisions and\s+current permit statements/);
  assert.match(advisor, /do not repeatedly ask for an\s+already recorded choice/);
  assert.match(skill, /requirement-by-requirement working matrix/);
  assert.match(skill, /Cross-reference each prior\s+Planner finding/);
  assert.match(skill, /referenced findings are\s+unavailable, report the blocker/);
  assert.match(skill, /affected components and boundaries,[\s\S]*acceptance criteria,[\s\S]*recovery/);
  assert.match(skill, /current-screening qualified statement[\s\S]*class 4, independent\s+verification/);
  assert.match(skill, /statement is separate from application studies and independent Planner\s+assessment/);
  assert.match(skill, /undetermined conclusion is not itself a clearance failure or\s+proof of safety/);
  assert.match(skill, /empirical checks must await separately authorized delivery/);
  assert.match(skill, /Do not demand unauthorized\s+production work/);
  assert.match(skill, /precise blockers rather than cycling an unchanged incomplete packet/);
});

test('Planner batches identifiable revision findings without masking review limits', async () => {
  const planner = await readFile(path.join(agentsPath, 'chief-planner.agent.md'), 'utf8');
  const skill = await readFile(path.join(root, 'skills/city-development-applications/SKILL.md'), 'utf8');
  const assessment = skill.split('## Chief Planner: independent assessment')[1].split('## Persistence')[0];
  assert.match(planner, /review the whole\s+available packet[\s\S]*all currently identifiable material deficiencies\s+together/);
  assert.match(assessment, /Do not stop at the first deficiency/);
  assert.match(assessment, /applicable requirement, specific gap, evidence and next action or owner/);
  assert.match(assessment, /areas that cannot yet be assessed and their\s+dependencies/);
  assert.match(assessment, /New findings may arise from changed context or evidence/);
  assert.match(assessment, /resident interaction may still ask one\s+focused question at a time/);
  assert.match(assessment, /`reason` is exposed in status[\s\S]*actual saved\s+ID\/path/);
  assert.match(assessment, /Do not\s+silently omit findings/);
});

test('Advisor and Manager invite useful resident input on blockers without assuming consent', async () => {
  const advisor = await readFile(path.join(agentsPath, 'development-advisor.agent.md'), 'utf8');
  const skill = await readFile(path.join(root, 'skills/city-development-applications/SKILL.md'), 'utf8');
  const manager = await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8');
  const coordination = await readFile(path.join(root, 'skills/city-interdepartmental-coordination/SKILL.md'), 'utf8');
  assert.match(advisor, /resident input could materially help even if not strictly\s+necessary/);
  assert.match(advisor, /retaining the original goal where feasible/);
  assert.match(advisor, /return the exact resident question[\s\S]*ask the question in that\s+interaction/);
  assert.match(skill, /even when city investigation\s+could also continue/);
  assert.match(skill, /Distinguish optional help from a required decision/);
  assert.match(manager, /do not say\s+no input is needed merely because the resident has no mandatory decision/);
  assert.match(manager, /Continue authorized independent work without waiting for\s+optional input/);
  assert.match(coordination, /if contact\s+is unavailable, report the question and limitation/);
  assert.match(advisor, /Do not frame optional input as a requirement or infer\s+consent/);
});

test('work-order delegate reuse is scoped and does not replace durable handoffs', async () => {
  const manager = await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8');
  const coordination = await readFile(path.join(root, 'skills/city-interdepartmental-coordination/SKILL.md'), 'utf8');
  assert.match(manager, /track each actual delegate handle by selected root, work-order ID and\s+office/);
  assert.match(manager, /message that existing delegate if the host supports it/);
  assert.match(manager, /Do not\s+reuse a delegate for another work order or office/);
  assert.match(manager, /if delivery is uncertain, do not resend or dispatch a duplicate/);
  assert.match(manager, /Do not assume message acceptance means the task\s+was performed/);
  assert.match(coordination, /never treat a handle or accepted message as a durable record or a completed\s+handoff/);
  assert.match(coordination, /Any participating office may communicate directly with any other available peer/);
  assert.match(coordination, /If direct messaging or a peer is unavailable, return the request to City Manager/);
  assert.match(coordination, /A message is not a decision, authentication, authority\s+to act, or a filed record/);
  assert.match(coordination, /Existing\s+charters and policies may require Manager routing; follow those requirements\s+until properly amended/);
  assert.match(manager, /actual same-case office\/handle mapping/);
});

test('intake and handoffs preserve outcomes and promptly relay required choices', async () => {
  const petition = await readFile(path.join(root, 'skills/city-petition/SKILL.md'), 'utf8');
  const manager = await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8');
  const records = await readFile(path.join(agentsPath, 'records-officer.agent.md'), 'utf8');
  const development = await readFile(path.join(root, 'skills/city-development-applications/SKILL.md'), 'utf8');
  assert.match(petition, /request for publication must not become merely suitability for publication/);
  assert.match(petition, /`petition-revise --root[\s\S]*obtain confirmation/);
  assert.match(manager, /relay it immediately\s+before filing or assessing/);
  assert.match(manager, /unfiled draft is not missing canonical evidence/);
  assert.match(records, /Do not require a separate canonical\s+artifact or repeat confirmation/);
  assert.match(development, /small static page[\s\S]*remains formal where adopted policy says so/);
  assert.match(development, /`--expected-snapshot`[\s\S]*one canonical checkout/);
});

test('development coordination continues through persisted independent assessment', async () => {
  const manager = await readFile(path.join(agentsPath, 'city-manager.agent.md'), 'utf8');
  assert.match(manager, /Continue the handoff in this run/);
  assert.match(manager, /request a fresh `status` for the same case/);
  assert.match(manager, /after an Advisor application is persisted, send its actual\s+revision[\s\S]*to Chief Planner for independent\s+assessment/i);
  assert.match(manager, /persist the Planner's finding and recheck status/);
  assert.match(manager, /not two sequential lifecycle handoffs/);
  assert.match(manager, /Stop for a real resident choice or required confirmation/);
  assert.match(manager, /Do not retry an unchanged\s+failing step/);

  const records = await readFile(path.join(agentsPath, 'records-officer.agent.md'), 'utf8');
  assert.match(records, /On a case participant's request, run the packaged CLI `status`/);
  assert.match(records, /node "<installed-plugin>\/scripts\/city\.mjs"/);
  assert.match(records, /does not provide a `city` command\s+on PATH/);
  assert.match(records, /read-only `validate`\s+command is also permitted for the selected root/);
  assert.match(records, /`status`, `validate`, and records commands/);
  assert.match(records, /successful preview reports\s+`validation: "passed"`[\s\S]*`recordSummary`/);
  assert.match(records, /separate `validate` command is not a prerequisite/);
  assert.match(records, /exact command and error when a check or write fails/);
  assert.match(records, /append revisions; they do not amend an existing screening or\s+statement/);
  assert.match(records, /do not file a duplicate artifact/i);
  const recordsSkill = await readFile(path.join(root, 'skills/city-records-management/SKILL.md'), 'utf8');
  assert.match(recordsSkill, /read-only `validate` for the exact selected root/);
  assert.match(recordsSkill, /separate `validate` command is not a prerequisite/);
  const advisor = await readFile(path.join(agentsPath, 'development-advisor.agent.md'), 'utf8');
  assert.match(advisor, /interim handoff, not a request for the resident/);
  assert.match(advisor, /invoked without an available peer or coordinating caller[\s\S]*do not claim a handoff happened/);
  const coordination = await readFile(path.join(root, 'skills/city-interdepartmental-coordination/SKILL.md'), 'utf8');
  assert.match(coordination, /A next-actor\s+message alone is not a handoff/);
});

test('zoning schema keeps change rules separate from project and district records', async () => {
  const { ZONING_CHANGE_TYPES } = await import('../scripts/lib/constants.mjs');
  const schema = await json('schemas/zoning.schema.json');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ['schemaVersion', 'zones']);
  assert.deepEqual(schema.properties.zones.items.properties.rules.items.properties.changeType.enum, ZONING_CHANGE_TYPES);
  assert.deepEqual(schema.properties.zones.items.properties.rules.items.properties.disposition.enum, [
    'permitted', 'conditional', 'prohibited',
  ]);
  const zoning = await readFile(path.join(root, 'templates/repository/.city/policy-drafts/zoning.md'), 'utf8');
  assert.match(zoning, /separate from project delivery scope and\s+district ownership/);
  assert.match(zoning, /not a team, permission boundary/);
  assert.match(zoning, /copy this draft to\s+`\.city\/policies\/zoning\.md`/);
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
    'docs/development-applications.md',
    'docs/zoning.md',
    'docs/public-information.md',
    'docs/infrastructure-plan.md',
    'skills/city-asset-management/SKILL.md',
    'templates/repository/.city/charter.md',
    'templates/repository/.city/instruction-fragment.md',
    'templates/repository/.city/policy-drafts/zoning.md',
    'templates/repository/.city/policy-drafts/public-information.md',
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
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd pack --dry-run --json --ignore-scripts']
    : ['pack', '--dry-run', '--json', '--ignore-scripts'];
  const packed = JSON.parse(execFileSync(command, args, {
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
    'scripts/lib/development.mjs',
    'scripts/lib/zoning.mjs',
    'schemas/zoning.schema.json',
    'schemas/projects.schema.json',
    'schemas/infrastructure-asset.schema.json',
    'schemas/infrastructure-programme.schema.json',
    'schemas/records-request.schema.json',
    'schemas/artifact.schema.json',
    'schemas/requisition.schema.json',
    'schemas/staff.schema.json',
    'schemas/assignment.schema.json',
    'schemas/institutional-review.schema.json',
    'templates/repository/.city/charter.md',
    'templates/repository/.city/instruction-fragment.md',
    'templates/repository/.city/projects.json',
    'templates/repository/.city/policy-drafts/zoning.md',
    'templates/repository/.city/policy-drafts/public-information.md',
    'templates/workforce/agent.md',
    'templates/workforce/skill.md',
    'templates/workforce/practice.md',
    'templates/workforce/run-checks.mjs',
    ...policyTemplates.map((name) => `templates/repository/.city/policies/${name}.md`),
    'docs/governance.md',
    'docs/compatibility.md',
    'docs/development-applications.md',
    'docs/zoning.md',
    'docs/infrastructure-plan.md',
    'docs/artifact-library.md',
    'docs/public-information.md',
    ...agentIds.map((id) => `com.github.copilot/agents/${id}.agent.md`),
    ...[...professionalSkills, ...residentSkills].map((name) => `skills/${name}/SKILL.md`),
  ]) {
    assert.ok(files.has(required), `Missing packaged asset: ${required}`);
  }
  for (const filename of files) {
    assert.doesNotMatch(filename, /^(node_modules|\.vscode|\.city|tests)\//, filename);
  }
});
