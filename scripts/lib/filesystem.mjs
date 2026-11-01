import { constants } from 'node:fs';
import {
  link, lstat, mkdir, open, realpath, readdir, rename, rm, rmdir, unlink,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { LIMITS } from './constants.mjs';
import { CityError, fail } from './errors.mjs';

const noFollow = constants.O_NOFOLLOW ?? 0;
export const encodeJSON = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const sameIdentity = (first, second) => first.dev === second.dev && first.ino === second.ino;

export async function inspect(location) {
  try {
    return await lstat(location);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new CityError('PATH_ACCESS', 'City paths cannot be inspected safely. Repair permissions or restore accessible local state.');
  }
}

export async function rootDirectory(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.includes('\0')) {
    fail('INVALID_ARGUMENT', '--root or cwd must be an absolute path to an existing directory.');
  }
  try {
    const resolved = await realpath(root);
    const info = await lstat(resolved);
    if (!info.isDirectory()) fail('INVALID_ARGUMENT', 'City root or cwd must be an existing directory.');
    return resolved;
  } catch (error) {
    if (error instanceof CityError) throw error;
    fail('INVALID_ARGUMENT', 'City root or cwd is missing or inaccessible; restore the directory or repair its permissions.');
  }
}

export async function directory(location, label) {
  const info = await inspect(location);
  if (!info || info.isSymbolicLink() || !info.isDirectory()) {
    fail('UNSAFE_PATH', `${label} must be an existing regular directory, not a symlink. Restore or repair the city layout.`);
  }
  return info;
}

export async function regularFile(location, label) {
  const info = await inspect(location);
  if (!info || info.isSymbolicLink() || !info.isFile()) {
    fail('UNSAFE_PATH', `${label} must be an existing regular file, not a symlink. Restore or repair the city layout.`);
  }
  return info;
}

export async function readRegular(location, label) {
  const before = await regularFile(location, label);
  if (before.size > LIMITS.fileBytes) fail('SIZE_LIMIT', `${label} exceeds the supported local file size; inspect and repair it.`);
  let handle;
  try {
    handle = await open(location, constants.O_RDONLY | noFollow);
    const opened = await handle.stat();
    if (!sameIdentity(before, opened) || !opened.isFile()) {
      fail('CONFLICT', `${label} changed while being opened. Retry after inspecting concurrent edits.`);
    }
    const buffer = Buffer.alloc(LIMITS.fileBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    const current = await inspect(location);
    if (length > LIMITS.fileBytes) fail('SIZE_LIMIT', `${label} exceeds the supported local file size; inspect and repair it.`);
    if (!current || !sameIdentity(opened, current) || current.isSymbolicLink()
      || after.size !== length || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) {
      fail('CONFLICT', `${label} changed while being read. Retry after inspecting concurrent edits.`);
    }
    return { bytes: buffer.subarray(0, length), info: after };
  } catch (error) {
    if (error instanceof CityError) throw error;
    fail('PATH_ACCESS', `${label} cannot be read safely. Restore the regular file or repair permissions.`);
  } finally {
    await handle?.close();
  }
}

export async function entries(location, label) {
  await directory(location, label);
  try {
    const names = (await readdir(location)).sort();
    if (names.length > LIMITS.records) fail('SIZE_LIMIT', `${label} exceeds the supported record count.`);
    return names;
  } catch (error) {
    if (error instanceof CityError) throw error;
    fail('PATH_ACCESS', `${label} cannot be listed. Repair directory access before retrying.`);
  }
}

export async function assertIdentity(location, expected, label) {
  const actual = await inspect(location);
  if (!actual || actual.isSymbolicLink() || !sameIdentity(expected, actual)) {
    fail('CONFLICT', `${label} changed during this operation. Inspect concurrent edits before retrying.`);
  }
}

export async function exclusiveFile(location, content) {
  const bytes = Buffer.from(content);
  if (bytes.length > LIMITS.fileBytes) fail('SIZE_LIMIT', 'The proposed city record exceeds the supported local file size.');
  let handle;
  let createdInfo;
  let completed = false;
  try {
    handle = await open(location, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow, 0o600);
    createdInfo = await handle.stat();
    await handle.writeFile(bytes);
    await handle.sync();
    completed = true;
    return createdInfo;
  } catch (error) {
    if (error instanceof CityError) throw error;
    if (error.code === 'EEXIST') fail('CONFLICT', 'A city destination already exists; no content was overwritten.');
    throw error;
  } finally {
    await handle?.close();
    if (!completed && createdInfo) await removeOwnedFile(location, createdInfo);
  }
}

export async function removeOwnedFile(location, identity) {
  const actual = await inspect(location);
  if (actual && !actual.isSymbolicLink() && actual.isFile() && sameIdentity(actual, identity)) {
    await unlink(location);
  }
}

export async function ensureDirectories(root, relativePath, label) {
  const segments = relativePath.split(/[\\/]/u);
  if (path.isAbsolute(relativePath) || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    fail('INVALID_ARGUMENT', `${label} directory path must be a safe relative path.`);
  }
  const created = [];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const existing = await inspect(current);
    if (existing) {
      await directory(current, label);
      continue;
    }
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const identity = await directory(current, label);
    created.push({ path: current, identity });
  }
  return created;
}

export async function removeOwnedDirectory(location, identity) {
  const actual = await inspect(location);
  if (actual && !actual.isSymbolicLink() && actual.isDirectory() && sameIdentity(actual, identity)) {
    try {
      await rmdir(location);
    } catch (error) {
      if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error;
    }
  }
}

