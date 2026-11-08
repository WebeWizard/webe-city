import path from 'node:path';
import { COMPATIBLE_PLUGIN_VERSIONS, INFRASTRUCTURE_POLICY } from './constants.mjs';
import { fail } from './errors.mjs';
import { inspect } from './filesystem.mjs';
import { calendarDate, text, validateRecordId } from './validation.mjs';

const own = (value, key) => Object.hasOwn(value, key);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const safeId = /^[a-z][a-z0-9-]{0,63}$/u;
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const lifecycle = ['proposed', 'active', 'deprecated', 'retired'];
const conditionStates = ['unknown', 'satisfactory', 'degraded', 'failed'];
const criticalities = ['low', 'moderate', 'high', 'critical'];
const findingKinds = ['security', 'defect', 'reliability', 'support', 'compatibility', 'recovery', 'other'];
const urgency = ['low', 'moderate', 'high', 'critical'];

function fields(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== expected.length || expected.some((key) => !own(value, key))) {
    fail('INVALID_RECORD', `${label} has missing or unexpected fields.`);
  }
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !dateTime.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail('INVALID_RECORD', `${label} must be a canonical UTC timestamp.`);
  }
}

function optionalDate(value, label) {
  if (value !== null) calendarDate(value, label, 'INVALID_RECORD');
}

function unique(values, key, label) {
  if (new Set(values.map(key)).size !== values.length) fail('INVALID_RECORD', `${label} must be unique.`);
}

function boundedArray(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) fail('INVALID_RECORD', `${label} must contain at most ${maximum} entries.`);
}

function identifier(value, label) {
  if (typeof value !== 'string' || !safeId.test(value)) fail('INVALID_RECORD', `${label} must be a safe lowercase identifier.`);
}

function safePath(value, label) {
  text(value, label, 500);
  if (value === '.') return;
  const segments = value.split('/');
  if (path.posix.isAbsolute(value) || value.includes('\\') || value.includes(':') || /[*?[\]{}]/u.test(value)
    || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment === '.city' || segment === '.git')
    || path.posix.normalize(value) !== value) {
    fail('INVALID_RECORD', `${label} must be a normalized repository-relative path outside Git and city metadata.`);
  }
}

function validateProvenance(value, label) {
  fields(value, ['source', 'plugin'], label);
  if (value.source !== 'local-draft') fail('INVALID_RECORD', `${label} must be local-draft metadata.`);
  fields(value.plugin, ['name', 'version'], `${label}.plugin`);
  if (value.plugin.name !== 'repository-city' || !COMPATIBLE_PLUGIN_VERSIONS.includes(value.plugin.version)) {
    fail('INVALID_RECORD', `${label}.plugin is invalid.`);
  }
}

