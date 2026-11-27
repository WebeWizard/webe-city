export const PLUGIN = Object.freeze({ name: 'repository-city', version: '0.10.2' });
// Records written by earlier compatible releases stay valid; new writes always use PLUGIN.version.
export const COMPATIBLE_PLUGIN_VERSIONS = Object.freeze(['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0', '0.5.1', '0.5.2', '0.5.3', '0.5.4', '0.6.0', '0.6.1', '0.7.0', '0.8.0', '0.8.1', '0.8.2', '0.9.0', '0.10.0', '0.10.1', '0.10.2']);
export const SCHEMA_VERSION = 1;
export const WORK_ORDER_SCHEMA_VERSION = 2;
export const INFRASTRUCTURE_WORK_ORDER_SCHEMA_VERSION = 3;
export const INFRASTRUCTURE_SCHEMA_VERSION = 1;
export const RECORDS_REQUEST_SCHEMA_VERSION = 1;
export const WORKFORCE_SCHEMA_VERSION = 1;
// Closed work-order file parts (continuation volumes) carry their own record version.
export const WORK_ORDER_PART_SCHEMA_VERSION = 1;
export const INFRASTRUCTURE_POLICY = 'policies/infrastructure-management.md';
// Delivery decisions (authorization and acceptance) use their own record version; proposal decisions stay at 1.
export const DELIVERY_DECISION_SCHEMA_VERSION = 2;
// City config has its own version so governance can evolve without rewriting work orders or decisions.
export const CONFIG_SCHEMA_VERSION = 2;
export const LEGACY_CONFIG_SCHEMA_VERSION = 1;
export const GOVERNANCE = Object.freeze(['draft', 'adopted']);
export const EVIDENCE_RULE = 'resident-declaration';
export const STATUSES = Object.freeze([
  'received', 'triaged', 'proposed', 'awaiting-approval',
  'authorized', 'in-progress', 'inspection', 'awaiting-merge', 'completed',
  'blocked', 'rejected', 'withdrawn', 'reopened',
]);
export const TRANSITIONS = Object.freeze({
  received: Object.freeze(['triaged', 'blocked', 'rejected', 'withdrawn']),
  triaged: Object.freeze(['proposed', 'blocked', 'rejected', 'withdrawn']),
  proposed: Object.freeze(['awaiting-approval', 'triaged', 'blocked', 'rejected', 'withdrawn']),
  'awaiting-approval': Object.freeze(['proposed', 'authorized', 'blocked', 'rejected', 'withdrawn']),
  authorized: Object.freeze(['in-progress', 'blocked', 'withdrawn', 'proposed']),
  'in-progress': Object.freeze(['inspection', 'blocked', 'withdrawn', 'proposed']),
  inspection: Object.freeze(['in-progress', 'awaiting-merge', 'blocked']),
  'awaiting-merge': Object.freeze(['completed', 'in-progress', 'blocked', 'withdrawn']),
  completed: Object.freeze(['reopened']),
  blocked: Object.freeze(['triaged', 'proposed', 'in-progress', 'rejected', 'withdrawn']),
  rejected: Object.freeze(['reopened']),
  withdrawn: Object.freeze(['reopened']),
  reopened: Object.freeze(['triaged', 'blocked', 'rejected', 'withdrawn']),
});
// These states are entered only by the command that also writes the linked decision record.
export const COMMAND_ONLY_STATES = Object.freeze({ authorized: 'authorize', completed: 'complete' });
// Re-entering any of these states voids an earlier authorization; a new authorize is required.
export const AUTHORIZATION_VOIDING_STATES = Object.freeze(['triaged', 'proposed', 'reopened']);
export const DECIDERS = Object.freeze(['city-council', 'resident']);
export const AUTHORIZATION_OUTCOMES = Object.freeze(['authorize', 'reject', 'return', 'refer']);
export const OUTCOME_STATES = Object.freeze({
  authorize: 'authorized', reject: 'rejected', return: 'proposed', refer: null, accept: 'completed',
});
export const ROUTINE_CLASSES = Object.freeze(['documentation', 'tests', 'in-scope-fix', 'dependency-patch']);
export const RESERVED_MATTERS = Object.freeze([
  'governance', 'security', 'deletion', 'deployment', 'publication', 'expenditure',
]);
export const DELEGATION_POLICY = 'policies/council-delegation.md';
export const WORKFORCE_DELEGATION_POLICY = 'policies/workforce-delegation.md';
export const INSTITUTIONAL_REVIEW_POLICY = 'policies/institutional-review.md';
export const DEVELOPMENT_POLICY = 'policies/development-applications.md';
export const ZONING_POLICY = 'policies/zoning.md';
export const ZONING_CHANGE_TYPES = Object.freeze([
  'documentation', 'tests', 'bugfix', 'refactor', 'feature', 'public-interface',
  'dependency', 'data-migration', 'security', 'deletion', 'generated-code',
]);
export const PERMIT_POLICY = 'policies/building-permits.md';
export const PERMIT_COMMENCEMENT_DAYS = 30;
export const PERMIT_INACTIVITY_DAYS = 30;
export const PERMIT_MAX_EXTENSIONS = 2;
export const DEVELOPMENT_IMPACTS = Object.freeze([
  'new-project', 'substantial-capability', 'architecture', 'ownership-boundary',
  'public-interface', 'data-migration', 'security', 'operations', 'cost', 'cross-project',
]);
export const DEVELOPMENT_ARTIFACTS = Object.freeze(['proposal', 'diagram', 'specification', 'project-facts', 'study']);
export const INSTITUTIONAL_REVIEW_TRIGGERS = Object.freeze([
  'periodic-volume',
  'periodic-time',
  'returned-or-rejected',
  'inspection-failures',
  'referrals',
  'blocked',
]);
export const WORKFORCE_TOOLS = Object.freeze(['read', 'search', 'edit', 'execute']);
export const GENERAL_ENGINEER_ID = 'municipal-software-engineer';
export const LIMITS = Object.freeze({
  fileBytes: 256 * 1024,
  hookBytes: 1024 * 1024,
  records: 1000,
  history: 1000,
  criteria: 50,
  recordBatch: 20,
  recordPage: 100,
});
export const DRAFT_NOTICE = 'Draft governance and intake only. --apply requests local writes, not authenticated approval. Ratification, authorized delivery and completion are unavailable until a resident adopts the charter and policies; council authorization also requires the adopted council delegation policy.';
export const ADOPTED_NOTICE = 'Governance adopted by a recorded resident declaration. Host and platform permissions govern access; the plugin does not authenticate the declaration. --apply requests local writes, not authenticated approval. With the council delegation policy adopted and no drift, authorize and complete record delivery decisions; those decisions are recorded, not authenticated, and the runtime performs no git, merge, push or deployment.';

export function governanceNotice(governance) {
  return governance === 'adopted' ? ADOPTED_NOTICE : DRAFT_NOTICE;
}

export function provenance() {
  return { source: 'local-draft', plugin: { ...PLUGIN } };
}
