import { isAbsolute, posix } from 'node:path';
import {
  AUTHORIZATION_OUTCOMES, AUTHORIZATION_VOIDING_STATES, COMPATIBLE_PLUGIN_VERSIONS, CONFIG_SCHEMA_VERSION,
  DELIVERY_DECISION_SCHEMA_VERSION, EVIDENCE_RULE, GOVERNANCE, LEGACY_CONFIG_SCHEMA_VERSION,
  INFRASTRUCTURE_SCHEMA_VERSION, INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION,
  INSTITUTIONAL_REVIEW_TRIGGERS, LIMITS, PLUGIN, RECORDS_REQUEST_SCHEMA_VERSION, RESERVED_MATTERS, ROUTINE_CLASSES,
  SCHEMA_VERSION, STATUSES, TRANSITIONS, WORK_ORDER_PART_SCHEMA_VERSION, WORK_ORDER_SCHEMA_VERSION,
  WORKFORCE_SCHEMA_VERSION,
  WORKFORCE_TOOLS, GENERAL_ENGINEER_ID,
  DEVELOPMENT_IMPACTS, DEVELOPMENT_ARTIFACTS, DEVELOPMENT_POLICY, ZONING_CHANGE_TYPES, ZONING_POLICY,
} from './constants.mjs';
import { fail } from './errors.mjs';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuidPattern = new RegExp(`^${uuid}$`);
const orderPattern = new RegExp(`^WO-${uuid}$`);
const orderPartPattern = new RegExp(`^(WO-${uuid})-part-([0-9]{4})$`);
const decisionPattern = new RegExp(`^DEC-${uuid}$`);
const recordsRequestPattern = new RegExp(`^RR-${uuid}$`);
const institutionalReviewPattern = new RegExp(`^IR-${uuid}$`);
const artifactPattern = new RegExp(`^ART-${uuid}$`);
const infrastructureAssetPattern = new RegExp(`^IA-${uuid}$`);
const requisitionPattern = new RegExp(`^REQ-${uuid}$`);
const assignmentPattern = new RegExp(`^ASN-${uuid}$`);
const artifactCategories = ['working-draft', 'filed-work-product', 'proposed-instrument'];
const staffIdPattern = /^[a-z][a-z0-9-]{1,40}$/u;
const own = (value, key) => Object.hasOwn(value, key);