export function validateInfrastructureAsset(value, expectedCityId) {
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'revision', 'name', 'purpose', 'category', 'lifecycle',
    'owner', 'custodian', 'operator', 'services', 'locators', 'projectIds', 'dependencies',
    'criticality', 'condition', 'baseline', 'obligations', 'findings', 'deferrals',
    'renewal', 'resilience', 'history', 'createdAt', 'updatedAt', 'provenance',
  ], 'Infrastructure asset');
  if (value.schemaVersion !== 1) fail('UNKNOWN_SCHEMA_VERSION', 'Infrastructure asset schemaVersion is unsupported.');
  validateRecordId('infrastructure-asset', value.id, 'Infrastructure asset ID');
  if (value.cityId !== expectedCityId || !uuid.test(value.cityId)) fail('INVALID_RECORD', 'Infrastructure asset cityId must identify this city.');
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail('INVALID_RECORD', 'Infrastructure asset revision must be positive.');
  text(value.name, 'Infrastructure asset name', 200);
  text(value.purpose, 'Infrastructure asset purpose', 2000);
  identifier(value.category, 'Infrastructure asset category');
  if (!lifecycle.includes(value.lifecycle)) fail('INVALID_RECORD', 'Infrastructure asset lifecycle is unsupported.');
  text(value.owner, 'Infrastructure asset accountable owner', 200);
  text(value.custodian, 'Infrastructure asset technical custodian', 200);

  fields(value.operator, ['role', 'channel', 'coverage', 'verifiedAt'], 'Infrastructure asset operator');
  text(value.operator.role, 'Infrastructure operator role', 200);
  text(value.operator.channel, 'Infrastructure reporting channel', 500);
  text(value.operator.coverage, 'Infrastructure operator coverage', 1000);
  optionalDate(value.operator.verifiedAt, 'Infrastructure operator verification date');

  boundedArray(value.services, 'Infrastructure services', 100);
  unique(value.services, (service) => service.id, 'Infrastructure service IDs');
  for (const service of value.services) {
    fields(service, [
      'id', 'name', 'expectation', 'target', 'measurementSource', 'maxAgeDays', 'measurements',
    ], 'Infrastructure service');
    identifier(service.id, 'Infrastructure service ID');
    text(service.name, 'Infrastructure service name', 200);
    text(service.expectation, 'Infrastructure service expectation', 1000);
    if (service.target !== null) text(service.target, 'Infrastructure service target', 500);
    text(service.measurementSource, 'Infrastructure measurement source', 500);
    if (!Number.isSafeInteger(service.maxAgeDays) || service.maxAgeDays < 1 || service.maxAgeDays > 3650) {
      fail('INVALID_RECORD', 'Infrastructure service maxAgeDays must be 1-3650.');
    }
    boundedArray(service.measurements, 'Infrastructure service measurements', 1000);
    for (const measurement of service.measurements) {
      fields(measurement, ['observedAt', 'value', 'evidence'], 'Infrastructure service measurement');
      optionalDate(measurement.observedAt, 'Infrastructure measurement date');
      text(measurement.value, 'Infrastructure measurement value', 500);
      text(measurement.evidence, 'Infrastructure measurement evidence', 2000);
    }
  }

  boundedArray(value.locators, 'Infrastructure asset locators', 100);
  value.locators.forEach((locator) => safePath(locator, 'Infrastructure asset locator'));
  unique(value.locators, (locator) => locator.normalize('NFC').toLowerCase(), 'Infrastructure asset locators');
  boundedArray(value.projectIds, 'Infrastructure consumer projects', 100);
  value.projectIds.forEach((id) => identifier(id, 'Infrastructure consumer project ID'));
  unique(value.projectIds, (id) => id, 'Infrastructure consumer project IDs');
  boundedArray(value.dependencies, 'Infrastructure dependencies', 100);
  value.dependencies.forEach((id) => validateRecordId('infrastructure-asset', id, 'Infrastructure dependency'));
  if (value.dependencies.includes(value.id)) fail('INVALID_RECORD', 'An infrastructure asset cannot depend on itself.');
  unique(value.dependencies, (id) => id, 'Infrastructure dependencies');

  if (!criticalities.includes(value.criticality)) fail('INVALID_RECORD', 'Infrastructure asset criticality is unsupported.');
  fields(value.condition, ['state', 'observedAt', 'method', 'evidence'], 'Infrastructure condition');
  if (!conditionStates.includes(value.condition.state)) fail('INVALID_RECORD', 'Infrastructure condition state is unsupported.');
  optionalDate(value.condition.observedAt, 'Infrastructure condition date');
  text(value.condition.method, 'Infrastructure condition method', 500);
  text(value.condition.evidence, 'Infrastructure condition evidence', 2000);
  fields(value.baseline, ['version', 'compatibility', 'supportEnds'], 'Infrastructure baseline');
  if (value.baseline.version !== null) text(value.baseline.version, 'Infrastructure baseline version', 200);
  text(value.baseline.compatibility, 'Infrastructure compatibility notes', 2000);
  optionalDate(value.baseline.supportEnds, 'Infrastructure support end date');

  boundedArray(value.obligations, 'Infrastructure maintenance obligations', 500);
  unique(value.obligations, (obligation) => obligation.id, 'Infrastructure obligation IDs');
  for (const obligation of value.obligations) {
    fields(obligation, [
      'id', 'task', 'owner', 'trigger', 'dueDate', 'recurrenceDays', 'acceptanceEvidence',
      'status', 'nextReviewDate', 'history',
    ], 'Infrastructure maintenance obligation');
    identifier(obligation.id, 'Infrastructure obligation ID');
    text(obligation.task, 'Infrastructure obligation task', 1000);
    text(obligation.owner, 'Infrastructure obligation owner', 200);
    if (!['recurring', 'event-driven'].includes(obligation.trigger)) fail('INVALID_RECORD', 'Infrastructure obligation trigger is unsupported.');
    optionalDate(obligation.dueDate, 'Infrastructure obligation due date');
    if (obligation.trigger === 'recurring' && obligation.dueDate === null) {
      fail('INVALID_RECORD', 'A recurring infrastructure obligation requires a due date.');
    }
    if (obligation.recurrenceDays !== null
      && (!Number.isSafeInteger(obligation.recurrenceDays) || obligation.recurrenceDays < 1 || obligation.recurrenceDays > 3650)) {
      fail('INVALID_RECORD', 'Infrastructure recurrenceDays must be 1-3650 or null.');
    }
    text(obligation.acceptanceEvidence, 'Infrastructure obligation acceptance evidence', 1000);
    if (!['open', 'deferred', 'satisfied'].includes(obligation.status)) fail('INVALID_RECORD', 'Infrastructure obligation status is unsupported.');
    optionalDate(obligation.nextReviewDate, 'Infrastructure obligation next review date');
    boundedArray(obligation.history, 'Infrastructure obligation history', 1000);
    for (const entry of obligation.history) {
      fields(entry, ['outcome', 'date', 'evidence', 'workOrderId'], 'Infrastructure obligation history entry');
      if (!['completed', 'deferred', 'no-change'].includes(entry.outcome)) fail('INVALID_RECORD', 'Infrastructure obligation outcome is unsupported.');
      optionalDate(entry.date, 'Infrastructure obligation history date');
      text(entry.evidence, 'Infrastructure obligation evidence', 2000);
      if (entry.workOrderId !== null) validateWorkOrderId(entry.workOrderId);
    }
  }

  boundedArray(value.findings, 'Infrastructure findings', 500);
  unique(value.findings, (finding) => finding.id, 'Infrastructure finding IDs');
  for (const finding of value.findings) {
    fields(finding, [
      'id', 'kind', 'source', 'observedAt', 'affectedBaseline', 'applicability',
      'urgency', 'evidence', 'status', 'workOrderId',
    ], 'Infrastructure finding');
    identifier(finding.id, 'Infrastructure finding ID');
    if (!findingKinds.includes(finding.kind)) fail('INVALID_RECORD', 'Infrastructure finding kind is unsupported.');
    text(finding.source, 'Infrastructure finding source', 500);
    optionalDate(finding.observedAt, 'Infrastructure finding date');
    text(finding.affectedBaseline, 'Infrastructure finding baseline', 500);
    if (!['unknown', 'applicable', 'not-applicable'].includes(finding.applicability)) fail('INVALID_RECORD', 'Infrastructure finding applicability is unsupported.');
    if (!urgency.includes(finding.urgency)) fail('INVALID_RECORD', 'Infrastructure finding urgency is unsupported.');
    text(finding.evidence, 'Infrastructure finding evidence', 2000);
    if (!['open', 'resolved'].includes(finding.status)) fail('INVALID_RECORD', 'Infrastructure finding status is unsupported.');
    if (finding.workOrderId !== null) validateWorkOrderId(finding.workOrderId);
  }

  boundedArray(value.deferrals, 'Infrastructure deferrals', 500);
  for (const deferral of value.deferrals) {
    fields(deferral, [
      'id', 'referenceType', 'referenceId', 'reason', 'riskOwner', 'authorityReference',
      'reviewDate', 'originalDueDate',
    ], 'Infrastructure deferral');
    identifier(deferral.id, 'Infrastructure deferral ID');
    if (!['obligation', 'finding'].includes(deferral.referenceType)) fail('INVALID_RECORD', 'Infrastructure deferral referenceType is unsupported.');
    text(deferral.referenceId, 'Infrastructure deferral reference ID', 64);
    text(deferral.reason, 'Infrastructure deferral reason', 2000);
    text(deferral.riskOwner, 'Infrastructure deferral risk owner', 200);
    if (deferral.authorityReference !== null) text(deferral.authorityReference, 'Infrastructure deferral authority reference', 1000);
    calendarDate(deferral.reviewDate, 'Infrastructure deferral review date', 'INVALID_RECORD');
    optionalDate(deferral.originalDueDate, 'Infrastructure original due date');
  }

  fields(value.renewal, ['description', 'resourceEstimate'], 'Infrastructure renewal plan');
  text(value.renewal.description, 'Infrastructure renewal description', 2000);
  text(value.renewal.resourceEstimate, 'Infrastructure renewal resource estimate', 500);
  fields(value.resilience, ['failureModes', 'restorationOrder', 'recoveryPlan', 'lastExerciseAt', 'exerciseEvidence'], 'Infrastructure resilience');
  boundedArray(value.resilience.failureModes, 'Infrastructure failure modes', 100);
  value.resilience.failureModes.forEach((item) => text(item, 'Infrastructure failure mode', 500));
  text(value.resilience.restorationOrder, 'Infrastructure restoration order', 2000);
  text(value.resilience.recoveryPlan, 'Infrastructure recovery plan', 2000);
  optionalDate(value.resilience.lastExerciseAt, 'Infrastructure recovery exercise date');
  text(value.resilience.exerciseEvidence, 'Infrastructure recovery exercise evidence', 2000);

  if (!Array.isArray(value.history) || value.history.length !== value.revision || value.history.length > 1000) {
    fail('INVALID_RECORD', 'Infrastructure asset history must contain exactly one entry per revision.');
  }
  for (const [index, entry] of value.history.entries()) {
    fields(entry, ['revision', 'reason', 'recordedAt', 'recordedBy'], 'Infrastructure asset history entry');
    if (entry.revision !== index + 1) fail('INVALID_RECORD', 'Infrastructure asset history revisions must be contiguous.');
    text(entry.reason, 'Infrastructure asset history reason', 2000);
    timestamp(entry.recordedAt, 'Infrastructure asset history recordedAt');
    text(entry.recordedBy, 'Infrastructure asset history recordedBy', 200);
  }
  timestamp(value.createdAt, 'Infrastructure asset createdAt');
  timestamp(value.updatedAt, 'Infrastructure asset updatedAt');
  if (value.history.at(-1).recordedAt !== value.updatedAt || value.history[0].recordedAt !== value.createdAt) {
    fail('INVALID_RECORD', 'Infrastructure asset timestamps must match its first and latest history entries.');
  }
  validateProvenance(value.provenance, 'Infrastructure asset provenance');
  return value;
}

