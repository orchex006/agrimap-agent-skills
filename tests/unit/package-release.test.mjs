import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, readFile, writeFile, mkdir, rm, readdir, symlink, rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertRuntimeFile, runtimePlan, buildRelease, releaseDecision} from '../../tools/package-release.mjs';
import {checkPackagePr} from '../../tools/check-package-pr.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const valid = {version:'4.1.0', expectedVersion:'4.1.0', ref:'main', dirty:false, tagExists:false};

test('publication requires exact version, release branch, clean source and an unused tag', () => {
  assert.deepEqual(releaseDecision(valid), {tag:'v4.1.0', prerelease:false});
  assert.equal(releaseDecision({...valid,version:'4.2.0-rc.1',expectedVersion:'4.2.0-rc.1',ref:'release/4.2.0'}).prerelease,true);
  for (const changed of [{expectedVersion:'4.0.0'}, {ref:'develop'}, {ref:'feature/fix'}, {ref:'hotfix/urgent'}, {dirty:true}, {tagExists:true},
    {version:'4.1.0-rc.01',expectedVersion:'4.1.0-rc.01'}, {version:'4.1.0-rc.1',expectedVersion:'4.1.0-rc.1',ref:'main'}]) {
    assert.throws(() => releaseDecision({...valid,...changed}), /RELEASE_/);
  }
});

test('PR routes distinguish development integration from stable publication', () => {
  for (const head of ['feature/change','fix/bug','release/4.1.0','hotfix/security']) {
    assert.equal(checkPackagePr({base:'develop',head,sameRepository:false}),true);
  }
  assert.equal(checkPackagePr({base:'main',head:'release/4.1.0',sameRepository:true}),true);
  assert.equal(checkPackagePr({base:'main',head:'hotfix/bug',sameRepository:true}),true);
  for (const head of ['develop','feature/change','fix/bug']) assert.equal(checkPackagePr({base:'main',head,sameRepository:true}),false);
  assert.equal(checkPackagePr({base:'main',head:'release/4.1.0',sameRepository:false}),false);
});

test('maintainer instructions are rejected without removing legitimate bootstrap templates', () => {
  const text = Buffer.from('ordinary content');
  assert.doesNotThrow(() => assertRuntimeFile('skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md', text));
  for (const file of ['AGENTS.md','DEVELOPMENT.md','docs/AGENTS.md','skills/example/AGENTS.md','examples/assets/bootstrap/AGENTS.md','docs/agents.md','.github/workflows/run.yml']) {
    assert.throws(() => assertRuntimeFile(file,text), /MAINTAINER_INSTRUCTION_LEAK/);
  }
  assert.throws(() => assertRuntimeFile('docs/innocent.md',Buffer.from('<!-- AGM-MAINTAINER-ONLY -->')), /MAINTAINER_INSTRUCTION_LEAK/);
});

