import { isAbsolute, posix } from 'node:path';
import {
  AUTHORIZATION_OUTCOMES, AUTHORIZATION_VOIDING_STATES, COMPATIBLE_PLUGIN_VERSIONS, CONFIG_SCHEMA_VERSION,
  DELIVERY_DECISION_SCHEMA_VERSION, EVIDENCE_RULE, GOVERNANCE, LEGACY_CONFIG_SCHEMA_VERSION,
  LIMITS, PLUGIN, RECORDS_REQUEST_SCHEMA_VERSION, RESERVED_MATTERS, ROUTINE_CLASSES,
  SCHEMA_VERSION, STATUSES, TRANSITIONS, WORK_ORDER_SCHEMA_VERSION, WORKFORCE_SCHEMA_VERSION,
  WORKFORCE_TOOLS, GENERAL_ENGINEER_ID,
} from './constants.mjs';
import { fail } from './errors.mjs';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuidPattern = new RegExp(`^${uuid}$`);
const orderPattern = new RegExp(`^WO-${uuid}$`);
const decisionPattern = new RegExp(`^DEC-${uuid}$`);
const recordsRequestPattern = new RegExp(`^RR-${uuid}$`);
const requisitionPattern = new RegExp(`^REQ-${uuid}$`);
const assignmentPattern = new RegExp(`^ASN-${uuid}$`);
const staffIdPattern = /^[a-z][a-z0-9-]{1,40}$/u;
const own = (value, key) => Object.hasOwn(value, key);

export const RECORD_TYPES = Object.freeze([
  'work-order', 'decision', 'records-request', 'config', 'project', 'district', 'charter', 'policy',
]);
export const CANONICAL_RECORD_TYPES = Object.freeze([
  ...RECORD_TYPES, 'requisition', 'staff', 'assignment',
]);
export const RECORD_EXCHANGE_TYPES = Object.freeze([
  'work-order', 'decision', 'records-request', 'config', 'project', 'district', 'charter', 'policy',
]);
export const RECORD_REQUEST_OUTCOMES = Object.freeze(['found', 'not-found', 'withheld', 'unavailable']);

export function validateRecordId(type, id, label = 'Record ID') {
  if (typeof id !== 'string') fail('INVALID_ARGUMENT', `${label} must be a supported record identifier.`);
  switch (type) {
    case 'work-order':
      if (!orderPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a work-order ID.`);
      break;
    case 'decision':
      if (!decisionPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a decision ID.`);
      break;
    case 'records-request':
      if (!recordsRequestPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a records-request ID.`);
      break;
    case 'requisition':
      if (!requisitionPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a requisition ID.`);
      break;
    case 'assignment':
      if (!assignmentPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be an assignment ID.`);
      break;
    case 'staff':
      if (!staffIdPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a safe staff ID.`);
      break;
    case 'config':
      if (id !== 'config') fail('INVALID_ARGUMENT', `${label} must be config.`);
      break;
    case 'project':
    case 'district':
      if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id)) fail('INVALID_ARGUMENT', `${label} must be a safe ${type} ID.`);
      break;
    case 'charter':
      if (id !== 'charter') fail('INVALID_ARGUMENT', `${label} must be charter.`);
      break;
    case 'policy':
      if (!/^policy:[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.md$/u.test(id)) {
        fail('INVALID_ARGUMENT', `${label} must be policy:<filename>.md.`);
      }
      break;
    default:
      fail('INVALID_ARGUMENT', 'Record type is unsupported.');
  }
}

export function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_RECORD', `${label} must be a JSON object.`);
  }
}

function fields(value, keys, label) {
  object(value, label);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !own(value, key))) {
    fail('INVALID_RECORD', `${label} has missing or unexpected fields; only the current draft schema is supported.`);
  }
}

function version(value, label, supported = [SCHEMA_VERSION]) {
  object(value, label);
  if (!own(value, 'schemaVersion')) fail('INVALID_RECORD', `${label} is missing schemaVersion.`);
  if (!supported.includes(value.schemaVersion)) {
    fail('UNKNOWN_SCHEMA_VERSION', `${label} uses an unsupported schemaVersion. Restore a compatible version or perform a separately reviewed migration.`);
  }
}

export function text(value, label, maximum) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()
    || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    fail('INVALID_ARGUMENT', `${label} must be nonempty trimmed text of at most ${maximum} characters, without control characters.`);
  }
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u.test(value)
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    fail('INVALID_RECORD', `${label} must be a canonical ISO timestamp.`);
  }
}

function plugin(value, label) {
  fields(value, ['name', 'version'], label);
  if (value.name !== PLUGIN.name || !COMPATIBLE_PLUGIN_VERSIONS.includes(value.version)) {
    fail('INCOMPATIBLE_PLUGIN', `${label} has incompatible plugin provenance; restore compatible state or review a migration.`);
  }
}

function provenance(value, label) {
  fields(value, ['source', 'plugin'], label);
  if (value.source !== 'local-draft') {
    fail('INVALID_RECORD', `${label} must describe local-draft metadata, not verified authorization.`);
  }
  plugin(value.plugin, `${label}.plugin`);
}

function cityId(value, label, expected) {
  if (typeof value !== 'string' || !uuidPattern.test(value) || (expected && value !== expected)) {
    fail('INVALID_RECORD', `${label} must identify this city with a UUID.`);
  }
}

