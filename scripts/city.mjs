#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import {
  COMMAND_ONLY_STATES, DELEGATION_POLICY, DRAFT_NOTICE, PLUGIN, RESERVED_MATTERS, ROUTINE_CLASSES, STATUSES,
  TRANSITIONS,
} from './lib/constants.mjs';
import {
  adopt, amend, authorize, complete, init, migrate, petition, projectAdd, recordsCancel, recordsGet,
  recordsList, recordsRequest, recordsResolve, reviewRecord, status, transition, validate,
} from './lib/city.mjs';
import { errorOutput, fail } from './lib/errors.mjs';
import { rootDirectory } from './lib/filesystem.mjs';
import { appoint, assign, hire, requisition, retire, reviewRequisition } from './lib/workforce.mjs';

const commands = {
  init: { allowed: ['root', 'name', 'apply'], required: ['root'] },
  status: { allowed: ['root'], required: ['root'] },
  validate: { allowed: ['root'], required: ['root'] },
  petition: { allowed: ['root', 'title', 'request', 'project', 'criterion', 'apply'], required: ['root', 'title', 'request'] },
  'project-add': {
    allowed: ['root', 'id', 'name', 'path', 'description', 'apply'],
    required: ['root', 'id', 'name', 'path', 'description'],
  },
  'records-list': {
    allowed: ['root', 'type', 'id', 'work-order', 'project', 'status', 'limit', 'offset'],
    required: ['root'],
  },
  'records-get': { allowed: ['root', 'id', 'linked'], required: ['root', 'id'] },
  'records-request': {
    allowed: ['root', 'requested-by', 'source-office', 'purpose', 'related-work-order', 'item', 'apply'],
    required: ['root', 'requested-by', 'purpose', 'item'],
  },
  'records-resolve': {
    allowed: ['root', 'id', 'resolved-by', 'response', 'reason', 'apply'],
    required: ['root', 'id', 'resolved-by', 'response', 'reason'],
  },
  'records-cancel': {
    allowed: ['root', 'id', 'cancelled-by', 'reason', 'apply'],
    required: ['root', 'id', 'cancelled-by', 'reason'],
  },
  'review-record': {
    allowed: ['root', 'conducted-by', 'summary', 'recommendation', 'apply'],
    required: ['root', 'conducted-by', 'summary'],
  },
  transition: { allowed: ['root', 'id', 'to', 'reason', 'apply'], required: ['root', 'id', 'to', 'reason'] },
  migrate: { allowed: ['root', 'apply'], required: ['root'] },
  adopt: {
    allowed: ['root', 'adopted-on', 'declared-by', 'evidence', 'charter-version', 'apply'],
    required: ['root', 'adopted-on', 'declared-by', 'evidence'],
  },
  amend: {
    allowed: ['root', 'adopted-on', 'declared-by', 'evidence', 'summary', 'charter-version', 'apply'],
    required: ['root', 'adopted-on', 'declared-by', 'evidence', 'summary'],
  },
  authorize: {
    allowed: ['root', 'id', 'decided-by', 'outcome', 'reserved', 'reason', 'routine-class', 'declared-by', 'evidence', 'apply'],
    required: ['root', 'id', 'decided-by', 'outcome', 'reserved', 'reason'],
  },
  complete: {
    allowed: ['root', 'id', 'declared-by', 'evidence', 'reason', 'apply'],
    required: ['root', 'id', 'declared-by', 'evidence', 'reason'],
  },
  requisition: {
    allowed: [
      'root', 'work-order', 'staff-id', 'title', 'reason', 'duties', 'competency', 'standard',
      'tool', 'check', 'mcp-proposal', 'apply',
    ],
    required: ['root', 'work-order', 'staff-id', 'title', 'reason', 'duties'],
  },
  'review-requisition': {
    allowed: ['root', 'id', 'outcome', 'reason', 'apply'],
    required: ['root', 'id', 'outcome', 'reason'],
  },
  appoint: {
    allowed: ['root', 'id', 'outcome', 'reason', 'apply'],
    required: ['root', 'id', 'outcome', 'reason'],
  },
  hire: { allowed: ['root', 'id', 'apply'], required: ['root', 'id'] },
  assign: {
    allowed: ['root', 'work-order', 'staff', 'reason', 'apply'],
    required: ['root', 'work-order', 'staff', 'reason'],
  },
  retire: {
    allowed: ['root', 'staff', 'reason', 'handover', 'apply'],
    required: ['root', 'staff', 'reason', 'handover'],
  },
};