test('real archives retain version/bootstrap, separate hosts, exclude source governance and match checksums', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'agm-release-fixture-'));
  t.after(() => rm(temp,{recursive:true,force:true}));
  const sources = ['package.json','README.md','CHANGELOG.md','.gitignore','.agents','.claude-plugin','plugin.json','config','docs','examples','skills','plugins'];
  for (const source of sources) await cp(path.join(root,source),path.join(temp,source),{recursive:true});
  const git = (...args) => execFileSync('git',['-c',`safe.directory=${temp.replaceAll('\\','/')}`,...args],{cwd:temp,encoding:'utf8',stdio:'pipe'}).trim();
  git('init','--initial-branch=main');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture baseline');
  const pkg = JSON.parse(await readFile(path.join(temp,'package.json')));
  const publicationRef = pkg.version.includes('-rc.') ? `release/${pkg.version.split('-')[0]}` : 'main';
  // Fixture state is independent of whether the real source notes have been finalized.
  const fixtureNotesPath = path.join(temp,'CHANGELOG.md');
  const fixtureNotes = (await readFile(fixtureNotesPath,'utf8')).split(/\r?\n/);
  const fixtureHeading = fixtureNotes.findIndex(line=>line.startsWith(`## ${pkg.version} `));
  assert.ok(fixtureHeading >= 0);
  fixtureNotes[fixtureHeading] = fixtureNotes[fixtureHeading].replace(' (unreleased)','') + ' (unreleased)';
  await writeFile(fixtureNotesPath,fixtureNotes.join('\n'));
  // Deliberately present source-only material; the allowlist must not distribute it.
  await writeFile(path.join(temp,'AGENTS.md'),'<!-- AGM-MAINTAINER-ONLY -->');
  await writeFile(path.join(temp,'DEVELOPMENT.md'),'<!-- AGM-MAINTAINER-ONLY -->');
  await writeFile(path.join(temp,'docs/DEVELOPMENT.md'),'<!-- AGM-MAINTAINER-ONLY -->');
  const result = await buildRelease(temp);
  assert.equal(result.sourceDirty,true);
  const catalog = JSON.parse(await readFile(path.join(result.output,'release.json')));
  assert.equal(catalog.tag,null);assert.equal(catalog.status,'local-preview');
  const sums = await readFile(path.join(result.output,'SHA256SUMS'),'utf8');
  for (const line of sums.trim().split('\n')) {
    const [expected,file] = line.split('  ');
    assert.equal(hash(await readFile(path.join(result.output,file))),expected);
  }
  for (const artifact of catalog.artifacts) {
    const extracted = path.join(temp,`extracted-${artifact.host}`);
    await mkdir(extracted);
    execFileSync('tar',['-xzf',path.join(result.output,artifact.archive),'-C',extracted]);
    for (const file of artifact.files) assert.equal(hash(await readFile(path.join(extracted,file.path))),file.sha256,file.path);
    const paths = artifact.files.map(f=>f.path);
    assert.ok(!paths.some(p=>/(^|\/)(DEVELOPMENT\.md|tools|tests|\.github|\.git)(\/|$)/.test(p)));
    assert.ok(!paths.includes('AGENTS.md'));
    const agents = paths.filter(p=>p.endsWith('/AGENTS.md'));
    assert.equal(agents.length,1);
    assert.match(agents[0],/\/assets\/bootstrap\/AGENTS\.md$/);
    assert.match(await readFile(path.join(extracted,agents[0]),'utf8'), new RegExp(`BOOTSTRAP VERSION: ${pkg.version.replaceAll('.','\\.')}`));
    const manifest = JSON.parse(await readFile(path.join(extracted,'package.json')));
    assert.equal(manifest.version,pkg.version);assert.equal(manifest.scripts,undefined);
    assert.equal(paths.some(p=>p.endsWith('hooks/codex-hooks.json')),artifact.host === 'codex');
    assert.equal(paths.some(p=>p.endsWith('hooks/claude-hooks.json')),artifact.host === 'claude');
    assert.equal(paths.includes('plugin.json'),artifact.host === 'antigravity');
    assert.equal(paths.some(p=>p.endsWith('/.codex-plugin/plugin.json')),artifact.host === 'codex');
    assert.equal(paths.some(p=>p.endsWith('/.claude-plugin/plugin.json')),artifact.host === 'claude');
    await rm(extracted,{recursive:true,force:true});
  }
  // A dirty source cannot be stamped as a publication build, even on main.
  const before = await readdir(path.join(temp,'dist'));
  await assert.rejects(buildRelease(temp,{publication:true,expectedVersion:pkg.version,ref:publicationRef}),/RELEASE_DIRTY_SOURCE/);
  assert.deepEqual(await readdir(path.join(temp,'dist')),before);
  git('add','--',...sources,'AGENTS.md','DEVELOPMENT.md');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture source');
  git('update-ref',`refs/remotes/origin/${publicationRef}`,'HEAD');
  const options = {publication:true,expectedVersion:pkg.version,ref:publicationRef};
  await assert.rejects(buildRelease(temp,options),/RELEASE_NOTES_NOT_FINAL/);
  const changelogPath = path.join(temp,'CHANGELOG.md');
  await writeFile(changelogPath,(await readFile(changelogPath,'utf8')).replace(' (unreleased)',''));
  git('add','--','CHANGELOG.md');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture final notes');
  await assert.rejects(buildRelease(temp,options),/RELEASE_SOURCE_REF_MISMATCH/);
  git('update-ref',`refs/remotes/origin/${publicationRef}`,'HEAD');
  const ignoredPayload = path.join(temp,'skills/agrimap-agent-skills/untracked.log');
  await writeFile(ignoredPayload,'ignored file must not enter a published build');
  await assert.rejects(buildRelease(temp,options),/RELEASE_UNTRACKED_PAYLOAD/);
  await rm(ignoredPayload);
  const ready = await buildRelease(temp,options);
  const publishedCatalog = JSON.parse(await readFile(path.join(ready.output,'release.json')));
  assert.equal(publishedCatalog.tag,`v${pkg.version}`);
  assert.equal(publishedCatalog.sourceDirty,false);
  assert.equal(publishedCatalog.sourceSha,git('rev-parse','HEAD'));
  assert.equal(publishedCatalog.status,'publication-build');
  git('tag',`v${pkg.version}`);
  await assert.rejects(buildRelease(temp,options),/RELEASE_VERSION_ALREADY_EXISTS/);
  const injected = path.join(temp,'skills/agrimap-agent-skills/references/AGENTS.md');
  await writeFile(injected,'unexpected instructions');
  await assert.rejects(runtimePlan(temp,'codex'),/MAINTAINER_INSTRUCTION_LEAK/);
  await rm(injected);
  await rename(path.join(temp,'docs'),path.join(temp,'real-docs'));
  await symlink(path.join(temp,'real-docs'),path.join(temp,'docs'),process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(runtimePlan(temp,'antigravity'),/DISTRIBUTION_SYMLINK/);
});