function stringArray(value, label, maximum, stringMaximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail('INVALID_RECORD', `${label} must be an array of at most ${maximum} entries.`);
  }
  value.forEach((entry) => text(entry, `${label} entry`, stringMaximum));
}

export function parseJSON(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('MALFORMED_JSON', `${label} contains malformed JSON. Restore or repair that file explicitly.`);
  }
}

const sha256Pattern = /^[0-9a-f]{64}$/u;
const policyPathPattern = /^policies\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.md$/u;
const DAY = 24 * 60 * 60 * 1000;

export function calendarDate(value, label, code = 'INVALID_ARGUMENT') {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    fail(code, `${label} must be a calendar date in YYYY-MM-DD form.`);
  }
}

function digest(value, label) {
  if (typeof value !== 'string' || !sha256Pattern.test(value)) {
    fail('INVALID_RECORD', `${label} must be a lowercase SHA-256 hex digest.`);
  }
}

function fieldsWithOptional(value, required, optional, label) {
  object(value, label);
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !own(value, key)) || keys.some((key) => !allowed.has(key))) {
    fail('INVALID_RECORD', `${label} has missing or unexpected fields; only the current draft schema is supported.`);
  }
}

function validateAdoptionDates(adoptedOn, recordedAt, createdAt, label) {
  calendarDate(adoptedOn, `${label}.adoptedOn`, 'INVALID_RECORD');
  timestamp(recordedAt, `${label}.recordedAt`);
  if (recordedAt < createdAt) {
    fail('INVALID_RECORD', `${label} cannot be recorded before the city was created.`);
  }
  // Allow for any civil time zone (UTC-12 to UTC+14) when comparing a local date with UTC timestamps.
  const earliest = new Date(Date.parse(createdAt) - DAY / 2).toISOString().slice(0, 10);
  const latest = new Date(Date.parse(recordedAt) + (14 * DAY) / 24).toISOString().slice(0, 10);
  if (adoptedOn < earliest || adoptedOn > latest) {
    fail('INVALID_RECORD', `${label} date must fall between city creation and the time it was recorded.`);
  }
}

function validateCharterDigest(value, label) {
  fields(value, ['path', 'sha256', 'version'], label);
  if (value.path !== 'charter.md') fail('INVALID_RECORD', `${label}.path must be charter.md.`);
  digest(value.sha256, `${label}.sha256`);
  if (value.version !== null) text(value.version, `${label}.version`, 100);
}

function validatePolicyDigests(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    fail('INVALID_RECORD', `${label} must list between 1 and 100 adopted policies.`);
  }
  let previous = '';
  for (const policy of value) {
    fields(policy, ['path', 'sha256'], `${label} entry`);
    if (typeof policy.path !== 'string' || !policyPathPattern.test(policy.path) || policy.path <= previous) {
      fail('INVALID_RECORD', `${label} paths must be unique, sorted policies/*.md paths.`);
    }
    digest(policy.sha256, `${label} entry sha256`);
    previous = policy.path;
  }
}

function validateEvidence(value, label) {
  fields(value, ['rule', 'declaredBy', 'reference', 'authenticated'], label);
  if (value.rule !== EVIDENCE_RULE) {
    fail('INVALID_RECORD', `${label} rule must be ${EVIDENCE_RULE}.`);
  }
  text(value.declaredBy, `${label}.declaredBy`, 200);
  text(value.reference, `${label}.reference`, 4000);
  if (value.authenticated !== false) {
    fail('INVALID_RECORD', `${label} must record authenticated: false; the plugin cannot authenticate a resident declaration.`);
  }
}

function validateAdoptionHistory(history, currentAdoption, createdAt) {
  if (!Array.isArray(history) || history.length === 0 || history.length > LIMITS.history) {
    fail('INVALID_RECORD', `City adoption history must have between 1 and ${LIMITS.history} entries.`);
  }
  let previousAdoptedOn = '';
  let previousSupersededAt = null;
  for (const [index, entry] of history.entries()) {
    fields(entry, [
      'adoptedOn', 'recordedAt', 'charter', 'policies', 'evidence', 'supersededAt', 'summary',
    ], 'City adoption history entry');
    validateAdoptionDates(entry.adoptedOn, entry.recordedAt, createdAt, 'City adoption history entry');
    validateCharterDigest(entry.charter, 'City adoption history entry.charter');
    validatePolicyDigests(entry.policies, 'City adoption history entry.policies');
    validateEvidence(entry.evidence, 'City adoption history entry.evidence');
    timestamp(entry.supersededAt, 'City adoption history entry.supersededAt');
    text(entry.summary, 'City adoption history entry.summary', 4000);
    if (entry.recordedAt >= entry.supersededAt) {
      fail('INVALID_RECORD', 'City adoption history entry must be superseded strictly after it was recorded.');
    }
    if (index > 0 && entry.recordedAt !== previousSupersededAt) {
      fail('INVALID_RECORD', 'City adoption history is discontinuous or reordered.');
    }
    if (entry.adoptedOn < previousAdoptedOn) {
      fail('INVALID_RECORD', 'City adoption history dates must be non-decreasing.');
    }
    previousAdoptedOn = entry.adoptedOn;
    previousSupersededAt = entry.supersededAt;
  }
  if (previousSupersededAt !== currentAdoption.recordedAt) {
    fail('INVALID_RECORD', 'City adoption history must end exactly where the current adoption was recorded.');
  }
  if (currentAdoption.adoptedOn < previousAdoptedOn) {
    fail('INVALID_RECORD', 'City adoption history dates must be non-decreasing.');
  }
}

