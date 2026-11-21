import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENERAL_ENGINEER_ID, LIMITS, WORKFORCE_DELEGATION_POLICY, WORKFORCE_SCHEMA_VERSION, WORKFORCE_TOOLS,
} from './constants.mjs';
import { CityError, fail } from './errors.mjs';
import {
  assertIdentity, atomicRecord, directory, encodeJSON, ensureDirectories, entries, exclusiveFile,
  inspect, readRegular, removeOwnedDirectory, removeOwnedFile, withMutationLock,
} from './filesystem.mjs';
import {
  authorizationCurrent, parseJSON, text, validateAssignment, validateOrderId, validateRequisition, validateStaff,
} from './validation.mjs';
import { loadCity } from './city.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const templateRoot = fileURLToPath(new URL('../../templates/workforce/', import.meta.url));
const staffIdPattern = /^[a-z][a-z0-9-]{1,40}$/u;
const titlePattern = /^[A-Za-z0-9][A-Za-z0-9 &+./-]{0,59}$/u;
const checkProgramPattern = /^[A-Za-z0-9._-]{1,64}$/u;

async function readOptionalRecords(cityPath, directoryName, validator, cityId) {
  const location = path.join(cityPath, 'workforce', directoryName);
  if (!(await inspect(location))) return { records: new Map(), identity: null };
  const identity = await directory(location, `City workforce ${directoryName}`);
  const filenames = await entries(location, `City workforce ${directoryName}`);
  const records = new Map();
  for (const filename of filenames) {
    if (!filename.endsWith('.json')) {
      fail('INVALID_RECORD', `City workforce ${directoryName} contains an unrecognized record file. Inspect and repair it; no files are silently skipped.`);
    }
    const source = await readRegular(path.join(location, filename), `City workforce ${directoryName} record`);
    const value = validator(parseJSON(source.bytes, `City workforce ${directoryName} record`), cityId);
    if (`${value.id}.json` !== filename || records.has(value.id)) {
      fail('INVALID_RECORD', `City workforce ${directoryName} filename must match its unique safe ID.`);
    }
    records.set(value.id, { value, bytes: source.bytes });
  }
  await assertIdentity(location, identity, `City workforce ${directoryName}`);
  if (JSON.stringify(await entries(location, `City workforce ${directoryName}`)) !== JSON.stringify(filenames)) {
    fail('CONFLICT', `City workforce ${directoryName} changed during validation. Inspect concurrent edits and retry.`);
  }
  return { records, identity };
}

async function generatedFileState(root, relative, expectedDigest) {
  const segments = relative.split('/');
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await inspect(current);
    if (!info || info.isSymbolicLink()) return 'missing';
    if (index < segments.length - 1 && !info.isDirectory()) return 'missing';
    if (index === segments.length - 1) {
      if (!info.isFile()) return 'missing';
      if (info.size > LIMITS.fileBytes) return 'changed';
      const source = await readRegular(current, 'Generated workforce file');
      return sha256(source.bytes) === expectedDigest ? 'same' : 'changed';
    }
  }
  return 'missing';
}

async function checkCrossRecords(root, orders, requisitions, staff, assignments) {
  for (const { value: requisition } of requisitions.values()) {
    if (!orders.has(requisition.workOrderId)) {
      fail('INVALID_RECORD', 'City requisition references a missing work order. Restore or repair its local references.');
    }
  }
  for (const { value: record } of staff.values()) {
    const requisition = requisitions.get(record.requisitionId)?.value;
    if (!requisition || requisition.status !== 'filled' || requisition.staffId !== record.id
      || requisition.title !== record.title || JSON.stringify(requisition.tools) !== JSON.stringify(record.tools)
      || JSON.stringify(requisition.checks) !== JSON.stringify(record.checks)) {
      fail('INVALID_RECORD', 'City staff record must match its filled requisition. Restore or repair its local references.');
    }
  }
  for (const { value: requisition } of requisitions.values()) {
    if (requisition.status === 'filled' && !staff.has(requisition.staffId)) {
      fail('INVALID_RECORD', 'Every filled city requisition must have its staff record.');
    }
  }
  for (const { value: assignment } of assignments.values()) {
    if (!orders.has(assignment.workOrderId)) {
      fail('INVALID_RECORD', 'City assignment references a missing work order. Restore or repair its local references.');
    }
    if (assignment.staffId === GENERAL_ENGINEER_ID) continue;
    const staffRecord = staff.get(assignment.staffId)?.value;
    if (!staffRecord || Date.parse(staffRecord.hiredAt) > Date.parse(assignment.createdAt)) {
      fail('INVALID_RECORD', 'City assignment must reference staff hired at or before the assignment.');
    }
    const retiredAt = staffRecord.history.find((entry) => entry.to === 'retired')?.timestamp;
    if (retiredAt && Date.parse(retiredAt) < Date.parse(assignment.createdAt)) {
      fail('INVALID_RECORD', 'City assignment cannot reference staff retired before the assignment.');
    }
  }
}

