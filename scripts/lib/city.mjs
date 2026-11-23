import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  AUTHORIZATION_OUTCOMES, COMMAND_ONLY_STATES, CONFIG_SCHEMA_VERSION, DECIDERS, DELEGATION_POLICY,
  DELIVERY_DECISION_SCHEMA_VERSION, DRAFT_NOTICE, EVIDENCE_RULE, LEGACY_CONFIG_SCHEMA_VERSION, LIMITS,
  INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION,
  INSTITUTIONAL_REVIEW_POLICY, INSTITUTIONAL_REVIEW_TRIGGERS,
  DEVELOPMENT_POLICY, PERMIT_COMMENCEMENT_DAYS, PERMIT_INACTIVITY_DAYS, PERMIT_MAX_EXTENSIONS,
  OUTCOME_STATES, PLUGIN, RECORDS_REQUEST_SCHEMA_VERSION, ROUTINE_CLASSES, SCHEMA_VERSION, STATUSES,
  WORK_ORDER_PART_SCHEMA_VERSION, WORK_ORDER_SCHEMA_VERSION,
  governanceNotice, provenance,
} from './constants.mjs';
import { CityError, fail } from './errors.mjs';
import {
  assertIdentity, atomicCityFile, atomicConfig, atomicRecord, directory, encodeJSON, entries, ensureDirectories, inspect,
  publishCity, readRegular, regularFile, removeOwnedFile, rootDirectory, withMutationLock,
} from './filesystem.mjs';
import {
  authorizationCurrent, calendarDate, CANONICAL_RECORD_TYPES, checkTransition, parseJSON, parseReserved,
  RECORD_EXCHANGE_TYPES, text,
  validateConfig, validateDecision, validateDistricts, validateInstitutionalReview, validateOrderId,
  validateProjects, validateRecordId, validateRecordsRequest, validateState, validateWorkOrder,
  validateDevelopmentInput, applicationMissing, validateZoningMap, validateZoningCheckInput,
  validateInfrastructureWorkScope,
  validateArtifact, validateArtifactInput,
  DEVELOPMENT_KINDS, MAX_WORK_ORDER_PARTS, validateStoredWorkOrder, validateWorkOrderPart, workOrderPartId,
} from './validation.mjs';
import { currentAssignments, readWorkforceRecords, workforceStatus } from './workforce.mjs';
import {
  assertDevelopmentReady, currentScreening, currentStatement, developmentPreparationAllowed, developmentSnapshot, developmentStatus,
  permitPolicyEnabled,
} from './development.mjs';
import {
  assertInfrastructureScopeCurrent, assertInfrastructureTargets, infrastructureSecurityFinding,
  infrastructurePathWithin, infrastructurePolicyEnabled, infrastructureStatus, validateInfrastructureAsset,
  validateInfrastructureProgramme,
} from './infrastructure.mjs';
import {
  assessZoning, currentZoningCheck, zoningEnabled, zoningSnapshot, zoningStatus,
} from './zoning.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const dayMilliseconds = 24 * 60 * 60 * 1000;
const institutionalReviewUnits = Object.freeze({
  'periodic-volume': 'completed work orders',
  'periodic-time': 'elapsed days',
  'returned-or-rejected': 'council returns or rejections',
  'inspection-failures': 'inspection returns to in-progress',
  referrals: 'council referrals',
  blocked: 'work orders entering blocked',
});

async function governanceLayout(cityPath) {
  await regularFile(path.join(cityPath, 'charter.md'), 'City draft charter');
  await regularFile(path.join(cityPath, 'instruction-fragment.md'), 'City instruction fragment');
  const policyPath = path.join(cityPath, 'policies');
  const policyIdentity = await directory(policyPath, 'City policies');
  const policies = await entries(policyPath, 'City policies');
  if (policies.length === 0) fail('INVALID_CITY', 'City draft policies are missing. Restore or repair the governance templates.');
  for (const name of policies) {
    if (!name.endsWith('.md')) fail('INVALID_CITY', 'City policies must contain only regular Markdown policy files.');
    await regularFile(path.join(policyPath, name), 'City policy');
  }
  await assertIdentity(policyPath, policyIdentity, 'City policies');
}

async function governanceDigests(cityPath) {
  const charter = await readRegular(path.join(cityPath, 'charter.md'), 'City charter');
  const policyPath = path.join(cityPath, 'policies');
  const policies = [];
  for (const name of await entries(policyPath, 'City policies')) {
    const source = await readRegular(path.join(policyPath, name), 'City policy');
    policies.push({ path: `policies/${name}`, sha256: sha256(source.bytes) });
  }
  return { charter: sha256(charter.bytes), policies };
}

// Reported, never enforced: blocking on drift would let any later amendment lock the repository via the hook.
function adoptionDrift(adoption, digests) {
  const adopted = new Map(adoption.policies.map((policy) => [policy.path, policy.sha256]));
  const current = new Map(digests.policies.map((policy) => [policy.path, policy.sha256]));
  const changedPolicies = [...new Set([...adopted.keys(), ...current.keys()])].sort()
    .filter((name) => adopted.get(name) !== current.get(name));
  const charterMatches = adoption.charter.sha256 === digests.charter;
  return { matchesAdoptedRevision: charterMatches && changedPolicies.length === 0, charterMatches, changedPolicies };
}

async function readRecords(cityPath, name, validator, cityId, optional = false) {
  const location = path.join(cityPath, name);
  if (optional && !(await inspect(location))) return { records: new Map(), identity: null };
  const identity = await directory(location, `City ${name}`);
  const names = await entries(location, `City ${name}`);
  const records = new Map();
  for (const filename of names) {
    if (!filename.endsWith('.json')) {
      fail('INVALID_RECORD', `City ${name} contains an unrecognized record file. Inspect and repair it; no files are silently skipped.`);
    }
    const source = await readRegular(path.join(location, filename), `City ${name} record`);
    const record = validator(parseJSON(source.bytes, `City ${name} record`), cityId);
    if (`${record.id}.json` !== filename || records.has(record.id)) {
      fail('INVALID_RECORD', `City ${name} record filename must match its unique safe ID.`);
    }
    records.set(record.id, { value: record, bytes: source.bytes });
  }
  await assertIdentity(location, identity, `City ${name}`);
  if (JSON.stringify(await entries(location, `City ${name}`)) !== JSON.stringify(names)) {
    fail('CONFLICT', `City ${name} changed during validation. Inspect concurrent edits and retry.`);
  }
  return { records, identity };
}

// Reassembles each case file from its closed parts and open live file, then validates the whole record.
function assembleWorkOrders(orders, parts, cityId) {
  for (const { value: part } of parts.values()) {
    if (!orders.get(part.workOrderId)?.value.fileParts?.some((reference) => reference.id === part.id)) {
      fail('INVALID_RECORD', `Work-order file part .city/work-order-parts/${part.id}.json is not listed in its work order's fileParts manifest. It may remain from an interrupted file-part-close: confirm the work order still holds the full open record, then remove the unlisted part file or restore both records from backup. No part is silently ignored.`);
    }
  }
  for (const entry of orders.values()) {
    const stored = entry.value;
    entry.stored = stored;
    entry.parts = [];
    if (!stored.fileParts) continue;
    const history = [];
    const development = {};
    let previous = null;
    let previousClosedAt = stored.createdAt;
    for (const [index, reference] of stored.fileParts.entries()) {
      const part = parts.get(reference.id);
      if (!part) {
        fail('INVALID_RECORD', `Work order ${stored.id} lists missing file part ${reference.id}. Restore .city/work-order-parts/${reference.id}.json from backup; the case file cannot be assembled without it.`);
      }
      const digest = sha256(part.bytes);
      if (digest !== reference.sha256) {
        fail('INVALID_RECORD', `Work-order file part ${reference.id} does not match the SHA-256 recorded in its work order. Closed file parts are immutable; restore the original part from backup.`);
      }
      if (part.value.part !== index + 1 || part.value.previousPartSha256 !== previous
        || part.value.closedAt < previousClosedAt) {
        fail('INVALID_RECORD', `Work-order file part ${reference.id} breaks the part chain or chronology. Restore the original parts from backup.`);
      }
      history.push(...part.value.contents.history);
      for (const [kind, records] of Object.entries(part.value.contents.development)) {
        (development[kind] ??= []).push(...records);
      }
      previous = digest;
      previousClosedAt = part.value.closedAt;
      entry.parts.push(part);
    }
    history.push(...stored.history);
    for (const [kind, records] of Object.entries(stored.development ?? {})) (development[kind] ??= []).push(...records);
    const kinds = DEVELOPMENT_KINDS.filter((kind) => Object.hasOwn(development, kind));
    const logical = { ...stored, history };
    if (kinds.length) logical.development = Object.fromEntries(kinds.map((kind) => [kind, development[kind]]));
    entry.value = validateWorkOrder(logical, cityId);
  }
}

const sameJSON = (first, second) => JSON.stringify(first) === JSON.stringify(second);

// Returns the live-file form of a full case file: closed parts stay immutable and only the open portion is written.
function storedWorkOrder(workOrder, parts) {
  const manifest = parts.map(({ value, bytes }) => ({ id: value.id, sha256: sha256(bytes) }));
  if (!sameJSON(workOrder.fileParts ?? [], manifest)) {
    fail('CONFLICT', 'The work-order file part manifest changed since validation. Reload the case file and retry.');
  }
  if (parts.length === 0) return workOrder;
  const closedHistory = parts.flatMap(({ value }) => value.contents.history);
  if (!sameJSON(workOrder.history.slice(0, closedHistory.length), closedHistory)) {
    fail('CLOSED_FILE_PART', 'The proposed change would alter history held in a closed work-order file part. Closed parts are immutable; append a new entry instead.');
  }
  const stored = { ...workOrder, history: workOrder.history.slice(closedHistory.length) };
  for (const kind of DEVELOPMENT_KINDS) {
    const closed = parts.flatMap(({ value }) => value.contents.development[kind] ?? []);
    const records = workOrder.development?.[kind];
    if (!records && closed.length === 0) continue;
    if (!records || !sameJSON(records.slice(0, closed.length), closed)) {
      fail('CLOSED_FILE_PART', 'The proposed change would alter development revisions held in a closed work-order file part. Closed parts are immutable; append a new revision instead.');
    }
  }
  if (workOrder.development) {
    stored.development = Object.fromEntries(Object.entries(workOrder.development).map(([kind, records]) => [
      kind, records.slice(parts.reduce((sum, { value }) => sum + (value.contents.development[kind]?.length ?? 0), 0)),
    ]));
  }
  return stored;
}

// Prepares the live file for a proposed case file and reports capacity explicitly instead of truncating anything.
function preparedWorkOrder(workOrder, original) {
  const stored = storedWorkOrder(workOrder, original?.parts ?? []);
  const bytes = Buffer.byteLength(encodeJSON(stored));
  if (bytes > LIMITS.fileBytes) {
    const current = original ? ` (currently ${original.bytes.length} bytes)` : '';
    const remedy = original
      ? ` Close the current file part with file-part-close --id ${workOrder.id} --reason TEXT, then retry; the closed part keeps the full history and revisions unchanged.`
      : '';
    fail('SIZE_LIMIT', `The proposed work-order file .city/work-orders/${workOrder.id}.json would be ${bytes} bytes, above the ${LIMITS.fileBytes}-byte per-file limit${current}. No record was written.${remedy}`);
  }
  return stored;
}

export async function loadCity(root, required = true) {
  const cityPath = path.join(root, '.city');
  const found = await inspect(cityPath);
  if (!found) {
    if (required) fail('NOT_ENROLLED', 'City is not initialized. Review an init dry-run before explicitly requesting --apply.');
    return null;
  }
  const identity = await directory(cityPath, 'City directory');
  const configSource = await readRegular(path.join(cityPath, 'config.json'), 'City config');
  const config = validateConfig(parseJSON(configSource.bytes, 'City config'));
  const districtsSource = await readRegular(path.join(cityPath, 'districts.json'), 'City districts');
  const districts = validateDistricts(parseJSON(districtsSource.bytes, 'City districts'));
  const projectsPath = path.join(cityPath, 'projects.json');
  const projectsInfo = await inspect(projectsPath);
  const projectsSource = projectsInfo
    ? await readRegular(projectsPath, 'City projects')
    : null;
  const projectsBytes = projectsSource?.bytes ?? null;
  const projects = validateProjects(projectsSource
    ? parseJSON(projectsSource.bytes, 'City projects')
    : { schemaVersion: SCHEMA_VERSION, projects: [] });
  await assertProjectPaths(root, projects);
  const zoningPath = path.join(cityPath, 'zoning.json');
  const zoningInfo = await inspect(zoningPath);
  const zoningSource = zoningInfo ? await readRegular(zoningPath, 'City zoning map') : null;
  const zoning = zoningSource ? validateZoningMap(parseJSON(zoningSource.bytes, 'City zoning map')) : null;
  await governanceLayout(cityPath);
  const currentGovernanceDigests = await governanceDigests(cityPath);
  const drift = config.governance === 'adopted' ? adoptionDrift(config.adoption, currentGovernanceDigests) : null;
  const orders = await readRecords(cityPath, 'work-orders', validateStoredWorkOrder, config.cityId, true);
  const orderParts = await readRecords(cityPath, 'work-order-parts', validateWorkOrderPart, config.cityId, true);
  assembleWorkOrders(orders.records, orderParts.records, config.cityId);
  const decisions = await readRecords(cityPath, 'decisions', validateDecision, config.cityId, true);
  const recordsRequests = await readRecords(
    cityPath, 'records-requests', validateRecordsRequest, config.cityId, true,
  );
  const institutionalReviews = await readRecords(
    cityPath, 'institutional-reviews', validateInstitutionalReview, config.cityId, true,
  );
  const artifacts = await readRecords(cityPath, 'artifacts', validateArtifact, config.cityId, true);
  for (const { value: artifact } of artifacts.records.values()) {
    if (artifact.workOrderId && !orders.records.has(artifact.workOrderId)) {
      fail('INVALID_RECORD', 'Artifact references a missing work order.');
    }
    if (artifact.supersedes) {
      const previous = artifacts.records.get(artifact.supersedes)?.value;
      if (!previous || previous.workOrderId !== artifact.workOrderId
        || Date.parse(previous.createdAt) >= Date.parse(artifact.createdAt)) {
        fail('INVALID_RECORD', 'Artifact must supersede an earlier artifact for the same work order.');
      }
    }
  }
  for (const { value: order } of orders.records.values()) {
    for (const statement of order.development?.statements ?? []) {
      if (statement.evidenceArtifactId
        && artifacts.records.get(statement.evidenceArtifactId)?.value.workOrderId !== order.id) {
        fail('INVALID_RECORD', 'Permit statement evidenceArtifactId must reference an artifact filed for the same work order.');
      }
    }
  }
  const infrastructureRoot = path.join(cityPath, 'infrastructure');
  const infrastructureRootInfo = await inspect(infrastructureRoot);
  if (infrastructureRootInfo && (!infrastructureRootInfo.isDirectory() || infrastructureRootInfo.isSymbolicLink())) {
    fail('UNSAFE_PATH', 'City infrastructure state must be a regular directory, not a symlink.');
  }
  const infrastructureAssets = await readRecords(
    cityPath, 'infrastructure/assets', validateInfrastructureAsset, config.cityId, true,
  );
  let infrastructureProgramme = null;
  let infrastructureProgrammePath = null;
  if (infrastructureRootInfo) {
    infrastructureProgrammePath = path.join(infrastructureRoot, 'programme.json');
    const programmeInfo = await inspect(infrastructureProgrammePath);
    if (programmeInfo) {
      const source = await readRegular(infrastructureProgrammePath, 'Infrastructure programme');
      infrastructureProgramme = {
        value: validateInfrastructureProgramme(parseJSON(source.bytes, 'Infrastructure programme'), config.cityId),
        bytes: source.bytes,
        identity: source.info,
      };
    }
  }
  const institutionalReviewPolicyPath = path.join(cityPath, INSTITUTIONAL_REVIEW_POLICY);
  const institutionalReviewPolicy = await inspect(institutionalReviewPolicyPath)
    ? (await readRegular(institutionalReviewPolicyPath, 'Institutional review policy')).bytes.toString('utf8')
    : null;
  const workforce = await readWorkforceRecords(root, cityPath, config.cityId, orders.records);
  const projectIds = new Set(projects.projects.map((project) => project.id));
  const assetIds = new Set(infrastructureAssets.records.keys());
  for (const { value: asset } of infrastructureAssets.records.values()) {
    if (asset.projectIds.some((id) => !projectIds.has(id))) {
      fail('INVALID_RECORD', 'Infrastructure asset references a missing project.');
    }
    if (asset.dependencies.some((id) => !assetIds.has(id))) {
      fail('INVALID_RECORD', 'Infrastructure asset references a missing dependency.');
    }
  }
  for (const { value: asset } of infrastructureAssets.records.values()) {
    for (const dependency of asset.dependencies) {
      if (infrastructureAssets.records.get(dependency).value.dependencies.includes(asset.id)) {
        fail('INVALID_RECORD', 'Infrastructure asset dependency cycle must be resolved explicitly.');
      }
    }
  }
  const visitedAssets = new Set();
  const activeAssets = new Set();
  const visitAsset = (id) => {
    if (activeAssets.has(id)) fail('INVALID_RECORD', 'Infrastructure asset dependency cycle must be resolved explicitly.');
    if (visitedAssets.has(id)) return;
    activeAssets.add(id);
    for (const dependency of infrastructureAssets.records.get(id).value.dependencies) visitAsset(dependency);
    activeAssets.delete(id);
    visitedAssets.add(id);
  };
  for (const id of assetIds) visitAsset(id);
  for (const { value: order } of orders.records.values()) {
    if (order.projectIds?.some((id) => !projectIds.has(id))) {
      fail('INVALID_RECORD', 'City work order references a missing project. Restore or repair its local references.');
    }
    if (order.development?.screenings.some((screening) => screening.projectIds.some((id) => !projectIds.has(id)))) {
      fail('INVALID_RECORD', 'Development screening references a missing registered project.');
    }
    if (order.schemaVersion === INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION) {
      for (const pin of order.infrastructure.assets) {
        const asset = infrastructureAssets.records.get(pin.assetId)?.value;
        if (!asset || pin.revision > asset.revision) {
          fail('INVALID_RECORD', 'Infrastructure work order references a missing asset or a future asset revision.');
        }
      }
      for (const target of order.infrastructure.targets) {
        const asset = infrastructureAssets.records.get(target.assetId)?.value;
        if (!asset) fail('INVALID_RECORD', 'Infrastructure work order references a missing target asset.');
        const pin = order.infrastructure.assets.find((item) => item.assetId === target.assetId);
        const locatorMatches = pin.locators.some((locator) => infrastructurePathWithin(locator, target.path));
        if (!locatorMatches) fail('INVALID_RECORD', 'Infrastructure work-order target is outside the registered asset locators.');
      }
      for (const obligation of order.infrastructure.obligations) {
        const asset = infrastructureAssets.records.get(obligation.assetId)?.value;
        if (!asset?.obligations.some((item) => item.id === obligation.obligationId)) {
          fail('INVALID_RECORD', 'Infrastructure work order references a missing maintenance obligation.');
        }
      }
      for (const reference of order.infrastructure.findings) {
        const asset = infrastructureAssets.records.get(reference.assetId)?.value;
        if (!asset?.findings.some((item) => item.id === reference.findingId)) {
          fail('INVALID_RECORD', 'Infrastructure work order references a missing finding.');
        }
      }
      await assertInfrastructureTargets(root, order.infrastructure, infrastructureAssets.records);
    }
  }
  if (infrastructureProgramme) {
    for (const pin of infrastructureProgramme.value.assets) {
      const asset = infrastructureAssets.records.get(pin.assetId)?.value;
      if (!asset || pin.revision > asset.revision) fail('INVALID_RECORD', 'Infrastructure programme references a missing asset or future revision.');
    }
    for (const activity of infrastructureProgramme.value.activities) {
      if (activity.workOrderId && !orders.records.has(activity.workOrderId)) {
        fail('INVALID_RECORD', 'Infrastructure programme activity references a missing work order.');
      }
    }
  }
  for (const { value: asset } of infrastructureAssets.records.values()) {
    for (const obligation of asset.obligations) {
      for (const entry of obligation.history) {
        if (entry.workOrderId && !orders.records.has(entry.workOrderId)) {
          fail('INVALID_RECORD', 'Infrastructure obligation history references a missing work order.');
        }
      }
    }
    for (const finding of asset.findings) {
      if (finding.workOrderId && !orders.records.has(finding.workOrderId)) {
        fail('INVALID_RECORD', 'Infrastructure finding references a missing work order.');
      }
    }
  }
  for (const { value: decision } of decisions.records.values()) {
    if (decision.workOrderIds.some((id) => !orders.records.has(id))) {
      fail('INVALID_RECORD', 'City decision references a missing work order. Restore or repair its local references.');
    }
  }
  for (const { value: request } of recordsRequests.records.values()) {
    if (request.relatedWorkOrderId && !orders.records.has(request.relatedWorkOrderId)) {
      fail('INVALID_RECORD', 'City records request references a missing work order. Restore or repair its local references.');
    }
  }
  checkDecisionLinkage(orders.records, decisions.records);
  await assertIdentity(cityPath, identity, 'City directory');
  await assertIdentity(path.join(cityPath, 'config.json'), configSource.info, 'City config');
  await assertIdentity(path.join(cityPath, 'districts.json'), districtsSource.info, 'City districts');
  if (projectsSource) await assertIdentity(projectsPath, projectsSource.info, 'City projects');
  if (zoningSource) await assertIdentity(zoningPath, zoningSource.info, 'City zoning map');
  if (infrastructureRootInfo) {
    await assertIdentity(infrastructureRoot, infrastructureRootInfo, 'City infrastructure');
    if (infrastructureProgramme) {
      await assertIdentity(infrastructureProgrammePath, infrastructureProgramme.identity, 'Infrastructure programme');
    }
  }
  return {
    root, path: cityPath, identity, config, configBytes: configSource.bytes,
    districts, districtsBytes: districtsSource.bytes, projects, projectsBytes, drift,
    zoning, zoningBytes: zoningSource?.bytes ?? null,
    governanceDigests: currentGovernanceDigests,
    workOrders: orders.records,
    workOrderParts: orderParts.records,
    decisions: decisions.records,
    recordsRequests: recordsRequests.records,
    institutionalReviews: institutionalReviews.records,
    artifacts: artifacts.records,
    infrastructure: {
      assets: infrastructureAssets.records,
      programme: infrastructureProgramme,
      rootIdentity: infrastructureRootInfo,
    },
    institutionalReviewPolicy,
    workforce,
    directoryIdentities: {
      'work-orders': orders.identity, decisions: decisions.identity,
      'work-order-parts': orderParts.identity,
      'records-requests': recordsRequests.identity,
      'institutional-reviews': institutionalReviews.identity,
      artifacts: artifacts.identity,
      'infrastructure/assets': infrastructureAssets.identity,
      ...(infrastructureRootInfo ? { infrastructure: infrastructureRootInfo } : {}),
      ...workforce.directoryIdentities,
    },
  };
}