function validateAdoption(value, createdAt) {
  fieldsWithOptional(value, ['adoptedOn', 'recordedAt', 'charter', 'policies', 'evidence'], ['history'], 'City adoption');
  validateAdoptionDates(value.adoptedOn, value.recordedAt, createdAt, 'City adoption');
  validateCharterDigest(value.charter, 'City adoption.charter');
  validatePolicyDigests(value.policies, 'City adoption.policies');
  validateEvidence(value.evidence, 'City adoption.evidence');
  if (own(value, 'history')) validateAdoptionHistory(value.history, value, createdAt);
}

export function validateConfig(value) {
  object(value, 'City config');
  if (!own(value, 'schemaVersion')) fail('INVALID_RECORD', 'City config is missing schemaVersion.');
  if (value.schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION) {
    fields(value, ['schemaVersion', 'plugin', 'cityId', 'name', 'createdAt', 'governance'], 'City config');
  } else if (value.schemaVersion === CONFIG_SCHEMA_VERSION) {
    fields(value, ['schemaVersion', 'plugin', 'cityId', 'name', 'createdAt', 'governance', 'adoption'], 'City config');
  } else {
    fail('UNKNOWN_SCHEMA_VERSION', 'City config uses an unsupported schemaVersion. Restore a compatible version or perform a separately reviewed migration.');
  }
  plugin(value.plugin, 'City config.plugin');
  cityId(value.cityId, 'City config.cityId');
  text(value.name, 'City name', 200);
  timestamp(value.createdAt, 'City config.createdAt');
  if (value.schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION) {
    if (value.governance !== 'draft') {
      fail('INVALID_RECORD', 'City config schemaVersion 1 only supports draft governance. Run migrate, then adopt, to record charter adoption.');
    }
    return value;
  }
  if (!GOVERNANCE.includes(value.governance)) {
    fail('INVALID_RECORD', 'City governance must be draft or adopted.');
  }
  if (value.governance === 'draft' && value.adoption !== null) {
    fail('INVALID_RECORD', 'Draft city governance must have adoption: null.');
  }
  if (value.governance === 'adopted') {
    if (value.adoption === null) fail('INVALID_RECORD', 'Adopted city governance requires an adoption record; use the adopt command.');
    validateAdoption(value.adoption, value.createdAt);
  }
  return value;
}

export function validateDistricts(value) {
  version(value, 'City districts');
  fields(value, ['schemaVersion', 'districts'], 'City districts');
  if (!Array.isArray(value.districts) || value.districts.length === 0 || value.districts.length > 100) {
    fail('INVALID_RECORD', 'City districts must declare between 1 and 100 districts.');
  }
  const seen = new Set();
  for (const district of value.districts) {
    fields(district, ['id', 'name', 'path', 'description'], 'City district');
    if (typeof district.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(district.id) || seen.has(district.id)) {
      fail('INVALID_RECORD', 'City district IDs must be unique safe lowercase identifiers.');
    }
    seen.add(district.id);
    text(district.name, 'City district name', 200);
    text(district.description, 'City district description', 2000);
    text(district.path, 'City district path', 500);
    if (isAbsolute(district.path) || district.path.includes('\\') || district.path.includes(':')
      || district.path.split('/').includes('..') || posix.normalize(district.path) !== district.path) {
      fail('INVALID_RECORD', 'City district paths must be normalized repository-relative paths without traversal.');
    }
  }
  return value;
}

export function validateProjects(value) {
  version(value, 'City projects');
  fields(value, ['schemaVersion', 'projects'], 'City projects');
  if (!Array.isArray(value.projects) || value.projects.length > 100) {
    fail('INVALID_RECORD', 'City projects must declare at most 100 projects.');
  }
  const ids = new Set();
  for (const project of value.projects) {
    fields(project, ['id', 'name', 'path', 'description'], 'City project');
    if (typeof project.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(project.id) || ids.has(project.id)) {
      fail('INVALID_RECORD', 'City project IDs must be unique safe lowercase identifiers.');
    }
    ids.add(project.id);
    text(project.name, 'City project name', 200);
    text(project.description, 'City project description', 2000);
    text(project.path, 'City project path', 500);
    const segments = project.path.split('/');
    if (posix.isAbsolute(project.path) || project.path.includes('\\') || project.path.includes(':')
      || segments.includes('..') || segments.includes('.city') || segments.includes('.git')
      || project.path === '.' || posix.normalize(project.path) !== project.path) {
      fail('INVALID_RECORD', 'City project paths must be normalized repository-relative directories outside city and Git metadata.');
    }
  }
  const paths = value.projects.map((project) => project.path.normalize('NFC').toLowerCase());
  for (let index = 0; index < paths.length; index += 1) {
    for (let other = index + 1; other < paths.length; other += 1) {
      if (paths[other].startsWith(`${paths[index]}/`) || paths[index].startsWith(`${paths[other]}/`)) {
        fail('INVALID_RECORD', 'City project directories must not overlap.');
      }
    }
  }
  return value;
}

export function validateOrderId(value) {
  if (typeof value !== 'string' || !orderPattern.test(value)) {
    fail('INVALID_ARGUMENT', 'Work-order ID must be WO- followed by a UUID.');
  }
}

export function validateState(value) {
  if (!STATUSES.includes(value)) {
    fail('INVALID_STATE', 'State is not part of the city work-order lifecycle. Use --help for the supported states.');
  }
}

