#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { redactText } from './sensitive-recording.mjs';

const display = value => redactText(String(value)).replace(/[\r\n|`<>]/g, ' ');
const duration = ms => `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(3)}s`;

export async function timingOutput(file, unavailableReason = '') {
  unavailableReason = typeof unavailableReason === 'string' ? unavailableReason.trim() : '';
  let summary;
  let reason = unavailableReason;
  if (!reason && file) {
    try {
      const state = JSON.parse(await readFile(file, 'utf8'));
      const intervals = [...(state.intervals || []), ...(state.current ? [{...state.current, start:state.cursor, end:Date.now()}] : [])];
      if (!Number.isSafeInteger(state.startedAt) || !Number.isSafeInteger(state.cursor)
          || state.cursor < state.startedAt || !Array.isArray(state.intervals)
          || intervals.some(i => !['active','human-wait','unmeasured'].includes(i.kind)
            || !Number.isSafeInteger(i.start) || !Number.isSafeInteger(i.end) || i.end < i.start)) throw new Error('invalid');
      let cursor = state.startedAt;
      for (const interval of state.intervals) {
        if (interval.start !== cursor) throw new Error('invalid');
        cursor = interval.end;
      }
      if (cursor !== state.cursor || (state.endedAt !== null
          && (state.endedAt !== state.cursor || state.current !== null))
          || (state.endedAt === null && !state.current)) throw new Error('invalid');
      summary = summarize(state);
      if (![summary.elapsedMs, summary.activeMs, summary.humanWaitMs, summary.unmeasuredMs].every(Number.isFinite)
          || summary.elapsedMs !== summary.activeMs + summary.humanWaitMs + summary.unmeasuredMs) throw new Error('invalid');
    } catch { reason = 'Timing file is missing or invalid; duration was not established.'; }
  }
  if (!summary) {
    reason ||= 'Timing was not recorded.';
    return {status:'unavailable', ready:Boolean(unavailableReason.trim()), finalOutput:
      `Release timing: UNAVAILABLE\nElapsed: UNKNOWN\nActive: UNKNOWN\nWaiting: UNKNOWN\nSteps: UNKNOWN\nReason: ${display(reason)}`};
  }
  const status = !summary.endedAt ? 'in-progress' : summary.activeComplete ? 'measured' : 'partial';
  const qualifier = summary.activeComplete ? '' : ' (measured portion only)';
  const rows = Object.entries(summary.stepMs).map(([label, ms]) => `| ${display(label)} | ${duration(ms)} |`);
  return {status, ready:Boolean(summary.endedAt), summary, finalOutput:
    `Release timing: ${status.toUpperCase()}\nElapsed: ${duration(summary.elapsedMs)}\nActive: ${duration(summary.activeMs)}${qualifier}\nWaiting: ${duration(summary.humanWaitMs)}\nUnmeasured: ${duration(summary.unmeasuredMs)}\n\n| Step | Active time |\n| --- | --- |\n${rows.join('\n') || '| No measured steps | UNKNOWN |'}`};
}

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
  if (action === 'output') return timingOutput(file);
  if (action === 'unavailable') return timingOutput(null, [file, ...labels].filter(Boolean).join(' '));
  if (!['start', 'step', 'wait', 'pause', 'finish', 'report'].includes(action) || !file) {
    throw new Error('Usage: release-timing.mjs start|step|wait|pause|finish|report|output <local-state.json> [label]; unavailable <reason>');
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
  main(process.argv.slice(2)).then(async result => {
    if (['output','unavailable'].includes(process.argv[2])) {
      process.stdout.write(result.finalOutput + '\n');
      if (!result.ready) process.exitCode = 1;
      return;
    }
    if (['finish','report'].includes(process.argv[2])) result = {...result, ...(await timingOutput(process.argv[3]))};
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  })
    .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
