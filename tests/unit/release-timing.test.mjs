import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main, transition, summarize } from '../../skills/agrimap-agent-skills/scripts/release-timing.mjs';

test('elapsed includes requester/confirmation waits; actual sums steps and retries once', () => {
  let state = transition(null, 'start', 'readiness', 0);
  state = transition(state, 'wait', 'requester', 1000);
  state = transition(state, 'step', 'indexing', 61000);
  state = transition(state, 'step', 'hash', 241000);
  state = transition(state, 'wait', 'confirmation', 541000);
  state = transition(state, 'step', 'hash', 1141000);
  state = transition(state, 'step', 'tag', 1201000);
  state = transition(state, 'finish', '', 1261000);
  const result = summarize(state, 9999999);
  assert.equal(result.elapsedMs, 1261000);
  assert.equal(result.humanWaitMs, 660000);
  assert.equal(result.activeMs, 601000);
  assert.deepEqual(result.stepMs, { readiness: 1000, indexing: 180000, hash: 360000, tag: 60000 });
  assert.equal(result.elapsedMs, result.activeMs + result.humanWaitMs + result.unmeasuredMs);
});

test('pause survives resume and reports incomplete measurement instead of inventing active time', () => {
  let state = transition(null, 'start', 'verify', 0);
  state = transition(state, 'pause', 'interrupted', 100);
  state = transition(JSON.parse(JSON.stringify(state)), 'step', 'verify', 10000);
  const result = summarize(state, 10100);
  assert.equal(result.activeMs, 200);
  assert.equal(result.unmeasuredMs, 9900);
  assert.equal(result.activeComplete, false);
  assert.throws(() => transition(state, 'step', 'tag', 1), /CLOCK_MOVED_BACKWARD/);
  assert.throws(() => transition(state, 'start', '', 11000), /RUN_EXISTS/);
  assert.throws(() => transition(state, 'wait', '', 11000), /LABEL_REQUIRED/);
  assert.throws(() => transition(transition(state, 'finish', '', 11000), 'step', 'tag', 12000), /RUN_FINISHED/);
});

test('CLI persists timeline and report is read-only', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agm-timing-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'run.json');
  await main(['start', file, 'readiness']);
  await main(['wait', file, 'requester']);
  await main(['step', file, 'indexing']);
  const result = await main(['finish', file]);
  const before = await readFile(file, 'utf8');
  assert.deepEqual(await main(['report', file]), result);
  assert.equal(await readFile(file, 'utf8'), before);
  await assert.rejects(main(['start', file]), /RUN_EXISTS/);
});
