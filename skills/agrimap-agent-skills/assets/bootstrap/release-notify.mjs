#!/usr/bin/env node
// AgriMap release notification (managed by AgriMap bootstrap; local edits are replaced).
// Sends the plain-language Release Description to the AgriMap notify service, which
// forwards it to Microsoft Teams. Requires Node >= 18. No dependencies.
//
//   node tools/agrimap/release-notify.mjs check
//   node tools/agrimap/release-notify.mjs set-url <https://.../agrimap-notify/release>
//   node tools/agrimap/release-notify.mjs send --description <file.md> --commit <sha> [--preview]
//
// URL: --url, else env NOTIFY_WEBHOOK_URL (process, then Windows user env or shell profile).
// Health: env NOTIFY_HEALTH_URL, else the same base with /healthz instead of /release (agrimap-notify service).
// Exit: 0 ok, 1 usage, 2 NOTIFY_WEBHOOK_URL_MISSING, 3 health failed, 4 post failed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV = 'NOTIFY_WEBHOOK_URL';
const PROFILE_FILES = ['.profile', '.bashrc', '.zshrc'];
const PROJECT_TYPES = ['Web', 'Service', 'Job', 'FE-Library', 'BE-Library'];
const STATUSES = ['SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT'];

const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
const fail = (code, exit, extra = {}) => { print({ ok: false, code, ...extra }); process.exit(exit); };

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { out._.push(token); continue; }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function git(cwd, ...params) {
  try { return execFileSync('git', params, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

function validUrl(value) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url : null; }
  catch { return null; }
}

function persistedUrl() {
  if (process.platform === 'win32') {
    try {
      const text = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', ENV], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const match = text.match(new RegExp(`${ENV}\\s+REG_\\w+\\s+(\\S.*)`));
      if (match) return { url: match[1].trim(), source: 'windows-user-env' };
    } catch { /* not set */ }
    return null;
  }
  for (const name of PROFILE_FILES) {
    const file = path.join(os.homedir(), name);
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(new RegExp(`^\\s*export\\s+${ENV}=["']?([^"'\\s]+)`, 'm'));
    if (match) return { url: match[1], source: `~/${name}` };
  }
  return null;
}

function resolveUrl(options) {
  if (options.url) return { url: options.url, source: '--url' };
  if (process.env[ENV]) return { url: process.env[ENV], source: 'process-env' };
  return persistedUrl();
}

function healthUrl(postUrl) {
  if (process.env.NOTIFY_HEALTH_URL) return process.env.NOTIFY_HEALTH_URL;
  const url = new URL(postUrl);
  url.pathname = url.pathname.replace(/\/release\/?$/, '').replace(/\/$/, '') + '/healthz';
  url.search = '';
  return url.toString();
}

async function checkHealth(url) {
  const target = healthUrl(url);
  try {
    const response = await fetch(target, { method: 'GET', signal: AbortSignal.timeout(15000) });
    const body = (await response.text()).slice(0, 300);
    return { ok: response.ok, healthUrl: target, status: response.status, body };
  } catch (error) {
    return { ok: false, healthUrl: target, status: null, body: String(error?.cause?.code || error?.message || error) };
  }
}

async function requireUrl(options) {
  const resolved = resolveUrl(options);
  if (!resolved) fail('NOTIFY_WEBHOOK_URL_MISSING', 2, { next: `Ask the requester for the notify URL, then run: set-url <url>` });
  if (!validUrl(resolved.url)) fail('NOTIFY_WEBHOOK_URL_INVALID', 1, { source: resolved.source });
  return resolved;
}

function setUrl(value) {
  const url = validUrl(value);
  if (!url) fail('NOTIFY_WEBHOOK_URL_INVALID', 1, { next: 'Pass an http(s) URL such as https://<host>/agrimap-notify/release' });
  if (process.platform === 'win32') {
    execFileSync('setx', [ENV, url.toString()], { stdio: 'ignore' });
    print({ ok: true, saved: 'windows-user-env', url: url.toString(), note: 'New terminals see it; this script also reads it directly.' });
    return;
  }
  const file = path.join(os.homedir(), '.profile');
  const line = `export ${ENV}="${url.toString()}"`;
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const pattern = new RegExp(`^\\s*export\\s+${ENV}=.*$`, 'm');
  writeFileSync(file, pattern.test(text) ? text.replace(pattern, line) : text.replace(/\n?$/, '\n') + line + '\n');
  print({ ok: true, saved: '~/.profile', url: url.toString() });
}

// "# AppName / Version" (or plain) first line, then "- " / "* " / "1. " bullets.
function parseDescription(file) {
  const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const heading = lines.find(line => line.trim());
  const title = String(heading || '').replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  const [appName, version] = title.includes(' / ') ? title.split(' / ').map(part => part.trim()) : [title, ''];
  const changes = lines.map(line => line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/)?.[1]).filter(Boolean).slice(0, 30);
  return { appName, version: version.replace(/^v/i, ''), changes };
}