async function assertProjectPaths(root, projects) {
  for (const project of projects.projects) {
    let current = root;
    for (const segment of project.path.split('/')) {
      current = path.join(current, segment);
      const info = await inspect(current);
      if (!info) break;
      if (info.isSymbolicLink()) {
        fail('UNSAFE_PATH', 'City project directories and their existing parents must not be symlinks.');
      }
      if (!info.isDirectory()) {
        fail('INVALID_RECORD', 'An existing city project path component is not a directory.');
      }
    }
  }
}

const DECISION_FROM = Object.freeze({
  authorize: 'awaiting-approval', reject: 'awaiting-approval', return: 'awaiting-approval', accept: 'awaiting-merge',
});
const LINKED_ENTRIES = Object.freeze({ authorized: 'authorize', completed: 'accept' });
const linkKey = (orderId, timestamp, state) => `${orderId}\n${timestamp}\n${state}`;

// Delivery decisions and work-order history must corroborate each other; neither can be forged alone.
function checkDecisionLinkage(orders, decisions) {
  const links = new Set();
  for (const { value: decision } of decisions.values()) {
    if (decision.schemaVersion !== DELIVERY_DECISION_SCHEMA_VERSION) continue;
    const order = orders.get(decision.workOrderIds[0]).value;
    const state = OUTCOME_STATES[decision.outcome];
    if (state === null) {
      const awaiting = order.history.some((entry, index) => entry.to === 'awaiting-approval'
        && entry.timestamp <= decision.createdAt
        && (index + 1 === order.history.length || order.history[index + 1].timestamp >= decision.createdAt));
      if (!awaiting) {
        fail('INVALID_RECORD', 'City referral decision does not match a period when its work order was awaiting approval. Restore or repair the linked records.');
      }
      continue;
    }
    const matches = order.history.filter((entry) => entry.from === DECISION_FROM[decision.outcome]
      && entry.to === state && entry.timestamp === decision.createdAt);
    const key = linkKey(order.id, decision.createdAt, state);
    if (matches.length !== 1 || links.has(key)) {
      fail('INVALID_RECORD', 'City delivery decision does not match exactly one work-order history entry with the same timestamp and outcome. Restore or repair the linked records.');
    }
    links.add(key);
  }
  for (const { value: order } of orders.values()) {
    for (const entry of order.history) {
      if (Object.hasOwn(LINKED_ENTRIES, entry.to) && !links.has(linkKey(order.id, entry.timestamp, entry.to))) {
        fail('INVALID_RECORD', 'City work-order history enters authorized or completed without a matching decision record. Restore or repair the linked records.');
      }
    }
  }
}

function deliveryDecisions(city, orderId) {
  return [...city.decisions.values()].map(({ value }) => value)
    .filter((decision) => decision.schemaVersion === DELIVERY_DECISION_SCHEMA_VERSION && decision.workOrderIds[0] === orderId)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id));
}

export function permitStatus(city, order, now = new Date()) {
  const authorization = deliveryDecisions(city, order.id)
    .filter((decision) => decision.kind === 'authorization' && decision.outcome === 'authorize' && decision.permit)
    .at(-1);
  if (!authorization) return { state: 'none', permit: null };
  if (order.status === 'completed') return { state: 'completed', permit: authorization.permit };
  if (!authorizationCurrent(order.history) || Date.parse(order.updatedAt) < Date.parse(authorization.createdAt)) {
    return { state: 'void', permit: authorization.permit };
  }
  const extensions = (order.development?.permitExtensions ?? [])
    .filter((extension) => extension.permitId === authorization.permit.permitId);
  const extraDays = extensions.reduce((total, extension) => total + extension.extensionDays, 0);
  const commencementDeadline = new Date(
    Date.parse(`${authorization.permit.commencementDeadline}T00:00:00.000Z`) + extraDays * dayMilliseconds,
  ).toISOString().slice(0, 10);
  const started = order.history.some((entry) => entry.to === 'in-progress'
    && Date.parse(entry.timestamp) >= Date.parse(authorization.createdAt));
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const commencementLimit = Date.parse(`${commencementDeadline}T23:59:59.999Z`);
  const lastActivity = Math.max(
    Date.parse(order.history.at(-1).timestamp),
    ...extensions.map((extension) => Date.parse(extension.recordedAt)),
  );
  const inactivityLimit = lastActivity + authorization.permit.inactivityDays * dayMilliseconds;
  const lapsing = !started && nowMs > commencementLimit
    || ['authorized', 'in-progress', 'blocked'].includes(order.status) && nowMs > inactivityLimit;
  return {
    state: lapsing ? 'lapsed' : 'active',
    permit: { ...authorization.permit, commencementDeadline },
    extensionCount: extensions.length,
    extensionsRemaining: Math.max(0, PERMIT_MAX_EXTENSIONS - extensions.length),
  };
}

function councilSummary(city) {
  const adopted = city.config.governance === 'adopted';
  const governanceCurrent = adopted && city.drift.matchesAdoptedRevision;
  const delegationPolicyAdopted = adopted && city.config.adoption.policies.some((policy) => policy.path === DELEGATION_POLICY);
  return {
    delegationAvailable: governanceCurrent && delegationPolicyAdopted,
    delegationPolicy: `.city/${DELEGATION_POLICY}`,
    delegationPolicyAdopted,
    governanceCurrent,
    residentDecisionsAvailable: governanceCurrent,
  };
}

function citySummary(city) {
  const summary = {
    cityId: city.config.cityId,
    name: city.config.name,
    schemaVersion: city.config.schemaVersion,
    governance: city.config.governance,
    migrationAvailable: city.config.schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION,
  };
  if (city.config.governance === 'adopted') {
    summary.adoption = { ...city.config.adoption, drift: city.drift };
  }
  return summary;
}

function policyThresholds(policy) {
  const lines = policy.split(/\r?\n/u);
  const heading = lines.findIndex((line) => line.trim() === '## Trigger thresholds');
  if (heading < 0) return { error: 'The trigger-threshold table is missing.' };
  const table = [];
  for (const line of lines.slice(heading + 1)) {
    if (/^#{1,6}\s/u.test(line)) break;
    if (line.trim().startsWith('|')) table.push(line.trim());
  }
  const rows = table.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  const header = rows.find((row) => row[0] === 'Trigger');
  if (!header || header.length !== 3 || header[1] !== 'Threshold' || header[2] !== 'Unit') {
    return { error: 'The trigger-threshold table header is invalid.' };
  }
  const values = new Map();
  for (const row of rows) {
    if (row === header || row.every((cell) => /^:?-{3,}:?$/u.test(cell))) continue;
    if (row.length !== 3 || !INSTITUTIONAL_REVIEW_TRIGGERS.includes(row[0])
      || !/^[1-9][0-9]{0,8}$/u.test(row[1])
      || row[2] !== institutionalReviewUnits[row[0]] || values.has(row[0])) {
      return { error: 'The trigger-threshold table has an invalid or duplicate row.' };
    }
    values.set(row[0], Number(row[1]));
  }
  if (values.size !== INSTITUTIONAL_REVIEW_TRIGGERS.length
    || INSTITUTIONAL_REVIEW_TRIGGERS.some((name) => !values.has(name))) {
    return { error: 'The trigger-threshold table does not define every supported trigger.' };
  }
  return { values };
}

export function institutionalReviewStatus(city, now = new Date()) {
  const policyPath = `.city/${INSTITUTIONAL_REVIEW_POLICY}`;
  const unavailable = (policyError) => ({
    available: false, policy: policyPath, policyError, due: false, windowStart: null, triggers: [], lastReview: null,
  });
  if (city.config.governance !== 'adopted') return unavailable('Governance has not been adopted.');
  if (!city.config.adoption.policies.some((policy) => policy.path === INSTITUTIONAL_REVIEW_POLICY)) {
    return unavailable('The institutional-review policy is not part of the adopted revision.');
  }
  if (!city.drift.matchesAdoptedRevision) return unavailable('The adopted charter or policy revision has drifted.');
  if (city.institutionalReviewPolicy === null) return unavailable('The adopted institutional-review policy is missing.');
  const parsed = policyThresholds(city.institutionalReviewPolicy);
  if (parsed.error) return unavailable(parsed.error);

  const last = [...city.institutionalReviews.values()]
    .map(({ value }) => value)
    .sort((first, second) => first.coversThrough.localeCompare(second.coversThrough)
      || first.id.localeCompare(second.id)).at(-1) ?? null;
  const windowStart = last?.coversThrough ?? city.config.adoption.recordedAt;
  const start = Date.parse(windowStart);
  const end = now.getTime();
  const occurredInWindow = (timestamp) => Date.parse(timestamp) > start && Date.parse(timestamp) <= end;
  const completed = [...city.workOrders.values()].reduce((count, { value }) => count
    + value.history.filter((entry) => entry.to === 'completed' && occurredInWindow(entry.timestamp)).length, 0);
  const returnedOrRejected = [...city.decisions.values()].reduce((count, { value }) => count
    + (value.schemaVersion === DELIVERY_DECISION_SCHEMA_VERSION
      && value.decidedBy === 'city-council'
      && ['return', 'reject'].includes(value.outcome) && occurredInWindow(value.createdAt) ? 1 : 0), 0);
  const inspectionFailures = [...city.workOrders.values()].reduce((count, { value }) => count
    + value.history.filter((entry) => entry.from === 'inspection' && entry.to === 'in-progress'
      && occurredInWindow(entry.timestamp)).length, 0);
  const referrals = [...city.decisions.values()].reduce((count, { value }) => count
    + (value.schemaVersion === DELIVERY_DECISION_SCHEMA_VERSION
      && value.decidedBy === 'city-council'
      && value.outcome === 'refer' && occurredInWindow(value.createdAt) ? 1 : 0), 0);
  const blocked = [...city.workOrders.values()].reduce((count, { value }) => count
    + value.history.filter((entry) => entry.to === 'blocked' && occurredInWindow(entry.timestamp)).length, 0);
  const observed = {
    'periodic-volume': completed,
    'periodic-time': Math.max(0, Math.floor((end - start) / dayMilliseconds)),
    'returned-or-rejected': returnedOrRejected,
    'inspection-failures': inspectionFailures,
    referrals,
    blocked,
  };
  const triggers = INSTITUTIONAL_REVIEW_TRIGGERS.map((name) => ({
    name, observed: observed[name], threshold: parsed.values.get(name),
    due: observed[name] >= parsed.values.get(name),
  }));
  return {
    available: true, policy: policyPath, policyError: null, windowStart,
    due: triggers.some((trigger) => trigger.due), triggers,
    lastReview: last ? {
      id: last.id, coversThrough: last.coversThrough, summary: last.summary,
      recommendationCount: last.recommendations.length,
    } : null,
  };
}

export function statusOutput(root, city, command = 'status') {
  if (!city) return { command, root, enrolled: false, notice: DRAFT_NOTICE };
  const assignments = currentAssignments(city);
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const projectCounts = new Map(city.projects.projects.map((project) => [
    project.id, { projectId: project.id, name: project.name, total: 0, byStatus: Object.fromEntries(STATUSES.map((status) => [status, 0])) },
  ]));
  const unassigned = { total: 0, byStatus: Object.fromEntries(STATUSES.map((status) => [status, 0])) };
  const awaitingResidentDecision = [];
  const readyForDelivery = [];
  for (const { value } of city.workOrders.values()) {
    byStatus[value.status] += 1;
    const assignedProjects = value.projectIds?.map((id) => projectCounts.get(id)) ?? [];
    if (assignedProjects.length === 0) {
      unassigned.total += 1;
      unassigned.byStatus[value.status] += 1;
    }
    for (const project of assignedProjects) {
      project.total += 1;
      project.byStatus[value.status] += 1;
    }
    const latest = deliveryDecisions(city, value.id).filter((decision) => decision.kind === 'authorization').at(-1);
    if (value.status === 'authorized') {
      readyForDelivery.push({
        id: value.id, title: value.title, projectIds: value.projectIds ?? [],
        authorizedBy: latest.id, decidedBy: latest.decidedBy,
        assignedTo: assignments.get(value.id)?.staffId ?? null,
      });
    }
    const enteredAwaiting = value.history.findLast((entry) => entry.to === 'awaiting-approval')?.timestamp;
    // A referral from an earlier awaiting-approval period is stale once the order re-enters the queue.
    if (value.status === 'awaiting-approval' && latest?.outcome === 'refer' && latest.createdAt >= enteredAwaiting) {
      awaitingResidentDecision.push({
        id: value.id, title: value.title, referredBy: latest.id, reservedMatters: latest.reservedMatters,
      });
    }
  }
  const byKind = { proposal: 0, authorization: 0, acceptance: 0 };
  const byOutcome = Object.fromEntries([...AUTHORIZATION_OUTCOMES, 'accept'].map((outcome) => [outcome, 0]));
  for (const { value } of city.decisions.values()) {
    byKind[value.kind] += 1;
    if (value.schemaVersion === DELIVERY_DECISION_SCHEMA_VERSION) byOutcome[value.outcome] += 1;
  }
  const recordsRequestCounts = { open: 0, resolved: 0, cancelled: 0 };
  const openRecordsRequests = [];
  for (const { value } of city.recordsRequests.values()) {
    recordsRequestCounts[value.status] += 1;
    if (value.status === 'open') {
      openRecordsRequests.push({
        id: value.id,
        requestedBy: value.requestedBy,
        sourceOffice: value.sourceOffice,
        purpose: value.purpose,
        relatedWorkOrderId: value.relatedWorkOrderId,
        itemCount: value.items.length,
        createdAt: value.createdAt,
      });
    }
  }
  const deliveryWithoutAssignment = [...city.workOrders.values()]
    .map(({ value }) => value)
    .filter((value) => ['in-progress', 'inspection'].includes(value.status)
      && !assignments.has(value.id))
    .map((value) => ({ id: value.id, title: value.title }))
    .sort((first, second) => first.id.localeCompare(second.id));
  const permits = [...city.workOrders.values()].flatMap(({ value }) => {
    const current = permitStatus(city, value);
    return current.state === 'none' ? [] : [{
      workOrderId: value.id, title: value.title, state: current.state, permitId: current.permit.permitId,
      safetyClass: current.permit.safetyClass, structuralClass: current.permit.structuralClass,
      commencementDeadline: current.permit.commencementDeadline,
    }];
  }).sort((first, second) => first.workOrderId.localeCompare(second.workOrderId));
  return {
    command, root, enrolled: true, governance: city.config.governance, city: citySummary(city),
    council: councilSummary(city),
    zoning: { enabled: zoningEnabled(city), configured: Boolean(city.zoning), zones: city.zoning?.zones.length ?? 0 },
    projects: city.projects.projects,
    workOrders: {
      total: city.workOrders.size,
      byStatus,
      byProject: [...projectCounts.values()].sort((first, second) => first.projectId.localeCompare(second.projectId)),
      unassigned,
      awaitingResidentDecision: awaitingResidentDecision.sort((first, second) => first.id.localeCompare(second.id)),
      readyForDelivery: readyForDelivery.sort((first, second) => first.id.localeCompare(second.id)),
      deliveryWithoutAssignment,
      development: [...city.workOrders.values()].map(({ value }) => ({
        id: value.id, title: value.title, ...developmentStatus(city, value),
        preparationRequiredForNextAuthorization: !authorizationCurrent(value.history),
      })).sort((first, second) => first.id.localeCompare(second.id)),
    },
    decisions: { total: city.decisions.size, proposed: byKind.proposal, byKind, byOutcome },
    recordsRequests: {
      total: city.recordsRequests.size,
      ...recordsRequestCounts,
      openRequests: openRecordsRequests.sort((first, second) => first.createdAt.localeCompare(second.createdAt)
        || first.id.localeCompare(second.id)),
    },
    institutionalReview: institutionalReviewStatus(city),
    infrastructure: infrastructureStatus(city),
    workforce: workforceStatus(city),
    permits: {
      enabled: permitPolicyEnabled(city),
      total: permits.length,
      byState: Object.fromEntries(['active', 'lapsed', 'void', 'completed'].map((state) => [
        state, permits.filter((permit) => permit.state === state).length,
      ])),
      records: permits,
    },
    notice: governanceNotice(city.config.governance),
  };
}

export async function status(root) {
  return statusOutput(root, await loadCity(root, false));
}

async function ensureInfrastructureDirectories(city) {
  await ensureDirectories(city.path, 'infrastructure/assets', 'City infrastructure');
  city.directoryIdentities.infrastructure = await directory(path.join(city.path, 'infrastructure'), 'City infrastructure');
  city.directoryIdentities['infrastructure/assets'] = await directory(
    path.join(city.path, 'infrastructure/assets'), 'City infrastructure assets',
  );
}

function infrastructureTimestamp(previous = null) {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString();
}

function assetRecord(city, id, data, recordedBy, reason, previous = null) {
  const recordedAt = infrastructureTimestamp(previous?.updatedAt);
  return validateInfrastructureAsset({
    ...(previous ?? {}),
    ...data,
    schemaVersion: 1,
    id,
    cityId: city.config.cityId,
    revision: (previous?.revision ?? 0) + 1,
    history: [
      ...(previous?.history ?? []),
      { revision: (previous?.revision ?? 0) + 1, reason, recordedAt, recordedBy },
    ],
    createdAt: previous?.createdAt ?? recordedAt,
    updatedAt: recordedAt,
    provenance: previous?.provenance ?? provenance(),
  }, city.config.cityId);
}

function infrastructureMutationOutput(command, root, apply, city, asset, programme = null) {
  return {
    command, root, governance: city.config.governance,
    dryRun: !apply, changed: Boolean(apply), wouldWrite: true,
    ...(asset ? { asset } : {}),
    ...(programme ? { programme } : {}),
    notice: governanceNotice(city.config.governance),
  };
}

function validateInfrastructureAssetReferences(city, asset) {
  const projectIds = new Set(city.projects.projects.map((project) => project.id));
  if (asset.projectIds.some((id) => !projectIds.has(id))) {
    fail('NOT_FOUND', 'Every infrastructure consumer project must already be registered.');
  }
  const assets = new Map([...city.infrastructure.assets].map(([id, record]) => [id, record.value]));
  assets.set(asset.id, asset);
  for (const id of asset.dependencies) {
    if (!assets.has(id)) fail('NOT_FOUND', `Infrastructure dependency ${id} is not registered.`);
  }
  const visited = new Set();
  const active = new Set();
  const visit = (id) => {
    if (active.has(id)) fail('INVALID_RECORD', 'Infrastructure asset dependency cycle must be resolved explicitly.');
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of assets.get(id).dependencies) visit(dependency);
    active.delete(id);
    visited.add(id);
  };
  for (const id of assets.keys()) visit(id);
  for (const obligation of asset.obligations) {
    for (const entry of obligation.history) {
      if (entry.workOrderId) {
        const order = city.workOrders.get(entry.workOrderId)?.value;
        if (!order) fail('NOT_FOUND', 'Infrastructure obligation history references a missing work order.');
        if (entry.outcome === 'completed' && (order.status !== 'completed'
          || !order.infrastructure?.assets.some((pin) => pin.assetId === asset.id)
          || !order.infrastructure.obligations.some((reference) => reference.assetId === asset.id
            && reference.obligationId === obligation.id))) {
          fail('INVALID_RECORD', 'Completed infrastructure obligations must link to an accepted order covering that asset and obligation.');
        }
      }
    }
  }
  for (const finding of asset.findings) {
    if (finding.workOrderId) {
      const order = city.workOrders.get(finding.workOrderId)?.value;
      if (!order) fail('NOT_FOUND', 'Infrastructure finding references a missing work order.');
      if (finding.status === 'resolved' && finding.applicability === 'applicable'
        && (order.status !== 'completed'
          || !order.infrastructure?.findings.some((reference) => reference.assetId === asset.id
            && reference.findingId === finding.id))) {
        fail('INVALID_RECORD', 'An applicable infrastructure finding may be resolved only by its accepted linked order.');
      }
    }
  }
}