export async function readWorkforceRecords(root, cityPath, cityId, orders) {
  const workforcePath = path.join(cityPath, 'workforce');
  const workforceInfo = await inspect(workforcePath);
  let workforceIdentity = null;
  let workforceEntries = [];
  if (workforceInfo) {
    workforceIdentity = await directory(workforcePath, 'City workforce');
    workforceEntries = await entries(workforcePath, 'City workforce');
    if (workforceEntries.some((name) => !['requisitions', 'staff', 'assignments'].includes(name))) {
      fail('INVALID_RECORD', 'City workforce contains an unrecognized entry. Inspect and repair it; no files are silently skipped.');
    }
  }
  const requisitions = await readOptionalRecords(cityPath, 'requisitions', validateRequisition, cityId);
  const staff = await readOptionalRecords(cityPath, 'staff', validateStaff, cityId);
  const assignments = await readOptionalRecords(cityPath, 'assignments', validateAssignment, cityId);
  await checkCrossRecords(root, orders, requisitions.records, staff.records, assignments.records);
  if (workforceIdentity) {
    await assertIdentity(workforcePath, workforceIdentity, 'City workforce');
    if (JSON.stringify(await entries(workforcePath, 'City workforce')) !== JSON.stringify(workforceEntries)) {
      fail('CONFLICT', 'City workforce changed during validation. Inspect concurrent edits and retry.');
    }
  }
  const drift = [];
  for (const { value } of staff.records.values()) {
    const changed = [];
    const missing = [];
    for (const file of value.files) {
      const state = await generatedFileState(root, file.path, file.sha256);
      if (state === 'changed') changed.push(file.path);
      if (state === 'missing') missing.push(file.path);
    }
    if (changed.length || missing.length) {
      drift.push({ staffId: value.id, changed: changed.sort(), missing: missing.sort() });
    }
  }
  drift.sort((first, second) => first.staffId.localeCompare(second.staffId));
  return {
    requisitions: requisitions.records,
    staff: staff.records,
    assignments: assignments.records,
    drift,
    directoryIdentities: {
      'workforce/requisitions': requisitions.identity,
      'workforce/staff': staff.identity,
      'workforce/assignments': assignments.identity,
    },
  };
}

export function currentAssignments(city) {
  const latest = new Map();
  for (const { value } of city.workforce.assignments.values()) {
    const previous = latest.get(value.workOrderId);
    if (!previous || value.createdAt > previous.createdAt
      || (value.createdAt === previous.createdAt && value.id.localeCompare(previous.id) > 0)) {
      latest.set(value.workOrderId, value);
    }
  }
  return latest;
}

export function workforceStatus(city) {
  const assignments = currentAssignments(city);
  const staff = [{
    id: GENERAL_ENGINEER_ID,
    agentName: 'City: Municipal Software Engineer',
    status: 'active',
    bundled: true,
  }];
  for (const { value } of city.workforce.staff.values()) {
    const drift = city.workforce.drift.find((entry) => entry.staffId === value.id);
    staff.push({
      id: value.id, title: value.title, agentName: value.agentName, status: value.status,
      files: { changed: drift?.changed ?? [], missing: drift?.missing ?? [] },
    });
  }
  const byStatus = { requested: 0, endorsed: 0, declined: 0, approved: 0, filled: 0 };
  const open = [];
  for (const { value } of city.workforce.requisitions.values()) {
    byStatus[value.status] += 1;
    if (['requested', 'endorsed', 'approved'].includes(value.status)) {
      open.push({
        id: value.id, status: value.status, staffId: value.staffId,
        title: value.title, workOrderId: value.workOrderId, createdAt: value.createdAt,
      });
    }
  }
  const current = [...assignments.values()].map((value) => ({
    workOrderId: value.workOrderId, staffId: value.staffId, assignmentId: value.id,
  })).sort((first, second) => first.workOrderId.localeCompare(second.workOrderId));
  return {
    delegationAvailable: city.config.governance === 'adopted'
      && city.drift.matchesAdoptedRevision
      && city.config.adoption.policies.some((policy) => policy.path === WORKFORCE_DELEGATION_POLICY),
    delegationPolicy: `.city/${WORKFORCE_DELEGATION_POLICY}`,
    staff: staff.sort((first, second) => first.id.localeCompare(second.id)),
    requisitions: { open: open.sort((first, second) => first.createdAt.localeCompare(second.createdAt)), byStatus },
    assignments: current,
    drift: city.workforce.drift,
  };
}

export function assignedStaffFor(city, orderId) {
  return currentAssignments(city).get(orderId)?.staffId ?? null;
}