function validateWorkOrderId(value) {
  if (typeof value !== 'string' || !/^WO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
    fail('INVALID_RECORD', 'Infrastructure links must identify a work order.');
  }
}

export function validateInfrastructureProgramme(value, expectedCityId) {
  fields(value, [
    'schemaVersion', 'id', 'cityId', 'revision', 'horizon', 'reviewDue', 'summary',
    'assets', 'activities', 'unfundedNeeds', 'history', 'updatedAt', 'provenance',
  ], 'Infrastructure programme');
  if (value.schemaVersion !== 1) fail('UNKNOWN_SCHEMA_VERSION', 'Infrastructure programme schemaVersion is unsupported.');
  validateRecordId('infrastructure-programme', value.id);
  if (value.cityId !== expectedCityId || !uuid.test(value.cityId)) fail('INVALID_RECORD', 'Infrastructure programme cityId must identify this city.');
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail('INVALID_RECORD', 'Infrastructure programme revision must be positive.');
  fields(value.horizon, ['startYear', 'endYear'], 'Infrastructure programme horizon');
  if (!Number.isInteger(value.horizon.startYear) || !Number.isInteger(value.horizon.endYear)
    || value.horizon.startYear < 2000 || value.horizon.endYear < value.horizon.startYear
    || value.horizon.endYear - value.horizon.startYear > 50) {
    fail('INVALID_RECORD', 'Infrastructure programme horizon must be an explicit span of at most 50 years.');
  }
  calendarDate(value.reviewDue, 'Infrastructure programme review date', 'INVALID_RECORD');
  text(value.summary, 'Infrastructure programme summary', 4000);
  boundedArray(value.assets, 'Infrastructure programme assets', 100);
  unique(value.assets, (item) => item.assetId, 'Infrastructure programme asset IDs');
  for (const item of value.assets) {
    fields(item, ['assetId', 'revision'], 'Infrastructure programme asset reference');
    validateRecordId('infrastructure-asset', item.assetId);
    if (!Number.isSafeInteger(item.revision) || item.revision < 1) fail('INVALID_RECORD', 'Infrastructure programme asset revision must be positive.');
  }
  boundedArray(value.activities, 'Infrastructure programme activities', 500);
  unique(value.activities, (item) => item.id, 'Infrastructure programme activity IDs');
  for (const item of value.activities) {
    fields(item, [
      'id', 'assetId', 'title', 'description', 'priority', 'proposedYear', 'effortEstimate',
      'resourceEstimate', 'authorityStatus', 'workOrderId',
    ], 'Infrastructure programme activity');
    identifier(item.id, 'Infrastructure programme activity ID');
    validateRecordId('infrastructure-asset', item.assetId);
    if (!value.assets.some((asset) => asset.assetId === item.assetId)) fail('INVALID_RECORD', 'Infrastructure programme activity must reference a listed asset.');
    text(item.title, 'Infrastructure programme activity title', 200);
    text(item.description, 'Infrastructure programme activity description', 2000);
    if (!criticalities.includes(item.priority)) fail('INVALID_RECORD', 'Infrastructure programme activity priority is unsupported.');
    if (!Number.isInteger(item.proposedYear) || item.proposedYear < value.horizon.startYear || item.proposedYear > value.horizon.endYear) {
      fail('INVALID_RECORD', 'Infrastructure programme activity year must be within the planning horizon.');
    }
    text(item.effortEstimate, 'Infrastructure programme effort estimate', 500);
    text(item.resourceEstimate, 'Infrastructure programme resource estimate', 500);
    if (!['proposed', 'authorized', 'deferred', 'complete'].includes(item.authorityStatus)) fail('INVALID_RECORD', 'Infrastructure programme activity authority status is unsupported.');
    if (item.workOrderId !== null) validateWorkOrderId(item.workOrderId);
  }
  boundedArray(value.unfundedNeeds, 'Infrastructure unfunded needs', 500);
  unique(value.unfundedNeeds, (item) => item.id, 'Infrastructure unfunded need IDs');
  for (const need of value.unfundedNeeds) {
    fields(need, ['id', 'description', 'consequence', 'reviewDate'], 'Infrastructure unfunded need');
    identifier(need.id, 'Infrastructure unfunded need ID');
    text(need.description, 'Infrastructure unfunded need description', 2000);
    text(need.consequence, 'Infrastructure unfunded need consequence', 2000);
    calendarDate(need.reviewDate, 'Infrastructure unfunded need review date', 'INVALID_RECORD');
  }
  if (!Array.isArray(value.history) || value.history.length !== value.revision || value.history.length > 1000) {
    fail('INVALID_RECORD', 'Infrastructure programme history must contain exactly one entry per revision.');
  }
  for (const [index, entry] of value.history.entries()) {
    fields(entry, ['revision', 'reason', 'recordedAt', 'recordedBy'], 'Infrastructure programme history entry');
    if (entry.revision !== index + 1) fail('INVALID_RECORD', 'Infrastructure programme history revisions must be contiguous.');
    text(entry.reason, 'Infrastructure programme history reason', 2000);
    timestamp(entry.recordedAt, 'Infrastructure programme history recordedAt');
    text(entry.recordedBy, 'Infrastructure programme history recordedBy', 200);
  }
  timestamp(value.updatedAt, 'Infrastructure programme updatedAt');
  if (value.history.at(-1).recordedAt !== value.updatedAt) fail('INVALID_RECORD', 'Infrastructure programme updatedAt must match its latest history entry.');
  validateProvenance(value.provenance, 'Infrastructure programme provenance');
  return value;
}