function validateInfrastructureProgrammeReferences(city, programme) {
  for (const pin of programme.assets) {
    const asset = city.infrastructure.assets.get(pin.assetId)?.value;
    if (!asset || pin.revision > asset.revision) {
      fail('NOT_FOUND', 'Infrastructure programme references a missing asset or future revision.');
    }
  }
  for (const activity of programme.activities) {
    if (activity.authorityStatus === 'authorized' || activity.authorityStatus === 'complete') {
      const order = activity.workOrderId && city.workOrders.get(activity.workOrderId)?.value;
      if (!order || !order.infrastructure?.assets.some((pin) => pin.assetId === activity.assetId)
        || (activity.authorityStatus === 'authorized'
          && !['authorized', 'in-progress', 'inspection', 'awaiting-merge', 'completed'].includes(order.status))
        || (activity.authorityStatus === 'complete' && order.status !== 'completed')) {
        fail('INVALID_RECORD', 'Authorized or completed programme activities must link to a delivery order for that asset in the matching lifecycle state.');
      }
    } else if (activity.workOrderId && !city.workOrders.has(activity.workOrderId)) {
      fail('NOT_FOUND', 'Infrastructure programme activity references a missing work order.');
    }
  }
}

export async function infrastructureAssetRegister(root, options) {
  const data = requestJSON(options.data, 'Infrastructure asset --data');
  text(options['recorded-by'], '--recorded-by', 200);
  text(options.reason, '--reason', 2000);
  const city = await loadCity(root);
  if (city.infrastructure.assets.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported infrastructure asset count.');
  const asset = assetRecord(city, `IA-${randomUUID()}`, data, options['recorded-by'], options.reason);
  validateInfrastructureAssetReferences(city, asset);
  if (Buffer.byteLength(encodeJSON(asset)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed infrastructure asset exceeds the supported local file size.');
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      if (current.infrastructure.assets.has(asset.id)) fail('CONFLICT', 'Infrastructure asset ID already exists.');
      if (current.infrastructure.assets.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported infrastructure asset count.');
      await ensureInfrastructureDirectories(current);
      await atomicRecord(current, 'infrastructure/assets', `${asset.id}.json`, asset);
      await loadCity(root);
    });
  }
  return infrastructureMutationOutput('asset-register', root, options.apply, city, asset);
}

export async function infrastructureAssetRevise(root, options) {
  validateRecordId('infrastructure-asset', options.id);
  text(options['recorded-by'], '--recorded-by', 200);
  text(options.reason, '--reason', 2000);
  if (!Number.isSafeInteger(options.revision) || options.revision < 1) {
    fail('INVALID_ARGUMENT', '--revision must be the positive current infrastructure asset revision.');
  }
  const data = requestJSON(options.data, 'Infrastructure asset --data');
  const city = await loadCity(root);
  const original = city.infrastructure.assets.get(options.id);
  if (!original) fail('NOT_FOUND', 'Infrastructure asset does not exist in this repository.');
  if (original.value.revision !== options.revision) fail('CONFLICT', 'Infrastructure asset revision is stale; retrieve its current record and reconcile before retrying.');
  const asset = assetRecord(city, options.id, data, options['recorded-by'], options.reason, original.value);
  validateInfrastructureAssetReferences(city, asset);
  if (Buffer.byteLength(encodeJSON(asset)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed infrastructure asset exceeds the supported local file size.');
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const latest = current.infrastructure.assets.get(options.id);
      if (!latest || !latest.bytes.equals(original.bytes)) fail('CONFLICT', 'Infrastructure asset changed since revision preparation.');
      await atomicRecord(current, 'infrastructure/assets', `${asset.id}.json`, asset, original.bytes);
      await loadCity(root);
    });
  }
  return infrastructureMutationOutput('asset-revise', root, options.apply, city, asset);
}

function updateInfrastructureAssetForReview(city, original, data, recordedBy, reason) {
  const previous = original.value;
  const next = structuredClone(previous);
  if (data.kind === 'condition') {
    next.condition = {
      state: data.state, observedAt: data.observedAt, method: data.method, evidence: data.evidence,
    };
  } else if (data.kind === 'service-measurement') {
    const service = next.services.find((item) => item.id === data.serviceId);
    if (!service) fail('NOT_FOUND', 'Infrastructure service does not exist on this asset.');
    service.measurements.push({ observedAt: data.observedAt, value: data.value, evidence: data.evidence });
    if (service.measurements.length > LIMITS.history) fail('SIZE_LIMIT', 'Infrastructure service measurement history is full.');
  } else if (data.kind === 'obligation') {
    const obligation = next.obligations.find((item) => item.id === data.obligationId);
    if (!obligation) fail('NOT_FOUND', 'Infrastructure maintenance obligation does not exist on this asset.');
    if (data.outcome === 'completed' && data.workOrderId === null) {
      fail('INVALID_TRANSITION', 'Completing a maintenance obligation requires its accepted linked work order.');
    }
    if (data.workOrderId !== null) {
      const order = city.workOrders.get(data.workOrderId)?.value;
      if (!order) fail('NOT_FOUND', 'Infrastructure maintenance work order does not exist.');
      if (data.outcome === 'completed' && order.status !== 'completed') {
        fail('INVALID_TRANSITION', 'A maintenance obligation can be marked completed only after delivery inspection and resident acceptance.');
      }
      if (data.outcome === 'completed' && (!order.infrastructure?.assets.some((pin) => pin.assetId === previous.id)
        || !order.infrastructure.obligations.some((reference) => reference.assetId === previous.id
          && reference.obligationId === obligation.id))) {
        fail('INVALID_TRANSITION', 'The accepted work order must be scoped to this asset and maintenance obligation.');
      }
    }
    obligation.history.push({
      outcome: data.outcome, date: data.date, evidence: data.evidence, workOrderId: data.workOrderId,
    });
    if (data.outcome === 'deferred') {
      obligation.status = 'deferred';
      obligation.nextReviewDate = data.reviewDate;
      next.deferrals.push({
        id: `deferral-${randomUUID()}`, referenceType: 'obligation', referenceId: obligation.id,
        reason: data.evidence, riskOwner: data.riskOwner, authorityReference: data.authorityReference,
        reviewDate: data.reviewDate, originalDueDate: obligation.dueDate,
      });
    } else if (data.outcome === 'completed') {
      obligation.status = obligation.recurrenceDays ? 'open' : 'satisfied';
      obligation.nextReviewDate = null;
      if (obligation.recurrenceDays) {
        const base = Date.parse(`${obligation.dueDate}T00:00:00.000Z`);
        const completedAt = Date.parse(`${data.date}T00:00:00.000Z`);
        obligation.dueDate = new Date(Math.max(base, completedAt) + obligation.recurrenceDays * dayMilliseconds).toISOString().slice(0, 10);
      }
    }
  } else if (data.kind === 'finding') {
    const finding = next.findings.find((item) => item.id === data.findingId);
    if (!finding) fail('NOT_FOUND', 'Infrastructure finding does not exist on this asset.');
    finding.applicability = data.applicability;
    finding.evidence = data.evidence;
    if (data.status === 'resolved' && finding.applicability === 'applicable') {
      const order = data.workOrderId && city.workOrders.get(data.workOrderId)?.value;
      if (!order || order.status !== 'completed'
        || !order.infrastructure?.findings.some((reference) => reference.assetId === previous.id
          && reference.findingId === finding.id)) {
        fail('INVALID_TRANSITION', 'An applicable infrastructure finding can be resolved only with an accepted linked work order.');
      }
      finding.workOrderId = data.workOrderId;
    }
    finding.status = data.status;
  } else {
    fail('INVALID_ARGUMENT', 'Infrastructure review kind is unsupported.');
  }
  return assetRecord(city, previous.id, next, recordedBy, reason, previous);
}

function validateInfrastructureReviewInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.kind !== 'string') {
    fail('INVALID_ARGUMENT', 'Infrastructure review --data must be a JSON object with a supported kind.');
  }
  const shape = {
    condition: ['kind', 'state', 'observedAt', 'method', 'evidence'],
    'service-measurement': ['kind', 'serviceId', 'observedAt', 'value', 'evidence'],
    obligation: [
      'kind', 'obligationId', 'outcome', 'date', 'evidence', 'workOrderId',
      'reviewDate', 'riskOwner', 'authorityReference',
    ],
    finding: ['kind', 'findingId', 'applicability', 'status', 'evidence', 'workOrderId'],
  }[data.kind];
  if (!shape || Object.keys(data).length !== shape.length || shape.some((key) => !Object.hasOwn(data, key))) {
    fail('INVALID_ARGUMENT', 'Infrastructure review --data has missing or unexpected fields.');
  }
  if (data.kind === 'condition') {
    if (!['unknown', 'satisfactory', 'degraded', 'failed'].includes(data.state)) fail('INVALID_ARGUMENT', 'Condition state is unsupported.');
    calendarDate(data.observedAt, 'Infrastructure condition observation date');
    text(data.method, 'Infrastructure condition method', 500);
    text(data.evidence, 'Infrastructure condition evidence', 2000);
  } else if (data.kind === 'service-measurement') {
    text(data.serviceId, 'Infrastructure service ID', 64);
    calendarDate(data.observedAt, 'Infrastructure measurement date');
    text(data.value, 'Infrastructure measurement value', 500);
    text(data.evidence, 'Infrastructure measurement evidence', 2000);
  } else if (data.kind === 'obligation') {
    text(data.obligationId, 'Infrastructure obligation ID', 64);
    if (!['completed', 'deferred', 'no-change'].includes(data.outcome)) fail('INVALID_ARGUMENT', 'Infrastructure obligation outcome is unsupported.');
    calendarDate(data.date, 'Infrastructure obligation review date');
    text(data.evidence, 'Infrastructure obligation evidence', 2000);
    if (data.workOrderId !== null) validateOrderId(data.workOrderId);
    if (data.outcome === 'deferred') {
      calendarDate(data.reviewDate, 'Infrastructure deferral review date');
      text(data.riskOwner, 'Infrastructure deferral risk owner', 200);
      if (data.authorityReference !== null) text(data.authorityReference, 'Infrastructure deferral authority reference', 1000);
    } else if (data.reviewDate !== null || data.riskOwner !== null || data.authorityReference !== null) {
      fail('INVALID_ARGUMENT', 'Deferral details are permitted only for a deferred obligation.');
    }
  } else {
    text(data.findingId, 'Infrastructure finding ID', 64);
    if (!['unknown', 'applicable', 'not-applicable'].includes(data.applicability)
      || !['open', 'resolved'].includes(data.status)) fail('INVALID_ARGUMENT', 'Infrastructure finding disposition is unsupported.');
    text(data.evidence, 'Infrastructure finding evidence', 2000);
    if (data.workOrderId !== null) validateOrderId(data.workOrderId);
  }
}

export async function infrastructureAssetReview(root, options) {
  validateRecordId('infrastructure-asset', options.id);
  if (!Number.isSafeInteger(options.revision) || options.revision < 1) {
    fail('INVALID_ARGUMENT', '--revision must be the positive current infrastructure asset revision.');
  }
  text(options['recorded-by'], '--recorded-by', 200);
  text(options.reason, '--reason', 2000);
  const data = requestJSON(options.data, 'Infrastructure review --data');
  validateInfrastructureReviewInput(data);
  const city = await loadCity(root);
  const original = city.infrastructure.assets.get(options.id);
  if (!original) fail('NOT_FOUND', 'Infrastructure asset does not exist in this repository.');
  if (original.value.revision !== options.revision) fail('CONFLICT', 'Infrastructure asset revision is stale; retrieve the current record before retrying.');
  let asset = updateInfrastructureAssetForReview(city, original, data, options['recorded-by'], options.reason);
  validateInfrastructureAssetReferences(city, asset);
  if (Buffer.byteLength(encodeJSON(asset)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed infrastructure asset exceeds the supported local file size.');
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const latest = current.infrastructure.assets.get(options.id);
      if (!latest || !latest.bytes.equals(original.bytes)) fail('CONFLICT', 'Infrastructure asset changed since review preparation.');
      asset = updateInfrastructureAssetForReview(current, latest, data, options['recorded-by'], options.reason);
      validateInfrastructureAssetReferences(current, asset);
      await atomicRecord(current, 'infrastructure/assets', `${asset.id}.json`, asset, original.bytes);
      await loadCity(root);
    });
  }
  return infrastructureMutationOutput('asset-review', root, options.apply, city, asset);
}

function programmeRecord(city, data, recordedBy, reason, previous = null) {
  const recordedAt = infrastructureTimestamp(previous?.updatedAt);
  return validateInfrastructureProgramme({
    ...data,
    schemaVersion: 1,
    id: 'infrastructure-programme',
    cityId: city.config.cityId,
    revision: (previous?.revision ?? 0) + 1,
    history: [
      ...(previous?.history ?? []),
      { revision: (previous?.revision ?? 0) + 1, reason, recordedAt, recordedBy },
    ],
    updatedAt: recordedAt,
    provenance: previous?.provenance ?? provenance(),
  }, city.config.cityId);
}

export async function infrastructureProgrammeRecord(root, options) {
  if (!Number.isSafeInteger(options.revision) || options.revision < 0) {
    fail('INVALID_ARGUMENT', '--revision must be 0 for a new programme or the positive current revision.');
  }
  text(options['recorded-by'], '--recorded-by', 200);
  text(options.reason, '--reason', 2000);
  const data = requestJSON(options.data, 'Infrastructure programme --data');
  const city = await loadCity(root);
  const previous = city.infrastructure.programme;
  if ((previous?.value.revision ?? 0) !== options.revision) {
    fail('CONFLICT', 'Infrastructure programme revision is stale; retrieve the current record before retrying.');
  }
  let programme = programmeRecord(city, data, options['recorded-by'], options.reason, previous?.value ?? null);
  validateInfrastructureProgrammeReferences(city, programme);
  if (Buffer.byteLength(encodeJSON(programme)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed infrastructure programme exceeds the supported local file size.');
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const latest = current.infrastructure.programme;
      if ((latest?.value.revision ?? 0) !== options.revision
        || (previous && !latest.bytes.equals(previous.bytes))) {
        fail('CONFLICT', 'Infrastructure programme changed since preparation.');
      }
      await ensureInfrastructureDirectories(current);
      programme = programmeRecord(current, data, options['recorded-by'], options.reason, latest?.value ?? null);
      validateInfrastructureProgrammeReferences(current, programme);
      await atomicRecord(current, 'infrastructure', 'programme.json', programme, latest?.bytes);
      await loadCity(root);
    });
  }
  return infrastructureMutationOutput('infrastructure-programme-record', root, options.apply, city, null, programme);
}