export const RECORD_TYPES = Object.freeze([
  'work-order', 'decision', 'records-request', 'institutional-review', 'artifact', 'infrastructure-asset',
  'infrastructure-programme', 'config', 'project', 'district', 'zoning', 'charter', 'policy',
]);
export const CANONICAL_RECORD_TYPES = Object.freeze([
  ...RECORD_TYPES, 'requisition', 'staff', 'assignment', 'work-order-part',
]);
// Development revision arrays, in canonical order; file parts may close any of them.
export const DEVELOPMENT_KINDS = Object.freeze([
  'screenings', 'applications', 'assessments', 'zoningChecks', 'statements', 'verifications',
  'completionNotices', 'permitExtensions',
]);
export const MAX_WORK_ORDER_PARTS = 99;
export const workOrderPartId = (orderId, part) => `${orderId}-part-${String(part).padStart(4, '0')}`;
export const RECORD_EXCHANGE_TYPES = Object.freeze([
  'work-order', 'decision', 'records-request', 'institutional-review', 'artifact', 'infrastructure-asset',
  'infrastructure-programme', 'config', 'project', 'district', 'zoning', 'charter', 'policy',
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
    case 'institutional-review':
      if (!institutionalReviewPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be an institutional-review ID.`);
      break;
    case 'artifact':
      if (!artifactPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be an artifact ID.`);
      break;
    case 'infrastructure-asset':
      if (!infrastructureAssetPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be an infrastructure asset ID.`);
      break;
    case 'infrastructure-programme':
      if (id !== 'infrastructure-programme') fail('INVALID_ARGUMENT', `${label} must be infrastructure-programme.`);
      break;
    case 'work-order-part':
      if (!orderPartPattern.test(id)) fail('INVALID_ARGUMENT', `${label} must be a work-order file part ID.`);
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
    case 'zoning':
      if (id !== 'zoning') fail('INVALID_ARGUMENT', `${label} must be zoning.`);
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

export function validateArtifactInput(value, allowLegacyCategory = false) {
  const required = ['title', 'kind', 'format', 'content', 'sourceOffice', 'workOrderId', 'supersedes'];
  fields(value, allowLegacyCategory && !own(value, 'recordCategory')
    ? required : [...required, 'recordCategory'], 'Artifact input');
  text(value.title, 'Artifact title', 500);
  text(value.kind, 'Artifact kind', 100);
  text(value.sourceOffice, 'Artifact source office', 200);
  if (own(value, 'recordCategory') && !artifactCategories.includes(value.recordCategory)) {
    fail('INVALID_ARGUMENT', `Artifact recordCategory must be one of ${artifactCategories.join(', ')}.`);
  }
  if (!['markdown', 'text', 'mermaid', 'json'].includes(value.format)) {
    fail('INVALID_ARGUMENT', 'Artifact format must be markdown, text, mermaid, or json.');
  }
  if (typeof value.content !== 'string' || !value.content.trim()
    || Buffer.byteLength(value.content) > LIMITS.fileBytes
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.content)) {
    fail('INVALID_ARGUMENT', 'Artifact content must be nonempty text without control characters within the local file size limit.');
  }
  if (value.format === 'json') parseJSON(Buffer.from(value.content), 'Artifact JSON content');
  if (value.workOrderId !== null) validateRecordId('work-order', value.workOrderId);
  if (value.supersedes !== null) validateRecordId('artifact', value.supersedes);
  return value;
}

export function validateArtifact(value, cityId) {
  version(value, 'Artifact');
  fieldsWithOptional(value, [
    'schemaVersion', 'id', 'cityId', 'title', 'kind', 'format', 'content',
    'sourceOffice', 'workOrderId', 'supersedes', 'createdAt', 'authenticated', 'provenance',
  ], ['recordCategory'], 'Artifact');
  validateRecordId('artifact', value.id);
  if (value.cityId !== cityId) fail('INVALID_RECORD', 'Artifact belongs to another city.');
  const { schemaVersion, id, cityId: owner, createdAt, authenticated, provenance: source, ...input } = value;
  validateArtifactInput(input, true);
  timestamp(createdAt, 'Artifact timestamp');
  if (authenticated !== false) fail('INVALID_RECORD', 'Artifact attribution is not authenticated.');
  provenance(source, 'Artifact provenance');
  return value;
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
    if (value.adoption.policies.some((policy) => policy.path === ZONING_POLICY)
      && !value.adoption.policies.some((policy) => policy.path === DEVELOPMENT_POLICY)) {
      fail('INVALID_RECORD', 'Adopting zoning requires the development-applications policy for conditional review.');
    }
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

function validateZoningPath(value, label) {
  text(value, label, 500);
  if (value !== '.' && (isAbsolute(value) || value.includes('\\') || value.includes(':')
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..'
      || segment === '.city' || segment === '.git')
    || posix.normalize(value) !== value)) {
    fail('INVALID_RECORD', `${label} must be a normalized repository-relative path outside city and Git metadata.`);
  }
}

export function validateZoningMap(value) {
  version(value, 'City zoning map');
  fields(value, ['schemaVersion', 'zones'], 'City zoning map');
  if (!Array.isArray(value.zones) || value.zones.length === 0 || value.zones.length > 100) {
    fail('INVALID_RECORD', 'City zoning map must contain between 1 and 100 zones.');
  }
  const ids = new Set();
  const paths = [];
  for (const zone of value.zones) {
    fields(zone, ['id', 'name', 'path', 'description', 'rules'], 'City zone');
    if (typeof zone.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(zone.id) || ids.has(zone.id)) {
      fail('INVALID_RECORD', 'City zone IDs must be unique safe lowercase identifiers.');
    }
    ids.add(zone.id);
    text(zone.name, 'City zone name', 200);
    text(zone.description, 'City zone description', 2000);
    validateZoningPath(zone.path, 'City zone path');
    const normalized = zone.path.normalize('NFC').toLowerCase();
    for (const existing of paths) {
      if (normalized === existing || normalized === '.' || existing === '.'
        || normalized.startsWith(`${existing}/`) || existing.startsWith(`${normalized}/`)) {
        fail('INVALID_RECORD', 'City zone paths must be disjoint so each delivery scope matches at most one zone.');
      }
    }
    paths.push(normalized);
    if (!Array.isArray(zone.rules) || zone.rules.length > ZONING_CHANGE_TYPES.length) {
      fail('INVALID_RECORD', 'City zone rules must be a bounded array of supported change types.');
    }
    const changeTypes = new Set();
    for (const rule of zone.rules) {
      fields(rule, ['changeType', 'disposition', 'requirements'], 'City zoning rule');
      if (!ZONING_CHANGE_TYPES.includes(rule.changeType) || changeTypes.has(rule.changeType)) {
        fail('INVALID_RECORD', 'City zoning rules must use unique supported change types.');
      }
      changeTypes.add(rule.changeType);
      if (!['permitted', 'conditional', 'prohibited'].includes(rule.disposition)) {
        fail('INVALID_RECORD', 'City zoning rule disposition is unsupported.');
      }
      stringArray(rule.requirements, 'Zoning rule requirements', 25, 2000);
      if ((rule.disposition === 'conditional') !== (rule.requirements.length > 0)) {
        fail('INVALID_RECORD', 'Conditional zoning rules need requirements; other dispositions must not include them.');
      }
    }
  }
  return value;
}

export function validateZoningCheckInput(value) {
  object(value, 'Zoning check input');
  const expected = ['changeTypes', 'reason', 'evidence'];
  if (Object.keys(value).length !== expected.length || expected.some((key) => !own(value, key))) {
    fail('INVALID_ARGUMENT', 'Zoning check input has missing or unexpected fields.');
  }
  if (!Array.isArray(value.changeTypes) || value.changeTypes.length === 0
    || value.changeTypes.length > ZONING_CHANGE_TYPES.length
    || new Set(value.changeTypes).size !== value.changeTypes.length
    || value.changeTypes.some((type) => !ZONING_CHANGE_TYPES.includes(type))) {
    fail('INVALID_ARGUMENT', 'Zoning changeTypes must be a nonempty array of unique supported change types.');
  }
  text(value.reason, 'Zoning check reason', 4000);
  text(value.evidence, 'Zoning check evidence', 4000);
  return value;
}

function validateZoningCheck(value, expectedRevision, createdAt, previousRecordedAt) {
  fields(value, [
    'revision', 'recordedAt', 'sourceOffice', 'authenticated', 'provenance', 'snapshot',
    'changeTypes', 'outcome', 'coverage', 'reason', 'evidence',
  ], 'Zoning check revision');
  if (value.revision !== expectedRevision || value.sourceOffice !== 'chief-planner' || value.authenticated !== false) {
    fail('INVALID_RECORD', 'Zoning check revision or professional source role is invalid.');
  }
  timestamp(value.recordedAt, 'Zoning check recordedAt');
  if (value.recordedAt < createdAt || value.recordedAt < previousRecordedAt) {
    fail('INVALID_RECORD', 'Zoning check timestamps must follow work-order creation and prior zoning checks.');
  }
  provenance(value.provenance, 'Zoning check provenance');
  digest(value.snapshot, 'Zoning check snapshot');
  validateZoningCheckInput({
    changeTypes: value.changeTypes, reason: value.reason, evidence: value.evidence,
  });
  if (!['permitted', 'conditional', 'prohibited', 'unknown'].includes(value.outcome)) {
    fail('INVALID_RECORD', 'Zoning check outcome is unsupported.');
  }
  developmentList(value.coverage, 'Zoning coverage', 100);
  const seenPaths = new Set();
  for (const scope of value.coverage) {
    fields(scope, ['path', 'zoneId', 'determinations'], 'Zoning coverage entry');
    validateZoningPath(scope.path, 'Zoning coverage path');
    if (seenPaths.has(scope.path)) fail('INVALID_RECORD', 'Zoning coverage paths must be unique.');
    seenPaths.add(scope.path);
    if (scope.zoneId !== null && (typeof scope.zoneId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(scope.zoneId))) {
      fail('INVALID_RECORD', 'Zoning coverage zoneId must be a safe zone ID or null.');
    }
    if (!Array.isArray(scope.determinations) || scope.determinations.length !== value.changeTypes.length) {
      fail('INVALID_RECORD', 'Zoning coverage must include every assessed change type.');
    }
    for (const [index, determination] of scope.determinations.entries()) {
      fields(determination, ['changeType', 'disposition', 'requirements'], 'Zoning determination');
      if (determination.changeType !== value.changeTypes[index]
        || !['permitted', 'conditional', 'prohibited', 'unknown'].includes(determination.disposition)) {
        fail('INVALID_RECORD', 'Zoning determination must match the ordered change types and use a supported disposition.');
      }
      stringArray(determination.requirements, 'Zoning determination requirements', 25, 2000);
      if (determination.disposition !== 'conditional' && determination.requirements.length > 0) {
        fail('INVALID_RECORD', 'Only conditional zoning determinations may include requirements.');
      }
    }
  }
  const dispositions = value.coverage.flatMap((scope) => scope.determinations.map((item) => item.disposition));
  const expectedOutcome = dispositions.includes('prohibited') ? 'prohibited'
    : dispositions.includes('unknown') || value.coverage.length === 0 ? 'unknown'
      : dispositions.includes('conditional') ? 'conditional' : 'permitted';
  if (value.outcome !== expectedOutcome) fail('INVALID_RECORD', 'Zoning check outcome must match its recorded determinations.');
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

function safeInfrastructurePath(value, label, allowRepositoryRoot = false) {
  text(value, label, 500);
  if (allowRepositoryRoot && value === '.') return;
  const segments = value.split('/');
  if (posix.isAbsolute(value) || value.includes('\\') || value.includes(':') || /[*?[\]{}]/u.test(value)
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
    || segments.some((segment) => segment === '.city' || segment === '.git')
    || posix.normalize(value) !== value) {
    fail('INVALID_RECORD', `${label} must be a normalized, explicit repository-relative path outside Git and city metadata.`);
  }
}

export function validateInfrastructureWorkScope(value) {
  fields(value, ['assets', 'targets', 'obligations', 'findings'], 'Work-order infrastructure scope');
  if (!Array.isArray(value.assets) || value.assets.length === 0 || value.assets.length > 100) {
    fail('INVALID_RECORD', 'Infrastructure scope must pin 1-100 asset revisions.');
  }
  const assets = new Set();
  for (const asset of value.assets) {
    fields(asset, ['assetId', 'revision', 'locators', 'baseline', 'criticality'], 'Infrastructure asset pin');
    validateRecordId('infrastructure-asset', asset.assetId, 'Infrastructure asset ID');
    positiveRevision(asset.revision);
    if (!Array.isArray(asset.locators) || asset.locators.length === 0 || asset.locators.length > 100) {
      fail('INVALID_RECORD', 'Infrastructure asset pins must snapshot 1-100 local asset locators.');
    }
    asset.locators.forEach((locator) => safeInfrastructurePath(locator, 'Pinned infrastructure asset locator', true));
    fields(asset.baseline, ['version', 'compatibility', 'supportEnds'], 'Pinned infrastructure baseline');
    if (asset.baseline.version !== null) text(asset.baseline.version, 'Pinned infrastructure baseline version', 200);
    text(asset.baseline.compatibility, 'Pinned infrastructure compatibility', 2000);
    if (asset.baseline.supportEnds !== null) calendarDate(asset.baseline.supportEnds, 'Pinned infrastructure support end date', 'INVALID_RECORD');
    if (!['low', 'moderate', 'high', 'critical'].includes(asset.criticality)) {
      fail('INVALID_RECORD', 'Pinned infrastructure criticality is unsupported.');
    }
    if (assets.has(asset.assetId)) fail('INVALID_RECORD', 'Infrastructure asset pins must be unique.');
    assets.add(asset.assetId);
  }
  if (!Array.isArray(value.targets) || value.targets.length > 100) {
    fail('INVALID_RECORD', 'Infrastructure delivery targets must be an array of at most 100 entries.');
  }
  const targets = new Set();
  for (const target of value.targets) {
    fields(target, ['assetId', 'path'], 'Infrastructure delivery target');
    if (!assets.has(target.assetId)) fail('INVALID_RECORD', 'Each infrastructure target must reference a pinned asset.');
    safeInfrastructurePath(target.path, 'Infrastructure target path');
    const key = `${target.assetId}\n${target.path}`;
    if (targets.has(key)) fail('INVALID_RECORD', 'Infrastructure delivery targets must be unique per asset.');
    targets.add(key);
  }
  if (!Array.isArray(value.obligations) || value.obligations.length > 100) {
    fail('INVALID_RECORD', 'Infrastructure obligations must be an array of at most 100 entries.');
  }
  const obligations = new Set();
  for (const obligation of value.obligations) {
    fields(obligation, ['assetId', 'obligationId', 'dueDate'], 'Infrastructure obligation reference');
    if (!assets.has(obligation.assetId)) fail('INVALID_RECORD', 'Each obligation must reference a pinned asset.');
    text(obligation.obligationId, 'Infrastructure obligation ID', 64);
    calendarDate(obligation.dueDate, 'Infrastructure obligation due date', 'INVALID_RECORD');
    const key = `${obligation.assetId}\n${obligation.obligationId}\n${obligation.dueDate}`;
    if (obligations.has(key)) fail('INVALID_RECORD', 'Infrastructure obligation occurrences must be unique.');
    obligations.add(key);
  }
  if (!Array.isArray(value.findings) || value.findings.length > 100) {
    fail('INVALID_RECORD', 'Infrastructure findings must be an array of at most 100 entries.');
  }
  const findings = new Set();
  for (const finding of value.findings) {
    fields(finding, ['assetId', 'findingId', 'kind'], 'Infrastructure finding reference');
    if (!assets.has(finding.assetId)) fail('INVALID_RECORD', 'Each finding must reference a pinned asset.');
    text(finding.findingId, 'Infrastructure finding ID', 64);
    if (!['security', 'defect', 'reliability', 'support', 'compatibility', 'recovery', 'other'].includes(finding.kind)) {
      fail('INVALID_RECORD', 'Infrastructure finding kind is unsupported.');
    }
    const key = `${finding.assetId}\n${finding.findingId}`;
    if (findings.has(key)) fail('INVALID_RECORD', 'Infrastructure finding references must be unique.');
    findings.add(key);
  }
}

export function validateWorkOrder(value, expectedCityId) {
  version(value, 'City work order', [SCHEMA_VERSION, WORK_ORDER_SCHEMA_VERSION, INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION]);
  const required = [
    'schemaVersion', 'id', 'cityId', 'title', 'request', 'acceptanceCriteria',
    'status', 'createdAt', 'updatedAt', 'history', 'provenance',
    ...(own(value, 'fileParts') ? ['fileParts'] : []),
    ...(own(value, 'requestRevisions') ? ['requestRevisions'] : []),
  ];
  if (value.schemaVersion === WORK_ORDER_SCHEMA_VERSION) {
    fields(value, [...required, 'projectIds', ...(own(value, 'development') ? ['development'] : [])], 'City work order');
  } else if (value.schemaVersion === INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION) {
    fields(value, [
      ...required, ...(own(value, 'projectIds') ? ['projectIds'] : []), 'infrastructure',
      ...(own(value, 'development') ? ['development'] : []),
    ], 'City work order');
  } else if (value.schemaVersion === SCHEMA_VERSION) {
    fields(value, [...required, ...(own(value, 'development') ? ['development'] : [])], 'City work order');
  } else {
    fail('UNKNOWN_SCHEMA_VERSION', 'City work order uses an unsupported schemaVersion. Restore a compatible version or perform a separately reviewed migration.');
  }
  validateOrderId(value.id);
  cityId(value.cityId, 'City work-order cityId', expectedCityId);
  if (own(value, 'fileParts')) validateFilePartManifest(value.fileParts, value.id);
  text(value.title, 'Work-order title', 500);
  text(value.request, 'Work-order request', 20000);
  stringArray(value.acceptanceCriteria, 'Work-order acceptance criteria', LIMITS.criteria, 2000);
  if (own(value, 'requestRevisions')) {
    if (!Array.isArray(value.requestRevisions) || value.requestRevisions.length === 0
      || value.requestRevisions.length > LIMITS.history) {
      fail('INVALID_RECORD', 'Work-order request revisions must be a nonempty bounded array.');
    }
    let previous = value.createdAt;
    for (const [index, revision] of value.requestRevisions.entries()) {
      fields(revision, ['revision', 'request', 'acceptanceCriteria', 'reason', 'recordedAt'], 'Work-order request revision');
      if (revision.revision !== index + 1) fail('INVALID_RECORD', 'Work-order request revisions must be sequential.');
      text(revision.request, 'Previous work-order request', 20000);
      stringArray(revision.acceptanceCriteria, 'Previous work-order acceptance criteria', LIMITS.criteria, 2000);
      text(revision.reason, 'Work-order revision reason', 4000);
      timestamp(revision.recordedAt, 'Work-order revision recordedAt');
      if (revision.recordedAt < previous) fail('INVALID_RECORD', 'Work-order request revisions must be chronological.');
      previous = revision.recordedAt;
    }
  }
  if ([WORK_ORDER_SCHEMA_VERSION, INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION].includes(value.schemaVersion)
    && own(value, 'projectIds')) {
    if (!Array.isArray(value.projectIds) || value.projectIds.length === 0 || value.projectIds.length > 100
      || new Set(value.projectIds).size !== value.projectIds.length
      || value.projectIds.some((id) => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(id))) {
      fail('INVALID_RECORD', 'Work-order projectIds must contain unique safe IDs for at least one project.');
    }
  }
  if (value.schemaVersion === INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION) {
    validateInfrastructureWorkScope(value.infrastructure);
    if ((!value.projectIds || value.projectIds.length === 0) && value.infrastructure.targets.length === 0) {
      fail('INVALID_RECORD', 'Infrastructure work orders need at least one registered project or exact infrastructure delivery target.');
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
  if (own(value, 'development')) validateDevelopment(value.development, value.createdAt);
  return value;
}

function validateFilePartManifest(value, orderId) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_WORK_ORDER_PARTS) {
    fail('INVALID_RECORD', `Work-order fileParts must list 1-${MAX_WORK_ORDER_PARTS} closed file parts.`);
  }
  for (const [index, reference] of value.entries()) {
    fields(reference, ['id', 'sha256'], 'Work-order file part reference');
    if (reference.id !== workOrderPartId(orderId, index + 1)) {
      fail('INVALID_RECORD', 'Work-order fileParts must reference this order\'s parts in consecutive order from part-0001.');
    }
    digest(reference.sha256, 'Work-order file part sha256');
  }
}

// A live file with closed parts holds only the open portion; validateWorkOrder runs on the assembled case file.
export function validateStoredWorkOrder(value, expectedCityId) {
  object(value, 'City work order');
  if (!own(value, 'fileParts')) return validateWorkOrder(value, expectedCityId);
  version(value, 'City work order', [WORK_ORDER_SCHEMA_VERSION, INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION]);
  validateOrderId(value.id);
  cityId(value.cityId, 'City work-order cityId', expectedCityId);
  validateFilePartManifest(value.fileParts, value.id);
  if (!Array.isArray(value.history) || value.history.length > LIMITS.history) {
    fail('INVALID_RECORD', `Open work-order history must have at most ${LIMITS.history} entries.`);
  }
  if (own(value, 'development')) partDevelopment(value.development, 'Open work-order development');
  return value;
}

function partDevelopment(value, label) {
  object(value, label);
  for (const [kind, records] of Object.entries(value)) {
    if (!DEVELOPMENT_KINDS.includes(kind) || !Array.isArray(records) || records.length > LIMITS.history) {
      fail('INVALID_RECORD', `${label} has an unknown or unbounded revision list.`);
    }
  }
}

export function validateWorkOrderPart(value, expectedCityId) {
  version(value, 'Work-order file part', [WORK_ORDER_PART_SCHEMA_VERSION]);
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'workOrderId', 'part', 'previousPartSha256', 'closedAt', 'reason',
    'sourceOffice', 'authenticated', 'contents', 'provenance',
  ], 'Work-order file part');
  if (typeof value.workOrderId !== 'string' || !orderPattern.test(value.workOrderId)
    || !Number.isSafeInteger(value.part) || value.part < 1 || value.part > MAX_WORK_ORDER_PARTS
    || value.id !== workOrderPartId(value.workOrderId, value.part)) {
    fail('INVALID_RECORD', 'Work-order file part ID must be <work-order-id>-part-NNNN and match its work order and part number.');
  }
  cityId(value.cityId, 'Work-order file part cityId', expectedCityId);
  if (value.part === 1) {
    if (value.previousPartSha256 !== null) fail('INVALID_RECORD', 'The first work-order file part has no previous part.');
  } else digest(value.previousPartSha256, 'Work-order file part previousPartSha256');
  timestamp(value.closedAt, 'Work-order file part closedAt');
  text(value.reason, 'Work-order file part reason', 4000);
  if (value.sourceOffice !== 'records-officer' || value.authenticated !== false) {
    fail('INVALID_RECORD', 'Work-order file parts are closed by the records-officer and are unauthenticated.');
  }
  provenance(value.provenance, 'Work-order file part provenance');
  fields(value.contents, ['history', 'development'], 'Work-order file part contents');
  if (!Array.isArray(value.contents.history) || value.contents.history.length > LIMITS.history) {
    fail('INVALID_RECORD', `Work-order file part history must have at most ${LIMITS.history} entries.`);
  }
  partDevelopment(value.contents.development, 'Work-order file part development');
  const total = value.contents.history.length
    + Object.values(value.contents.development).reduce((sum, records) => sum + records.length, 0);
  if (total === 0) fail('INVALID_RECORD', 'A work-order file part must close at least one history entry or revision.');
  const latest = [...value.contents.history.map((entry) => entry?.timestamp),
    ...Object.values(value.contents.development).flat().map((record) => record?.recordedAt)]
    .filter((time) => typeof time === 'string').sort().at(-1);
  if (latest && latest > value.closedAt) fail('INVALID_RECORD', 'A work-order file part cannot close entries recorded after closedAt.');
  return value;
}

function developmentList(value, label, maximum = 50) {
  if (!Array.isArray(value) || value.length > maximum) fail('INVALID_ARGUMENT', `${label} must be a bounded array (at most ${maximum}).`);
}

function uniqueDevelopment(value, key, label) {
  if (new Set(value.map(key)).size !== value.length) fail('INVALID_ARGUMENT', `${label} must not contain duplicates.`);
}

function positiveRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_ARGUMENT', 'Development revision must be a positive integer.');
}

// Shared by the record validator and CLI: no unknown keys or implicit defaults.
export function validateDevelopmentInput(kind, value) {
  const keys = {
    screenings: ['route', 'projectIds', 'scopeEvidence', 'reason', 'evidence', 'impacts', 'questions', 'policyCitations', 'requirements'],
    applications: ['screeningRevision', 'reason', 'evidence', 'proposal', 'answers', 'artifacts'],
    assessments: ['applicationRevision', 'outcome', 'reason', 'evidence'],
    statements: ['dimension', 'class', 'staffId', 'screeningRevision', 'scope', 'evidence'],
    verifications: ['statementRevision', 'staffId', 'outcome', 'reason', 'evidence'],
    completionNotices: ['permitId', 'conditions', 'evidence'],
    permitExtensions: ['permitId', 'extensionDays', 'reason', 'decidedBy', 'declaredBy', 'evidence'],
  }[kind];
  if (!keys) fail('INVALID_ARGUMENT', 'Unknown development record kind.');
  object(value, 'Development input');
  const optionalKeys = {
    screenings: ['permit'], statements: ['supersedes', 'correctionReason', 'evidenceArtifactId'],
  }[kind] ?? [];
  if (keys.some((key) => !own(value, key))
    || Object.keys(value).some((key) => !keys.includes(key) && !optionalKeys.includes(key))) {
    fail('INVALID_ARGUMENT', 'Development input has missing or unexpected fields.');
  }
  if (own(value, 'reason')) text(value.reason, 'Development reason', 4000);
  if (own(value, 'evidence') && (kind !== 'permitExtensions' || value.evidence !== null)) {
    text(value.evidence, 'Development evidence', 4000);
  }
  if (kind === 'screenings') {
    if (!['lightweight', 'formal', 'needs-clarification'].includes(value.route)) fail('INVALID_ARGUMENT', 'Unknown development route.');
    text(value.scopeEvidence, 'Development scope evidence', 4000);
    developmentList(value.projectIds, 'Development projectIds', 100);
    uniqueDevelopment(value.projectIds, (id) => id, 'Development projectIds');
    if (value.projectIds.some((id) => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(id))) {
      fail('INVALID_ARGUMENT', 'Development project IDs must be safe registered IDs.');
    }
    developmentList(value.impacts, 'Development impacts', DEVELOPMENT_IMPACTS.length);
    uniqueDevelopment(value.impacts, (impact) => impact, 'Development impacts');
    if (value.impacts.some((impact) => !DEVELOPMENT_IMPACTS.includes(impact))) fail('INVALID_ARGUMENT', 'Unknown material impact.');
    stringArray(value.questions, 'Development questions', 50, 2000);
    uniqueDevelopment(value.questions, (question) => question, 'Development questions');
    developmentList(value.policyCitations, 'Development policy citations');
    for (const citation of value.policyCitations) {
      fields(citation, ['path', 'section', 'projectIds'], 'Development policy citation');
      if (typeof citation.path !== 'string' || !policyPathPattern.test(citation.path)) fail('INVALID_ARGUMENT', 'Cite a local Markdown policy path.');
      text(citation.section, 'Policy section and interpretation', 2000);
      developmentList(citation.projectIds, 'Policy project scope', 100);
      uniqueDevelopment(citation.projectIds, (id) => id, 'Policy project scope');
      if (citation.projectIds.some((id) => !value.projectIds.includes(id))) fail('INVALID_ARGUMENT', 'A policy citation may only name screened projects; [] means repository-wide.');
    }
    if (!value.policyCitations.some((citation) => citation.path === DEVELOPMENT_POLICY && citation.projectIds.length === 0)) {
      fail('INVALID_ARGUMENT', 'Cite the repository-wide development-applications baseline.');
    }
    developmentList(value.requirements, 'Application requirements', 25);
    uniqueDevelopment(value.requirements, (item) => item?.id, 'Application requirements');
    for (const requirement of value.requirements) {
      fields(requirement, ['id', 'kind', 'description', 'reason'], 'Application requirement');
      if (typeof requirement.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(requirement.id)
        || !DEVELOPMENT_ARTIFACTS.includes(requirement.kind)) fail('INVALID_ARGUMENT', 'Invalid application requirement ID or kind.');
      text(requirement.description, 'Requirement description', 2000);
      text(requirement.reason, 'Requirement justification', 2000);
    }
    if (value.route === 'needs-clarification' && value.questions.length === 0) fail('INVALID_ARGUMENT', 'Uncertain screening needs concrete resident questions.');
    if (value.route === 'lightweight' && (value.impacts.length || value.questions.length || value.requirements.length)) {
      fail('INVALID_ARGUMENT', 'Lightweight screening cannot contain material impacts, unresolved questions or formal requirements.');
    }
    if (value.route === 'formal' && value.requirements.length === 0) fail('INVALID_ARGUMENT', 'Formal screening needs proportionate justified requirements.');
    if (own(value, 'permit')) {
      fields(value.permit, ['safetyClass', 'structuralClass', 'classRationale'], 'Permit risk classification');
      for (const key of ['safetyClass', 'structuralClass']) {
        if (!Number.isInteger(value.permit[key]) || value.permit[key] < 1 || value.permit[key] > 4) {
          fail('INVALID_ARGUMENT', `${key} must be an integer from 1 to 4.`);
        }
      }
      text(value.permit.classRationale, 'Permit class rationale', 2000);
    }
  } else if (kind === 'applications') {
    positiveRevision(value.screeningRevision);
    text(value.proposal, 'Assisted proposal', 20000);
    developmentList(value.answers, 'Resident answers');
    uniqueDevelopment(value.answers, (answer) => answer?.question, 'Resident answers');
    for (const answer of value.answers) {
      fields(answer, ['question', 'answer'], 'Resident answer');
      text(answer.question, 'Resident question', 2000);
      text(answer.answer, 'Resident answer', 4000);
    }
    developmentList(value.artifacts, 'Application artifacts', 25);
    uniqueDevelopment(value.artifacts, (artifact) => artifact?.requirementId, 'Application artifacts');
    for (const artifact of value.artifacts) {
      fields(artifact, ['requirementId', 'disposition', 'evidence'], 'Application artifact');
      text(artifact.requirementId, 'Artifact requirement ID', 64);
      if (!['provided', 'not-applicable'].includes(artifact.disposition)) fail('INVALID_ARGUMENT', 'Artifact disposition must be provided or not-applicable.');
      text(artifact.evidence, 'Artifact evidence or justified non-applicability', 4000);
    }
  } else if (kind === 'assessments') {
    positiveRevision(value.applicationRevision);
    if (!['ready', 'revise'].includes(value.outcome)) fail('INVALID_ARGUMENT', 'Assessment outcome must be ready or revise.');
  } else if (kind === 'statements') {
    if (!['safety', 'structural'].includes(value.dimension) || ![3, 4].includes(value.class)) {
      fail('INVALID_ARGUMENT', 'Permit statements require a safety or structural dimension and class 3 or 4.');
    }
    if (typeof value.staffId !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/u.test(value.staffId)) {
      fail('INVALID_ARGUMENT', 'Permit statement staffId must be a safe staff ID.');
    }
    positiveRevision(value.screeningRevision);
    text(value.scope, 'Permit statement scope', 2000);
    if (own(value, 'supersedes') !== own(value, 'correctionReason')) {
      fail('INVALID_ARGUMENT', 'A corrected permit statement needs both supersedes and correctionReason.');
    }
    if (own(value, 'supersedes')) {
      positiveRevision(value.supersedes);
      text(value.correctionReason, 'Permit statement correctionReason', 4000);
    }
    if (own(value, 'evidenceArtifactId')
      && (typeof value.evidenceArtifactId !== 'string' || !artifactPattern.test(value.evidenceArtifactId))) {
      fail('INVALID_ARGUMENT', 'Permit statement evidenceArtifactId must be an artifact ID.');
    }
  } else if (kind === 'verifications') {
    positiveRevision(value.statementRevision);
    if (typeof value.staffId !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/u.test(value.staffId)) {
      fail('INVALID_ARGUMENT', 'Permit verification staffId must be a safe staff ID.');
    }
    if (!['verified', 'not-verified'].includes(value.outcome)) fail('INVALID_ARGUMENT', 'Permit verification outcome must be verified or not-verified.');
  } else if (kind === 'completionNotices') {
    if (typeof value.permitId !== 'string' || !/^PMT-[0-9a-f-]{36}$/u.test(value.permitId)) {
      fail('INVALID_ARGUMENT', 'Completion notice must reference a permit ID.');
    }
    developmentList(value.conditions, 'Completion notice conditions', 50);
    uniqueDevelopment(value.conditions, (condition) => condition?.id, 'Completion notice conditions');
    for (const condition of value.conditions) {
      fields(condition, ['id', 'status', 'evidence'], 'Completion notice condition');
      if (typeof condition.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(condition.id)
        || !['met', 'not-applicable'].includes(condition.status)) {
        fail('INVALID_ARGUMENT', 'Completion notice condition has an invalid ID or status.');
      }
      text(condition.evidence, 'Completion condition evidence', 4000);
    }
  } else {
    if (typeof value.permitId !== 'string' || !/^PMT-[0-9a-f-]{36}$/u.test(value.permitId)) {
      fail('INVALID_ARGUMENT', 'Permit extension must reference a permit ID.');
    }
    if (!Number.isInteger(value.extensionDays) || value.extensionDays < 1 || value.extensionDays > 30) {
      fail('INVALID_ARGUMENT', 'Permit extensionDays must be an integer from 1 to 30.');
    }
    if (!['city-council', 'resident'].includes(value.decidedBy)) fail('INVALID_ARGUMENT', 'Permit extension decider must be city-council or resident.');
    if (value.decidedBy === 'resident') {
      text(value.declaredBy, 'Permit extension declaredBy', 200);
      text(value.evidence, 'Permit extension evidence', 4000);
    } else if (value.declaredBy !== null || value.evidence !== null) {
      fail('INVALID_ARGUMENT', 'Council permit extensions must not include resident declaration evidence.');
    }
  }
  return value;
}

export function applicationMissing(screening, application) {
  return [
    ...screening.questions.filter((question) => !application.answers.some((answer) => answer.question === question)),
    ...screening.requirements.filter((requirement) => !application.artifacts.some((artifact) => artifact.requirementId === requirement.id))
      .map((requirement) => `${requirement.id}: ${requirement.description}`),
  ];
}

export function validateDevelopment(value, createdAt) {
  fieldsWithOptional(value, ['screenings', 'applications', 'assessments'], [
    'zoningChecks', 'statements', 'verifications', 'completionNotices', 'permitExtensions',
  ], 'Work-order development');
  const offices = {
    screenings: 'chief-planner', applications: 'development-advisor', assessments: 'chief-planner',
    statements: 'engineering-manager', verifications: 'city-auditor', completionNotices: 'engineering-manager',
    permitExtensions: null,
  };
  const superseded = new Map();
  const statementHeads = new Map();
  for (const kind of Object.keys(offices)) {
    const records = value[kind] ?? (['statements', 'verifications', 'completionNotices', 'permitExtensions'].includes(kind) ? [] : null);
    if (!records) fail('INVALID_RECORD', `Work-order development is missing ${kind}.`);
    developmentList(records, `Development ${kind}`, LIMITS.history);
    let previous = createdAt;
    for (const [index, record] of records.entries()) {
      object(record, 'Development revision');
      const { revision, recordedAt, sourceOffice, authenticated, provenance: source, snapshot, ...input } = record;
      const sourceValid = kind === 'permitExtensions'
        ? ['city-council', 'resident'].includes(sourceOffice)
        : sourceOffice === offices[kind];
      if (revision !== index + 1 || !sourceValid || authenticated !== false) fail('INVALID_RECORD', 'Development revision or professional source role is invalid.');
      timestamp(recordedAt, 'Development recordedAt');
      if (recordedAt < previous) fail('INVALID_RECORD', 'Development revisions have out-of-order timestamps.');
      previous = recordedAt;
      provenance(source, 'Development provenance');
      if (kind === 'screenings') {
        if (typeof snapshot !== 'string' || !/^[a-f0-9]{64}$/u.test(snapshot)) fail('INVALID_RECORD', 'Screening snapshot must be a SHA-256 digest.');
      } else if (own(record, 'snapshot')) fail('INVALID_RECORD', 'Only a screening has a context snapshot.');
      validateDevelopmentInput(kind, input);
      if (kind === 'applications') {
        const screening = value.screenings[input.screeningRevision - 1];
        if (!screening || screening.route !== 'formal' || recordedAt < screening.recordedAt) fail('INVALID_RECORD', 'Application must reference an earlier formal screening.');
        if (input.answers.some((answer) => !screening.questions.includes(answer.question))
          || input.artifacts.some((artifact) => !screening.requirements.some((requirement) => requirement.id === artifact.requirementId))) {
          fail('INVALID_RECORD', 'Application evidence must address its screening requirements and questions.');
        }
      } else if (kind === 'assessments') {
        const application = value.applications[input.applicationRevision - 1];
        if (!application || recordedAt < application.recordedAt) fail('INVALID_RECORD', 'Assessment must reference an earlier application.');
        if (input.outcome === 'ready' && applicationMissing(value.screenings[application.screeningRevision - 1], application).length) {
          fail('INVALID_RECORD', 'Ready assessment cannot omit required evidence or resident answers.');
        }
      } else if (kind === 'statements') {
        const screening = value.screenings[input.screeningRevision - 1];
        if (!screening?.permit || screening.permit[`${input.dimension}Class`] !== input.class
          || recordedAt < screening.recordedAt) fail('INVALID_RECORD', 'Permit statement must match an earlier risk-classified screening.');
        if (own(input, 'supersedes')) {
          const previous = value.statements[input.supersedes - 1];
          if (!previous || input.supersedes >= revision || previous.dimension !== input.dimension
            || previous.class !== input.class || previous.screeningRevision !== input.screeningRevision) {
            fail('INVALID_RECORD', 'A corrected permit statement must supersede an earlier statement for the same dimension, class and screening.');
          }
          if (superseded.has(input.supersedes)) {
            fail('INVALID_RECORD', 'A permit statement can be superseded only once; corrections form a single chain.');
          }
          superseded.set(input.supersedes, record);
        }
        const key = `${input.dimension}:${input.screeningRevision}`;
        if ((input.supersedes ?? null) !== (statementHeads.get(key) ?? null)) {
          fail('INVALID_RECORD', 'Each later permit statement for a dimension and screening must supersede the current statement.');
        }
        statementHeads.set(key, revision);
      } else if (kind === 'verifications') {
        const statement = recordsOf(value, 'statements')[input.statementRevision - 1];
        if (!statement || statement.class !== 4 || statement.staffId === input.staffId
          || recordedAt < statement.recordedAt) fail('INVALID_RECORD', 'Verification must independently reference an earlier class 4 statement.');
        if (superseded.get(input.statementRevision)?.recordedAt < recordedAt) {
          fail('INVALID_RECORD', 'Verification cannot reference a permit statement that was already superseded.');
        }
      } else if (kind === 'completionNotices') {
        if (recordedAt < createdAt) fail('INVALID_RECORD', 'Completion notice cannot predate the work order.');
      } else if (kind === 'permitExtensions') {
        if (input.decidedBy !== sourceOffice || recordedAt < createdAt) {
          fail('INVALID_RECORD', 'Permit extension decider, source office, or chronology is invalid.');
        }
      }
    }
  }
  if (own(value, 'zoningChecks')) {
    developmentList(value.zoningChecks, 'Development zoningChecks', LIMITS.history);
    let previous = createdAt;
    for (const [index, record] of value.zoningChecks.entries()) {
      validateZoningCheck(record, index + 1, createdAt, previous);
      previous = record.recordedAt;
    }
  }
}

function recordsOf(value, kind) {
  return value[kind] ?? [];
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

export function validateInstitutionalReview(value, expectedCityId) {
  version(value, 'City institutional review');
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'conductedBy', 'summary', 'windowStart', 'coversThrough',
    'triggers', 'recommendations', 'createdAt', 'provenance',
  ], 'City institutional review');
  if (typeof value.id !== 'string' || !institutionalReviewPattern.test(value.id)) {
    fail('INVALID_RECORD', 'City institutional review ID must be IR- followed by a UUID.');
  }
  cityId(value.cityId, 'City institutional review cityId', expectedCityId);
  text(value.conductedBy, 'Institutional review conductedBy', 200);
  text(value.summary, 'Institutional review summary', 4000);
  timestamp(value.windowStart, 'Institutional review windowStart');
  timestamp(value.coversThrough, 'Institutional review coversThrough');
  timestamp(value.createdAt, 'Institutional review createdAt');
  if (value.windowStart > value.coversThrough || value.coversThrough !== value.createdAt) {
    fail('INVALID_RECORD', 'Institutional review window must end at its creation timestamp.');
  }
  if (!Array.isArray(value.triggers) || value.triggers.length !== INSTITUTIONAL_REVIEW_TRIGGERS.length) {
    fail('INVALID_RECORD', 'Institutional review must snapshot each supported trigger exactly once.');
  }
  const triggerNames = new Set();
  for (const trigger of value.triggers) {
    fields(trigger, ['name', 'observed', 'threshold', 'due'], 'Institutional review trigger');
    if (!INSTITUTIONAL_REVIEW_TRIGGERS.includes(trigger.name) || triggerNames.has(trigger.name)
      || !Number.isSafeInteger(trigger.observed) || trigger.observed < 0
      || !Number.isSafeInteger(trigger.threshold) || trigger.threshold < 1
      || typeof trigger.due !== 'boolean' || trigger.due !== (trigger.observed >= trigger.threshold)) {
      fail('INVALID_RECORD', 'Institutional review trigger snapshot is invalid.');
    }
    triggerNames.add(trigger.name);
  }
  if (INSTITUTIONAL_REVIEW_TRIGGERS.some((name) => !triggerNames.has(name))) {
    fail('INVALID_RECORD', 'Institutional review trigger snapshot is incomplete.');
  }
  if (!Array.isArray(value.recommendations) || value.recommendations.length > LIMITS.criteria) {
    fail('INVALID_RECORD', `Institutional review recommendations must be an array of at most ${LIMITS.criteria} entries.`);
  }
  for (const recommendation of value.recommendations) {
    fields(recommendation, [
      'title', 'rationale', 'precedent', 'sources', 'route', 'reservedMatters',
    ], 'Institutional review recommendation');
    text(recommendation.title, 'Institutional review recommendation title', 500);
    text(recommendation.rationale, 'Institutional review recommendation rationale', 4000);
    text(recommendation.precedent, 'Institutional review recommendation precedent', 4000);
    if (!Array.isArray(recommendation.sources) || recommendation.sources.length === 0
      || recommendation.sources.length > 10) {
      fail('INVALID_RECORD', 'Institutional review recommendations require 1-10 cited sources.');
    }
    recommendation.sources.forEach((source) => text(source, 'Institutional review source', 1000));
    if (!['administrative', 'council', 'resident'].includes(recommendation.route)) {
      fail('INVALID_RECORD', 'Institutional review recommendation route is unsupported.');
    }
    if (!Array.isArray(recommendation.reservedMatters)
      || recommendation.reservedMatters.some((matter) => !RESERVED_MATTERS.includes(matter))
      || new Set(recommendation.reservedMatters).size !== recommendation.reservedMatters.length) {
      fail('INVALID_RECORD', 'Institutional review recommendation reserved matters are invalid.');
    }
    if (recommendation.reservedMatters.length > 0 && recommendation.route !== 'resident') {
      fail('INVALID_RECORD', 'Recommendations involving reserved matters must be routed to the resident.');
    }
  }
  provenance(value.provenance, 'Institutional review provenance');
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
    ...(own(value, 'permit') ? ['permit'] : []),
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
  if (own(value, 'permit')) {
    if (value.kind !== 'authorization' || value.outcome !== 'authorize') invalid('permit terms are valid only on an authorization.');
    validatePermitRecord(value.permit);
  }
  if (value.routineClass === null) {
    if (value.basis === 'routine-policy') invalid('basis routine-policy requires a routineClass.');
  } else if (!ROUTINE_CLASSES.includes(value.routineClass) || value.basis !== 'routine-policy'
    || value.outcome !== 'authorize' || value.reservedMatters.length !== 0) {
    invalid('routineClass is only valid for a council routine-policy authorization without reserved matters.');
  }

  function validatePermitRecord(permit) {
    fields(permit, [
      'permitId', 'safetyClass', 'structuralClass', 'issuedAt', 'conditions', 'rightOfWay',
      'commencementDeadline', 'inactivityDays',
    ], 'Permit terms');
    if (typeof permit.permitId !== 'string' || !/^PMT-[0-9a-f-]{36}$/u.test(permit.permitId)) {
      fail('INVALID_RECORD', 'Permit ID must be PMT- followed by a UUID.');
    }
    for (const key of ['safetyClass', 'structuralClass']) {
      if (!Number.isInteger(permit[key]) || permit[key] < 1 || permit[key] > 4) {
        fail('INVALID_RECORD', `${key} must be an integer from 1 to 4.`);
      }
    }
    timestamp(permit.issuedAt, 'Permit issuedAt');
    calendarDate(permit.commencementDeadline, 'Permit commencementDeadline', 'INVALID_RECORD');
    if (!Number.isInteger(permit.inactivityDays) || permit.inactivityDays < 1 || permit.inactivityDays > 365) {
      fail('INVALID_RECORD', 'Permit inactivityDays must be an integer from 1 to 365.');
    }
    if (!Array.isArray(permit.conditions) || permit.conditions.length > 50
      || new Set(permit.conditions.map((condition) => condition?.id)).size !== permit.conditions.length) {
      fail('INVALID_RECORD', 'Permit conditions must be a bounded array with unique IDs.');
    }
    for (const condition of permit.conditions) {
      fields(condition, ['id', 'description'], 'Permit condition');
      if (typeof condition.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(condition.id)) {
        fail('INVALID_RECORD', 'Permit condition ID must be a safe identifier.');
      }
      text(condition.description, 'Permit condition description', 2000);
    }
    if (!Array.isArray(permit.rightOfWay) || permit.rightOfWay.length > 50
      || new Set(permit.rightOfWay.map((consent) => consent?.projectId)).size !== permit.rightOfWay.length) {
      fail('INVALID_RECORD', 'Permit rightOfWay must be bounded and unique by project.');
    }
    for (const consent of permit.rightOfWay) {
      fields(consent, ['projectId', 'consentBy', 'evidence'], 'Right-of-way consent');
      if (typeof consent.projectId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(consent.projectId)) {
        fail('INVALID_RECORD', 'Right-of-way projectId must be a safe project ID.');
      }
      text(consent.consentBy, 'Right-of-way consentBy', 200);
      text(consent.evidence, 'Right-of-way consent evidence', 4000);
    }
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
