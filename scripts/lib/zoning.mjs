import { createHash } from 'node:crypto';
import { ZONING_POLICY } from './constants.mjs';

export function zoningEnabled(city) {
  return city.config.governance === 'adopted'
    && city.config.adoption.policies.some((policy) => policy.path === ZONING_POLICY);
}

export function zoningScopePaths(city, order) {
  const paths = [
    ...(order.projectIds ?? []).map((id) => city.projects.projects.find((project) => project.id === id)?.path),
    ...(order.infrastructure?.targets ?? []).map((target) => target.path),
  ].filter(Boolean);
  return [...new Set(paths)].sort();
}

function zoneForPath(zoning, target) {
  return zoning.zones.find((zone) => zone.path === '.'
    || target === zone.path || target.startsWith(`${zone.path}/`)) ?? null;
}

function dispositionFor(zone, changeType) {
  const rule = zone?.rules.find((entry) => entry.changeType === changeType);
  return rule ?? { disposition: 'unknown', requirements: [] };
}

export function assessZoning(city, order, changeTypes) {
  const paths = zoningScopePaths(city, order);
  const coverage = paths.map((path) => {
    const zone = city.zoning ? zoneForPath(city.zoning, path) : null;
    return {
      path,
      zoneId: zone?.id ?? null,
      determinations: changeTypes.map((changeType) => ({
        changeType,
        ...dispositionFor(zone, changeType),
      })),
    };
  });
  const dispositions = coverage.flatMap((entry) => entry.determinations.map((item) => item.disposition));
  const outcome = dispositions.includes('prohibited') ? 'prohibited'
    : dispositions.includes('unknown') || coverage.length === 0 ? 'unknown'
      : dispositions.includes('conditional') ? 'conditional' : 'permitted';
  return { coverage, outcome };
}

export function zoningSnapshot(city, order, changeTypes) {
  const scope = {
    map: city.zoningBytes ? createHash('sha256').update(city.zoningBytes).digest('hex') : null,
    paths: zoningScopePaths(city, order),
    changeTypes: [...changeTypes].sort(),
  };
  return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

export function currentZoningCheck(city, order) {
  const check = order.development?.zoningChecks?.at(-1);
  if (!check) return null;
  const expected = assessZoning(city, order, check.changeTypes);
  return check.snapshot === zoningSnapshot(city, order, check.changeTypes)
    && check.outcome === expected.outcome
    && JSON.stringify(check.coverage) === JSON.stringify(expected.coverage) ? check : null;
}

export function zoningStatus(city, order) {
  const enabled = zoningEnabled(city);
  if (!enabled) return { enabled: false, outcome: null, current: false, missing: [] };
  if (!city.zoning) return { enabled: true, outcome: 'unknown', current: false, missing: ['.city/zoning.json'] };
  const check = currentZoningCheck(city, order);
  if (!check) return { enabled: true, outcome: 'unknown', current: false, missing: ['current zoning check'] };
  return {
    enabled: true, outcome: check.outcome, current: true,
    missing: check.outcome === 'conditional'
      ? check.coverage.flatMap((entry) => entry.determinations
        .filter((item) => item.disposition === 'conditional')
        .flatMap((item) => item.requirements))
      : [],
  };
}
