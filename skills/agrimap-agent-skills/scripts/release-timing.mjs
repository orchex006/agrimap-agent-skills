#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// One serialized timeline per release. Waiting and unattended gaps are explicit,
// so resuming a process cannot silently count human time as execution time.
export function transition(previous, action, label, now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('INVALID_TIME');
  if (action === 'start') {
    if (previous) throw new Error('RUN_EXISTS: resume the existing timeline');
    return { schemaVersion: 1, startedAt: now, endedAt: null, cursor: now,
      current: { kind: 'active', label: label || 'readiness' }, intervals: [] };
  }
  if (!previous || previous.schemaVersion !== 1) throw new Error('RUN_MISSING');
  if (previous.endedAt !== null) throw new Error('RUN_FINISHED');
  if (now < previous.cursor) throw new Error('CLOCK_MOVED_BACKWARD');
  if (!['step', 'wait', 'pause', 'finish'].includes(action)) throw new Error('INVALID_ACTION');
  if (action !== 'finish' && !label?.trim()) throw new Error('LABEL_REQUIRED');
  const state = structuredClone(previous);
  state.intervals.push({ ...state.current, start: state.cursor, end: now });
  state.cursor = now;
  state.current = action === 'finish' ? null : {
    kind: action === 'step' ? 'active' : action === 'wait' ? 'human-wait' : 'unmeasured', label,
  };
  if (action === 'finish') state.endedAt = now;
  return state;
}

export function summarize(state, now = Date.now()) {
  if (!state || state.schemaVersion !== 1) throw new Error('RUN_MISSING');
  const end = state.endedAt ?? now;
  if (end < state.cursor) throw new Error('CLOCK_MOVED_BACKWARD');
  const intervals = [...state.intervals];
  if (state.current) intervals.push({ ...state.current, start: state.cursor, end });
  const stepMs = {};
  let activeMs = 0, humanWaitMs = 0, unmeasuredMs = 0;
  for (const interval of intervals) {
    const duration = interval.end - interval.start;
    if (interval.kind === 'active') {
      activeMs += duration;
      Object.defineProperty(stepMs, interval.label, { value: (Object.hasOwn(stepMs, interval.label) ? stepMs[interval.label] : 0) + duration,
        enumerable: true, configurable: true });
    } else if (interval.kind === 'human-wait') humanWaitMs += duration;
    else unmeasuredMs += duration;
  }
  return { startedAt: new Date(state.startedAt).toISOString(), endedAt: state.endedAt === null ? null : new Date(end).toISOString(),
    elapsedMs: end - state.startedAt, activeMs, humanWaitMs, unmeasuredMs,
    activeComplete: unmeasuredMs === 0, stepMs, current: state.current };
}

export async function main(argv) {
  const [action, file, ...labels] = argv;
  if (!['start', 'step', 'wait', 'pause', 'finish', 'report'].includes(action) || !file) {
    throw new Error('Usage: release-timing.mjs start|step|wait|pause|finish|report <local-state.json> [label]');
  }
  let state = null;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (action !== 'report') {
    state = transition(state, action, labels.join(' '));
    await mkdir(path.dirname(path.resolve(file)), { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 2) + '\n', 'utf8');
  }
  return summarize(state);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
