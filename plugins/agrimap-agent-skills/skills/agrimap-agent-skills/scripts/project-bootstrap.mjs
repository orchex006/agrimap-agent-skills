#!/usr/bin/env node
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArgs } from './cli-args.mjs';

const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/bootstrap');
const normalized = value => Buffer.from(value.toString('utf8').replaceAll('\r\n', '\n'));
const hash = value => createHash('sha256').update(value).digest('hex');
const kinds = ['fe-main', 'be-main', 'fe-library', 'be-library'];
const start = '<!-- BEGIN AGRIMAP DEPLOYMENT -->';
const end = '<!-- END AGRIMAP DEPLOYMENT -->';
async function readMaybe(file) { try { return await readFile(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function safeTarget(root, relative) {
  const dest = path.resolve(root, relative);
  if (!dest.startsWith(root + path.sep)) throw new Error('BOOTSTRAP_PATH_ESCAPE');
  let current = dest;
  while (true) {
    const info = await lstat(current).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    if (info?.isSymbolicLink()) throw new Error('BOOTSTRAP_LINK_FORBIDDEN');
    if (current === path.parse(current).root) break;
    current = path.dirname(current);
  }
  return dest;
}
export async function planBootstrap({ target, kind, upgrade = false }) {
  if (!target || !kinds.includes(kind)) throw new Error('BOOTSTRAP_TARGET_KIND_REQUIRED');
  const root = path.resolve(target);
  const pkg = await readMaybe(path.join(root, 'package.json'));
  if (pkg && JSON.parse(pkg).name === 'agrimap-agent-skills') throw new Error('PACKAGE_PRODUCT_BOOTSTRAP_FORBIDDEN');
  const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'));
  const entries = [];
  for (const item of manifest.files) {
    const source = await readFile(path.join(bundle, item.source));
    if (hash(source) !== item.sha256) throw new Error('BOOTSTRAP_BUNDLE_HASH_MISMATCH');
    const dest = await safeTarget(root, item.target);
    const before = await readMaybe(dest);
    const prior = before && (item.previous || []).find(old => old.sha256 === hash(normalized(before)));
    let content = source, status = before ? hash(before) === hash(source) ? 'unchanged' : 'conflict' : 'create';
    if ((prior || upgrade === true) && status === 'conflict') status = 'update';
    let previousVersion = prior?.version || null;
    if (item.mode === 'section') {
      const text = before?.toString('utf8') || '';
      const block = source.toString('utf8').trimEnd();
      const managed = `${start}\n${block}\n${end}\n`;
      if (text.includes(start) || text.includes(end) || /^## Deployment\s*$/m.test(text)) {
        const existing = text.split(start).length === 2 && text.split(end).length === 2 && text.indexOf(start) < text.indexOf(end) ? text.match(/<!-- BEGIN AGRIMAP DEPLOYMENT -->\r?\n([\s\S]*?)\r?\n<!-- END AGRIMAP DEPLOYMENT -->/) : null;
        status = existing && existing[1].replaceAll('\r\n', '\n') === block ? 'unchanged' : 'conflict';
        content = before;
        const previousBlock = existing && (item.previous || []).find(old => old.sha256 === hash(Buffer.from(existing[1].replaceAll('\r\n', '\n') + '\n')));
        if (status === 'conflict' && existing && (previousBlock || upgrade === true)) {
          status = 'update'; previousVersion = previousBlock?.version || null;
          content = Buffer.from(text.replace(existing[0], managed.trimEnd()));
        }
      } else {
        const index = text.search(/^## Swagger\s*$/m);
        const next = index >= 0 ? text.slice(0,index) + managed + '\n' + text.slice(index) : text.trimEnd() + (text ? '\n\n' : '') + managed;
        content = Buffer.from(next); status = before ? 'insert-section' : 'create';
      }
    }
    entries.push({ previousVersion, target: item.target, mode: item.mode, status, beforeHash: before ? hash(before) : null, sha256: hash(content || ''), content: (content || Buffer.alloc(0)).toString('base64') });
  }
  const agents = await readMaybe(await safeTarget(root, 'AGENTS.md'));
  const installedVersion = agents?.toString('utf8').match(/<!-- AGRIMAP BOOTSTRAP VERSION: ([^ ]+) -->/)?.[1] || null;
  const receiptBytes = await readMaybe(await safeTarget(root, '.agrimap-agent/runtime/bootstrap.json'));
  let receiptVersion = null;
  try { receiptVersion = receiptBytes ? JSON.parse(receiptBytes).version : null; } catch { /* Rebuild an invalid receipt only after verified apply. */ }
  return { version: manifest.version, installedVersion, receiptVersion, freshness: receiptVersion === manifest.version && installedVersion === manifest.version && entries.every(e => e.status === 'unchanged') ? 'current' : 'update-required', root, kind, upgrade: upgrade === true, ok: entries.every(e => e.status !== 'conflict'), entries };
}
export async function applyBootstrap(options) {
  const plan = await planBootstrap(options);
  if (!plan.ok) return { ...plan, applied: false };
  const receipt = await safeTarget(plan.root,'.agrimap-agent/runtime/bootstrap.json');
  // Preflight all target fingerprints before creating any target.
  for (const e of plan.entries) {
    const dest = await safeTarget(plan.root,e.target), before = await readMaybe(dest);
    if ((before ? hash(before) : null) !== e.beforeHash) throw new Error('BOOTSTRAP_TARGET_DRIFT');
  }
  // Save exact prior bytes before any replacement, including project README outside the managed block.
  for (const e of plan.entries.filter(e => e.status === 'update')) {
    const backup = await safeTarget(plan.root, `.agrimap-agent/runtime/bootstrap-backups/${e.beforeHash}/${e.target}`);
    await mkdir(path.dirname(backup), {recursive:true});
    const old = await readFile(await safeTarget(plan.root, e.target));
    if (hash(old) !== e.beforeHash) throw new Error('BOOTSTRAP_TARGET_DRIFT');
    await writeFile(backup, old);
  }
  for (const e of plan.entries.filter(e => e.status !== 'unchanged')) {
    const dest = await safeTarget(plan.root,e.target);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(e.content,'base64'), { flag: e.beforeHash === null ? 'wx' : 'w' });
    if (hash(await readFile(dest)) !== e.sha256) throw new Error('BOOTSTRAP_COPY_VERIFY_FAILED');
  }
  await mkdir(path.dirname(receipt),{recursive:true});
  await writeFile(receipt,JSON.stringify({version:plan.version,kind:plan.kind,files:plan.entries.map(({content,...e})=>e)},null,2)+'\n');
  return { ...plan, applied: true };
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0];
  Promise.resolve().then(() => {
    if (!['plan','apply','upgrade'].includes(command)) throw new Error('Use plan [--upgrade]|apply|upgrade --target <project> --kind <kind>');
    return (command === 'plan' ? planBootstrap : applyBootstrap)({ target: args.target, kind: args.kind, upgrade: command === 'upgrade' || args.upgrade === true });
  }).then(result => { console.log(JSON.stringify({...result,entries:result.entries.map(({content,...e})=>e)},null,2)); if (!result.ok) process.exitCode=1; })
    .catch(error => {console.error(JSON.stringify({ok:false,message:error.message}));process.exitCode=1;});
}