export async function withMutationLock(cityPath, cityIdentity, operation) {
  await assertIdentity(cityPath, cityIdentity, 'City directory');
  const lockPath = path.join(cityPath, '.mutation-lock');
  const lockInfo = await exclusiveFile(lockPath, encodeJSON({
    pid: process.pid,
    createdAt: new Date().toISOString(),
    purpose: 'Local write serialization only; not approval.',
  }));
  try {
    await assertIdentity(cityPath, cityIdentity, 'City directory');
    return await operation();
  } finally {
    await removeOwnedFile(lockPath, lockInfo);
  }
}

export async function atomicRecord(city, recordDirectory, filename, content, expectedBytes) {
  const recordPath = path.join(city.path, recordDirectory);
  const target = path.join(recordPath, filename);
  const staged = path.join(city.path, `.pending-${randomUUID()}`);
  const recordIdentity = city.directoryIdentities[recordDirectory];
  await assertIdentity(city.path, city.identity, 'City directory');
  await assertIdentity(recordPath, recordIdentity, 'City record directory');
  const stagedInfo = await exclusiveFile(staged, encodeJSON(content));
  try {
    await assertIdentity(city.path, city.identity, 'City directory');
    await assertIdentity(recordPath, recordIdentity, 'City record directory');
    await assertIdentity(staged, stagedInfo, 'Staged city record');
    if (expectedBytes) {
      const current = await readRegular(target, 'City work order');
      if (!current.bytes.equals(expectedBytes)) {
        fail('CONFLICT', 'City work order changed since validation. Inspect concurrent edits and retry.');
      }
      await rename(staged, target);
    } else {
      try {
        // A hard link publishes the complete record atomically without replacing an existing name.
        await link(staged, target);
      } catch (error) {
        if (error.code === 'EEXIST') fail('CONFLICT', 'City record already exists; no record was overwritten.');
        throw error;
      }
    }
  } finally {
    await removeOwnedFile(staged, stagedInfo);
  }
}

export async function atomicConfig(city, content, expectedBytes) {
  const target = path.join(city.path, 'config.json');
  const staged = path.join(city.path, `.pending-${randomUUID()}`);
  await assertIdentity(city.path, city.identity, 'City directory');
  const stagedInfo = await exclusiveFile(staged, encodeJSON(content));
  try {
    await assertIdentity(city.path, city.identity, 'City directory');
    await assertIdentity(staged, stagedInfo, 'Staged city config');
    const current = await readRegular(target, 'City config');
    if (!current.bytes.equals(expectedBytes)) {
      fail('CONFLICT', 'City config changed since validation. Inspect concurrent edits and retry.');
    }
    await rename(staged, target);
  } finally {
    await removeOwnedFile(staged, stagedInfo);
  }
}

export async function atomicCityFile(city, filename, content, expectedBytes) {
  if (path.basename(filename) !== filename) fail('INVALID_ARGUMENT', 'City register filename must be a basename.');
  const target = path.join(city.path, filename);
  const staged = path.join(city.path, `.pending-${randomUUID()}`);
  await assertIdentity(city.path, city.identity, 'City directory');
  const stagedInfo = await exclusiveFile(staged, encodeJSON(content));
  try {
    await assertIdentity(city.path, city.identity, 'City directory');
    await assertIdentity(staged, stagedInfo, 'Staged city register');
    if (expectedBytes) {
      const current = await readRegular(target, 'City register');
      if (!current.bytes.equals(expectedBytes)) {
        fail('CONFLICT', 'City register changed since validation. Inspect the concurrent edit and retry.');
      }
      await rename(staged, target);
    } else {
      try {
        await link(staged, target);
      } catch (error) {
        if (error.code === 'EEXIST') fail('CONFLICT', 'City register already exists; no content was overwritten.');
        throw error;
      }
    }
  } finally {
    await removeOwnedFile(staged, stagedInfo);
  }
}

export async function publishCity(root, files) {
  const stage = path.join(root, `.city-stage-${randomUUID()}`);
  const destination = path.join(root, '.city');
  await mkdir(stage, { mode: 0o700 });
  const stageIdentity = await lstat(stage);
  let reservation;
  let published = false;
  try {
    for (const [relative, content] of files) {
      await mkdir(path.dirname(path.join(stage, relative)), { recursive: true, mode: 0o700 });
      await exclusiveFile(path.join(stage, relative), content);
    }
    for (const name of ['work-orders', 'decisions', 'records-requests', 'institutional-reviews']) {
      await mkdir(path.join(stage, name), { mode: 0o700 });
    }
    try {
      // Reserve an absent name exclusively; rename may replace only this owned empty directory.
      await mkdir(destination, { mode: 0o700 });
    } catch (error) {
      if (error.code === 'EEXIST') fail('CONFLICT', 'City enrollment appeared concurrently; no existing city was overwritten. Inspect it and retry.');
      throw error;
    }
    reservation = await lstat(destination);
    await assertIdentity(destination, reservation, 'Reserved city directory');
    await assertIdentity(stage, stageIdentity, 'Staged city directory');
    if ((await readdir(destination)).length !== 0) {
      fail('CONFLICT', 'The reserved city directory changed; no existing content was overwritten.');
    }
    await rename(stage, destination);
    published = true;
  } finally {
    if (!published && reservation) {
      const actual = await inspect(destination);
      if (actual && actual.isDirectory() && !actual.isSymbolicLink() && sameIdentity(actual, reservation)) {
        try {
          await rmdir(destination);
        } catch (error) {
          if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST' && error.code !== 'ENOENT') throw error;
        }
      }
    }
    const actualStage = await inspect(stage);
    if (actualStage && !actualStage.isSymbolicLink() && sameIdentity(actualStage, stageIdentity)) {
      await rm(stage, { recursive: true });
    }
  }
}