function workforceAuthorization(city) {
  if (city.config.governance !== 'adopted') {
    fail('NOT_ADOPTED', 'City governance is still draft. Adopt the charter and policies before workforce changes.');
  }
  if (!city.drift?.matchesAdoptedRevision) {
    fail('GOVERNANCE_DRIFT', 'The charter or policies differ from the adopted revision. Amend governance before workforce changes.');
  }
  if (!city.config.adoption.policies.some((policy) => policy.path === WORKFORCE_DELEGATION_POLICY)) {
    fail('NO_DELEGATION', `The adopted policies do not include ${WORKFORCE_DELEGATION_POLICY}; adopt or amend this policy before workforce changes.`);
  }
}

async function governanceDigests(cityPath) {
  const charter = await readRegular(path.join(cityPath, 'charter.md'), 'City charter');
  const policyFile = await readRegular(path.join(cityPath, 'policies', path.basename(WORKFORCE_DELEGATION_POLICY)), 'Workforce delegation policy');
  return { charter: sha256(charter.bytes), policy: sha256(policyFile.bytes) };
}

function checkSnapshot(before, after, relevantOrderId = null, originalOrder = null) {
  if (!before.configBytes.equals(after.configBytes)
    || (relevantOrderId && !after.workOrders.get(relevantOrderId)?.bytes.equals(originalOrder))) {
    fail('CONFLICT', 'City governance or work order changed since workforce validation. Inspect concurrent edits and retry.');
  }
  for (const key of ['requisitions', 'staff', 'assignments']) {
    const oldRecords = before.workforce[key];
    const newRecords = after.workforce[key];
    if (oldRecords.size !== newRecords.size) {
      fail('CONFLICT', `City workforce ${key} changed since validation. Inspect concurrent edits and retry.`);
    }
    for (const [id, record] of oldRecords) {
      if (!newRecords.get(id)?.bytes.equals(record.bytes)) {
        fail('CONFLICT', `City workforce ${key} changed since validation. Inspect concurrent edits and retry.`);
      }
    }
  }
}

function mutationOutput(command, root, apply, city, record, plan, next = null) {
  return {
    command, root, governance: city.config.governance,
    dryRun: !apply, changed: Boolean(apply), wouldWrite: true,
    record, plan, next, notice: `Workforce records are local drafts; --apply is not authenticated approval. The resident retains all reserved authority.`,
  };
}

function parseTools(values) {
  if (!Array.isArray(values) || values.length > WORKFORCE_TOOLS.length
    || values.some((tool) => !WORKFORCE_TOOLS.includes(tool)) || new Set(values).size !== values.length) {
    fail('INVALID_ARGUMENT', `--tool values must be unique members of: ${WORKFORCE_TOOLS.join(', ')}.`);
  }
  const requested = new Set([...values, 'read', 'search']);
  return WORKFORCE_TOOLS.filter((tool) => requested.has(tool));
}

function parseChecks(values) {
  if (!Array.isArray(values) || values.length > 20) fail('INVALID_ARGUMENT', 'At most 20 --check arrays may be supplied.');
  return values.map((serialized) => {
    let check;
    try {
      check = JSON.parse(serialized);
    } catch {
      fail('INVALID_ARGUMENT', '--check must be a JSON array.');
    }
    if (!Array.isArray(check) || check.length < 1 || check.length > 50
      || typeof check[0] !== 'string' || !checkProgramPattern.test(check[0])
      || check.some((arg) => typeof arg !== 'string' || arg.length > 500 || /[\u0000-\u001f\u007f\r\n]/u.test(arg))) {
      fail('INVALID_ARGUMENT', '--check must be an argv array with a safe program name and at most 50 single-line arguments.');
    }
    return check;
  });
}

function validateStaffId(id) {
  if (typeof id !== 'string' || !staffIdPattern.test(id) || id === GENERAL_ENGINEER_ID) {
    fail('INVALID_ARGUMENT', '--staff-id must be a safe non-reserved staff ID.');
  }
}

function validateTitle(title) {
  if (typeof title !== 'string' || !titlePattern.test(title) || title !== title.trim()) {
    fail('INVALID_ARGUMENT', '--title must be a trimmed single-line title using letters, numbers, spaces, and &+./-.');
  }
}

function validateWorkforceTextArray(values, flag, maximum, maxLength, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum
    || values.some((value) => typeof value !== 'string' || value.length === 0 || value !== value.trim()
      || value.length > maxLength || /[\u0000-\u001f\u007f\r\n]/u.test(value))) {
    fail('INVALID_ARGUMENT', `${flag} must be supplied ${minimum ? 'at least once and ' : ''}at most ${maximum} times as single-line text of at most ${maxLength} characters.`);
  }
}