// Authorization is current when the latest authorized entry is later than any entry that voids it.
export function authorizationCurrent(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].to === 'authorized') return true;
    if (AUTHORIZATION_VOIDING_STATES.includes(history[index].to)) return false;
  }
  return false;
}

export function checkTransition(from, to, criteria, authorized = false) {
  validateState(to);
  if (!Object.hasOwn(TRANSITIONS, from) || !TRANSITIONS[from].includes(to)) {
    fail('INVALID_TRANSITION', 'This state transition is not permitted. Terminal cases must first be reopened.');
  }
  if (from === 'blocked' && to === 'in-progress' && !authorized) {
    fail('INVALID_TRANSITION', 'Delivery can resume from blocked only while its authorization is current. Returning to triaged, proposed or reopened voided it; record a new authorize decision first.');
  }
  if (to === 'proposed' && criteria.length === 0) {
    fail('CRITERIA_REQUIRED', 'At least one nonempty acceptance criterion is required before proposed.');
  }
}

export function validateWorkOrder(value, expectedCityId) {
  version(value, 'City work order', [SCHEMA_VERSION, WORK_ORDER_SCHEMA_VERSION]);
  const required = [
    'schemaVersion', 'id', 'cityId', 'title', 'request', 'acceptanceCriteria',
    'status', 'createdAt', 'updatedAt', 'history', 'provenance',
  ];
  if (value.schemaVersion === WORK_ORDER_SCHEMA_VERSION) {
    fields(value, [...required, 'projectIds'], 'City work order');
  } else {
    fields(value, required, 'City work order');
  }
  validateOrderId(value.id);
  cityId(value.cityId, 'City work-order cityId', expectedCityId);
  text(value.title, 'Work-order title', 500);
  text(value.request, 'Work-order request', 20000);
  stringArray(value.acceptanceCriteria, 'Work-order acceptance criteria', LIMITS.criteria, 2000);
  if (value.schemaVersion === WORK_ORDER_SCHEMA_VERSION) {
    if (!Array.isArray(value.projectIds) || value.projectIds.length === 0 || value.projectIds.length > 100
      || new Set(value.projectIds).size !== value.projectIds.length
      || value.projectIds.some((id) => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(id))) {
      fail('INVALID_RECORD', 'Work-order projectIds must contain unique safe IDs for at least one project.');
    }
  }
  validateState(value.status);
  timestamp(value.createdAt, 'Work-order createdAt');
  timestamp(value.updatedAt, 'Work-order updatedAt');
  provenance(value.provenance, 'Work-order provenance');
  if (!Array.isArray(value.history) || value.history.length === 0 || value.history.length > LIMITS.history) {
    fail('INVALID_RECORD', `Work-order history must have between 1 and ${LIMITS.history} entries.`);
  }
  let previousState = null;
  let previousTimestamp = value.createdAt;
  let authorized = false;
  for (const [index, entry] of value.history.entries()) {
    fields(entry, ['from', 'to', 'reason', 'timestamp'], 'Work-order history entry');
    text(entry.reason, 'Work-order history reason', 4000);
    timestamp(entry.timestamp, 'Work-order history timestamp');
    validateState(entry.to);
    if (entry.from !== previousState || entry.timestamp < previousTimestamp) {
      fail('INVALID_RECORD', 'Work-order history is discontinuous or has out-of-order timestamps.');
    }
    if (index === 0) {
      if (entry.from !== null || entry.to !== 'received' || entry.timestamp !== value.createdAt) {
        fail('INVALID_RECORD', 'Work-order history must begin with a received intake at createdAt.');
      }
    } else checkTransition(entry.from, entry.to, value.acceptanceCriteria, authorized);
    if (entry.to === 'authorized') authorized = true;
    else if (AUTHORIZATION_VOIDING_STATES.includes(entry.to)) authorized = false;
    previousState = entry.to;
    previousTimestamp = entry.timestamp;
  }
  if (previousState !== value.status || previousTimestamp !== value.updatedAt) {
    fail('INVALID_RECORD', 'Work-order status and updatedAt must match the final history entry.');
  }
  return value;
}

export function validateDecision(value, expectedCityId) {
  version(value, 'City decision', [SCHEMA_VERSION, DELIVERY_DECISION_SCHEMA_VERSION]);
  if (value.schemaVersion === DELIVERY_DECISION_SCHEMA_VERSION) return validateDeliveryDecision(value, expectedCityId);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'kind', 'status', 'title', 'proposal',
    'workOrderIds', 'createdAt', 'provenance',
  ], 'City decision');
  if (typeof value.id !== 'string' || !decisionPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City decision ID must be DEC- followed by a UUID.');
  }
  cityId(value.cityId, 'City decision cityId', expectedCityId);
  if (value.kind !== 'proposal' || value.status !== 'proposed') {
    fail('INVALID_RECORD', 'City decision schemaVersion 1 records are draft proposals only, never adoption or verified approval.');
  }
  text(value.title, 'City decision title', 500);
  text(value.proposal, 'City decision proposal', 20000);
  timestamp(value.createdAt, 'City decision createdAt');
  provenance(value.provenance, 'City decision provenance');
  if (!Array.isArray(value.workOrderIds) || value.workOrderIds.length > 100
    || new Set(value.workOrderIds).size !== value.workOrderIds.length) {
    fail('INVALID_RECORD', 'City decision workOrderIds must be an array of at most 100 unique IDs.');
  }
  value.workOrderIds.forEach(validateOrderId);
  return value;
}