async function ensureInstitutionalReviewDirectory(city) {
  const location = path.join(city.path, 'institutional-reviews');
  if (!city.directoryIdentities['institutional-reviews']) {
    try {
      await mkdir(location, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    city.directoryIdentities['institutional-reviews'] = await directory(
      location, 'City institutional reviews',
    );
  }
}

function parseRecommendations(values) {
  if (!Array.isArray(values) || values.length > LIMITS.criteria) {
    fail('INVALID_ARGUMENT', `At most ${LIMITS.criteria} recommendations may be supplied.`);
  }
  return values.map((value) => parseJSON(Buffer.from(value, 'utf8'), 'Institutional review recommendation'));
}

function makeInstitutionalReview(city, options, status) {
  const createdAt = new Date(Math.max(Date.now(), Date.parse(status.windowStart) + 1)).toISOString();
  const record = validateInstitutionalReview({
    schemaVersion: SCHEMA_VERSION,
    id: `IR-${randomUUID()}`,
    cityId: city.config.cityId,
    conductedBy: options['conducted-by'],
    summary: options.summary,
    windowStart: status.windowStart,
    coversThrough: createdAt,
    triggers: status.triggers,
    recommendations: options.parsedRecommendations,
    createdAt,
    provenance: provenance(),
  }, city.config.cityId);
  if (Buffer.byteLength(encodeJSON(record)) > LIMITS.fileBytes) {
    fail('SIZE_LIMIT', 'The institutional review exceeds the supported local file size.');
  }
  return record;
}

export async function reviewRecord(root, options) {
  text(options['conducted-by'], '--conducted-by', 200);
  text(options.summary, '--summary', 4000);
  options.parsedRecommendations = parseRecommendations(options.recommendations);
  const city = await loadCity(root);
  const reviewStatus = institutionalReviewStatus(city);
  if (!reviewStatus.available) fail('REVIEW_UNAVAILABLE', reviewStatus.policyError);
  if (!reviewStatus.due) fail('REVIEW_NOT_DUE', 'No institutional review trigger currently meets its adopted threshold.');
  if (city.institutionalReviews.size >= LIMITS.records) {
    fail('SIZE_LIMIT', 'City has reached the supported institutional-review record count.');
  }
  let review = makeInstitutionalReview(city, options, reviewStatus);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const currentStatus = institutionalReviewStatus(current);
      if (!currentStatus.available) fail('REVIEW_UNAVAILABLE', currentStatus.policyError);
      if (!currentStatus.due) {
        fail('REVIEW_NOT_DUE', 'Another review was recorded or the trigger no longer meets its adopted threshold.');
      }
      if (current.institutionalReviews.size >= LIMITS.records) {
        fail('SIZE_LIMIT', 'City has reached the supported institutional-review record count.');
      }
      review = makeInstitutionalReview(current, options, currentStatus);
      await ensureInstitutionalReviewDirectory(current);
      await atomicRecord(current, 'institutional-reviews', `${review.id}.json`, review);
    });
  }
  return {
    command: 'review-record', root, governance: city.config.governance,
    dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    institutionalReview: review,
    notice: governanceNotice(city.config.governance),
  };
}

const requestOutcomes = new Set(['found', 'not-found', 'withheld', 'unavailable']);

export async function artifactRecord(root, options) {
  const input = validateArtifactInput(parseJSON(Buffer.from(options.data), 'Artifact input'));
  const city = await loadCity(root);
  const makeRecord = (current) => {
    if (current.artifacts.size >= LIMITS.records) fail('SIZE_LIMIT', 'City artifact library is full.');
    if (input.workOrderId && !current.workOrders.has(input.workOrderId)) {
      fail('NOT_FOUND', 'Artifact work order does not exist.');
    }
    const previous = input.supersedes ? current.artifacts.get(input.supersedes)?.value : null;
    if (input.supersedes && !previous) fail('NOT_FOUND', 'Superseded artifact does not exist.');
    if (previous && previous.workOrderId !== input.workOrderId) {
      fail('INVALID_ARGUMENT', 'Superseded artifact must belong to the same work order.');
    }
    const artifact = validateArtifact({
      schemaVersion: SCHEMA_VERSION, id: `ART-${randomUUID()}`, cityId: current.config.cityId,
      ...input,
      createdAt: new Date(Math.max(Date.now(), previous ? Date.parse(previous.createdAt) + 1 : 0)).toISOString(),
      authenticated: false, provenance: provenance(),
    }, current.config.cityId);
    if (Buffer.byteLength(encodeJSON(artifact)) > LIMITS.fileBytes) {
      fail('SIZE_LIMIT', 'Encoded artifact exceeds the supported local file size.');
    }
    return artifact;
  };
  let artifact = makeRecord(city);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      if (input.supersedes
        && !current.artifacts.get(input.supersedes)?.bytes.equals(city.artifacts.get(input.supersedes).bytes)) {
        fail('CONFLICT', 'Superseded artifact changed since preview.');
      }
      artifact = makeRecord(current);
      await ensureDirectories(current.path, 'artifacts', 'City artifact library');
      current.directoryIdentities.artifacts = await directory(path.join(current.path, 'artifacts'), 'City artifact library');
      await atomicRecord(current, 'artifacts', `${artifact.id}.json`, artifact);
    });
  }
  return {
    command: 'artifact-record', root, dryRun: !options.apply, changed: Boolean(options.apply),
    wouldWrite: true, artifact, path: `.city/artifacts/${artifact.id}.json`,
    notice: governanceNotice(city.config.governance),
  };
}

function requestJSON(value, label) {
  return parseJSON(Buffer.from(value, 'utf8'), label);
}

function recordItem(type, id, relativePath, bytes, data, status = null, relatedRecords = [], label = null, recordCategory = null) {
  return {
    meta: {
      type, id, path: relativePath, status, sha256: sha256(bytes),
      relatedRecords: relatedRecords.sort((first, second) => first.type.localeCompare(second.type)
        || first.id.localeCompare(second.id)),
      ...(label ? { label } : {}),
      ...(recordCategory ? { recordCategory } : {}),
    },
    bytes,
    data,
  };
}

async function canonicalRecords(city) {
  const records = [];
  const artifactsByOrder = new Map();
  for (const { value } of city.artifacts.values()) {
    if (value.workOrderId) {
      const related = artifactsByOrder.get(value.workOrderId) ?? [];
      related.push({ type: 'artifact', id: value.id });
      artifactsByOrder.set(value.workOrderId, related);
    }
  }
  const decisionsByOrder = new Map();
  for (const { value } of city.decisions.values()) {
    for (const orderId of value.workOrderIds) {
      const related = decisionsByOrder.get(orderId) ?? [];
      related.push({ type: 'decision', id: value.id });
      decisionsByOrder.set(orderId, related);
    }
  }
  const requestsByOrder = new Map();
  for (const { value } of city.recordsRequests.values()) {
    if (value.relatedWorkOrderId) {
      const related = requestsByOrder.get(value.relatedWorkOrderId) ?? [];
      related.push({ type: 'records-request', id: value.id });
      requestsByOrder.set(value.relatedWorkOrderId, related);
    }
  }
  const workforceByOrder = new Map();
  const infrastructureByOrder = new Map();
  for (const { value: order } of city.workOrders.values()) {
    for (const pin of order.infrastructure?.assets ?? []) {
      const related = infrastructureByOrder.get(order.id) ?? [];
      related.push({ type: 'infrastructure-asset', id: pin.assetId });
      infrastructureByOrder.set(order.id, related);
    }
  }
  for (const { value } of city.workforce.requisitions.values()) {
    const related = workforceByOrder.get(value.workOrderId) ?? [];
    related.push({ type: 'requisition', id: value.id });
    workforceByOrder.set(value.workOrderId, related);
  }
  for (const { value } of city.workforce.assignments.values()) {
    const related = workforceByOrder.get(value.workOrderId) ?? [];
    related.push({ type: 'assignment', id: value.id });
    workforceByOrder.set(value.workOrderId, related);
  }
  // Work-order data is the live file as stored; closed file parts are their own canonical records.
  for (const { value, bytes, stored, parts } of city.workOrders.values()) {
    records.push(recordItem('work-order', value.id, `.city/work-orders/${value.id}.json`, bytes, stored ?? value,
      value.status, [
        ...parts.map((part) => ({ type: 'work-order-part', id: part.value.id })),
        ...(decisionsByOrder.get(value.id) ?? []),
        ...(requestsByOrder.get(value.id) ?? []),
        ...(workforceByOrder.get(value.id) ?? []),
        ...(infrastructureByOrder.get(value.id) ?? []),
        ...(artifactsByOrder.get(value.id) ?? []),
      ], value.title));
  }
  for (const { value, bytes } of city.workOrderParts.values()) {
    records.push(recordItem('work-order-part', value.id, `.city/work-order-parts/${value.id}.json`, bytes, value,
      null, [{ type: 'work-order', id: value.workOrderId }],
      `File part ${value.part} of ${value.workOrderId}`));
  }
  for (const { value, bytes } of city.decisions.values()) {
    records.push(recordItem('decision', value.id, `.city/decisions/${value.id}.json`, bytes, value,
      value.status ?? value.outcome, value.workOrderIds.map((id) => ({ type: 'work-order', id })),
      value.title ?? value.reason));
  }
  for (const { value, bytes } of city.recordsRequests.values()) {
    records.push(recordItem('records-request', value.id, `.city/records-requests/${value.id}.json`,
      bytes, value, value.status,
      value.relatedWorkOrderId ? [{ type: 'work-order', id: value.relatedWorkOrderId }] : [],
      value.purpose));
  }
  for (const { value, bytes } of city.institutionalReviews.values()) {
    records.push(recordItem('institutional-review', value.id,
      `.city/institutional-reviews/${value.id}.json`, bytes, value, null, [], value.summary));
  }
  for (const { value, bytes } of city.artifacts.values()) {
    const related = [
      ...(value.workOrderId ? [{ type: 'work-order', id: value.workOrderId }] : []),
      ...(value.supersedes ? [{ type: 'artifact', id: value.supersedes }] : []),
      ...[...city.artifacts.values()].filter(({ value: next }) => next.supersedes === value.id)
        .map(({ value: next }) => ({ type: 'artifact', id: next.id })),
    ];
    records.push(recordItem('artifact', value.id, `.city/artifacts/${value.id}.json`,
      bytes, value, null, related, value.title, value.recordCategory ?? 'legacy-unclassified'));
  }
  for (const { value, bytes } of city.infrastructure.assets.values()) {
    const related = [];
    for (const { value: order } of city.workOrders.values()) {
      if (order.infrastructure?.assets.some((pin) => pin.assetId === value.id)) {
        related.push({ type: 'work-order', id: order.id });
      }
    }
    if (city.infrastructure.programme?.value.assets.some((asset) => asset.assetId === value.id)) {
      related.push({ type: 'infrastructure-programme', id: 'infrastructure-programme' });
    }
    records.push(recordItem('infrastructure-asset', value.id,
      `.city/infrastructure/assets/${value.id}.json`, bytes, value, value.lifecycle, related, value.name));
  }
  if (city.infrastructure.programme) {
    const { value, bytes } = city.infrastructure.programme;
    records.push(recordItem('infrastructure-programme', value.id,
      '.city/infrastructure/programme.json', bytes, value, 'draft', [
        ...value.assets.map((asset) => ({ type: 'infrastructure-asset', id: asset.assetId })),
        ...value.activities.flatMap((item) => item.workOrderId ? [{ type: 'work-order', id: item.workOrderId }] : []),
      ], 'Infrastructure programme'));
  }
  for (const { value, bytes } of city.workforce.requisitions.values()) {
    records.push(recordItem('requisition', value.id, `.city/workforce/requisitions/${value.id}.json`,
      bytes, value, value.status, [{ type: 'work-order', id: value.workOrderId }], value.title));
  }
  for (const { value, bytes } of city.workforce.staff.values()) {
    const requisition = city.workforce.requisitions.get(value.requisitionId)?.value;
    records.push(recordItem('staff', value.id, `.city/workforce/staff/${value.id}.json`,
      bytes, value, value.status, [
        { type: 'requisition', id: value.requisitionId },
        { type: 'work-order', id: requisition.workOrderId },
      ], value.title));
  }
  for (const { value, bytes } of city.workforce.assignments.values()) {
    records.push(recordItem('assignment', value.id, `.city/workforce/assignments/${value.id}.json`,
      bytes, value, null, [
        { type: 'work-order', id: value.workOrderId },
        ...(value.staffId === 'municipal-software-engineer' ? [] : [{ type: 'staff', id: value.staffId }]),
      ]));
  }
  records.push(recordItem('config', 'config', '.city/config.json', city.configBytes, city.config,
    city.config.governance, [], city.config.name));
  for (const district of city.districts.districts) {
    records.push(recordItem('district', district.id, '.city/districts.json', city.districtsBytes,
      district, null, [], district.name));
  }
  if (city.zoning) {
    records.push(recordItem('zoning', 'zoning', '.city/zoning.json', city.zoningBytes,
      city.zoning, null, [], 'Repository zoning map'));
  }
  if (city.projectsBytes) {
    for (const project of city.projects.projects) {
      records.push(recordItem('project', project.id, '.city/projects.json', city.projectsBytes,
        project, null, [], project.name));
    }
  }
  const charterPath = path.join(city.path, 'charter.md');
  const charter = await readRegular(charterPath, 'City charter');
  records.push(recordItem('charter', 'charter', '.city/charter.md', charter.bytes,
    charter.bytes.toString('utf8'), null, [], 'City charter'));
  const policyDirectory = path.join(city.path, 'policies');
  for (const filename of await entries(policyDirectory, 'City policies')) {
    const policy = await readRegular(path.join(policyDirectory, filename), 'City policy');
    records.push(recordItem('policy', `policy:${filename}`, `.city/policies/${filename}`,
      policy.bytes, policy.bytes.toString('utf8'), null, [], filename));
  }
  return records.sort((first, second) => first.meta.type.localeCompare(second.meta.type)
    || first.meta.id.localeCompare(second.meta.id));
}

function validateAnyRecordId(id) {
  if (typeof id !== 'string' || id.includes('/') || id.includes('\\')) {
    fail('INVALID_ARGUMENT', 'Record ID must be an exact canonical identifier, not a path.');
  }
  for (const type of ['project', 'district']) {
    const prefix = `${type}:`;
    if (id.startsWith(prefix)) {
      const value = id.slice(prefix.length);
      validateRecordId(type, value);
      return { type, id: value };
    }
  }
  if (/^WO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'work-order', id };
  }
  if (/^WO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-part-[0-9]{4}$/u.test(id)) {
    return { type: 'work-order-part', id };
  }
  if (/^DEC-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'decision', id };
  }
  if (/^RR-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'records-request', id };
  }
  if (/^IR-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'institutional-review', id };
  }
  if (/^ART-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'artifact', id };
  }
  if (/^IA-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'infrastructure-asset', id };
  }
  if (/^REQ-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'requisition', id };
  }
  if (/^ASN-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { type: 'assignment', id };
  }
  if (id === 'config' || id === 'zoning' || id === 'charter' || id === 'infrastructure-programme') {
    return { type: id === 'infrastructure-programme' ? 'infrastructure-programme' : id, id };
  }
  if (/^policy:[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.md$/u.test(id)) {
    return { type: 'policy', id };
  }
  if (/^[a-z][a-z0-9-]{1,40}$/u.test(id)) return { type: 'staff', id };
  if (/^[a-z][a-z0-9-]{0,63}$/u.test(id)) return { type: null, id };
  fail('INVALID_ARGUMENT', 'Record ID must be a supported canonical identifier.');
}

function validateRecordFilters(options) {
  if (options.type !== undefined && !CANONICAL_RECORD_TYPES.includes(options.type)) {
    fail('INVALID_ARGUMENT', `--type must be one of ${CANONICAL_RECORD_TYPES.join(', ')}.`);
  }
  const selector = options.id === undefined ? null : validateAnyRecordId(options.id);
  if (options['work-order'] !== undefined) validateOrderId(options['work-order']);
  if (options.project !== undefined && !/^[a-z][a-z0-9-]{0,63}$/u.test(options.project)) {
    fail('INVALID_ARGUMENT', '--project must be a registered project ID.');
  }
  if (options.search !== undefined) {
    text(options.search, '--search', 200);
    if (options.type && options.type !== 'artifact') {
      fail('INVALID_ARGUMENT', '--search can only be used with artifact records.');
    }
  }
  if (options.status !== undefined && ![
    ...STATUSES, 'open', 'resolved', 'cancelled', 'draft', 'adopted', 'proposed',
  ].includes(options.status)) {
    fail('INVALID_ARGUMENT', '--status must be a supported record status.');
  }
  const limit = options.limit === undefined ? LIMITS.recordPage : Number(options.limit);
  const offset = options.offset === undefined ? 0 : Number(options.offset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMITS.recordPage
    || !Number.isSafeInteger(offset) || offset < 0 || offset > LIMITS.records) {
    fail('INVALID_ARGUMENT', `--limit must be 1-${LIMITS.recordPage}; --offset must be 0-${LIMITS.records}.`);
  }
  return { limit, offset, selector };
}

export async function recordsList(root, options) {
  const { limit, offset, selector } = validateRecordFilters(options);
  const city = await loadCity(root);
  const all = await canonicalRecords(city);
  const search = options.search?.normalize('NFKC').toLocaleLowerCase('en');
  const matching = all.filter(({ meta, data }) => {
    if (search && (meta.type !== 'artifact'
      || ![meta.label, data.kind, data.sourceOffice, data.recordCategory, data.content]
        .some((value) => value?.normalize('NFKC').toLocaleLowerCase('en').includes(search)))) return false;
    if (options.type && meta.type !== options.type) return false;
    if (selector && (meta.id !== selector.id || (selector.type && meta.type !== selector.type))) return false;
    if (options['work-order']
      && meta.id !== options['work-order']
      && !meta.relatedRecords.some((related) => related.type === 'work-order'
        && related.id === options['work-order'])) return false;
    if (options.project) {
      if (meta.type === 'project' && meta.id === options.project) {
        return !options.status || meta.status === options.status;
      }
      if (meta.type === 'infrastructure-asset' && data.projectIds.includes(options.project)) {
        return !options.status || meta.status === options.status;
      }
      let workOrder = data;
      if (meta.type === 'decision') {
        workOrder = city.workOrders.get(data.workOrderIds[0])?.value;
      } else if (meta.type !== 'work-order') {
        workOrder = meta.relatedRecords.map((related) => city.workOrders.get(related.id)?.value)
          .find(Boolean);
      }
      if (!workOrder?.projectIds?.includes(options.project)) return false;
    }
    return !options.status || meta.status === options.status;
  });
  return {
    command: 'records-list', root, total: matching.length, limit, offset,
    nextOffset: offset + limit < matching.length ? offset + limit : null,
    records: matching.slice(offset, offset + limit).map(({ meta }) => meta),
  };
}