function help() {
  return {
    plugin: PLUGIN,
    mode: 'governance-intake-and-recorded-delivery-decisions',
    usage: [
      'node <installed-plugin>/scripts/city.mjs --help',
      'node <installed-plugin>/scripts/city.mjs init --root ABS [--name NAME] [--apply]',
      'node <installed-plugin>/scripts/city.mjs status --root ABS',
      'node <installed-plugin>/scripts/city.mjs validate --root ABS',
      'node <installed-plugin>/scripts/city.mjs project-add --root ABS --id ID --name NAME --path RELATIVE_DIR --description TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs petition --root ABS --title TEXT --request TEXT --project ID [--project ID repeated] [--criterion TEXT repeated] [--apply]',
      'node <installed-plugin>/scripts/city.mjs transition --root ABS --id ID --to STATE --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs records-list --root ABS [--type TYPE] [--id ID] [--work-order ID] [--project ID] [--status STATE] [--limit N] [--offset N]',
      'node <installed-plugin>/scripts/city.mjs records-get --root ABS --id ID [--id ID repeated] [--linked]',
      'node <installed-plugin>/scripts/city.mjs records-request --root ABS --requested-by TEXT [--source-office OFFICE] --purpose TEXT --item JSON [--item JSON repeated] [--related-work-order ID] [--apply]',
      'node <installed-plugin>/scripts/city.mjs records-resolve --root ABS --id RR-ID --resolved-by OFFICE --response JSON [--response JSON repeated] --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs records-cancel --root ABS --id RR-ID --cancelled-by OFFICE --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs review-record --root ABS --conducted-by OFFICE --summary TEXT [--recommendation JSON repeated] [--apply]',
      'node <installed-plugin>/scripts/city.mjs migrate --root ABS [--apply]',
      'node <installed-plugin>/scripts/city.mjs adopt --root ABS --adopted-on YYYY-MM-DD --declared-by TEXT --evidence TEXT [--charter-version TEXT] [--apply]',
      'node <installed-plugin>/scripts/city.mjs amend --root ABS --adopted-on YYYY-MM-DD --declared-by TEXT --evidence TEXT --summary TEXT [--charter-version TEXT] [--apply]',
      'node <installed-plugin>/scripts/city.mjs authorize --root ABS --id ID --decided-by city-council|resident --outcome authorize|reject|return|refer --reserved none|LIST --reason TEXT [--routine-class CLASS] [--declared-by TEXT --evidence TEXT] [--apply]',
      'node <installed-plugin>/scripts/city.mjs complete --root ABS --id ID --declared-by TEXT --evidence TEXT --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs requisition --root ABS --work-order WO-ID --staff-id ID --title TITLE --reason TEXT --duties TEXT [--competency TEXT repeated] [--standard TEXT repeated] [--tool TOOL repeated] [--check JSON_ARRAY repeated] [--mcp-proposal TEXT repeated] [--apply]',
      'node <installed-plugin>/scripts/city.mjs review-requisition --root ABS --id REQ-ID --outcome endorse|decline --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs appoint --root ABS --id REQ-ID --outcome approve|decline --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs hire --root ABS --id REQ-ID [--apply]',
      'node <installed-plugin>/scripts/city.mjs assign --root ABS --work-order WO-ID --staff ID --reason TEXT [--apply]',
      'node <installed-plugin>/scripts/city.mjs retire --root ABS --staff ID --reason TEXT --handover TEXT [--apply]',
    ],
    states: STATUSES,
    transitions: TRANSITIONS,
    commandOnlyStates: COMMAND_ONLY_STATES,
    routineClasses: ROUTINE_CLASSES,
    reservedMatters: RESERVED_MATTERS,
    delegationPolicy: `.city/${DELEGATION_POLICY}`,
    notice: DRAFT_NOTICE,
    notes: [
      'All mutators default to JSON dry-runs with no writes. Installing this plugin never enrolls a repository.',
      'Register each project directory with project-add before intake. Project paths are repository-relative, normalized, disjoint directories outside .city and .git; registration does not create or move project files.',
      'New work orders require one or more registered --project IDs. Legacy work orders without projectIds remain valid and appear as unassigned; project associations are not inferred.',
      'Only --apply requests local writes. It is not authenticated approval, ratification or verified human authorization.',
      'Governance is draft until adopt records a resident declaration under the charter rule that repository access is the source of authority. The record stores the adoption date, charter SHA-256 and optional version label, policy digests, and authenticated: false.',
      'Adopted governance is recorded, not independently verified. Draft governance blocks authorize and complete (NOT_ADOPTED); charter or policy drift blocks them too (GOVERNANCE_DRIFT) until amend records the revision.',
      'Lifecycle: received, triaged, proposed, awaiting-approval, authorized, in-progress, inspection, awaiting-merge, completed. authorized is entered only through authorize and completed only through complete; transition to either fails with AUTHORIZATION_REQUIRED.',
      `authorize records a schemaVersion 2 authorization decision for a work order awaiting approval: authorize -> authorized, reject -> rejected, return -> proposed, refer -> no state change and the order is listed by status as awaiting a resident decision. --reserved is mandatory (none or a comma list of ${RESERVED_MATTERS.join(', ')}).`,
      'authorize output includes next, a routing hint: authorize -> engineering-manager assign-engineer, return -> chief-planner revise-proposal, refer -> resident decide-referral, reject -> none. status lists authorized orders under workOrders.readyForDelivery. Coordinators start delivery only after assignment; the hint grants no authority.',
      `--decided-by city-council requires the adopted policies to include ${DELEGATION_POLICY} (NO_DELEGATION), forbids --declared-by/--evidence, and cannot authorize any reserved matter (RESERVED_MATTER: refer it to the resident). --routine-class (${ROUTINE_CLASSES.join(', ')}) is only for a council authorize with --reserved none and records basis routine-policy.`,
      '--decided-by resident requires --declared-by and --evidence (RESIDENT_EVIDENCE_REQUIRED) and may decide reserved matters. complete records the resident acceptance of a work order awaiting merge and moves it to completed.',
      'Council and resident decisions are recorded, not authenticated: every decision stores evidence.authenticated: false. Anyone with write access to the repository can run these commands, matching the charter rule that repository access is the source of authority.',
      'Each decision stores SHA-256 digests of the work order as it was before the decision, the charter, and the council delegation policy (null when absent for a resident decision). loadCity requires every history entry into authorized or completed to match exactly one decision with the same timestamp and outcome, and every delivery decision to match its work-order history; forged or orphaned records are INVALID_RECORD.',
      'Delivery may resume from blocked only while authorization is current. Returning to triaged, proposed or reopened voids authorization; a new authorize is required. completed can only be reopened.',
      'Separation of duties (the City Council never edits code; the City Engineer never authorizes; the resident merges and accepts) is enforced by agent definitions and instructions, not by this runtime. The runtime never runs git, merges, pushes, deploys or contacts a network.',
      'authorize and complete write the decision first and then the work order under one mutation lock with conflict checks. If the second write fails, PARTIAL_WRITE names both paths so the decision can be removed or both records restored from backup before validate.',
      'records-list and records-get read only canonical .city records; list returns bounded metadata, get accepts exact IDs and may include first-degree links. Neither searches arbitrary repository paths or external stores.',
      'records-request, records-resolve, and records-cancel use dry-runs by default and write append-only request history under .city/records-requests with --apply. --source-office is optional routing context only. Resolution accounts for every item and found references must match the requested record, canonical path and current SHA-256.',
      'Workforce mutators require adopted, drift-free governance with policies/workforce-delegation.md among the adopted policies (NO_DELEGATION). They preview by default; appointments are unauthenticated records and generated files are never overwritten.',
      'Workforce lifecycle: requisition -> human-resources review-requisition -> engineering-manager appoint -> human-resources hire -> engineering-manager assign. Retire preserves generated files; status and validate report file drift without enforcing it.',
      'Institutional reviews are enabled only by current adopted governance that includes policies/institutional-review.md. status computes due triggers from local records; the City Manager routes a due review automatically. review-record is dry-run by default, refuses unless a review is due, and records recommendations without adopting or implementing them.',
      'Institutional-review thresholds are read from the adopted policy. Residents may petition to amend the policy; invalid or missing threshold tables make review availability explicitly false.',
      'Records request office labels and local hashes are self-reported evidence, not authentication or access control. A withheld response does not disclose restricted material; unavailable and not-found are explicit outcomes.',
      'migrate upgrades a schemaVersion 1 config to schemaVersion 2 in place, keeping cityId, name, createdAt and draft governance. Work orders, decisions, districts, charter and policies are not rewritten.',
      'status and validate report adoption drift when the charter or policies no longer match the adopted digests; drift is reported, not enforced.',
      'Proposed requires acceptance criteria. Rejected and withdrawn cases must be reopened before routing again.',
      'adopt refuses once governance is adopted; amend is the only way to record a later charter or policy revision, appending the superseded revision (with --summary) to adoption.history and never returning governance to draft.',
      'Configuration and record provenance are self-reported local metadata, not trusted identity or human consent. Records written by plugin 0.1.0 and 0.2.0 remain valid; new records use 0.3.0.',
      'schemaVersion 1 decisions remain proposal-only records. authorize and complete are the only decision-writing commands; adopt records charter adoption in config, not decisions.',
      'The city CLI does not itself execute work-order text. The generated check toolkit launches its recorded argv arrays with shell: false; it is not a sandbox, and a configured command may execute code, access the network, install packages or modify files. Review each command before running it. MCP servers are never installed by workforce commands.',
      'Hooks inspect physical cwd ancestors up to the nearest .git boundary and return no allow override.',
      'Hook timeout handling is host fail-open; this prototype is not a universal sandbox or tool authorization gate.',
      'Local exclusive locks and checked atomic writes detect cooperative conflicts; they do not defend against a malicious concurrent filesystem owner.',
      'After an interrupted write, inspect backups and local state, repair or restore the affected records, and run validate. Remove a stale .city/.mutation-lock only after confirming no writer is active.',
      'A crash during initialization may leave an empty reserved .city or a named .city-stage-* directory. Inspect it and recover explicitly; initialization never silently replaces partial state.',
      'Schemas describe current shapes; validation also checks lifecycle history, city references and provenance. Config migration is explicit via migrate; nothing migrates automatically.',
      'Bounds: 256 KiB per JSON/template file, 1000 records per record directory, 1000 history entries, 50 criteria and 1 MiB hook stdin. Exceeding a bound is an explicit error.',
    ],
  };
}