function recordId(record, prefix) {
  if (typeof record !== 'string' || !new RegExp(`^${prefix}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, 'u').test(record)) {
    fail('INVALID_ARGUMENT', `--id must be a ${prefix} record ID.`);
  }
}

function validateWorkOrderForAssignment(city, id) {
  const order = city.workOrders.get(id)?.value;
  if (!order) fail('NOT_FOUND', 'City work order was not found.');
  if (!['authorized', 'in-progress', 'inspection', 'blocked'].includes(order.status)
    || !authorizationCurrent(order.history)) {
    fail('INVALID_TRANSITION', 'Assignment requires an authorized, in-progress, inspection or currently authorized blocked work order.');
  }
  return order;
}

function monotonicTimestamp(previous) {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

function appendHistory(record, to, actor, reason, timestamp) {
  return {
    ...record,
    status: to,
    updatedAt: timestamp,
    history: [...record.history, { from: record.status, to, actor, reason, timestamp }],
  };
}

function activeOrUsedStaffId(city, staffId) {
  if (city.workforce.staff.has(staffId)) {
    fail('ALREADY_STAFFED', 'This staff ID has already been used; retired staff IDs and their files cannot be reused.');
  }
  if ([...city.workforce.requisitions.values()].some(({ value }) => (
    value.staffId === staffId && ['requested', 'endorsed', 'approved'].includes(value.status)
  ))) {
    fail('CONFLICT', 'An open requisition already exists for this staff ID.');
  }
}

function requisitionRecord(city, options) {
  const now = new Date().toISOString();
  return validateRequisition({
    schemaVersion: WORKFORCE_SCHEMA_VERSION,
    id: `REQ-${randomUUID()}`,
    cityId: city.config.cityId,
    workOrderId: options.workOrderId,
    staffId: options.staffId,
    title: options.title,
    reason: options.reason,
    duties: options.duties,
    competencies: options.competencies,
    standards: options.standards,
    tools: options.tools,
    checks: options.checks,
    mcpProposals: options.mcpProposals,
    status: 'requested',
    appointment: null,
    createdAt: now,
    updatedAt: now,
    history: [{
      from: null, to: 'requested', actor: 'engineering-manager',
      reason: options.reason, timestamp: now,
    }],
    provenance: { source: 'local-draft', plugin: { name: 'repository-city', version: '0.3.0' } },
  }, city.config.cityId);
}

export async function requisition(root, options) {
  validateStaffId(options['staff-id']);
  validateTitle(options.title);
  text(options.reason, '--reason', 4000);
  text(options.duties, '--duties', 4000);
  validateOrderId(options['work-order']);
  validateWorkforceTextArray(options.competencies, '--competency', 20, 300, 1);
  validateWorkforceTextArray(options.standards, '--standard', 20, 500);
  validateWorkforceTextArray(options['mcp-proposals'], '--mcp-proposal', 10, 500);
  const city = await loadCity(root);
  workforceAuthorization(city);
  const orderId = options['work-order'];
  const order = city.workOrders.get(orderId)?.value;
  if (!order) fail('NOT_FOUND', 'City work order was not found.');
  if (['completed', 'rejected', 'withdrawn'].includes(order.status)) {
    fail('INVALID_TRANSITION', 'A requisition requires an existing work order that is not completed, rejected or withdrawn.');
  }
  activeOrUsedStaffId(city, options['staff-id']);
  if (city.workforce.requisitions.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported workforce requisition count.');
  const record = requisitionRecord(city, {
    workOrderId: orderId,
    staffId: options['staff-id'],
    title: options.title,
    reason: options.reason,
    duties: options.duties,
    competencies: options.competencies,
    standards: options.standards,
    tools: parseTools(options.tools),
    checks: parseChecks(options.checks),
    mcpProposals: options['mcp-proposals'],
  });
  if (Buffer.byteLength(encodeJSON(record)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed city requisition exceeds the supported local file size.');
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      await ensureDirectories(city.path, 'workforce/requisitions', 'City workforce requisitions');
      const current = await loadCity(root);
      workforceAuthorization(current);
      checkSnapshot(city, current, orderId, city.workOrders.get(orderId).bytes);
      validateWorkOrderForRequisition(current, orderId);
      activeOrUsedStaffId(current, options['staff-id']);
      if (current.workforce.requisitions.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported workforce requisition count.');
      await atomicRecord(current, 'workforce/requisitions', `${record.id}.json`, record);
    });
  }
  return mutationOutput('requisition', root, options.apply, city, record, {
    create: [`.city/workforce/requisitions/${record.id}.json`],
  }, { actor: 'human-resources', action: 'review-requisition' });
}

function validateWorkOrderForRequisition(city, id) {
  const order = city.workOrders.get(id)?.value;
  if (!order) fail('NOT_FOUND', 'City work order was not found.');
  if (['completed', 'rejected', 'withdrawn'].includes(order.status)) {
    fail('INVALID_TRANSITION', 'A requisition requires an existing work order that is not completed, rejected or withdrawn.');
  }
}

async function updateRequisition(root, options, mode) {
  recordId(options.id, 'REQ');
  text(options.reason, '--reason', 4000);
  const city = await loadCity(root);
  workforceAuthorization(city);
  const original = city.workforce.requisitions.get(options.id);
  if (!original) fail('NOT_FOUND', 'City workforce requisition was not found.');
  const sourceStatus = mode === 'review' ? 'requested' : 'endorsed';
  if (original.value.status !== sourceStatus) {
    fail('INVALID_TRANSITION', `Only a ${sourceStatus} requisition can receive this decision.`);
  }
  const validOutcome = mode === 'review' ? ['endorse', 'decline'] : ['approve', 'decline'];
  if (!validOutcome.includes(options.outcome)) {
    fail('INVALID_ARGUMENT', `--outcome must be ${validOutcome.join(' or ')}.`);
  }
  const nextStatus = mode === 'review'
    ? (options.outcome === 'endorse' ? 'endorsed' : 'declined')
    : (options.outcome === 'approve' ? 'approved' : 'declined');
  const actor = mode === 'review' ? 'human-resources' : 'engineering-manager';
  const timestamp = monotonicTimestamp(original.value.updatedAt);
  let record = appendHistory(original.value, nextStatus, actor, options.reason, timestamp);
  if (mode === 'appoint' && options.outcome === 'approve') {
    const digests = await governanceDigests(city.path);
    record = {
      ...record,
      appointment: {
        decidedBy: 'engineering-manager',
        basis: 'workforce-delegation',
        subject: {
          requisitionSha256: sha256(original.bytes),
          charterSha256: digests.charter,
          delegationPolicySha256: digests.policy,
        },
        authenticated: false,
        decidedAt: timestamp,
      },
    };
  }
  record = validateRequisition(record, city.config.cityId);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      await ensureDirectories(city.path, 'workforce/requisitions', 'City workforce requisitions');
      const current = await loadCity(root);
      workforceAuthorization(current);
      checkSnapshot(city, current);
      const currentOriginal = current.workforce.requisitions.get(options.id);
      if (!currentOriginal?.bytes.equals(original.bytes)) {
        fail('CONFLICT', 'City requisition changed since validation. Inspect concurrent edits and retry.');
      }
      if (currentOriginal.value.status !== sourceStatus) {
        fail('INVALID_TRANSITION', `Only a ${sourceStatus} requisition can receive this decision.`);
      }
      await atomicRecord(current, 'workforce/requisitions', `${record.id}.json`, record, original.bytes);
    });
  }
  const next = nextStatus === 'endorsed'
    ? { actor: 'engineering-manager', action: 'appoint' }
    : nextStatus === 'approved' ? { actor: 'human-resources', action: 'hire' } : null;
  return mutationOutput(mode === 'review' ? 'review-requisition' : 'appoint', root, options.apply, city, record, {
    replace: [`.city/workforce/requisitions/${record.id}.json`],
  }, next);
}

export async function reviewRequisition(root, options) {
  return updateRequisition(root, options, 'review');
}

export async function appoint(root, options) {
  return updateRequisition(root, options, 'appoint');
}

async function safeFileTarget(root, relative, allowExisting = false) {
  const segments = relative.split('/');
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await inspect(current);
    if (!info) return false;
    if (info.isSymbolicLink()) fail('UNSAFE_PATH', 'Generated workforce paths cannot pass through symlinks.');
    if (index < segments.length - 1 && !info.isDirectory()) {
      fail('UNSAFE_PATH', 'Generated workforce path components must be directories.');
    }
    if (index === segments.length - 1 && !allowExisting) {
      fail('CONFLICT', 'A generated workforce destination already exists; no file was overwritten.');
    }
  }
  return true;
}

function mdBullets(values) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : 'None specified.';
}

async function readTemplate(name) {
  return (await readRegular(path.join(templateRoot, name), `Workforce ${name} template`)).bytes.toString('utf8');
}

function replaceTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/gu, (placeholder, key) => {
    if (!Object.hasOwn(values, key)) fail('INVALID_TEMPLATE', 'A workforce template contains an unknown placeholder.');
    return values[key];
  });
}

async function hireContents(root, city, requisitionEntry) {
  const requisition = requisitionEntry.value;
  const skillName = `city-engineering-${requisition.staffId}`;
  const checkLines = requisition.checks.length
    ? requisition.checks.map((check) => `- \`${JSON.stringify(check)}\``).join('\n')
    : 'No checks proposed.';
  const values = {
    NAME_YAML: JSON.stringify(`City Engineer: ${requisition.title}`),
    DESCRIPTION_YAML: JSON.stringify(`${requisition.title} specialist engineer for city work orders within fixed governance limits.`),
    TOOLS_YAML: JSON.stringify(requisition.tools),
    TITLE: requisition.title,
    STAFF_ID: requisition.staffId,
    SKILL_NAME: skillName,
    DUTIES: requisition.duties,
    COMPETENCIES: mdBullets(requisition.competencies),
    MCP_PROPOSALS: mdBullets(requisition.mcpProposals),
    REQUISITION_ID: requisition.id,
    STANDARDS: mdBullets(requisition.standards),
    CHECKS: checkLines,
    PRE_AUTHORIZATION: requisition.tools.every((tool) => ['read', 'search'].includes(tool))
      ? `### Limited pre-authorization evidence preparation

With only \`read\` and \`search\`, you may prepare an outstanding class-3 safety
statement before delivery authorization, without a delivery assignment, only
when current adopted, drift-free policy explicitly permits this preparation.
The bundled workforce policy alone does not grant this exception. Confirm your
active, drift-free staff record links to filled requisition \`${requisition.id}\`,
its independent HR endorsement and manager-approved appointment, and work order
\`${requisition.workOrderId}\`. Confirm the requisition records competency
\`permit-safety-class-3\`, the current screening specifies safety class 3, and
the matching statement for that screening revision is still outstanding.
Confirm there is no current delivery authorization and the work order remains
in a development-preparation state: received, triaged, proposed, awaiting-approval,
blocked, or reopened. Completed, rejected, and withdrawn orders are ineligible.
The manager must request this bounded preparation within the adopted policy;
appointment or specialty text alone is not permission. If any prerequisite is
missing or uncertain, pause and refer it to the Engineering Manager.

Read and search only the scoped evidence needed for that statement. Return the
statement's dimension, class, staffId, screeningRevision, scope and evidence,
with a complete author-attributed filing request to the Engineering Manager.
The manager records \`permit-statement\` and routes durable filing to the Records
Officer. Do not edit files, execute commands (including the check toolkit),
record the statement yourself, change lifecycle state, start delivery, or
authorize anything. This exception does not cover class 4, structural statements,
independent verification, or reserved matters. Once the statement is prepared,
stop; delivery still requires current authorization and assignment.`
      : 'Pre-authorization evidence preparation is unavailable with this tool set; current delivery authorization and assignment are required.',
    ARTIFACT_CAPTURE: requisition.tools.includes('execute')
      ? 'Write a local city record only if the active assignment explicitly authorizes changes to `.city/artifacts/` outside the registered project directories; the normal delivery scope does not. Otherwise prepare the complete author-attributed filing request and route it through the Engineering Manager to the Records Officer. Never claim a save without the actual apply result; return the saved ART ID/path or mark persistence pending.'
      : 'You do not have `execute`. For every substantive document, prepare a complete author-attributed filing request and route it through the Engineering Manager to the Records Officer. Never claim a save; return the actual ART ID/path when reported or mark persistence pending.',
  };
  const paths = {
    agent: `.github/agents/city-engineer-${requisition.staffId}.agent.md`,
    skill: `.github/skills/${skillName}/SKILL.md`,
    practice: `.github/skills/${skillName}/references/practice.md`,
    runner: `.github/skills/${skillName}/scripts/run-checks.mjs`,
    checks: `.github/skills/${skillName}/scripts/checks.json`,
  };
  const rendered = [
    [paths.agent, replaceTemplate(await readTemplate('agent.md'), values)],
    [paths.skill, replaceTemplate(await readTemplate('skill.md'), values)],
    [paths.practice, replaceTemplate(await readTemplate('practice.md'), values)],
    [paths.runner, await readTemplate('run-checks.mjs')],
    [paths.checks, encodeJSON({ schemaVersion: 1, checks: requisition.checks })],
  ];
  const files = rendered.map(([relative, content]) => ({
    path: relative, content, sha256: sha256(Buffer.from(content)),
  })).sort((first, second) => (first.path < second.path ? -1 : first.path > second.path ? 1 : 0));
  const hiredAt = monotonicTimestamp(requisition.updatedAt);
  const staff = validateStaff({
    schemaVersion: WORKFORCE_SCHEMA_VERSION,
    id: requisition.staffId,
    cityId: city.config.cityId,
    title: requisition.title,
    agentName: `City Engineer: ${requisition.title}`,
    skillName,
    requisitionId: requisition.id,
    status: 'active',
    tools: requisition.tools,
    checks: requisition.checks,
    mcpProposals: requisition.mcpProposals,
    files: files.map(({ path: filePath, sha256: digest }) => ({ path: filePath, sha256: digest })),
    hiredAt,
    updatedAt: hiredAt,
    history: [{
      from: null, to: 'active', actor: 'human-resources',
      reason: `Hired from approved requisition ${requisition.id}.`,
      timestamp: hiredAt,
    }],
    provenance: { source: 'local-draft', plugin: { name: 'repository-city', version: '0.3.0' } },
  }, city.config.cityId);
  const updatedRequisition = validateRequisition(appendHistory(
    requisition, 'filled', 'human-resources', `Hired as staff ${staff.id}.`, hiredAt,
  ), city.config.cityId);
  return {
    files: [...files, {
      path: `.city/workforce/staff/${staff.id}.json`, content: encodeJSON(staff), sha256: null,
    }],
    staff, requisition: updatedRequisition, skillName,
  };
}

async function removeCreated(created) {
  const errors = [];
  for (const { path: location, identity } of created.reverse()) {
    try {
      await removeOwnedFile(location, identity);
    } catch {
      errors.push(location);
    }
  }
  return errors;
}

export async function hire(root, options) {
  recordId(options.id, 'REQ');
  const city = await loadCity(root);
  workforceAuthorization(city);
  const original = city.workforce.requisitions.get(options.id);
  if (!original) fail('NOT_FOUND', 'City workforce requisition was not found.');
  if (original.value.status !== 'approved') fail('INVALID_TRANSITION', 'Only an approved requisition can be hired.');
  const prepared = await hireContents(root, city, original);
  const recordPath = `.city/workforce/staff/${prepared.staff.id}.json`;
  const reqPath = `.city/workforce/requisitions/${original.value.id}.json`;
  const contentFiles = prepared.files.map(({ path: relative, content }) => ({ path: relative, content }));
  const generatedFiles = contentFiles.filter((file) => file.path.startsWith('.github/'));
  for (const file of contentFiles) await safeFileTarget(root, file.path);
  if (city.workforce.staff.has(prepared.staff.id)) fail('ALREADY_STAFFED', 'This staff ID has already been used; staff records cannot be overwritten.');
  const plan = { create: contentFiles.map((file) => file.path), replace: [reqPath] };
  if (!options.apply) {
    return {
      ...mutationOutput('hire', root, false, city, prepared.staff, plan, {
        actor: 'engineering-manager', action: 'assign',
      }),
      files: contentFiles,
      requisition: prepared.requisition,
    };
  }
  await withMutationLock(city.path, city.identity, async () => {
    await ensureDirectories(city.path, 'workforce/requisitions', 'City workforce requisitions');
    await ensureDirectories(city.path, 'workforce/staff', 'City workforce staff');
    const current = await loadCity(root);
    workforceAuthorization(current);
    checkSnapshot(city, current);
    const currentOriginal = current.workforce.requisitions.get(options.id);
    if (!currentOriginal?.bytes.equals(original.bytes)) {
      fail('CONFLICT', 'City requisition changed since validation. Inspect concurrent edits and retry.');
    }
    if (currentOriginal.value.status !== 'approved') fail('INVALID_TRANSITION', 'Only an approved requisition can be hired.');
    if (current.workforce.staff.has(prepared.staff.id)) fail('ALREADY_STAFFED', 'This staff ID has already been used; staff records cannot be overwritten.');
    const createdDirectories = [];
    const createdFiles = [];
    let writingRecords = false;
    let requisitionWritten = false;
    try {
      const directories = [
        '.github/agents',
        `.github/skills/${prepared.skillName}/references`,
        `.github/skills/${prepared.skillName}/scripts`,
      ];
      for (const relative of directories) {
        createdDirectories.push(...await ensureDirectories(root, relative, 'Generated workforce directory'));
      }
      for (const file of generatedFiles) {
        await safeFileTarget(root, file.path);
        const identity = await exclusiveFile(path.join(root, file.path), file.content);
        createdFiles.push({ path: path.join(root, file.path), identity });
      }
      writingRecords = true;
      const staffPath = path.join(city.path, 'workforce/staff', `${prepared.staff.id}.json`);
      const staffIdentity = await exclusiveFile(staffPath, encodeJSON(prepared.staff));
      createdFiles.push({ path: staffPath, identity: staffIdentity });
      await atomicRecord(
        current, 'workforce/requisitions', `${prepared.requisition.id}.json`,
        prepared.requisition, original.bytes,
      );
      requisitionWritten = true;
    } catch (error) {
      if (!requisitionWritten) {
        const cleanupFailures = await removeCreated(createdFiles);
        for (const directoryEntry of createdDirectories.reverse()) {
          try {
            await removeOwnedDirectory(directoryEntry.path, directoryEntry.identity);
          } catch {
            cleanupFailures.push(directoryEntry.path);
          }
        }
        if (writingRecords) {
          const names = [...new Set([
            ...contentFiles.map((file) => file.path), recordPath, reqPath, ...cleanupFailures,
          ])].join(', ');
          fail('PARTIAL_WRITE', `Workforce hire could not update city records after creating generated files (${error instanceof CityError ? `${error.code}: ${error.message}` : 'FILESYSTEM_ERROR'}). The operation attempted identity-checked cleanup; inspect these paths: ${names}.`);
        }
        throw error;
      }
      throw error;
    }
  });
  const refreshed = await loadCity(root);
  return {
    ...mutationOutput('hire', root, true, refreshed, prepared.staff, plan, {
      actor: 'engineering-manager', action: 'assign',
    }),
    files: contentFiles.map(({ path: filePath }) => ({ path: filePath })),
    requisition: prepared.requisition,
  };
}

function validateOrderIdForWorkforce(id) {
  if (typeof id !== 'string' || !/^WO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    fail('INVALID_ARGUMENT', '--work-order must be a work-order ID.');
  }
}

export async function assign(root, options) {
  const orderId = options['work-order'];
  validateOrderIdForWorkforce(orderId);
  const staffId = options.staff;
  if (staffId !== GENERAL_ENGINEER_ID) validateStaffId(staffId);
  text(options.reason, '--reason', 4000);
  const city = await loadCity(root);
  workforceAuthorization(city);
  const order = validateWorkOrderForAssignment(city, orderId);
  const staff = staffId === GENERAL_ENGINEER_ID ? null : city.workforce.staff.get(staffId)?.value;
  if (staffId !== GENERAL_ENGINEER_ID && !staff) fail('NOT_FOUND', 'City staff record was not found.');
  if (staff?.status && staff.status !== 'active') fail('STAFF_INACTIVE', 'Retired staff cannot receive work assignments.');
  if (city.workforce.assignments.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported workforce assignment count.');
  const priorAssignment = currentAssignments(city).get(orderId);
  const record = validateAssignment({
    schemaVersion: WORKFORCE_SCHEMA_VERSION,
    id: `ASN-${randomUUID()}`,
    cityId: city.config.cityId,
    workOrderId: order.id,
    staffId,
    assignedBy: 'engineering-manager',
    reason: options.reason,
    createdAt: priorAssignment ? monotonicTimestamp(priorAssignment.createdAt) : new Date().toISOString(),
    provenance: { source: 'local-draft', plugin: { name: 'repository-city', version: '0.3.0' } },
  }, city.config.cityId);
  if (Buffer.byteLength(encodeJSON(record)) > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed city assignment exceeds the supported local file size.');
  const nextActor = staff?.agentName ?? 'City: Municipal Software Engineer';
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      await ensureDirectories(city.path, 'workforce/assignments', 'City workforce assignments');
      const current = await loadCity(root);
      workforceAuthorization(current);
      checkSnapshot(city, current, orderId, city.workOrders.get(orderId).bytes);
      validateWorkOrderForAssignment(current, orderId);
      if (staffId !== GENERAL_ENGINEER_ID) {
        const currentStaff = current.workforce.staff.get(staffId)?.value;
        if (!currentStaff) fail('NOT_FOUND', 'City staff record was not found.');
        if (currentStaff.status !== 'active') fail('STAFF_INACTIVE', 'Retired staff cannot receive work assignments.');
      }
      if (current.workforce.assignments.size >= LIMITS.records) fail('SIZE_LIMIT', 'City has reached the supported workforce assignment count.');
      await atomicRecord(current, 'workforce/assignments', `${record.id}.json`, record);
    });
  }
  return mutationOutput('assign', root, options.apply, city, record, {
    create: [`.city/workforce/assignments/${record.id}.json`],
  }, { actor: nextActor, action: 'start-delivery' });
}