function detectProject(root, name) {
  const has = entry => existsSync(path.join(root, entry));
  let type = 'Service';
  if (/^agmwa-/i.test(name)) type = 'Web';
  else if (/^agmbo-/i.test(name)) type = 'Job';
  else if (/^agmws-/i.test(name)) type = 'Service';
  else if (has('angular.json') && has('projects')) type = 'FE-Library';
  else if (readdirSync(root).some(entry => /\.(?:sln|slnx|csproj)$/i.test(entry))) type = 'BE-Library';
  const tags = ['Web', 'FE-Library'].includes(type) ? ['Angular'] : ['.NET'];
  return { type, tags };
}

function httpsRemote(value) {
  const text = String(value || '').trim();
  const ssh = text.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  return text.replace(/\.git$/, '') || null;
}

function imageName(root, fallback) {
  for (const file of ['Jenkinsfile_Production', 'Jenkinsfile']) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    const match = readFileSync(full, 'utf8').match(/IMAGE_NAME\s*=\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  }
  return fallback;
}

function buildPayload(options) {
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel') || process.cwd();
  const description = parseDescription(options.description);
  const projectName = options['project-name'] || path.basename(root);
  const detected = detectProject(root, projectName);
  const version = String(options.version || description.version || '').replace(/^v/i, '');
  if (!version) fail('RELEASE_VERSION_MISSING', 1, { next: 'Start the description with "AppName / <version>" or pass --version' });
  if (!description.changes.length) fail('RELEASE_DESCRIPTION_EMPTY', 1, { next: 'List each change as a "- " bullet' });
  const type = options['project-type'] || detected.type;
  const status = options.status || 'SUCCESS';
  if (!PROJECT_TYPES.includes(type)) fail('PROJECT_TYPE_INVALID', 1, { allowed: PROJECT_TYPES });
  if (!STATUSES.includes(status)) fail('STATUS_INVALID', 1, { allowed: STATUSES });
  return {
    environment: options.environment || 'Production',
    projectName,
    projectType: type,
    projectTags: options['project-tags'] ? String(options['project-tags']).split(',').map(tag => tag.trim()).filter(Boolean) : detected.tags,
    repositoryUrl: options['repository-url'] || httpsRemote(git(root, 'remote', 'get-url', 'origin')),
    commit: options.commit || git(root, 'rev-parse', 'HEAD') || null,
    gitTag: options['git-tag'] || `v${version}`,
    triggeredBy: options['triggered-by'] || 'agm-release',
    imageName: options['image-name'] || imageName(root, projectName),
    imageTag: options['image-tag'] || version,
    projectVersion: version,
    jobName: options['job-name'] || 'agm-release release production',
    buildNumber: String(Math.floor(Date.now() / 1000)),
    status,
    registryPublished: options['registry-published'] === 'true',
    changes: description.changes,
  };
}

async function send(options) {
  if (!options.description || options.description === true) fail('DESCRIPTION_REQUIRED', 1, { next: 'Pass --description <file.md>' });
  if (!existsSync(options.description)) fail('DESCRIPTION_NOT_FOUND', 1, { file: options.description });
  const payload = buildPayload(options);
  if (options.preview) { print({ ok: true, preview: true, payload }); return; }
  const { url, source } = await requireUrl(options);
  const health = await checkHealth(url);
  if (!health.ok) fail('NOTIFY_HEALTH_FAILED', 3, { url, source, health, sent: false });
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    const body = (await response.text()).slice(0, 1000);
    if (!response.ok) fail('NOTIFY_POST_FAILED', 4, { url, status: response.status, body, sent: false });
    print({ ok: true, sent: true, url, source, status: response.status, body, projectName: payload.projectName, projectVersion: payload.projectVersion, changes: payload.changes.length });
  } catch (error) {
    fail('NOTIFY_POST_FAILED', 4, { url, error: String(error?.cause?.code || error?.message || error), sent: 'unknown' });
  }
}

const options = args(process.argv.slice(2));
const command = options._[0] || 'help';
if (command === 'check') {
  const { url, source } = await requireUrl(options);
  const health = await checkHealth(url);
  print({ ok: health.ok, url, source, health });
  process.exit(health.ok ? 0 : 3);
} else if (command === 'set-url') setUrl(options._[1]);
else if (command === 'send') await send(options);
else {
  print({ ok: command === 'help', usage: ['check', 'set-url <url>', 'send --description <file.md> [--commit <sha>] [--version <x.y.z>] [--environment Production] [--project-name <name>] [--project-type Web|Service|Job|FE-Library|BE-Library] [--preview]'] });
  process.exit(command === 'help' ? 0 : 1);
}