function parse(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === 'help')) return { command: 'help' };
  const [command, ...flags] = args;
  if (!Object.hasOwn(commands, command)) fail('INVALID_ARGUMENT', 'Unknown or missing city command. Use --help for the JSON command contract.');
  const specification = commands[command];
  const options = {
    apply: false, linked: false, criteria: [], projects: [], ids: [], items: [], responses: [],
    competencies: [], standards: [], tools: [], checks: [], 'mcp-proposals': [], recommendations: [],
  };
  const repeated = new Set([
    'criterion', 'project', 'id', 'item', 'response', 'competency', 'standard',
    'tool', 'check', 'mcp-proposal', 'recommendation',
  ]);
  const seen = new Set();
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (!flag.startsWith('--') || !specification.allowed.includes(flag.slice(2))) {
      fail('INVALID_ARGUMENT', 'Unknown flag or positional argument. Use --help for the supported command contract.');
    }
    const name = flag.slice(2);
    const mayRepeat = repeated.has(name)
      && ((['criterion', 'project'].includes(name) && command === 'petition')
        || (name === 'id' && command === 'records-get')
        || (name === 'item' && command === 'records-request')
        || (name === 'response' && command === 'records-resolve')
        || (name === 'recommendation' && command === 'review-record')
        || (['competency', 'standard', 'tool', 'check', 'mcp-proposal'].includes(name)
          && command === 'requisition'));
    if (seen.has(name) && !mayRepeat) {
      fail('INVALID_ARGUMENT', 'Duplicate flags are not allowed except for explicitly repeated list flags.');
    }
    seen.add(name);
    if (['apply', 'linked'].includes(name)) {
      options[name] = true;
      continue;
    }
    const value = flags[index + 1];
    if (value === undefined || value.startsWith('--') || value.includes('\0')) {
      fail('INVALID_ARGUMENT', 'A flag value is missing or malformed. Use --help for the supported command contract.');
    }
    index += 1;
    if (name === 'criterion') options.criteria.push(value);
    else if (name === 'competency') options.competencies.push(value);
    else if (name === 'standard') options.standards.push(value);
    else if (name === 'tool') options.tools.push(value);
    else if (name === 'check') options.checks.push(value);
    else if (name === 'mcp-proposal') options['mcp-proposals'].push(value);
    else if (name === 'project' && command !== 'records-list') options.projects.push(value);
    else if (name === 'id' && command === 'records-get') options.ids.push(value);
    else if (name === 'item') options.items.push(value);
    else if (name === 'response') options.responses.push(value);
    else if (name === 'recommendation') options.recommendations.push(value);
    else options[name] = value;
  }
  if (specification.required.some((name) => !seen.has(name))) {
    fail('INVALID_ARGUMENT', 'A required flag is missing. Use --help for the supported command contract.');
  }
  return { command, options };
}

