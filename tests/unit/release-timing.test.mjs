import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main, transition, summarize, timingOutput } from '../../skills/agrimap-agent-skills/scripts/release-timing.mjs';

test('visible output prints measured totals and steps; pending/missing timing cannot silently succeed', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agm-output-'));
  t.after(() => rm(dir, {recursive:true, force:true}));
  const file = path.join(dir, 'run.json');
  const cli = (...args) => spawnSync(process.execPath, ['skills/agrimap-agent-skills/scripts/release-timing.mjs', ...args], {encoding:'utf8'});
  assert.equal(cli('output', file).status, 1);
  assert.match(cli('output', file).stdout, /Elapsed: UNKNOWN/);
  assert.equal(cli('unavailable').status, 1);
  const unavailable = cli('unavailable', 'Timer never started');
  assert.equal(unavailable.status, 0);
  assert.match(unavailable.stdout, /Reason: Timer never started/);
  let state = transition(null, 'start', 'indexing', 0);
  state = transition(state, 'wait', 'requester', 180000);
  state = transition(state, 'step', 'hash', 600000);
  await writeFile(file, JSON.stringify(state));
  assert.equal(cli('output', file).status, 1);
  state = transition(state, 'finish', '', 900000);
  await writeFile(file, JSON.stringify(state));
  const result = cli('output', file);
  assert.equal(result.status, 0);
  for (const text of ['MEASURED', 'Elapsed: 15m 0.000s', 'Active: 8m 0.000s', 'Waiting: 7m 0.000s', '| indexing | 3m 0.000s |', '| hash | 5m 0.000s |']) assert.ok(result.stdout.includes(text), text);
  assert.equal(JSON.parse(cli('report', file).stdout).finalOutput, result.stdout.trim());
  state.intervals[1].kind = 'unmeasured';
  await writeFile(file, JSON.stringify(state));
  assert.match((await timingOutput(file)).finalOutput, /PARTIAL[\s\S]*measured portion only[\s\S]*Unmeasured: 7m/);
  state.intervals[1].start++;
  await writeFile(file, JSON.stringify(state));
  assert.equal((await timingOutput(file)).ready, false);
});

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