export async function recordsGet(root, options) {
  if (!Array.isArray(options.ids) || options.ids.length === 0 || options.ids.length > LIMITS.recordBatch) {
    fail('INVALID_ARGUMENT', `Supply 1-${LIMITS.recordBatch} exact --id values.`);
  }
  if (new Set(options.ids).size !== options.ids.length) {
    fail('INVALID_ARGUMENT', 'A record ID may be requested only once per batch.');
  }
  const selectors = options.ids.map(validateAnyRecordId);
  const city = await loadCity(root);
  const all = await canonicalRecords(city);
  const index = new Map(all.map((record) => [`${record.meta.type}\n${record.meta.id}`, record]));
  const requested = selectors.map((selector) => {
    const matches = all.filter((record) => record.meta.id === selector.id
      && (!selector.type || record.meta.type === selector.type));
    if (matches.length === 0) fail('NOT_FOUND', `Canonical record ${selector.type ? `${selector.type}:` : ''}${selector.id} does not exist in this repository.`);
    if (matches.length > 1) fail('INVALID_ARGUMENT', `Record ID ${selector.id} is ambiguous; use project:<id> or district:<id>.`);
    return matches[0];
  });
  const response = requested.map((record) => {
    const linked = options.linked
      ? record.meta.relatedRecords.map((related) => index.get(`${related.type}\n${related.id}`)).filter(Boolean)
      : [];
    if (linked.length > LIMITS.recordBatch) {
      fail('SIZE_LIMIT', 'Linked record set exceeds the supported batch size; fetch the requested record without --linked.');
    }
    return {
      type: record.meta.type, id: record.meta.id, path: record.meta.path,
      status: record.meta.status, sha256: record.meta.sha256, record: record.data,
      linked: linked.map(({ meta, data }) => ({ ...meta, record: data })),
    };
  });
  const output = {
    command: 'records-get', root, retrievedAt: new Date().toISOString(), records: response,
  };
  if (Buffer.byteLength(encodeJSON(output)) > LIMITS.hookBytes) {
    fail('SIZE_LIMIT', 'Record batch exceeds the supported response size; request fewer records or omit --linked.');
  }
  return output;
}

function requestItem(value) {
  const item = requestJSON(value, 'Records request item');
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    fail('INVALID_ARGUMENT', '--item must be a JSON object with type, id, and description.');
  }
  if (!RECORD_EXCHANGE_TYPES.includes(item.type) || item.type === 'records-request') {
    fail('INVALID_ARGUMENT', '--item type must identify a supported canonical record type.');
  }
  validateRecordId(item.type, item.id, '--item id');
  text(item.description, '--item description', 1000);
  if (Object.keys(item).length !== 3 || !['type', 'id', 'description'].every((key) => Object.hasOwn(item, key))) {
    fail('INVALID_ARGUMENT', '--item accepts only type, id, and description.');
  }
  return item;
}

function requestResponse(value, items, recordIndex) {
  const response = requestJSON(value, 'Records request response');
  if (response === null || typeof response !== 'object' || Array.isArray(response)
    || Object.keys(response).length !== 4
    || !['item', 'outcome', 'references', 'explanation'].every((key) => Object.hasOwn(response, key))) {
    fail('INVALID_ARGUMENT', '--response must be a JSON object with item, outcome, references, and explanation.');
  }
  if (!Number.isInteger(response.item) || response.item < 0 || response.item >= items.length
    || !requestOutcomes.has(response.outcome) || !Array.isArray(response.references)) {
    fail('INVALID_ARGUMENT', '--response has an invalid item index, outcome, or references array.');
  }
  text(response.explanation, '--response explanation', 4000);
  if (response.references.length > LIMITS.recordBatch) {
    fail('INVALID_ARGUMENT', `A response may reference at most ${LIMITS.recordBatch} records.`);
  }
  const references = response.references.map((reference) => {
    if (reference === null || typeof reference !== 'object' || Array.isArray(reference)
      || Object.keys(reference).length !== 4
      || !['type', 'id', 'path', 'sha256'].every((key) => Object.hasOwn(reference, key))) {
      fail('INVALID_ARGUMENT', 'Each response reference must include type, id, path, and sha256.');
    }
    const key = `${reference.type}\n${reference.id}`;
    const actual = recordIndex.get(key);
    if (!actual || actual.meta.path !== reference.path || actual.meta.sha256 !== reference.sha256) {
      fail('STALE_REFERENCE', 'A response reference is missing or no longer matches the current canonical record. Fetch it again and retry.');
    }
    return {
      type: actual.meta.type, id: actual.meta.id, path: actual.meta.path, sha256: actual.meta.sha256,
    };
  });
  if (response.outcome === 'found' && references.length === 0) {
    fail('INVALID_ARGUMENT', 'A found response must cite at least one current canonical record.');
  }
  if (response.outcome === 'found'
    && !references.some((reference) => reference.type === items[response.item].type
      && reference.id === items[response.item].id)) {
    fail('INVALID_ARGUMENT', 'A found response must cite the exact record requested for that item.');
  }
  if (response.outcome !== 'found' && references.length > 0) {
    fail('INVALID_ARGUMENT', 'Only a found response may cite canonical record references.');
  }
  return { ...response, references };
}

function checkRecordsRequestsUnchanged(before, after) {
  if (before.recordsRequests.size !== after.recordsRequests.size) {
    fail('CONFLICT', 'City records requests changed since validation. Inspect concurrent edits and retry.');
  }
  for (const [id, record] of before.recordsRequests) {
    if (!after.recordsRequests.get(id)?.bytes.equals(record.bytes)) {
      fail('CONFLICT', 'City records requests changed since validation. Inspect concurrent edits and retry.');
    }
  }
}

async function ensureRecordsRequestDirectory(root) {
  const location = path.join(root, '.city', 'records-requests');
  try {
    await mkdir(location, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  await directory(location, 'City records requests');
}

export async function recordsRequest(root, options) {
  text(options['requested-by'], '--requested-by', 200);
  text(options.purpose, '--purpose', 4000);
  if (!Array.isArray(options.items) || options.items.length === 0 || options.items.length > LIMITS.criteria) {
    fail('INVALID_ARGUMENT', `Supply 1-${LIMITS.criteria} repeated --item JSON values.`);
  }
  const items = options.items.map(requestItem);
  const city = await loadCity(root);
  if (options['related-work-order'] !== undefined) {
    validateOrderId(options['related-work-order']);
    if (!city.workOrders.has(options['related-work-order'])) {
      fail('NOT_FOUND', 'Related work order does not exist in this repository.');
    }
  }
  if (options['source-office'] !== undefined) text(options['source-office'], '--source-office', 200);
  const now = new Date(Math.max(Date.now(), Date.parse(city.config.createdAt))).toISOString();
  const record = validateRecordsRequest({
    schemaVersion: RECORDS_REQUEST_SCHEMA_VERSION,
    id: `RR-${randomUUID()}`,
    cityId: city.config.cityId,
    requestedBy: options['requested-by'],
    sourceOffice: options['source-office'] ?? null,
    purpose: options.purpose,
    relatedWorkOrderId: options['related-work-order'] ?? null,
    items,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    history: [{
      from: null, to: 'open', actor: options['requested-by'],
      reason: 'Records request submitted.', timestamp: now,
    }],
    responses: [],
    provenance: provenance(),
  }, city.config.cityId);
  if (Buffer.byteLength(encodeJSON(record)) > LIMITS.fileBytes) {
    fail('SIZE_LIMIT', 'Records request exceeds the supported record size.');
  }
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      let current = await loadCity(root);
      checkCityUnchanged(city, current);
      checkRecordsRequestsUnchanged(city, current);
      if (record.relatedWorkOrderId && !current.workOrders.has(record.relatedWorkOrderId)) {
        fail('CONFLICT', 'The related work order changed before the request was written. Review the current register and retry.');
      }
      if (current.recordsRequests.size >= LIMITS.records) {
        fail('SIZE_LIMIT', 'City has reached the supported records request count.');
      }
      if (!current.directoryIdentities['records-requests']) {
        await ensureRecordsRequestDirectory(root);
        current = await loadCity(root);
      }
      await atomicRecord(current, 'records-requests', `${record.id}.json`, record);
    });
  }
  return {
    command: 'records-request', root, governance: city.config.governance,
    dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    recordsRequest: record, notice: governanceNotice(city.config.governance),
  };
}

async function mutateRecordsRequest(root, options, terminalStatus) {
  validateRecordId('records-request', options.id);
  const actorFlag = terminalStatus === 'resolved' ? 'resolved-by' : 'cancelled-by';
  text(options[actorFlag], `--${actorFlag}`, 200);
  text(options.reason, '--reason', 4000);
  const city = await loadCity(root);
  const original = city.recordsRequests.get(options.id);
  if (!original) fail('NOT_FOUND', 'City records request does not exist in this repository.');
  if (original.value.status !== 'open') {
    fail('INVALID_TRANSITION', `Only open records requests can become ${terminalStatus}.`);
  }
  let responses = [];
  if (terminalStatus === 'resolved') {
    if (!Array.isArray(options.responses) || options.responses.length !== original.value.items.length) {
      fail('INVALID_ARGUMENT', 'Resolve every requested item with exactly one --response JSON value.');
    }
    const canonical = await canonicalRecords(city);
    const index = new Map(canonical.map((record) => [`${record.meta.type}\n${record.meta.id}`, record]));
    responses = options.responses.map((value) => requestResponse(value, original.value.items, index));
    if (new Set(responses.map((response) => response.item)).size !== original.value.items.length) {
      fail('INVALID_ARGUMENT', 'Responses must account for each requested item exactly once.');
    }
    responses.sort((first, second) => first.item - second.item);
  }
  const timestampValue = new Date(Math.max(
    Date.now(), Date.parse(original.value.updatedAt) + 1,
  )).toISOString();
  const updated = validateRecordsRequest({
    ...original.value,
    status: terminalStatus,
    updatedAt: timestampValue,
    history: [
      ...original.value.history,
      {
        from: 'open', to: terminalStatus, actor: options[actorFlag], reason: options.reason,
        timestamp: timestampValue,
      },
    ],
    responses,
  }, city.config.cityId);
  if (Buffer.byteLength(encodeJSON(updated)) > LIMITS.fileBytes) {
    fail('SIZE_LIMIT', 'Resolved records request exceeds the supported record size.');
  }
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const latest = current.recordsRequests.get(options.id);
      if (!latest || !latest.bytes.equals(original.bytes)) {
        fail('CONFLICT', 'City records request changed since validation. Inspect the concurrent edit and retry.');
      }
      if (terminalStatus === 'resolved') {
        const canonical = await canonicalRecords(current);
        const index = new Map(canonical.map((record) => [`${record.meta.type}\n${record.meta.id}`, record]));
        for (const response of responses) {
          for (const reference of response.references) {
            const actual = index.get(`${reference.type}\n${reference.id}`);
            if (!actual || actual.meta.path !== reference.path || actual.meta.sha256 !== reference.sha256) {
              fail('STALE_REFERENCE', 'A response reference changed before write. Fetch it again and retry.');
            }
          }
        }
      }
      await atomicRecord(
        current, 'records-requests', `${updated.id}.json`, updated, original.bytes,
      );
    });
  }
  return {
    command: terminalStatus === 'resolved' ? 'records-resolve' : 'records-cancel',
    root, governance: city.config.governance,
    dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    recordsRequest: updated, notice: governanceNotice(city.config.governance),
  };
}

export async function recordsResolve(root, options) {
  return mutateRecordsRequest(root, options, 'resolved');
}

export async function recordsCancel(root, options) {
  return mutateRecordsRequest(root, options, 'cancelled');
}

export async function validate(root) {
  const city = await loadCity(root);
  return {
    command: 'validate', root, enrolled: true, governance: city.config.governance, valid: true,
    city: citySummary(city),
    records: {
      projects: city.projects.projects.length,
      workOrders: city.workOrders.size,
      workOrderParts: city.workOrderParts.size,
      decisions: city.decisions.size,
      recordsRequests: city.recordsRequests.size,
      requisitions: city.workforce.requisitions.size,
      staff: city.workforce.staff.size,
      assignments: city.workforce.assignments.size,
      institutionalReviews: city.institutionalReviews.size,
      artifacts: city.artifacts.size,
      infrastructureAssets: city.infrastructure.assets.size,
      infrastructureProgramme: Number(Boolean(city.infrastructure.programme)),
      zoningMap: Number(Boolean(city.zoning)),
    },
    institutionalReview: institutionalReviewStatus(city),
    infrastructure: infrastructureStatus(city),
    workforce: { drift: city.workforce.drift },
    capacity: workOrderCapacity(city),
    notice: governanceNotice(city.config.governance),
  };
}

// Flags live work-order files nearing the per-file limit so a file part can be closed before writes fail.
function workOrderCapacity(city) {
  const threshold = Math.floor(LIMITS.fileBytes * 0.8);
  return {
    fileBytesLimit: LIMITS.fileBytes,
    nearLimitThresholdBytes: threshold,
    nearLimitWorkOrders: [...city.workOrders.values()]
      .filter(({ bytes }) => bytes.length >= threshold)
      .map(({ value, bytes, parts }) => ({
        id: value.id, bytes: bytes.length, fileParts: parts.length,
        action: `file-part-close --id ${value.id} --reason TEXT`,
      }))
      .sort((first, second) => second.bytes - first.bytes || first.id.localeCompare(second.id)),
  };
}

async function templateFiles(templateRoot) {
  await directory(templateRoot, 'Installed city templates');
  const files = new Map();
  const names = await entries(templateRoot, 'Installed city templates');
  const allowed = [
    'charter.md', 'instruction-fragment.md', 'policies', 'policy-drafts', 'districts.json', 'projects.json',
    'work-orders', 'decisions', 'records-requests',
  ];
  if (names.some((name) => !allowed.includes(name))) {
    fail('INVALID_TEMPLATE', 'Installed city templates contain unexpected assets; restore the blank draft template package.');
  }
  for (const name of ['charter.md', 'instruction-fragment.md']) {
    files.set(name, (await readRegular(path.join(templateRoot, name), 'Installed city governance template')).bytes);
  }
  const policiesPath = path.join(templateRoot, 'policies');
  const policies = await entries(policiesPath, 'Installed city policy templates');
  if (policies.length === 0) fail('INVALID_TEMPLATE', 'Installed city templates must include draft policies.');
  for (const name of policies) {
    if (!name.endsWith('.md')) fail('INVALID_TEMPLATE', 'Installed policy templates must be regular Markdown files.');
    files.set(`policies/${name}`, (await readRegular(path.join(policiesPath, name), 'Installed city policy template')).bytes);
  }
  if (names.includes('policy-drafts')) {
    const policyDraftsPath = path.join(templateRoot, 'policy-drafts');
    for (const name of await entries(policyDraftsPath, 'Optional policy drafts')) {
      if (!name.endsWith('.md')) fail('INVALID_TEMPLATE', 'Optional policy drafts must be regular Markdown files.');
      files.set(`policy-drafts/${name}`, (await readRegular(path.join(policyDraftsPath, name), 'Optional policy draft')).bytes);
    }
  }
  if (names.includes('districts.json')) {
    const source = await readRegular(path.join(templateRoot, 'districts.json'), 'Installed district template');
    validateDistricts(parseJSON(source.bytes, 'Installed district template'));
    files.set('districts.json', source.bytes);
  }
  if (names.includes('projects.json')) {
    const source = await readRegular(path.join(templateRoot, 'projects.json'), 'Installed projects template');
    validateProjects(parseJSON(source.bytes, 'Installed projects template'));
    files.set('projects.json', source.bytes);
  }
  for (const name of ['work-orders', 'decisions', 'records-requests']) {
    if (names.includes(name) && (await entries(path.join(templateRoot, name), 'Blank template records')).length !== 0) {
      fail('INVALID_TEMPLATE', 'Installed city templates must never contain an actual city record.');
    }
  }
  return files;
}

export async function init(root, options, templateRoot) {
  if (options.name !== undefined) text(options.name, 'City name', 200);
  const existing = await loadCity(root, false);
  if (existing) {
    return {
      ...statusOutput(root, existing, 'init'),
      existing: true, dryRun: !options.apply, changed: false, wouldWrite: false,
    };
  }
  const config = validateConfig({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    plugin: { ...PLUGIN },
    cityId: randomUUID(),
    name: options.name ?? path.basename(root),
    createdAt: new Date().toISOString(),
    governance: 'draft',
    adoption: null,
  });
  const files = await templateFiles(templateRoot);
  files.set('config.json', encodeJSON(config));
  if (!files.has('districts.json')) {
    files.set('districts.json', encodeJSON(validateDistricts({
      schemaVersion: SCHEMA_VERSION,
      districts: [{
        id: 'repository',
        name: 'Repository',
        path: '.',
        description: 'Default district covering this repository.',
      }],
    })));
  }
  if (!files.has('projects.json')) {
    files.set('projects.json', encodeJSON(validateProjects({ schemaVersion: SCHEMA_VERSION, projects: [] })));
  }
  if (options.apply) {
    await publishCity(root, files);
    await loadCity(root);
  }
  return {
    command: 'init', root, enrolled: Boolean(options.apply), governance: 'draft',
    existing: false, dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    config,
    plan: {
      create: [...files.keys(), 'work-orders/', 'decisions/', 'records-requests/']
        .map((name) => `.city/${name}`),
    },
    notice: DRAFT_NOTICE,
  };
}

function mutationOutput(command, root, apply, workOrder, governance) {
  return {
    command, root, governance, dryRun: !apply, changed: Boolean(apply),
    wouldWrite: true, workOrder, notice: governanceNotice(governance),
  };
}

// Exported for regression tests: a write prepared from `before` must fail if the order or its decisions changed.
export function checkOrderUnchanged(before, after, original) {
  const id = original.value.id;
  const decisionIds = (city) => deliveryDecisions(city, id).map((decision) => decision.id).join();
  const latest = after.workOrders.get(id);
  if (!latest || !latest.bytes.equals(original.bytes) || decisionIds(after) !== decisionIds(before)) {
    fail('CONFLICT', 'City work order or its decisions changed since validation. Inspect concurrent edits and retry.');
  }
}

function checkInfrastructureUnchanged(before, after, ids) {
  for (const id of ids) {
    const first = before.infrastructure.assets.get(id);
    const second = after.infrastructure.assets.get(id);
    if (!first || !second || !first.bytes.equals(second.bytes)) {
      fail('CONFLICT', 'A pinned infrastructure asset changed since scope validation. Review its current record and retry.');
    }
  }
}

function checkCityUnchanged(before, after) {
  const sameProjects = before.projectsBytes === null
    ? after.projectsBytes === null
    : after.projectsBytes !== null && before.projectsBytes.equals(after.projectsBytes);
  const sameAssets = before.infrastructure.assets.size === after.infrastructure.assets.size
    && [...before.infrastructure.assets].every(([id, record]) => (
      after.infrastructure.assets.get(id)?.bytes.equals(record.bytes)
    ));
  const beforeProgramme = before.infrastructure.programme?.bytes ?? null;
  const afterProgramme = after.infrastructure.programme?.bytes ?? null;
  const sameProgramme = beforeProgramme === null
    ? afterProgramme === null
    : afterProgramme !== null && beforeProgramme.equals(afterProgramme);
  const beforeZoning = before.zoningBytes ?? null;
  const afterZoning = after.zoningBytes ?? null;
  const sameZoning = beforeZoning === null
    ? afterZoning === null
    : afterZoning !== null && beforeZoning.equals(afterZoning);
  if (!before.configBytes.equals(after.configBytes) || !sameProjects || !sameAssets || !sameProgramme || !sameZoning) {
    fail('CONFLICT', 'City config, projects, zoning map, or infrastructure records changed since validation. Inspect the concurrent edit and retry.');
  }
}