async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (command === 'help') return help();
  const root = await rootDirectory(options.root);
  switch (command) {
    case 'init':
      return init(root, options, fileURLToPath(new URL('../templates/repository/.city/', import.meta.url)));
    case 'status':
      return status(root);
    case 'validate':
      return validate(root);
    case 'petition':
      return petition(root, options);
    case 'project-add':
      return projectAdd(root, options);
    case 'records-list':
      return recordsList(root, options);
    case 'records-get':
      return recordsGet(root, options);
    case 'records-request':
      return recordsRequest(root, options);
    case 'records-resolve':
      return recordsResolve(root, options);
    case 'records-cancel':
      return recordsCancel(root, options);
    case 'review-record':
      return reviewRecord(root, options);
    case 'transition':
      return transition(root, options);
    case 'migrate':
      return migrate(root, options);
    case 'adopt':
      return adopt(root, options);
    case 'amend':
      return amend(root, options);
    case 'authorize':
      return authorize(root, options);
    case 'complete':
      return complete(root, options);
    case 'requisition':
      return requisition(root, options);
    case 'review-requisition':
      return reviewRequisition(root, options);
    case 'appoint':
      return appoint(root, options);
    case 'hire':
      return hire(root, options);
    case 'assign':
      return assign(root, options);
    case 'retire':
      return retire(root, options);
    default:
      fail('INVALID_ARGUMENT', 'Unsupported command.');
  }
}

try {
  process.stdout.write(`${JSON.stringify(await main())}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify(errorOutput(error))}\n`);
  process.exitCode = 1;
}