export function validateRecordsRequest(value, expectedCityId) {
  version(value, 'City records request', [RECORDS_REQUEST_SCHEMA_VERSION]);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'requestedBy', 'sourceOffice', 'purpose', 'relatedWorkOrderId',
    'items', 'status', 'createdAt', 'updatedAt', 'history', 'responses', 'provenance',
  ], 'City records request');
  if (typeof value.id !== 'string' || !recordsRequestPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City records request ID must be RR- followed by a UUID.');
  }
  cityId(value.cityId, 'City records request cityId', expectedCityId);
  text(value.requestedBy, 'Records request requestedBy', 200);
  if (value.sourceOffice !== null) text(value.sourceOffice, 'Records request sourceOffice', 200);
  text(value.purpose, 'Records request purpose', 4000);
  if (value.relatedWorkOrderId !== null) validateOrderId(value.relatedWorkOrderId);
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > LIMITS.criteria) {
    fail('INVALID_RECORD', `Records request items must contain between 1 and ${LIMITS.criteria} entries.`);
  }
  const itemKeys = new Set();
  for (const item of value.items) {
    fields(item, ['type', 'id', 'description'], 'Records request item');
    if (!RECORD_EXCHANGE_TYPES.includes(item.type) || item.type === 'records-request') {
      fail('INVALID_RECORD', 'Records request item type is unsupported.');
    }
    validateRecordId(item.type, item.id, 'Records request item ID');
    text(item.description, 'Records request item description', 1000);
    const key = `${item.type}\n${item.id}`;
    if (itemKeys.has(key)) fail('INVALID_RECORD', 'Records request items must be unique.');
    itemKeys.add(key);
  }
  if (!['open', 'resolved', 'cancelled'].includes(value.status)) {
    fail('INVALID_RECORD', 'Records request status must be open, resolved or cancelled.');
  }
  timestamp(value.createdAt, 'Records request createdAt');
  timestamp(value.updatedAt, 'Records request updatedAt');
  provenance(value.provenance, 'Records request provenance');
  if (!Array.isArray(value.history) || value.history.length < 1 || value.history.length > LIMITS.history) {
    fail('INVALID_RECORD', `Records request history must have between 1 and ${LIMITS.history} entries.`);
  }
  let state = null;
  let previousTimestamp = value.createdAt;
  for (const [index, entry] of value.history.entries()) {
    fields(entry, ['from', 'to', 'actor', 'reason', 'timestamp'], 'Records request history entry');
    if (entry.from !== state || !['open', 'resolved', 'cancelled'].includes(entry.to)
      || (index === 0 ? entry.to !== 'open' : state !== 'open')
      || entry.timestamp < previousTimestamp) {
      fail('INVALID_RECORD', 'Records request history has an invalid transition or out-of-order timestamp.');
    }
    text(entry.actor, 'Records request history actor', 200);
    text(entry.reason, 'Records request history reason', 4000);
    timestamp(entry.timestamp, 'Records request history timestamp');
    state = entry.to;
    previousTimestamp = entry.timestamp;
  }
  if (state !== value.status || previousTimestamp !== value.updatedAt) {
    fail('INVALID_RECORD', 'Records request status and updatedAt must match its final history entry.');
  }
  if (!Array.isArray(value.responses) || value.responses.length > value.items.length) {
    fail('INVALID_RECORD', 'Records request responses must be an array matching its requested items.');
  }
  const responseItems = new Set();
  for (const response of value.responses) {
    fields(response, ['item', 'outcome', 'references', 'explanation'], 'Records request response');
    if (!Number.isInteger(response.item) || response.item < 0 || response.item >= value.items.length
      || responseItems.has(response.item) || !RECORD_REQUEST_OUTCOMES.includes(response.outcome)) {
      fail('INVALID_RECORD', 'Records request response item indexes must be unique, valid, and have a supported outcome.');
    }
    responseItems.add(response.item);
    if (!Array.isArray(response.references) || response.references.length > LIMITS.recordBatch) {
      fail('INVALID_RECORD', 'Records request response references must be a bounded array.');
    }
    for (const reference of response.references) {
      fields(reference, ['type', 'id', 'path', 'sha256'], 'Records request response reference');
      if (!RECORD_EXCHANGE_TYPES.includes(reference.type)) fail('INVALID_RECORD', 'Records request response reference type is unsupported.');
      validateRecordId(reference.type, reference.id, 'Records request response reference ID');
      text(reference.path, 'Records request response reference path', 500);
      digest(reference.sha256, 'Records request response reference sha256');
    }
    if (response.outcome === 'found' && response.references.length === 0) {
      fail('INVALID_RECORD', 'A found response must reference at least one canonical record.');
    }
    if (response.outcome !== 'found' && response.references.length !== 0) {
      fail('INVALID_RECORD', 'Only a found response may contain canonical record references.');
    }
    text(response.explanation, 'Records request response explanation', 4000);
  }
  if (value.status === 'open' && value.responses.length !== 0) {
    fail('INVALID_RECORD', 'An open records request cannot contain a final response.');
  }
  if (value.status === 'resolved' && value.responses.length !== value.items.length) {
    fail('INVALID_RECORD', 'A resolved records request must account for every requested item.');
  }
  if (value.status === 'cancelled' && value.responses.length !== 0) {
    fail('INVALID_RECORD', 'A cancelled records request cannot contain final responses.');
  }
  return value;
}