export async function projectAdd(root, options) {
  text(options.id, 'Project ID', 64);
  text(options.name, 'Project name', 200);
  text(options.path, 'Project path', 500);
  text(options.description, 'Project description', 2000);
  const city = await loadCity(root);
  const projects = validateProjects({
    ...city.projects,
    projects: [...city.projects.projects, {
      id: options.id, name: options.name, path: options.path, description: options.description,
    }],
  });
  await assertProjectPaths(root, projects);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      const currentProjects = validateProjects({
        ...current.projects,
        projects: [...current.projects.projects, {
          id: options.id, name: options.name, path: options.path, description: options.description,
        }],
      });
      await assertProjectPaths(root, currentProjects);
      await atomicCityFile(current, 'projects.json', currentProjects, city.projectsBytes);
    });
  }
  return {
    command: 'project-add', root, governance: city.config.governance,
    dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    project: projects.projects.at(-1), projects: projects.projects,
    notice: governanceNotice(city.config.governance),
  };
}

export async function petition(root, options) {
  text(options.title, 'Petition title', 500);
  text(options.request, 'Petition request', 20000);
  if (!Array.isArray(options.projects) || options.projects.length > 100) {
    fail('INVALID_ARGUMENT', 'Select at most 100 registered projects with repeated --project flags.');
  }
  if (new Set(options.projects).size !== options.projects.length) {
    fail('INVALID_ARGUMENT', 'A project may be selected only once per work order.');
  }
  if (!Array.isArray(options.criteria) || options.criteria.length > LIMITS.criteria) {
    fail('INVALID_ARGUMENT', `At most ${LIMITS.criteria} acceptance criteria may be supplied.`);
  }
  options.criteria.forEach((value) => text(value, 'Petition criterion', 2000));
  const city = await loadCity(root);
  const registeredProjects = new Set(city.projects.projects.map((project) => project.id));
  if (options.projects.some((id) => !registeredProjects.has(id))) {
    fail('NOT_FOUND', 'Every selected project must be registered in this repository.');
  }
  let infrastructure = null;
  if (options.infrastructure !== undefined) {
    const proposed = requestJSON(options.infrastructure, 'Petition --infrastructure');
    if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)
      || Object.keys(proposed).length !== 4
      || !['assets', 'targets', 'obligations', 'findings'].every((key) => Object.hasOwn(proposed, key))) {
      fail('INVALID_ARGUMENT', '--infrastructure must contain exactly assets, targets, obligations, and findings arrays.');
    }
    if (!Array.isArray(proposed.assets) || proposed.assets.length === 0 || proposed.assets.length > 100
      || new Set(proposed.assets).size !== proposed.assets.length) {
      fail('INVALID_ARGUMENT', '--infrastructure assets must contain unique asset IDs.');
    }
    proposed.assets.forEach((id) => validateRecordId('infrastructure-asset', id, 'Infrastructure asset ID'));
    if (!Array.isArray(proposed.targets) || !Array.isArray(proposed.obligations) || !Array.isArray(proposed.findings)) {
      fail('INVALID_ARGUMENT', 'Infrastructure targets, obligations, and findings must be arrays.');
    }
    infrastructure = {
      assets: proposed.assets.map((id) => {
        const asset = city.infrastructure.assets.get(id)?.value;
        if (!asset) fail('NOT_FOUND', `Infrastructure asset ${id} is not registered in this city.`);
        if (asset.lifecycle !== 'active') fail('INVALID_TRANSITION', `Infrastructure asset ${id} is not active for delivery.`);
        return {
          assetId: id, revision: asset.revision, locators: asset.locators,
          baseline: asset.baseline, criticality: asset.criticality,
        };
      }),
      targets: proposed.targets,
      obligations: proposed.obligations,
      findings: proposed.findings.map((reference) => {
        if (!reference || typeof reference !== 'object' || Array.isArray(reference)
          || Object.keys(reference).length !== 2
          || !Object.hasOwn(reference, 'assetId') || !Object.hasOwn(reference, 'findingId')) {
          fail('INVALID_ARGUMENT', 'Each infrastructure finding reference must contain exactly assetId and findingId.');
        }
        validateRecordId('infrastructure-asset', reference.assetId, 'Infrastructure finding asset ID');
        text(reference.findingId, 'Infrastructure finding ID', 64);
        const asset = city.infrastructure.assets.get(reference.assetId)?.value;
        const finding = asset?.findings.find((item) => item.id === reference.findingId);
        if (!finding || finding.status !== 'open') fail('STALE_INFRASTRUCTURE', 'Infrastructure finding is missing or already resolved.');
        return { ...reference, kind: finding.kind };
      }),
    };
    const consumerProjects = new Set(infrastructure.assets.flatMap((asset) => (
      city.infrastructure.assets.get(asset.assetId).value.projectIds
    )));
    if (options.projects.some((projectId) => !consumerProjects.has(projectId))) {
      fail('INVALID_ARGUMENT', 'An infrastructure work order may associate only consumer projects recorded on its pinned assets.');
    }
    validateInfrastructureWorkScope(infrastructure);
    for (const reference of infrastructure.obligations) {
      const asset = city.infrastructure.assets.get(reference.assetId).value;
      const obligation = asset.obligations.find((item) => item.id === reference.obligationId);
      if (!obligation || obligation.status === 'satisfied'
        || (obligation.dueDate !== reference.dueDate && obligation.nextReviewDate !== reference.dueDate)) {
        fail('STALE_INFRASTRUCTURE', 'Infrastructure maintenance occurrence is missing, satisfied, or no longer current.');
      }
      const duplicate = [...city.workOrders.values()].find(({ value }) => (
        !['completed', 'rejected', 'withdrawn'].includes(value.status)
        && value.infrastructure?.obligations.some((item) => item.assetId === reference.assetId
          && item.obligationId === reference.obligationId && item.dueDate === reference.dueDate)
      ));
      if (duplicate) fail('CONFLICT', `Infrastructure occurrence already has open work order ${duplicate.value.id}.`);
    }
    for (const reference of infrastructure.findings) {
      const asset = city.infrastructure.assets.get(reference.assetId).value;
      const finding = asset.findings.find((item) => item.id === reference.findingId);
      if (!finding || finding.status !== 'open') fail('STALE_INFRASTRUCTURE', 'Infrastructure finding is missing or already resolved.');
      const duplicate = [...city.workOrders.values()].find(({ value }) => (
        !['completed', 'rejected', 'withdrawn'].includes(value.status)
        && value.infrastructure?.findings.some((item) => item.assetId === reference.assetId
          && item.findingId === reference.findingId)
      ));
      if (duplicate) fail('CONFLICT', `Infrastructure finding already has open work order ${duplicate.value.id}.`);
    }
    await assertInfrastructureTargets(root, infrastructure, city.infrastructure.assets);
  }
  if (options.projects.length === 0 && !infrastructure) {
    fail('PROJECT_REQUIRED', 'Select one or more registered --project IDs or provide an exact --infrastructure scope.');
  }
  if (city.workOrders.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported draft work-order count.');
  const now = new Date().toISOString();
  const workOrder = validateWorkOrder({
    schemaVersion: infrastructure ? INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION : WORK_ORDER_SCHEMA_VERSION,
    id: `WO-${randomUUID()}`,
    cityId: city.config.cityId,
    title: options.title,
    request: options.request,
    acceptanceCriteria: options.criteria,
    ...(options.projects.length ? { projectIds: options.projects } : {}),
    ...(infrastructure ? { infrastructure } : {}),
    status: 'received',
    createdAt: now,
    updatedAt: now,
    history: [{ from: null, to: 'received', reason: 'Petition received as draft intake, not delivery authorization.', timestamp: now }],
    provenance: provenance(),
  }, city.config.cityId);
  preparedWorkOrder(workOrder, null);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      if (infrastructure) checkInfrastructureUnchanged(city, current, infrastructure.assets.map((asset) => asset.assetId));
      if (current.workOrders.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported draft work-order count.');
      await atomicRecord(current, 'work-orders', `${workOrder.id}.json`, workOrder);
    });
  }
  return mutationOutput('petition', root, options.apply, workOrder, city.config.governance);
}

export async function transition(root, options) {
  validateOrderId(options.id);
  validateState(options.to);
  if (Object.hasOwn(COMMAND_ONLY_STATES, options.to)) {
    fail('AUTHORIZATION_REQUIRED', 'Authorized and completed are entered only through the authorize and complete commands, which record a linked decision. A transition is never authorization or acceptance.');
  }
  text(options.reason, 'Transition reason', 4000);
  const city = await loadCity(root);
  const original = city.workOrders.get(options.id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  checkTransition(
    original.value.status, options.to, original.value.acceptanceCriteria, authorizationCurrent(original.value.history),
  );
  assertPermitTransition(city, original.value, options.to);
  if (options.to === 'awaiting-approval') assertDevelopmentReady(city, original.value);
  if (['in-progress', 'inspection', 'awaiting-approval'].includes(options.to)) {
    assertInfrastructureScopeCurrent(city, original.value);
  }
  // Never record history before a linked decision (such as a referral) that left the order bytes unchanged.
  const latestDecision = deliveryDecisions(city, original.value.id).at(-1);
  const now = new Date(Math.max(
    Date.now(), Date.parse(original.value.updatedAt), latestDecision ? Date.parse(latestDecision.createdAt) : 0,
  )).toISOString();
  const workOrder = validateWorkOrder({
    ...original.value,
    status: options.to,
    updatedAt: now,
    history: [
      ...original.value.history,
      { from: original.value.status, to: options.to, reason: options.reason, timestamp: now },
    ],
  }, city.config.cityId);
  const stored = preparedWorkOrder(workOrder, original);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      checkOrderUnchanged(city, current, original);
      if (options.to === 'awaiting-approval') {
        checkDevelopmentContextUnchanged(city, current);
        assertDevelopmentReady(current, original.value);
      }
      if (['in-progress', 'inspection', 'awaiting-approval'].includes(options.to)) {
        assertInfrastructureScopeCurrent(current, original.value);
      }
      assertPermitTransition(current, original.value, options.to);
      await atomicRecord(current, 'work-orders', `${workOrder.id}.json`, stored, original.bytes);
    });
  }
  return mutationOutput('transition', root, options.apply, workOrder, city.config.governance);
}

function assertPermitTransition(city, order, target) {
  if (!permitPolicyEnabled(city)) return;
  const current = permitStatus(city, order);
  if (['in-progress', 'inspection'].includes(target) && current.state === 'lapsed') {
    fail('PERMIT_LAPSED', 'This permit has lapsed. Obtain an allowed permit extension or return the work order for a fresh screening and authorization before delivery continues.');
  }
  if (target === 'inspection' && current.state === 'active') {
    const notice = (order.development?.completionNotices ?? []).at(-1);
    if (!notice || notice.permitId !== current.permit.permitId) {
      fail('COMPLETION_NOTICE_REQUIRED', 'Record a completion notice for the current permit before inspection.');
    }
    const lastDeliveryRestart = order.history.findLast((entry) => entry.to === 'in-progress')?.timestamp;
    if (lastDeliveryRestart && notice.recordedAt < lastDeliveryRestart) {
      fail('COMPLETION_NOTICE_REQUIRED', 'A new completion notice is required after delivery resumes from a failed inspection.');
    }
    const expected = current.permit.conditions.map((condition) => condition.id).sort();
    const supplied = notice.conditions.map((condition) => condition.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(supplied)) {
      fail('PERMIT_CONDITIONS_INCOMPLETE', 'The completion notice must address every current permit condition.');
    }
  }
}

function checkDevelopmentContextUnchanged(before, after) {
  const sameProjects = before.projectsBytes === null
    ? after.projectsBytes === null
    : after.projectsBytes !== null && before.projectsBytes.equals(after.projectsBytes);
  if (!before.districtsBytes.equals(after.districtsBytes) || !sameProjects
    || (before.zoningBytes === null) !== (after.zoningBytes === null)
    || (before.zoningBytes && !before.zoningBytes.equals(after.zoningBytes))
    || JSON.stringify(before.governanceDigests) !== JSON.stringify(after.governanceDigests)) {
    fail('CONFLICT', 'Development policy, district, or zoning context changed since preparation. Review and retry.');
  }
}

function requirePermitCompetency(city, staffId, dimension, riskClass) {
  const staff = city.workforce.staff.get(staffId)?.value;
  const requisition = staff && city.workforce.requisitions.get(staff.requisitionId)?.value;
  const competency = `permit-${dimension}-class-${riskClass}`;
  if (!staff || staff.status !== 'active' || !requisition?.competencies.includes(competency)) {
    fail('QUALIFIED_STAFF_REQUIRED', `An active staff member with recorded competency ${competency} is required.`);
  }
}

export async function developmentRecord(root, options, kind) {
  validateOrderId(options.id);
  const input = validateDevelopmentInput(kind, requestJSON(options.data, 'Development --data'));
  const city = await loadCity(root);
  const original = city.workOrders.get(options.id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  const order = original.value;
  let scopedOrder = order;
  const development = {
    screenings: [], applications: [], assessments: [], statements: [], verifications: [], completionNotices: [],
    ...order.development,
  };
  const zoningCheck = zoningEnabled(city) ? currentZoningCheck(city, order) : null;
  if (kind !== 'completionNotices' && !developmentPreparationAllowed(order)) {
    fail('INVALID_TRANSITION', 'Development preparation is recorded before delivery; reopen or return a case before a new planning cycle.');
  }
  if (kind === 'screenings') {
    const registered = new Set(city.projects.projects.map((project) => project.id));
    if (input.projectIds.some((id) => !registered.has(id))) fail('NOT_FOUND', 'Select registered development project IDs or ask a focused resident question.');
    const sameScope = JSON.stringify([...input.projectIds].sort()) === JSON.stringify([...(order.projectIds ?? [])].sort());
    if (input.route !== 'needs-clarification' && order.projectIds && !sameScope) {
      fail('INVALID_ARGUMENT', 'Conclusive screening must cover the exact work-order project scope. Resolve scope before screening.');
    }
    if (input.route !== 'needs-clarification' && order.schemaVersion === INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION) {
      if (!order.infrastructure || (input.projectIds.length === 0 && order.infrastructure.targets.length === 0)) {
        fail('INVALID_ARGUMENT', 'Conclusive infrastructure screening must cover an exact registered project or infrastructure delivery scope.');
      }
      assertInfrastructureScopeCurrent(city, order);
    } else if (input.route !== 'needs-clarification' && input.projectIds.length === 0) {
      fail('INVALID_ARGUMENT', 'Conclusive screening needs a registered project or pinned infrastructure delivery scope.');
    } else if (input.route !== 'needs-clarification' && !order.projectIds) {
      scopedOrder = { ...order, schemaVersion: WORK_ORDER_SCHEMA_VERSION, projectIds: input.projectIds };
    }
    if (input.policyCitations.some((citation) => !city.governanceDigests.policies.some((policy) => policy.path === citation.path))) {
      fail('NOT_FOUND', 'Every cited development policy must exist in the local policy register.');
    }
    if (zoningCheck?.outcome === 'conditional' && input.route === 'formal') {
      const conditions = [...new Set(zoningCheck.coverage.flatMap((scope) => scope.determinations
        .filter((item) => item.disposition === 'conditional')
        .flatMap((item) => item.requirements)))];
      if (conditions.some((condition) => !input.requirements.some((requirement) => (
        requirement.description.includes(condition)
      )))) {
        fail('INVALID_ARGUMENT', 'Formal screening must include every named conditional zoning requirement.');
      }
    } else if (zoningCheck?.outcome === 'conditional' && input.route === 'lightweight') {
      fail('DEVELOPMENT_NOT_READY', 'A conditional zoning finding requires formal screening and an independently assessed application.');
    }
    if (permitPolicyEnabled(city)) {
      if (!input.permit) fail('PERMIT_CLASSIFICATION_REQUIRED', 'The adopted building-permits policy requires safety and structural classes on every screening.');
      const maximumClass = Math.max(input.permit.safetyClass, input.permit.structuralClass);
      if (input.route === 'lightweight' && maximumClass > 2) {
        fail('INVALID_ARGUMENT', 'Lightweight screening is limited to safety and structural classes 1 and 2.');
      }
      if (input.impacts.includes('security') && input.permit.safetyClass < 2) {
        fail('INVALID_ARGUMENT', 'Security impacts require safety class 2 or higher.');
      }
      if (input.impacts.some((impact) => ['architecture', 'ownership-boundary', 'public-interface', 'data-migration', 'cross-project'].includes(impact))
        && input.permit.structuralClass < 2) {
        fail('INVALID_ARGUMENT', 'Architecture, boundary, interface, migration, and cross-project impacts require structural class 2 or higher.');
      }
    }
  } else {
    const screening = currentScreening(city, order);
    if (!screening || screening.route === 'needs-clarification') fail('STALE_DEVELOPMENT', 'Record a current conclusive screening before permit records.');
    if (['applications', 'assessments'].includes(kind) && screening.route !== 'formal') {
      fail('STALE_DEVELOPMENT', 'Formal application records require a current formal screening.');
    }
    if (kind === 'applications') {
      if (input.screeningRevision !== screening.revision) fail('STALE_DEVELOPMENT', 'Application must reference the exact current formal screening revision.');
    } else if (kind === 'assessments') {
      const application = development.applications.at(-1);
      if (!application || application.revision !== input.applicationRevision || application.screeningRevision !== screening.revision) {
        fail('STALE_DEVELOPMENT', 'Independent assessment must reference the exact current application revision.');
      }
      if (input.outcome === 'ready' && applicationMissing(screening, application).length) {
        fail('DEVELOPMENT_NOT_READY', 'Missing required artifact evidence or resident answers; do not claim readiness.');
      }
      if (input.outcome === 'ready' && zoningCheck?.outcome === 'conditional') {
        const conditions = [...new Set(zoningCheck.coverage.flatMap((scope) => scope.determinations
          .filter((item) => item.disposition === 'conditional')
          .flatMap((item) => item.requirements)))];
        const unsatisfied = conditions.filter((condition) => {
          const requirement = screening.requirements.find((entry) => entry.description.includes(condition));
          return !requirement || !application.artifacts.some((artifact) => (
            artifact.requirementId === requirement.id && artifact.disposition === 'provided'
          ));
        });
        if (unsatisfied.length) fail('DEVELOPMENT_NOT_READY', 'Conditional zoning requirements need provided application evidence.');
      }
    } else if (kind === 'statements') {
      const screening = currentScreening(city, order);
      const requiredClass = screening?.permit?.[`${input.dimension}Class`];
      if (!permitPolicyEnabled(city) || !screening?.permit || input.screeningRevision !== screening.revision
        || input.class !== requiredClass || input.class < 3) {
        fail('STALE_DEVELOPMENT', 'Permit statement must match a current class 3 or 4 risk classification.');
      }
      requirePermitCompetency(city, input.staffId, input.dimension, input.class);
      const head = currentStatement(order, input.dimension, screening.revision);
      if (input.supersedes === undefined && head) {
        fail('INVALID_ARGUMENT', `Permit statement revision ${head.revision} already exists for this risk dimension and screening. To correct it, record a replacement with supersedes ${head.revision} and a correctionReason; the original stays in history. Re-screen instead if the risk classification itself must change.`);
      }
      if (input.supersedes !== undefined && head?.revision !== input.supersedes) {
        fail('STALE_DEVELOPMENT', head
          ? `Only the current permit statement can be superseded; the current statement for this dimension and screening is revision ${head.revision}.`
          : 'There is no current permit statement for this risk dimension and screening to supersede.');
      }
      if (input.evidenceArtifactId) {
        const artifact = city.artifacts.get(input.evidenceArtifactId);
        if (!artifact) fail('NOT_FOUND', 'Permit statement evidenceArtifactId must reference a filed artifact.');
        if (artifact.value.workOrderId !== order.id) {
          fail('INVALID_ARGUMENT', 'Permit statement evidenceArtifactId must reference an artifact filed for this work order.');
        }
      }
    } else if (kind === 'verifications') {
      const statement = development.statements[input.statementRevision - 1];
      if (!statement || statement.class !== 4) {
        fail('STALE_DEVELOPMENT', 'Independent verification must reference a current class 4 professional statement.');
      }
      if (development.statements.some((next) => next.supersedes === statement.revision)) {
        fail('STALE_DEVELOPMENT', 'This permit statement was superseded by a correction; verify the current statement instead.');
      }
      if (statement.staffId === input.staffId) fail('SEPARATION_OF_DUTIES', 'The professional statement author cannot verify the same statement.');
      const assignment = currentAssignments(city).get(order.id);
      if (assignment?.staffId === input.staffId) {
        fail('SEPARATION_OF_DUTIES', 'The assigned engineer cannot independently verify their own permit statement.');
      }
      requirePermitCompetency(city, input.staffId, statement.dimension, statement.class);
      if (development.verifications.some((verification) => verification.statementRevision === statement.revision)) {
        fail('INVALID_ARGUMENT', 'This permit statement already has an independent verification.');
      }
    } else if (kind === 'completionNotices') {
      const permit = permitStatus(city, order);
      if (permit.state !== 'active' || permit.permit.permitId !== input.permitId) {
        fail('STALE_PERMIT', 'Completion notice must reference the current active permit.');
      }
      const expected = permit.permit.conditions.map((condition) => condition.id).sort();
      const supplied = input.conditions.map((condition) => condition.id).sort();
      if (JSON.stringify(expected) !== JSON.stringify(supplied)
        || input.conditions.some((condition) => condition.status !== 'met' && condition.status !== 'not-applicable')) {
        fail('PERMIT_CONDITIONS_INCOMPLETE', 'Completion notice must address every permit condition exactly once.');
      }
    }
  }
  const previousTimes = Object.values(development).flat().map((record) => Date.parse(record.recordedAt));
  const recordedAt = new Date(Math.max(Date.now(), Date.parse(order.updatedAt), ...previousTimes)).toISOString();
  const record = {
    ...input, revision: development[kind].length + 1, recordedAt,
    sourceOffice: ({
      applications: 'development-advisor',
      statements: 'engineering-manager',
      verifications: 'city-auditor',
      completionNotices: 'engineering-manager',
    })[kind] ?? 'chief-planner',
    authenticated: false, provenance: provenance(),
    ...(kind === 'screenings' ? { snapshot: developmentSnapshot(city, scopedOrder) } : {}),
  };
  // Metadata has its own timestamps; updatedAt must remain the final lifecycle timestamp.
  const workOrder = validateWorkOrder({
    ...scopedOrder, development: { ...development, [kind]: [...development[kind], record] },
  }, city.config.cityId);
  const stored = preparedWorkOrder(workOrder, original);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      checkOrderUnchanged(city, current, original);
      checkDevelopmentContextUnchanged(city, current);
      if (input.evidenceArtifactId
        && !current.artifacts.get(input.evidenceArtifactId)?.bytes.equals(city.artifacts.get(input.evidenceArtifactId).bytes)) {
        fail('CONFLICT', 'The cited evidence artifact changed since validation. Review it and retry.');
      }
      await atomicRecord(current, 'work-orders', `${order.id}.json`, stored, original.bytes);
    });
  }
  const command = { screenings: 'screen-development', applications: 'application-record', assessments: 'assess-application' }[kind];
  return {
    ...mutationOutput(command, root, options.apply, workOrder, city.config.governance),
    scopeAssigned: !order.projectIds && Boolean(workOrder.projectIds) && !order.infrastructure,
    development: developmentStatus(city, workOrder),
  };
}

