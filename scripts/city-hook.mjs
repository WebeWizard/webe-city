#!/usr/bin/env node
import path from 'node:path';
import { discoverCity } from './lib/city.mjs';
import { LIMITS } from './lib/constants.mjs';
import { CityError, fail } from './lib/errors.mjs';
import { object, text } from './lib/validation.mjs';

async function readPayload() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > LIMITS.hookBytes) fail('BAD_PAYLOAD', 'Hook input exceeds the supported size.');
    chunks.push(chunk);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    fail('BAD_PAYLOAD', 'Hook input must be JSON.');
  }
  object(payload, 'Hook payload');
  if (typeof payload.cwd !== 'string' || !path.isAbsolute(payload.cwd) || payload.cwd.includes('\0')) {
    fail('BAD_PAYLOAD', 'Hook cwd must be absolute.');
  }
  text(payload.toolName, 'Hook toolName', 200);
  // Patch-style tools send toolArgs as opaque text; it is never parsed, executed or echoed.
  if (typeof payload.toolArgs !== 'string') {
    if (payload.toolArgs === null || typeof payload.toolArgs !== 'object' || Array.isArray(payload.toolArgs)) {
      fail('BAD_PAYLOAD', 'Hook toolArgs must be a JSON object or a string.');
    }
  }
  return payload;
}

let result;
try {
  const payload = await readPayload();
  await discoverCity(payload.cwd);
  result = {};
} catch (error) {
  // CityError messages are fixed text that never includes payload values; other errors stay sanitized.
  const cause = error instanceof CityError ? ` Cause: ${error.code}: ${error.message}` : '';
  result = {
    permissionDecision: 'deny',
    permissionDecisionReason: `City hook cannot safely validate the payload, repository boundary or enrolled draft state.${cause} Recovery: check the camelCase cwd/toolName/toolArgs payload and directory access; restore or repair .city from a reviewed backup, then run node <installed-plugin>/scripts/city.mjs validate --root ABS before retrying. Do not treat --apply or this hook as verified approval.`,
  };
}
process.stdout.write(`${JSON.stringify(result)}\n`);