function dueDate(date, today) {
  return date !== null && date <= today;
}

export function infrastructureStatus(city, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const assets = [...city.infrastructure.assets.values()].map(({ value }) => {
    const staleServices = value.services.flatMap((service) => {
      const last = service.measurements.reduce((latest, measurement) => (
        !latest || measurement.observedAt > latest.observedAt ? measurement : latest
      ), null);
      const stale = !last || (Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${last.observedAt}T00:00:00.000Z`))
        > service.maxAgeDays * 86400000;
      return stale ? [{ serviceId: service.id, service: service.name, lastObserved: last?.observedAt ?? null, maxAgeDays: service.maxAgeDays }] : [];
    });
    const dueObligations = value.obligations.filter((item) => item.status !== 'satisfied'
      && dueDate(item.nextReviewDate ?? item.dueDate, today));
    const dueDeferrals = value.deferrals.filter((item) => item.reviewDate <= today);
    const openFindings = value.findings.filter((item) => item.status === 'open');
    return {
      id: value.id, revision: value.revision, name: value.name, lifecycle: value.lifecycle,
      criticality: value.criticality, condition: value.condition.state, owner: value.owner,
      dueObligations: dueObligations.map((item) => ({ id: item.id, dueDate: item.dueDate, status: item.status })),
      dueDeferrals: dueDeferrals.map((item) => ({ id: item.id, reviewDate: item.reviewDate, referenceId: item.referenceId })),
      openFindings: openFindings.map((item) => ({ id: item.id, kind: item.kind, urgency: item.urgency, applicability: item.applicability })),
      staleServices,
      coverageVerifiedAt: value.operator.verifiedAt,
      missingCoverage: value.operator.verifiedAt === null,
      supportEnds: value.baseline.supportEnds,
      supportEnding: value.baseline.supportEnds !== null && value.baseline.supportEnds <= today,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const by = (key) => Object.fromEntries([...new Set(assets.map((asset) => asset[key]))].sort()
    .map((item) => [item, assets.filter((asset) => asset[key] === item).length]));
  const programme = city.infrastructure.programme?.value ?? null;
  const policyEnabled = infrastructurePolicyEnabled(city);
  const staleWorkOrders = [...city.workOrders.values()].flatMap(({ value }) => (
    value.infrastructure && !['completed', 'rejected', 'withdrawn'].includes(value.status)
      && !infrastructureScopeIsCurrent(city, value)
      ? [{ id: value.id, status: value.status, reason: 'Pinned asset revision or linked obligation/finding changed.' }]
      : []
  )).sort((a, b) => a.id.localeCompare(b.id));
  return {
    available: true, policyEnabled, assets: assets.length, byLifecycle: by('lifecycle'),
    byCondition: by('condition'), byCriticality: by('criticality'), records: assets,
    dueObligations: assets.flatMap((asset) => asset.dueObligations.map((item) => ({ assetId: asset.id, ...item }))),
    overdueDeferrals: assets.flatMap((asset) => asset.dueDeferrals.map((item) => ({ assetId: asset.id, ...item }))),
    openFindings: assets.flatMap((asset) => asset.openFindings.map((item) => ({ assetId: asset.id, ...item }))),
    staleServices: assets.flatMap((asset) => asset.staleServices.map((item) => ({ assetId: asset.id, ...item }))),
    missingOperatingCoverage: assets.filter((asset) => asset.missingCoverage).map((asset) => asset.id),
    supportDeadlines: assets.filter((asset) => asset.supportEnding).map((asset) => ({ id: asset.id, supportEnds: asset.supportEnds })),
    staleWorkOrders,
    programme: programme ? {
      id: programme.id, revision: programme.revision, horizon: programme.horizon,
      reviewDue: programme.reviewDue, due: programme.reviewDue <= today,
      unfundedNeeds: programme.unfundedNeeds.length,
      staleAssets: programme.assets.filter((pin) => (
        city.infrastructure.assets.get(pin.assetId)?.value.revision !== pin.revision
      )).map((pin) => ({
        assetId: pin.assetId, recordedRevision: pin.revision,
        currentRevision: city.infrastructure.assets.get(pin.assetId)?.value.revision ?? null,
      })),
      proposedActivities: programme.activities.filter((item) => item.authorityStatus === 'proposed').length,
    } : null,
    governanceDrift: city.config.governance === 'adopted' && !city.drift.matchesAdoptedRevision,
    notice: policyEnabled ? 'Infrastructure findings are actionable only under the adopted policy; status never executes maintenance or external checks.' : 'Infrastructure records are diagnostic only until the infrastructure policy is adopted.',
  };
}

export function infrastructurePolicyEnabled(city) {
  return city.config.governance === 'adopted'
    && city.config.adoption.policies.some((policy) => policy.path === INFRASTRUCTURE_POLICY);
}

export function infrastructurePathWithin(locator, target) {
  const fold = (value) => process.platform === 'win32' ? value.normalize('NFC').toLowerCase() : value.normalize('NFC');
  const base = fold(locator);
  const candidate = fold(target);
  if (base === '.') return true;
  return candidate === base || candidate.startsWith(`${base}/`);
}

export async function assertInfrastructureTargets(root, scope, assets) {
  for (const target of scope.targets) {
    const asset = assets.get(target.assetId)?.value;
    const pin = scope.assets.find((item) => item.assetId === target.assetId);
    if (!asset || !pin) {
      fail('INVALID_RECORD', 'Infrastructure target references an unpinned or missing asset.');
    }
    if (!pin.locators.some((locator) => infrastructurePathWithin(locator, target.path))) {
      fail('UNSAFE_PATH', 'Infrastructure delivery target is outside the registered asset locators.');
    }
    let current = root;
    const segments = target.path.split('/');
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const info = await inspect(current);
      if (!info) break;
      if (info.isSymbolicLink()) fail('UNSAFE_PATH', 'Infrastructure targets and their existing parents must not be symlinks.');
      const last = index === segments.length - 1;
      if (!last && !info.isDirectory()) fail('UNSAFE_PATH', 'An existing infrastructure target parent is not a directory.');
    }
  }
}

export function assertInfrastructureScopeCurrent(city, order) {
  if (!infrastructureScopeIsCurrent(city, order)) {
    fail('STALE_INFRASTRUCTURE', 'Infrastructure asset revision, scope, maintenance occurrence or finding changed; reassess and obtain fresh screening/authorization.');
  }
}

function infrastructureScopeIsCurrent(city, order) {
  if (!order.infrastructure) return true;
  for (const pin of order.infrastructure.assets) {
    const asset = city.infrastructure.assets.get(pin.assetId)?.value;
    if (!asset || asset.revision !== pin.revision || asset.lifecycle !== 'active'
      || JSON.stringify(asset.locators) !== JSON.stringify(pin.locators)
      || JSON.stringify(asset.baseline) !== JSON.stringify(pin.baseline)
      || asset.criticality !== pin.criticality) {
      return false;
    }
  }
  for (const reference of order.infrastructure.obligations) {
    const asset = city.infrastructure.assets.get(reference.assetId)?.value;
    const obligation = asset?.obligations.find((item) => item.id === reference.obligationId);
    if (!obligation || obligation.status === 'satisfied'
      || (obligation.dueDate !== reference.dueDate && obligation.nextReviewDate !== reference.dueDate)) {
      return false;
    }
  }
  for (const reference of order.infrastructure.findings) {
    const asset = city.infrastructure.assets.get(reference.assetId)?.value;
    const finding = asset?.findings.find((item) => item.id === reference.findingId);
    if (!finding || finding.status !== 'open' || finding.kind !== reference.kind) {
      return false;
    }
  }
  return true;
}

export function infrastructureSecurityFinding(city, order) {
  return (order.infrastructure?.findings ?? []).some((reference) => reference.kind === 'security');
}