export async function zoningMapRecord(root, options) {
  const zoning = validateZoningMap(requestJSON(options.data, 'Zoning map --data'));
  const city = await loadCity(root);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      if (!current.configBytes.equals(city.configBytes)
        || (current.zoningBytes === null) !== (city.zoningBytes === null)
        || (current.zoningBytes && !current.zoningBytes.equals(city.zoningBytes))) {
        fail('CONFLICT', 'City config or zoning map changed since validation. Inspect concurrent edits and retry.');
      }
      await atomicCityFile(current, 'zoning.json', zoning, city.zoningBytes);
    });
  }
  return {
    command: 'zoning-map', root, governance: city.config.governance,
    dryRun: !options.apply, changed: Boolean(options.apply), wouldWrite: true,
    zoning, notice: 'Recording a zoning map is not policy adoption, authorization, or permission to deliver.',
  };
}

export async function zoningCheckRecord(root, options) {
  validateOrderId(options.id);
  const input = validateZoningCheckInput(requestJSON(options.data, 'Zoning check --data'));
  const city = await loadCity(root);
  if (!city.zoning) fail('ZONING_MAP_MISSING', 'Record a valid zoning map with zoning-map before checking a work order.');
  const original = city.workOrders.get(options.id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  if (!developmentPreparationAllowed(original.value)) {
    fail('INVALID_TRANSITION', 'Zoning checks are recorded before delivery or after a new planning cycle.');
  }
  const { coverage, outcome } = assessZoning(city, original.value, input.changeTypes);
  const priorDevelopment = original.value.development ?? {
    screenings: [], applications: [], assessments: [], zoningChecks: [],
  };
  const zoningChecks = priorDevelopment.zoningChecks ?? [];
  const previousTimes = Object.values(priorDevelopment).flat().map((record) => Date.parse(record.recordedAt));
  const recordedAt = new Date(Math.max(Date.now(), Date.parse(original.value.updatedAt), ...previousTimes)).toISOString();
  const record = {
    ...input, revision: zoningChecks.length + 1, recordedAt, coverage, outcome,
    sourceOffice: 'chief-planner', authenticated: false, provenance: provenance(),
    snapshot: zoningSnapshot(city, original.value, input.changeTypes),
  };
  const workOrder = validateWorkOrder({
    ...original.value,
    development: { ...priorDevelopment, zoningChecks: [...zoningChecks, record] },
  }, city.config.cityId);
  const stored = preparedWorkOrder(workOrder, original);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkOrderUnchanged(city, current, original);
      checkDevelopmentContextUnchanged(city, current);
      if (original.value.infrastructure?.assets.length) {
        checkInfrastructureUnchanged(city, current, original.value.infrastructure.assets.map((pin) => pin.assetId));
        assertInfrastructureScopeCurrent(current, original.value);
      }
      await atomicRecord(current, 'work-orders', `${workOrder.id}.json`, stored, original.bytes);
    });
  }
  return {
    ...mutationOutput('zoning-check', root, options.apply, workOrder, city.config.governance),
    zoning: zoningStatus(city, workOrder),
    development: developmentStatus(city, workOrder),
  };
}

async function deliveryContext(root, id) {
  const city = await loadCity(root);
  if (city.config.governance !== 'adopted') {
    fail('NOT_ADOPTED', 'City governance is still draft. A resident must adopt the charter and policies before delivery decisions can be recorded.');
  }
  if (!city.drift.matchesAdoptedRevision) {
    fail('GOVERNANCE_DRIFT', 'The charter or policies differ from the adopted revision. Record the revision with amend, or restore the adopted text, before recording delivery decisions.');
  }
  const original = city.workOrders.get(id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  const digests = await governanceDigests(city.path);
  return { city, original, digests };
}

function decisionTimestamp(city, order) {
  const previous = deliveryDecisions(city, order.id).at(-1);
  return new Date(Math.max(
    Date.now(), Date.parse(order.updatedAt) + 1, previous ? Date.parse(previous.createdAt) + 1 : 0,
  )).toISOString();
}

function validatePermitInput(value, city, order) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'conditions') || !Object.hasOwn(value, 'rightOfWay')) {
    fail('INVALID_ARGUMENT', 'Permit input must contain exactly conditions and rightOfWay arrays.');
  }
  if (!Array.isArray(value.conditions) || value.conditions.length > 50
    || new Set(value.conditions.map((condition) => condition?.id)).size !== value.conditions.length) {
    fail('INVALID_ARGUMENT', 'Permit conditions must be a bounded array with unique IDs.');
  }
  for (const condition of value.conditions) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)
      || Object.keys(condition).length !== 2 || !Object.hasOwn(condition, 'id') || !Object.hasOwn(condition, 'description')
      || typeof condition.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(condition.id)) {
      fail('INVALID_ARGUMENT', 'Each permit condition requires a safe id and description.');
    }
    text(condition.description, 'Permit condition description', 2000);
  }
  if (!Array.isArray(value.rightOfWay) || value.rightOfWay.length > 50
    || new Set(value.rightOfWay.map((consent) => consent?.projectId)).size !== value.rightOfWay.length) {
    fail('INVALID_ARGUMENT', 'Permit rightOfWay must be a bounded array with unique project IDs.');
  }
  for (const consent of value.rightOfWay) {
    if (!consent || typeof consent !== 'object' || Array.isArray(consent)
      || Object.keys(consent).length !== 3
      || !['projectId', 'consentBy', 'evidence'].every((key) => Object.hasOwn(consent, key))
      || !city.projects.projects.some((project) => project.id === consent.projectId)
      || order.projectIds?.includes(consent.projectId)) {
      fail('INVALID_ARGUMENT', 'Right-of-way consent must identify a registered project outside this work order scope.');
    }
    text(consent.consentBy, 'Right-of-way consentBy', 200);
    text(consent.evidence, 'Right-of-way consent evidence', 4000);
  }
  const screening = currentScreening(city, order);
  const crossBoundary = screening?.impacts.some((impact) => ['cross-project', 'ownership-boundary'].includes(impact));
  if (crossBoundary && value.rightOfWay.length === 0) {
    fail('RIGHT_OF_WAY_REQUIRED', 'Cross-project or ownership-boundary work needs recorded consent from the affected project owner.');
  }
  return value;
}

function issuePermit(city, order, terms, issuedAt) {
  const classification = currentScreening(city, order)?.permit;
  if (!classification) fail('DEVELOPMENT_NOT_READY', 'A current risk classification is required before issuing a permit.');
  const commencementDeadline = new Date(Date.parse(issuedAt) + PERMIT_COMMENCEMENT_DAYS * dayMilliseconds)
    .toISOString().slice(0, 10);
  return {
    permitId: `PMT-${randomUUID()}`,
    safetyClass: classification.safetyClass,
    structuralClass: classification.structuralClass,
    issuedAt,
    conditions: terms.conditions,
    rightOfWay: terms.rightOfWay,
    commencementDeadline,
    inactivityDays: PERMIT_INACTIVITY_DAYS,
  };
}