export async function retire(root, options) {
  if (options.staff === GENERAL_ENGINEER_ID) {
    fail('INVALID_TRANSITION', 'The bundled municipal-software-engineer is reserved and cannot be retired.');
  }
  validateStaffId(options.staff);
  text(options.reason, '--reason', 2000);
  text(options.handover, '--handover', 2000);
  const combinedReason = `Reason: ${options.reason}. Handover: ${options.handover}`;
  if (combinedReason.length > 4000) fail('INVALID_ARGUMENT', 'The combined retirement reason and handover must be at most 4000 characters.');
  const city = await loadCity(root);
  workforceAuthorization(city);
  const original = city.workforce.staff.get(options.staff);
  if (!original) fail('NOT_FOUND', 'City staff record was not found.');
  if (original.value.status !== 'active') fail('STAFF_INACTIVE', 'Only active staff can be retired.');
  const timestamp = monotonicTimestamp(original.value.updatedAt);
  const record = validateStaff(appendHistory(
    original.value, 'retired', 'human-resources', combinedReason, timestamp,
  ), city.config.cityId);
  if (options.apply) {
    await withMutationLock(city.path, city.identity, async () => {
      await ensureDirectories(city.path, 'workforce/staff', 'City workforce staff');
      const current = await loadCity(root);
      workforceAuthorization(current);
      checkSnapshot(city, current);
      const currentRecord = current.workforce.staff.get(options.staff);
      if (!currentRecord?.bytes.equals(original.bytes)) {
        fail('CONFLICT', 'City staff record changed since validation. Inspect concurrent edits and retry.');
      }
      if (currentRecord.value.status !== 'active') fail('STAFF_INACTIVE', 'Only active staff can be retired.');
      await atomicRecord(current, 'workforce/staff', `${record.id}.json`, record, original.bytes);
    });
  }
  return mutationOutput('retire', root, options.apply, city, record, {
    replace: [`.city/workforce/staff/${record.id}.json`],
    preserve: record.files.map((file) => file.path),
  });
}