function singleLine(value, label, maximum) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()
    || value.length > maximum || /[\u0000-\u001f\u007f\r\n]/u.test(value)) {
    fail('INVALID_RECORD', `${label} must be nonempty trimmed single-line text of at most ${maximum} characters.`);
  }
}

function workforceTools(value, label) {
  if (!Array.isArray(value) || value.length < 2 || value.length > WORKFORCE_TOOLS.length
    || value.some((tool) => !WORKFORCE_TOOLS.includes(tool))
    || new Set(value).size !== value.length
    || JSON.stringify(value) !== JSON.stringify(WORKFORCE_TOOLS.filter((tool) => value.includes(tool)))
    || !value.includes('read') || !value.includes('search')) {
    fail('INVALID_RECORD', `${label} must be unique allowed tools in canonical order and include read and search.`);
  }
}

function workforceChecks(value, label) {
  if (!Array.isArray(value) || value.length > 20) {
    fail('INVALID_RECORD', `${label} must contain at most 20 command checks.`);
  }
  for (const check of value) {
    if (!Array.isArray(check) || check.length < 1 || check.length > 50
      || typeof check[0] !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/u.test(check[0])) {
      fail('INVALID_RECORD', `${label} entries must be argv arrays with a safe program name and 1 to 50 arguments.`);
    }
    for (const argument of check) {
      if (typeof argument !== 'string' || argument.length > 500
        || /[\u0000-\u001f\u007f\r\n]/u.test(argument)) {
        fail('INVALID_RECORD', `${label} arguments must be single-line strings of at most 500 characters without control characters.`);
      }
    }
  }
}

function workforceTextArray(value, label, maximum, stringMaximum, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail('INVALID_RECORD', `${label} must contain between ${minimum} and ${maximum} entries.`);
  }
  value.forEach((entry) => singleLine(entry, `${label} entry`, stringMaximum));
}

function validateWorkforceHistory(history, label, initial, validTransition) {
  if (!Array.isArray(history) || history.length < 1 || history.length > LIMITS.history) {
    fail('INVALID_RECORD', `${label} history must have between 1 and ${LIMITS.history} entries.`);
  }
  let state = null;
  let previousTimestamp = null;
  for (const [index, entry] of history.entries()) {
    fields(entry, ['from', 'to', 'actor', 'reason', 'timestamp'], `${label} history entry`);
    if (entry.from !== state || (index === 0 && (entry.to !== initial.state || entry.from !== null))) {
      fail('INVALID_RECORD', `${label} history must begin in its initial state and remain continuous.`);
    }
    if (index > 0 && !validTransition(entry.from, entry.to, entry.actor, entry.reason)) {
      fail('INVALID_RECORD', `${label} history contains an unsupported transition or actor.`);
    }
    if (index === 0 && entry.actor !== initial.actor) {
      fail('INVALID_RECORD', `${label} history must use the required initial actor.`);
    }
    text(entry.reason, `${label} history reason`, 4000);
    timestamp(entry.timestamp, `${label} history timestamp`);
    if (previousTimestamp && entry.timestamp < previousTimestamp) {
      fail('INVALID_RECORD', `${label} history timestamps must be non-decreasing.`);
    }
    state = entry.to;
    previousTimestamp = entry.timestamp;
  }
  return { state, timestamp: previousTimestamp };
}

export function validateRequisition(value, expectedCityId) {
  version(value, 'City requisition', [WORKFORCE_SCHEMA_VERSION]);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'workOrderId', 'staffId', 'title', 'reason', 'duties',
    'competencies', 'standards', 'tools', 'checks', 'mcpProposals', 'status', 'appointment',
    'createdAt', 'updatedAt', 'history', 'provenance',
  ], 'City requisition');
  if (typeof value.id !== 'string' || !requisitionPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City requisition ID must be REQ- followed by a UUID.');
  }
  cityId(value.cityId, 'City requisition cityId', expectedCityId);
  validateOrderId(value.workOrderId);
  if (typeof value.staffId !== 'string' || !staffIdPattern.test(value.staffId)
    || value.staffId === GENERAL_ENGINEER_ID) {
    fail('INVALID_RECORD', 'City requisition staffId must be a non-reserved safe staff ID.');
  }
  singleLine(value.title, 'City requisition title', 60);
  if (!/^[A-Za-z0-9][A-Za-z0-9 &+./-]{0,59}$/u.test(value.title)) {
    fail('INVALID_RECORD', 'City requisition title contains unsupported characters.');
  }
  text(value.reason, 'City requisition reason', 4000);
  text(value.duties, 'City requisition duties', 4000);
  workforceTextArray(value.competencies, 'City requisition competencies', 20, 300, 1);
  workforceTextArray(value.standards, 'City requisition standards', 20, 500);
  workforceTools(value.tools, 'City requisition tools');
  workforceChecks(value.checks, 'City requisition checks');
  workforceTextArray(value.mcpProposals, 'City requisition MCP proposals', 10, 500);
  if (!['requested', 'endorsed', 'declined', 'approved', 'filled'].includes(value.status)) {
    fail('INVALID_RECORD', 'City requisition status is unsupported.');
  }
  timestamp(value.createdAt, 'City requisition createdAt');
  timestamp(value.updatedAt, 'City requisition updatedAt');
  provenance(value.provenance, 'City requisition provenance');
  const history = validateWorkforceHistory(value.history, 'City requisition',
    { state: 'requested', actor: 'engineering-manager' }, (from, to, actor) => (
      (from === 'requested' && to === 'endorsed' && actor === 'human-resources')
      || (from === 'requested' && to === 'declined' && actor === 'human-resources')
      || (from === 'endorsed' && to === 'approved' && actor === 'engineering-manager')
      || (from === 'endorsed' && to === 'declined' && actor === 'engineering-manager')
      || (from === 'approved' && to === 'filled' && actor === 'human-resources')
    ));
  if (value.history[0].timestamp !== value.createdAt
    || history.state !== value.status || history.timestamp !== value.updatedAt) {
    fail('INVALID_RECORD', 'City requisition status and timestamps must match its history.');
  }
  const approval = value.history.find((entry) => entry.to === 'approved');
  if (Boolean(approval) !== (value.appointment !== null)) {
    fail('INVALID_RECORD', 'City requisition appointment must exist exactly when it has been approved.');
  }
  if (value.appointment !== null) {
    fields(value.appointment, ['decidedBy', 'basis', 'subject', 'authenticated', 'decidedAt'], 'City requisition appointment');
    if (value.appointment.decidedBy !== 'engineering-manager'
      || value.appointment.basis !== 'workforce-delegation'
      || value.appointment.authenticated !== false || value.appointment.decidedAt !== approval.timestamp) {
      fail('INVALID_RECORD', 'City requisition appointment must be a recorded, unauthenticated delegated decision.');
    }
    fields(value.appointment.subject, ['requisitionSha256', 'charterSha256', 'delegationPolicySha256'], 'City requisition appointment subject');
    digest(value.appointment.subject.requisitionSha256, 'City requisition subject.requisitionSha256');
    digest(value.appointment.subject.charterSha256, 'City requisition subject.charterSha256');
    digest(value.appointment.subject.delegationPolicySha256, 'City requisition subject.delegationPolicySha256');
    timestamp(value.appointment.decidedAt, 'City requisition appointment decidedAt');
  }
  return value;
}