function deliveryRecords(context, fields, historyReason) {
  const { city, original, digests } = context;
  const createdAt = decisionTimestamp(city, original.value);
  const permit = fields.permitInput ? issuePermit(city, original.value, fields.permitInput, createdAt) : null;
  const decision = validateDecision({
    schemaVersion: DELIVERY_DECISION_SCHEMA_VERSION,
    id: `DEC-${randomUUID()}`,
    cityId: city.config.cityId,
    kind: fields.kind,
    workOrderIds: [original.value.id],
    outcome: fields.outcome,
    decidedBy: fields.decidedBy,
    basis: fields.basis,
    routineClass: fields.routineClass,
    reservedMatters: fields.reservedMatters,
    reason: fields.reason,
    subject: {
      workOrderSha256: sha256(original.bytes),
      charterSha256: digests.charter,
      delegationPolicySha256: digests.policies.find((policy) => policy.path === DELEGATION_POLICY)?.sha256 ?? null,
    },
    evidence: { declaredBy: fields.declaredBy, reference: fields.reference, authenticated: false },
    ...(permit ? { permit } : {}),
    createdAt,
    provenance: provenance(),
  }, city.config.cityId);
  const state = OUTCOME_STATES[fields.outcome];
  const workOrder = state === null ? original.value : validateWorkOrder({
    ...original.value,
    status: state,
    updatedAt: createdAt,
    history: [
      ...original.value.history,
      { from: original.value.status, to: state, reason: historyReason(decision.id), timestamp: createdAt },
    ],
  }, city.config.cityId);
  if (Buffer.byteLength(encodeJSON(decision)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed city decision exceeds the supported local file size.');
  const stored = state === null ? null : preparedWorkOrder(workOrder, original);
  if (city.decisions.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported decision count.');
  return { decision, workOrder, stored, changesOrder: state !== null };
}

async function writeDeliveryRecords(root, context, records) {
  const { city, original, digests } = context;
  const { decision, workOrder, stored, changesOrder } = records;
  await withMutationLock(city.path, city.identity, async () => {
    const current = await loadCity(root);
    checkCityUnchanged(city, current);
    checkOrderUnchanged(city, current, original);
    if (JSON.stringify(await governanceDigests(current.path)) !== JSON.stringify(digests)) {
      fail('CONFLICT', 'The charter or policies changed since this decision was prepared. Review the current text and retry.');
    }
    checkDevelopmentContextUnchanged(city, current);
    if (['authorize', 'accept'].includes(decision.outcome)) {
      assertInfrastructureScopeCurrent(current, original.value);
      if (decision.outcome === 'authorize') assertDevelopmentReady(current, original.value);
    }
    if (current.decisions.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported decision count.');
    await atomicRecord(current, 'decisions', `${decision.id}.json`, decision);
    if (!changesOrder) return;
    try {
      await atomicRecord(current, 'work-orders', `${workOrder.id}.json`, stored, original.bytes);
    } catch (error) {
      const cause = error instanceof CityError ? error.code : 'FILESYSTEM_ERROR';
      fail('PARTIAL_WRITE', `Decision .city/decisions/${decision.id}.json was written but work order .city/work-orders/${workOrder.id}.json was not updated (${cause}). The city will not validate until you remove that decision file or restore both records from backup; then run validate.`);
    }
  });
  await loadCity(root);
}

// Routing hint for coordinators; it grants no authority and is null for acceptance decisions.
const NEXT_STEPS = Object.freeze({
  authorize: { actor: 'engineering-manager', action: 'assign-engineer' },
  return: { actor: 'chief-planner', action: 'revise-proposal' },
  refer: { actor: 'resident', action: 'decide-referral' },
  reject: { actor: null, action: 'none' },
});

function deliveryOutput(command, root, apply, context, records) {
  return {
    command, root, governance: context.city.config.governance, dryRun: !apply, changed: Boolean(apply),
    wouldWrite: true, decision: records.decision, workOrder: records.workOrder,
    plan: {
      create: [`.city/decisions/${records.decision.id}.json`],
      replace: records.changesOrder ? [`.city/work-orders/${records.workOrder.id}.json`] : [],
    },
    next: NEXT_STEPS[records.decision.outcome] ?? null,
    notice: governanceNotice(context.city.config.governance),
  };
}

const HISTORY_REASONS = Object.freeze({
  authorize: 'Delivery authorized',
  reject: 'Rejected at the authorization checkpoint',
  return: 'Returned to proposed at the authorization checkpoint',
});

export async function authorize(root, options) {
  validateOrderId(options.id);
  const decidedBy = options['decided-by'];
  if (!DECIDERS.includes(decidedBy)) fail('INVALID_ARGUMENT', '--decided-by must be city-council or resident.');
  if (!AUTHORIZATION_OUTCOMES.includes(options.outcome)) {
    fail('INVALID_ARGUMENT', '--outcome must be authorize, reject, return or refer.');
  }
  const reservedMatters = parseReserved(options.reserved);
  text(options.reason, '--reason', 4000);
  const routineClass = options['routine-class'] ?? null;
  if (routineClass !== null) {
    if (!ROUTINE_CLASSES.includes(routineClass)) {
      fail('INVALID_ARGUMENT', `--routine-class must be one of: ${ROUTINE_CLASSES.join(', ')}.`);
    }
    if (decidedBy !== 'city-council' || options.outcome !== 'authorize') {
      fail('INVALID_ARGUMENT', '--routine-class applies only to a city-council authorize outcome under the routine-policy basis.');
    }
  }
  if (decidedBy === 'city-council') {
    if (options['declared-by'] !== undefined || options.evidence !== undefined) {
      fail('INVALID_ARGUMENT', 'City Council decisions do not carry resident declarations; omit --declared-by and --evidence.');
    }
  } else {
    if (options['declared-by'] === undefined || options.evidence === undefined) {
      fail('RESIDENT_EVIDENCE_REQUIRED', 'A resident decision requires --declared-by and --evidence describing the resident declaration.');
    }
    text(options['declared-by'], '--declared-by', 200);
    text(options.evidence, '--evidence', 4000);
  }
  const context = await deliveryContext(root, options.id);
  const { city, original } = context;
  if (decidedBy === 'city-council' && !city.config.adoption.policies.some((policy) => policy.path === DELEGATION_POLICY)) {
    fail('NO_DELEGATION', `The adopted policies do not include ${DELEGATION_POLICY}. Without an adopted council delegation only the resident can decide; adopt or amend the policy first.`);
  }
  if (original.value.status !== 'awaiting-approval') {
    fail('INVALID_TRANSITION', 'Only a work order awaiting approval can receive an authorization decision.');
  }
  if (original.value.infrastructure && !infrastructurePolicyEnabled(city)) {
    fail('NO_INFRASTRUCTURE_POLICY', 'Adopt the infrastructure-management policy before authorizing infrastructure delivery.');
  }
  if (original.value.acceptanceCriteria.length === 0) {
    fail('CRITERIA_REQUIRED', 'At least one acceptance criterion is required before an authorization decision.');
  }
  let permitInput = null;
  if (options.outcome === 'authorize' && permitPolicyEnabled(city)) {
    const classification = currentScreening(city, original.value)?.permit;
    if (classification && Math.max(classification.safetyClass, classification.structuralClass) === 4
      && decidedBy === 'city-council') {
      fail('RESERVED_MATTER', 'Class 4 permits are reserved to the resident under the adopted building-permits policy.');
    }
    if (options.permit === undefined) {
      fail('PERMIT_TERMS_REQUIRED', 'An adopted building-permits policy requires --permit JSON with conditions and rightOfWay arrays.');
    }
    permitInput = validatePermitInput(requestJSON(options.permit, '--permit'), city, original.value);
  } else if (options.permit !== undefined) {
    fail('INVALID_ARGUMENT', '--permit is available only for authorization under the adopted building-permits policy.');
  }
  const securityFinding = infrastructureSecurityFinding(city, original.value);
  if (securityFinding && !reservedMatters.includes('security')) {
    fail('RESERVED_MATTER', 'A work order linked to a security finding must explicitly classify security as reserved and route it to the resident.');
  }
  if (securityFinding && decidedBy === 'city-council' && options.outcome !== 'refer') {
    fail('RESERVED_MATTER', 'A Council cannot decide a security finding; refer it to the resident.');
  }
  if (options.outcome === 'authorize') assertInfrastructureScopeCurrent(city, original.value);
  if (options.outcome === 'authorize') assertDevelopmentReady(city, original.value);
  if (reservedMatters.length !== 0 && (routineClass !== null || (decidedBy === 'city-council' && options.outcome === 'authorize'))) {
    fail('RESERVED_MATTER', 'Reserved matters cannot be authorized by the City Council or under a routine class. The council must refer them to the resident.');
  }
  const records = deliveryRecords(context, {
    kind: 'authorization',
    outcome: options.outcome,
    decidedBy,
    basis: decidedBy === 'resident' ? 'resident-decision' : routineClass === null ? 'council-delegation' : 'routine-policy',
    routineClass,
    reservedMatters,
    reason: options.reason,
    declaredBy: options['declared-by'] ?? null,
    reference: options.evidence ?? null,
    permitInput,
  }, (id) => `${HISTORY_REASONS[options.outcome] ?? 'Decision recorded'} by ${decidedBy} in ${id}; recorded, not authenticated.`);
  if (options.apply) await writeDeliveryRecords(root, context, records);
  return deliveryOutput('authorize', root, options.apply, context, records);
}

export async function permitExtend(root, options) {
  validateOrderId(options.id);
  text(options['permit-id'], '--permit-id', 64);
  const extensionDays = Number(options.days);
  if (!Number.isSafeInteger(extensionDays) || extensionDays < 1 || extensionDays > 30) {
    fail('INVALID_ARGUMENT', '--days must be an integer from 1 to 30.');
  }
  const decidedBy = options['decided-by'];
  if (!['city-council', 'resident'].includes(decidedBy)) {
    fail('INVALID_ARGUMENT', '--decided-by must be city-council or resident.');
  }
  text(options.reason, '--reason', 4000);
  const declaredBy = options['declared-by'] ?? null;
  const evidence = options.evidence ?? null;
  if (decidedBy === 'resident') {
    text(declaredBy, '--declared-by', 200);
    text(evidence, '--evidence', 4000);
  } else if (declaredBy !== null || evidence !== null) {
    fail('INVALID_ARGUMENT', 'Council extensions must not include resident declaration evidence.');
  }
  const city = await loadCity(root);
  if (!permitPolicyEnabled(city)) fail('NO_PERMIT_POLICY', 'Adopt the building-permits policy before extending a permit.');
  if (decidedBy === 'city-council' && !city.config.adoption.policies.some((policy) => policy.path === DELEGATION_POLICY)) {
    fail('NO_DELEGATION', `The adopted policies do not include ${DELEGATION_POLICY}; only the resident can decide.`);
  }
  const original = city.workOrders.get(options.id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  const input = {
    permitId: options['permit-id'], extensionDays, reason: options.reason, decidedBy, declaredBy, evidence,
  };
  validatePermitExtensionAllowed(city, original.value, input);
  const development = {
    screenings: [], applications: [], assessments: [], statements: [], verifications: [],
    completionNotices: [], permitExtensions: [], ...original.value.development,
  };
  const recordedAt = new Date(Math.max(
    Date.now(), Date.parse(original.value.updatedAt),
    ...Object.values(development).flat().map((record) => Date.parse(record.recordedAt)),
  )).toISOString();
  const record = {
    ...input, revision: development.permitExtensions.length + 1, recordedAt,
    sourceOffice: decidedBy, authenticated: false, provenance: provenance(),
  };
  const workOrder = validateWorkOrder({
    ...original.value, development: { ...development, permitExtensions: [...development.permitExtensions, record] },
  }, city.config.cityId);
  const stored = preparedWorkOrder(workOrder, original);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      checkOrderUnchanged(city, current, original);
      checkDevelopmentContextUnchanged(city, current);
      validatePermitExtensionAllowed(current, original.value, input);
      await atomicRecord(current, 'work-orders', `${workOrder.id}.json`, stored, original.bytes);
    });
  }
  const output = mutationOutput('permit-extend', root, options.apply, workOrder, city.config.governance);
  return {
    ...output, extension: record, permit: permitStatus(city, workOrder),
  };
}

function validatePermitExtensionAllowed(city, order, input) {
  const current = permitStatus(city, order);
  if (!['active', 'lapsed'].includes(current.state) || current.permit?.permitId !== input.permitId) {
    fail('STALE_PERMIT', 'Permit extension must reference the current active or lapsed permit.');
  }
  if (!['authorized', 'in-progress', 'blocked'].includes(order.status)) {
    fail('INVALID_TRANSITION', 'Permit can be extended only before inspection begins.');
  }
  const screening = currentScreening(city, order);
  if (!screening?.permit || screening.permit.safetyClass !== current.permit.safetyClass
    || screening.permit.structuralClass !== current.permit.structuralClass) {
    fail('STALE_DEVELOPMENT', 'Permit extension requires a current risk classification matching the issued permit.');
  }
  if (current.extensionCount >= PERMIT_MAX_EXTENSIONS) {
    fail('PERMIT_EXTENSION_LIMIT', `A permit may be extended at most ${PERMIT_MAX_EXTENSIONS} times.`);
  }
  if (Math.max(current.permit.safetyClass, current.permit.structuralClass) === 4 && input.decidedBy !== 'resident') {
    fail('RESERVED_MATTER', 'Class 4 permit extensions are reserved to the resident.');
  }
}

export async function complete(root, options) {
  validateOrderId(options.id);
  text(options['declared-by'], '--declared-by', 200);
  text(options.evidence, '--evidence', 4000);
  text(options.reason, '--reason', 4000);
  const context = await deliveryContext(root, options.id);
  const { original } = context;
  if (original.value.status !== 'awaiting-merge') {
    fail('INVALID_TRANSITION', 'Only a work order awaiting merge can be accepted as completed by the resident.');
  }
  if (original.value.acceptanceCriteria.length === 0) {
    fail('CRITERIA_REQUIRED', 'At least one acceptance criterion is required before completion.');
  }
  assertInfrastructureScopeCurrent(context.city, original.value);
  const records = deliveryRecords(context, {
    kind: 'acceptance',
    outcome: 'accept',
    decidedBy: 'resident',
    basis: 'resident-decision',
    routineClass: null,
    reservedMatters: [],
    reason: options.reason,
    declaredBy: options['declared-by'],
    reference: options.evidence,
  }, (id) => `Completion accepted by the resident in ${id}; recorded, not authenticated.`);
  if (options.apply) await writeDeliveryRecords(root, context, records);
  return deliveryOutput('complete', root, options.apply, context, records);
}

// Closes the open portion of a case file into an immutable, hash-chained part so recording can continue.
export async function filePartClose(root, options) {
  validateOrderId(options.id);
  text(options.reason, '--reason', 4000);
  const city = await loadCity(root);
  const original = city.workOrders.get(options.id);
  if (!original) fail('NOT_FOUND', 'City work order does not exist in this repository.');
  const stored = original.stored;
  const open = {
    history: stored.history,
    development: Object.fromEntries(Object.entries(stored.development ?? {}).filter(([, records]) => records.length)),
  };
  if (open.history.length + Object.values(open.development).flat().length === 0) {
    fail('NOTHING_TO_CLOSE', 'The open work-order file has no history entries or revisions to close into a file part.');
  }
  const number = original.parts.length + 1;
  if (number > MAX_WORK_ORDER_PARTS) fail('SIZE_LIMIT', `A work order supports at most ${MAX_WORK_ORDER_PARTS} closed file parts.`);
  if (city.workOrderParts.size >= LIMITS.records) fail('SIZE_LIMIT', `City has reached the supported ${LIMITS.records} work-order file parts.`);
  const latest = [...open.history.map((entry) => entry.timestamp),
    ...Object.values(open.development).flat().map((record) => record.recordedAt)].sort().at(-1);
  const previousClosedAt = original.parts.at(-1)?.value.closedAt;
  const closedAt = new Date(Math.max(Date.now(), Date.parse(latest), previousClosedAt ? Date.parse(previousClosedAt) : 0)).toISOString();
  const part = validateWorkOrderPart({
    schemaVersion: WORK_ORDER_PART_SCHEMA_VERSION,
    id: workOrderPartId(stored.id, number),
    cityId: city.config.cityId,
    workOrderId: stored.id,
    part: number,
    previousPartSha256: original.parts.length ? sha256(original.parts.at(-1).bytes) : null,
    closedAt,
    reason: options.reason,
    sourceOffice: 'records-officer',
    authenticated: false,
    contents: open,
    provenance: provenance(),
  }, city.config.cityId);
  const partBytes = Buffer.from(encodeJSON(part));
  if (partBytes.length > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed work-order file part exceeds the supported local file size.');
  const manifest = [...(stored.fileParts ?? []), { id: part.id, sha256: sha256(partBytes) }];
  const live = { ...stored, fileParts: manifest, history: [] };
  if (stored.development) {
    live.development = Object.fromEntries(Object.keys(stored.development).map((kind) => [kind, []]));
  }
  validateStoredWorkOrder(live, city.config.cityId);
  const workOrder = validateWorkOrder({ ...original.value, fileParts: manifest }, city.config.cityId);
  const liveBytes = Buffer.byteLength(encodeJSON(live));
  if (liveBytes > LIMITS.fileBytes) {
    fail('SIZE_LIMIT', 'The work-order header alone exceeds the per-file limit; closing a file part cannot reduce it.');
  }
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      const current = await loadCity(root);
      checkCityUnchanged(city, current);
      checkOrderUnchanged(city, current, original);
      if (current.workOrderParts.has(part.id)) fail('CONFLICT', 'That work-order file part already exists; no record was overwritten.');
      if (current.workOrderParts.size >= LIMITS.records) fail('SIZE_LIMIT', `City has reached the supported ${LIMITS.records} work-order file parts.`);
      const partIdentity = await atomicRecord(current, 'work-order-parts', `${part.id}.json`, part);
      try {
        await atomicRecord(current, 'work-orders', `${stored.id}.json`, live, original.bytes);
      } catch (error) {
        const cause = error instanceof CityError ? error.code : 'FILESYSTEM_ERROR';
        try {
          await removeOwnedFile(path.join(current.path, 'work-order-parts', `${part.id}.json`), partIdentity);
        } catch {
          fail('PARTIAL_WRITE', `File part .city/work-order-parts/${part.id}.json was written but work order .city/work-orders/${stored.id}.json was not updated (${cause}), and the part could not be removed. Remove that part file, then run validate.`);
        }
        throw error;
      }
    });
    await loadCity(root);
  }
  return {
    command: 'file-part-close', root, governance: city.config.governance, dryRun: !options.apply,
    changed: Boolean(options.apply), wouldWrite: true,
    filePart: {
      id: part.id, part: number, path: `.city/work-order-parts/${part.id}.json`, bytes: partBytes.length,
      sha256: sha256(partBytes), closedAt, historyEntries: open.history.length,
      revisions: Object.fromEntries(Object.entries(open.development).map(([kind, records]) => [kind, records.length])),
    },
    workOrderFile: {
      path: `.city/work-orders/${stored.id}.json`, bytesBefore: original.bytes.length, bytesAfter: liveBytes,
      limitBytes: LIMITS.fileBytes,
    },
    workOrder,
    notice: 'Closing a file part moves the open history and revisions verbatim into an immutable, hash-chained record; nothing is removed from the case file and no lifecycle state, decision, or authorization changes.',
  };
}

function preserved(city) {
  return {
    'work-orders': [...city.workOrders.keys()].sort(),
    decisions: [...city.decisions.keys()].sort(),
    artifacts: [...city.artifacts.keys()].sort(),
    unchanged: ['districts.json', 'charter.md', 'instruction-fragment.md', 'policies/', 'work-orders/', 'decisions/',
      ...(city.directoryIdentities.artifacts ? ['artifacts/'] : []),
      ...(city.directoryIdentities['work-order-parts'] ? ['work-order-parts/'] : [])]
      .map((name) => `.city/${name}`),
  };
}

async function replaceConfig(root, city, config, guard) {
  await withMutationLock(city.path, city.identity, async () => {
    const current = await loadCity(root);
    checkCityUnchanged(city, current);
    if (guard) await guard(current);
    await atomicConfig(current, config, city.configBytes);
  });
  await loadCity(root);
}

export async function migrate(root, options) {
  const city = await loadCity(root);
  const before = city.config;
  if (before.schemaVersion === CONFIG_SCHEMA_VERSION) {
    return {
      command: 'migrate', root, governance: before.governance, dryRun: !options.apply,
      changed: false, wouldWrite: false, from: before.schemaVersion, to: CONFIG_SCHEMA_VERSION,
      config: before, notice: governanceNotice(before.governance),
    };
  }
  const config = validateConfig({ ...before, schemaVersion: CONFIG_SCHEMA_VERSION, adoption: null });
  if (options.apply) await replaceConfig(root, city, config);
  return {
    command: 'migrate', root, governance: config.governance, dryRun: !options.apply,
    changed: Boolean(options.apply), wouldWrite: true,
    from: before.schemaVersion, to: CONFIG_SCHEMA_VERSION, before, config,
    plan: { replace: ['.city/config.json'], preserve: preserved(city) },
    notice: governanceNotice(config.governance),
  };
}

export async function adopt(root, options) {
  calendarDate(options['adopted-on'], '--adopted-on');
  text(options['declared-by'], '--declared-by', 200);
  text(options.evidence, '--evidence', 4000);
  if (options['charter-version'] !== undefined) text(options['charter-version'], '--charter-version', 100);
  const city = await loadCity(root);
  if (city.config.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    fail('MIGRATION_REQUIRED', 'City config uses schemaVersion 1. Run migrate --apply first; it preserves all city records.');
  }
  if (city.config.governance === 'adopted') {
    fail('ALREADY_ADOPTED', 'City governance is already adopted. Use amend, not adopt, to record a charter or policy revision.');
  }
  const digests = await governanceDigests(city.path);
  const config = validateConfig({
    ...city.config,
    governance: 'adopted',
    adoption: {
      adoptedOn: options['adopted-on'],
      recordedAt: new Date(Math.max(Date.now(), Date.parse(city.config.createdAt))).toISOString(),
      charter: { path: 'charter.md', sha256: digests.charter, version: options['charter-version'] ?? null },
      policies: digests.policies,
      evidence: {
        rule: EVIDENCE_RULE,
        declaredBy: options['declared-by'],
        reference: options.evidence,
        authenticated: false,
      },
    },
  });
  if (options.apply) {
    await replaceConfig(root, city, config, async (current) => {
      if (JSON.stringify(await governanceDigests(current.path)) !== JSON.stringify(digests)) {
        fail('CONFLICT', 'The charter or policies changed since this adoption was prepared. Review the current text and retry.');
      }
    });
  }
  return {
    command: 'adopt', root, governance: 'adopted', dryRun: !options.apply,
    changed: Boolean(options.apply), wouldWrite: true, config,
    plan: { replace: ['.city/config.json'], preserve: preserved(city) },
    notice: governanceNotice('adopted'),
  };
}

function adoptionChanges(previous, digests) {
  const previousPolicies = new Map(previous.policies.map((policy) => [policy.path, policy.sha256]));
  const currentPolicies = new Map(digests.policies.map((policy) => [policy.path, policy.sha256]));
  return {
    charter: previous.charter.sha256 !== digests.charter,
    policies: {
      added: [...currentPolicies.keys()].filter((name) => !previousPolicies.has(name)).sort(),
      removed: [...previousPolicies.keys()].filter((name) => !currentPolicies.has(name)).sort(),
      modified: [...currentPolicies.keys()]
        .filter((name) => previousPolicies.has(name) && previousPolicies.get(name) !== currentPolicies.get(name))
        .sort(),
    },
  };
}

export async function amend(root, options) {
  calendarDate(options['adopted-on'], '--adopted-on');
  text(options['declared-by'], '--declared-by', 200);
  text(options.evidence, '--evidence', 4000);
  text(options.summary, '--summary', 4000);
  if (options['charter-version'] !== undefined) text(options['charter-version'], '--charter-version', 100);
  const city = await loadCity(root);
  if (city.config.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    fail('MIGRATION_REQUIRED', 'City config uses schemaVersion 1. Run migrate --apply first; it preserves all city records.');
  }
  if (city.config.governance !== 'adopted') {
    fail('NOT_ADOPTED', 'City governance is still draft. Use adopt, not amend, before any charter revision has been adopted.');
  }
  if (city.drift.matchesAdoptedRevision) {
    fail('NO_DRIFT', 'The charter and policies match the currently adopted revision; there is nothing to amend.');
  }
  const digests = await governanceDigests(city.path);
  const previous = city.config.adoption;
  const changes = adoptionChanges(previous, digests);
  if (changes.policies.added.includes(DEVELOPMENT_POLICY) && !changes.charter) {
    fail('CHARTER_AMENDMENT_REQUIRED', 'Adding development-applications policy requires an explicit revised charter appointing the Development Advisor; installation or a policy-only amendment cannot reappoint offices.');
  }
  const recordedAt = new Date(Math.max(
    Date.now(), Date.parse(city.config.createdAt), Date.parse(previous.recordedAt) + 1,
  )).toISOString();
  const { history: previousHistory, ...supersededAdoption } = previous;
  const supersededEntry = { ...supersededAdoption, supersededAt: recordedAt, summary: options.summary };
  const config = validateConfig({
    ...city.config,
    governance: 'adopted',
    adoption: {
      adoptedOn: options['adopted-on'],
      recordedAt,
      charter: { path: 'charter.md', sha256: digests.charter, version: options['charter-version'] ?? null },
      policies: digests.policies,
      evidence: {
        rule: EVIDENCE_RULE,
        declaredBy: options['declared-by'],
        reference: options.evidence,
        authenticated: false,
      },
      history: [...(previousHistory ?? []), supersededEntry],
    },
  });
  if (options.apply) {
    await replaceConfig(root, city, config, async (current) => {
      if (JSON.stringify(await governanceDigests(current.path)) !== JSON.stringify(digests)) {
        fail('CONFLICT', 'The charter or policies changed since this amendment was prepared. Review the current text and retry.');
      }
    });
  }
  return {
    command: 'amend', root, governance: 'adopted', dryRun: !options.apply,
    changed: Boolean(options.apply), wouldWrite: true,
    changes, before: previous, config,
    plan: { replace: ['.city/config.json'], preserve: preserved(city) },
    notice: governanceNotice('adopted'),
  };
}

export async function discoverCity(cwd) {
  let current = await rootDirectory(cwd);
  while (true) {
    const city = await inspect(path.join(current, '.city'));
    const git = await inspect(path.join(current, '.git'));
    if (git && (git.isSymbolicLink() || (!git.isDirectory() && !git.isFile()))) {
      fail('UNSAFE_PATH', 'City repository boundary is not a regular .git directory or file. Repair the boundary before retrying.');
    }
    if (city) return loadCity(current);
    if (git) return null;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
