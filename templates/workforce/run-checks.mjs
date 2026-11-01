#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const invalid = (message) => {
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 2;
};

function validChecks(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2 && value.schemaVersion === 1
    && Array.isArray(value.checks) && value.checks.length <= 20
    && value.checks.every((check) => Array.isArray(check) && check.length >= 1 && check.length <= 50
      && typeof check[0] === 'string' && /^[A-Za-z0-9._-]{1,64}$/u.test(check[0])
      && check.every((arg) => typeof arg === 'string' && arg.length <= 500
        && !/[\u0000-\u001f\u007f\r\n]/u.test(arg)));
}

function tail(value) {
  return value.slice(-8192);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--root' || !path.isAbsolute(args[1]) || args[1].includes('\0')) {
    invalid('Usage: node run-checks.mjs --root ABS');
    return;
  }
  let root;
  try {
    root = await realpath(args[1]);
    if (!(await lstat(root)).isDirectory()) throw new Error();
  } catch {
    invalid('--root must be an existing accessible directory.');
    return;
  }
  const checksPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'checks.json');
  let checks;
  try {
    const info = await lstat(checksPath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024) throw new Error();
    checks = JSON.parse(await readFile(checksPath, 'utf8'));
    if (!validChecks(checks)) throw new Error();
  } catch {
    invalid('checks.json must be a regular schemaVersion 1 file with valid command arrays.');
    return;
  }
  const results = [];
  for (const command of checks.checks) {
    const started = Date.now();
    const result = spawnSync(command[0], command.slice(1), {
      cwd: root, shell: false, timeout: 600_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    });
    const status = result.status;
    results.push({
      command,
      status,
      signal: result.signal,
      executionError: result.error?.message ?? null,
      durationMs: Date.now() - started,
      stdoutTail: tail(result.stdout ?? ''),
      stderrTail: tail(result.stderr ?? ''),
    });
  }
  const output = { root, checks: results, passed: results.every((check) => check.status === 0) };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (!output.passed) process.exitCode = 1;
}

await main();