export function validateStaff(value, expectedCityId) {
  version(value, 'City staff record', [WORKFORCE_SCHEMA_VERSION]);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'title', 'agentName', 'skillName', 'requisitionId', 'status',
    'tools', 'checks', 'mcpProposals', 'files', 'hiredAt', 'updatedAt', 'history', 'provenance',
  ], 'City staff record');
  if (typeof value.id !== 'string' || !staffIdPattern.test(value.id) || value.id === GENERAL_ENGINEER_ID) {
    fail('INVALID_RECORD', 'City staff ID is invalid or reserved for the bundled general engineer.');
  }
  cityId(value.cityId, 'City staff cityId', expectedCityId);
  singleLine(value.title, 'City staff title', 60);
  if (!/^[A-Za-z0-9][A-Za-z0-9 &+./-]{0,59}$/u.test(value.title)
    || value.agentName !== `City Engineer: ${value.title}`
    || value.skillName !== `city-engineering-${value.id}`) {
    fail('INVALID_RECORD', 'City staff title, agentName and skillName must match the generated identity.');
  }
  if (typeof value.requisitionId !== 'string' || !requisitionPattern.test(value.requisitionId)) {
    fail('INVALID_RECORD', 'City staff requisitionId must be a requisition ID.');
  }
  if (!['active', 'retired'].includes(value.status)) fail('INVALID_RECORD', 'City staff status must be active or retired.');
  workforceTools(value.tools, 'City staff tools');
  workforceChecks(value.checks, 'City staff checks');
  workforceTextArray(value.mcpProposals, 'City staff MCP proposals', 10, 500);
  const expectedPaths = [
    `.github/agents/city-engineer-${value.id}.agent.md`,
    `.github/skills/city-engineering-${value.id}/SKILL.md`,
    `.github/skills/city-engineering-${value.id}/references/practice.md`,
    `.github/skills/city-engineering-${value.id}/scripts/checks.json`,
    `.github/skills/city-engineering-${value.id}/scripts/run-checks.mjs`,
  ].sort();
  if (!Array.isArray(value.files) || value.files.length !== expectedPaths.length) {
    fail('INVALID_RECORD', 'City staff files must list exactly the five generated repository-relative files.');
  }
  for (const [index, file] of value.files.entries()) {
    fields(file, ['path', 'sha256'], 'City staff generated file');
    if (file.path !== expectedPaths[index]) fail('INVALID_RECORD', 'City staff generated file paths must be the exact sorted paths for this staff ID.');
    digest(file.sha256, 'City staff generated file sha256');
  }
  timestamp(value.hiredAt, 'City staff hiredAt');
  timestamp(value.updatedAt, 'City staff updatedAt');
  provenance(value.provenance, 'City staff provenance');
  const history = validateWorkforceHistory(value.history, 'City staff',
    { state: 'active', actor: 'human-resources' },
    (from, to, actor, reason) => from === 'active' && to === 'retired'
      && actor === 'human-resources' && /handover/iu.test(reason));
  if (value.history[0].timestamp !== value.hiredAt
    || history.state !== value.status || history.timestamp !== value.updatedAt) {
    fail('INVALID_RECORD', 'City staff status and timestamps must match its history.');
  }
  return value;
}

export function validateAssignment(value, expectedCityId) {
  version(value, 'City assignment', [WORKFORCE_SCHEMA_VERSION]);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'workOrderId', 'staffId', 'assignedBy', 'reason',
    'createdAt', 'provenance',
  ], 'City assignment');
  if (typeof value.id !== 'string' || !assignmentPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City assignment ID must be ASN- followed by a UUID.');
  }
  cityId(value.cityId, 'City assignment cityId', expectedCityId);
  validateOrderId(value.workOrderId);
  if (value.staffId !== GENERAL_ENGINEER_ID && (typeof value.staffId !== 'string' || !staffIdPattern.test(value.staffId))) {
    fail('INVALID_RECORD', 'City assignment staffId must be a safe staff ID.');
  }
  if (value.assignedBy !== 'engineering-manager') fail('INVALID_RECORD', 'City assignment must be made by the engineering-manager.');
  text(value.reason, 'City assignment reason', 4000);
  timestamp(value.createdAt, 'City assignment createdAt');
  provenance(value.provenance, 'City assignment provenance');
  return value;
}

export function parseReserved(value) {
  if (value === 'none') return [];
  const matters = typeof value === 'string' ? value.split(',') : [];
  if (matters.length === 0 || matters.some((matter) => !RESERVED_MATTERS.includes(matter))
    || new Set(matters).size !== matters.length) {
    fail('INVALID_ARGUMENT', `--reserved must be none or a comma-separated list of: ${RESERVED_MATTERS.join(', ')}.`);
  }
  return RESERVED_MATTERS.filter((matter) => matters.includes(matter));
}

function validateDeliveryDecision(value, expectedCityId) {
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'kind', 'workOrderIds', 'outcome', 'decidedBy', 'basis',
    'routineClass', 'reservedMatters', 'reason', 'subject', 'evidence', 'createdAt', 'provenance',
  ], 'City decision');
  if (typeof value.id !== 'string' || !decisionPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City decision ID must be DEC- followed by a UUID.');
  }
  cityId(value.cityId, 'City decision cityId', expectedCityId);
  if (!Array.isArray(value.workOrderIds) || value.workOrderIds.length !== 1) {
    fail('INVALID_RECORD', 'A delivery decision must reference exactly one work order.');
  }
  value.workOrderIds.forEach(validateOrderId);
  const invalid = (message) => fail('INVALID_RECORD', `City delivery decision ${message}`);
  if (value.kind === 'authorization') {
    if (!AUTHORIZATION_OUTCOMES.includes(value.outcome)) invalid('outcome must be authorize, reject, return or refer.');
    if (value.decidedBy === 'city-council') {
      if (!['council-delegation', 'routine-policy'].includes(value.basis)) invalid('by the council must rest on council-delegation or routine-policy.');
    } else if (value.decidedBy === 'resident') {
      if (value.basis !== 'resident-decision') invalid('by the resident must have basis resident-decision.');
    } else invalid('decidedBy must be city-council or resident.');
  } else if (value.kind === 'acceptance') {
    if (value.outcome !== 'accept' || value.decidedBy !== 'resident' || value.basis !== 'resident-decision') {
      invalid('acceptance is recorded only as a resident accept outcome.');
    }
  } else invalid('kind must be authorization or acceptance.');
  if (!Array.isArray(value.reservedMatters) || value.reservedMatters.some((matter) => !RESERVED_MATTERS.includes(matter))
    || JSON.stringify(value.reservedMatters) !== JSON.stringify(RESERVED_MATTERS.filter((matter) => value.reservedMatters.includes(matter)))) {
    invalid('reservedMatters must be unique known reserved matters in canonical order.');
  }
  if (value.kind === 'acceptance' && value.reservedMatters.length !== 0) invalid('acceptance does not classify reserved matters.');
  if (value.routineClass === null) {
    if (value.basis === 'routine-policy') invalid('basis routine-policy requires a routineClass.');
  } else if (!ROUTINE_CLASSES.includes(value.routineClass) || value.basis !== 'routine-policy'
    || value.outcome !== 'authorize' || value.reservedMatters.length !== 0) {
    invalid('routineClass is only valid for a council routine-policy authorization without reserved matters.');
  }
  if (value.decidedBy === 'city-council' && value.outcome === 'authorize' && value.reservedMatters.length !== 0) {
    invalid('cannot record a council authorization of a reserved matter; reserved matters are referred to the resident.');
  }
  text(value.reason, 'City decision reason', 4000);
  fields(value.subject, ['workOrderSha256', 'charterSha256', 'delegationPolicySha256'], 'City decision subject');
  digest(value.subject.workOrderSha256, 'City decision subject.workOrderSha256');
  digest(value.subject.charterSha256, 'City decision subject.charterSha256');
  if (value.subject.delegationPolicySha256 !== null) {
    digest(value.subject.delegationPolicySha256, 'City decision subject.delegationPolicySha256');
  } else if (value.decidedBy === 'city-council') invalid('by the council must record the delegation policy digest.');
  fields(value.evidence, ['declaredBy', 'reference', 'authenticated'], 'City decision evidence');
  if (value.decidedBy === 'resident') {
    text(value.evidence.declaredBy, 'City decision evidence.declaredBy', 200);
    text(value.evidence.reference, 'City decision evidence.reference', 4000);
  } else if (value.evidence.declaredBy !== null || value.evidence.reference !== null) {
    invalid('by the council must not carry resident declaration evidence.');
  }
  if (value.evidence.authenticated !== false) {
    invalid('evidence must record authenticated: false; the plugin cannot authenticate a decision.');
  }
  timestamp(value.createdAt, 'City decision createdAt');
  provenance(value.provenance, 'City decision provenance');
  return value;
}
