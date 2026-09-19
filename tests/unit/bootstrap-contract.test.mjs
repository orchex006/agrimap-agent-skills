import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {projectRoot} from '../helpers/harness.mjs';

test('bootstrap preserves the complete owner-submitted canonical contract',async()=>{
  const bundle=path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap');
  const bytes=await readFile(path.join(bundle,'AGENTS.md'));
  // Approved source: owner submit 2026-09-08, revisions 2026-09-09, and owner-requested
  // same-directory branch freshness / confirmed requester reuse revision 2026-09-10. Updating this hash
  // requires an intentional new canonical contract, not a formatting repair.
  // 4.6.0: Agent Collaboration Governance §10 team workflow, policy/local allowlist, per-execution logs (spec ACG v2.1 §13, §19.16).
  // 4.8.0: instruction diet — §2 (full), §4–§8 moved verbatim to AGENTS.release.md; core keeps a short §2
  // plus the owner-answered precedence sentence (Q-4.8.0-02).
  // Package bumps only change the generated version marker; freeze every other byte.
  const sourceBytes=Buffer.from(bytes.toString('utf8').replace(/<!-- AGRIMAP BOOTSTRAP VERSION: [^>]+ -->/,'<!-- AGRIMAP BOOTSTRAP VERSION: 3.6.1 -->'));
  assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),'99c9aca77d09b52b029f770bbd9a65b77ab615fc358b73f592299ef60da97c4c');
  const manifest=JSON.parse(await readFile(path.join(bundle,'manifest.json'),'utf8'));
  assert.ok(bytes.toString('utf8').includes(`<!-- AGRIMAP BOOTSTRAP VERSION: ${manifest.version} -->`));
  assert.equal(manifest.files.find(f=>f.source==='AGENTS.md').sha256,createHash('sha256').update(bytes).digest('hex'));
  for(const file of ['CLAUDE.md','GEMINI.md','CURSOR.md']){
    const pointer=await readFile(path.join(bundle,file),'utf8');
    assert.match(pointer,/@(?:\.\/)?AGENTS\.md/);
    assert.ok(pointer.split(/\r?\n/).length<12,'Keep the host file a thin pointer');
  }
});

test('release stages synchronize stale local branches and re-evaluate in one invocation',async()=>{
  const references=path.join(projectRoot,'skills/agrimap-agent-skills/references');
  const steps=await readFile(path.join(references,'release-steps.md'),'utf8');
  const workflow=await readFile(path.join(references,'release-workflow.md'),'utf8');
  assert.match(steps,/Synchronize only the branch needed by the current stage with its remote using fast-forward-only semantics/);
  assert.match(steps,/continue the same invocation instead of reporting the stale pre-sync mismatch/);
  assert.match(steps,/Do not advance jenkins-release from jenkins\/develop merely to perform this readiness check/);
  assert.match(steps,/Remote divergence remains a blocker/);
  assert.match(workflow,/Before each stage, fetch and fast-forward-only synchronize the stage's local branch with its remote/);
  assert.match(workflow,/materially changed remote candidate, destination or tag requires a revised plan and confirmation/);
  assert.match(workflow,/Do not clone the product, add a worktree/);
  assert.match(workflow,/For behind-only branches, in this same directory/);
  assert.match(workflow,/Local-only prepare never gains commit authority/);
  assert.match(workflow,/Feature and hotfix starting branches/);
  assert.doesNotMatch(workflow,/autonomously establish isolated|use an isolated develop worktree\/clone/);
});


test('operation policy reaches every first-read adapter without leaking to unrelated skills', async()=>{
  const {renderAliasSkill,renderAntigravitySkill,renderGeminiCommandPrompt,renderOperationEntrypoint,operationConfigIssues}=await import('../../tools/operation-entrypoints.mjs');
  const config=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8'));
  const release=config.operations.find(item=>item.operation==='release');
  assert.ok(release.entrypointPolicy, 'Release authority must be available before reference loading');
  const renderers=[renderAliasSkill,renderAntigravitySkill,renderGeminiCommandPrompt,renderOperationEntrypoint];
  for(const render of renderers){
    const output=render(release);
    assert.ok(output.includes(release.entrypointPolicy));
    const revised={...release,entrypointPolicy:'Owner supplied replacement policy'};
    assert.ok(render(revised).includes(revised.entrypointPolicy));
    assert.ok(!render(revised).includes(release.entrypointPolicy));
    const unrelated=config.operations.find(item=>item.operation!=='release');
    assert.ok(!render(unrelated).includes(release.entrypointPolicy));
  }
  const distributed=[
    'skills/agm-release.md',
    'plugins/agrimap-agent-skills/skills/agm-release/SKILL.md',
    'skills/agrimap-agent-skills/references/operations/release.md',
    'commands/agm-release.toml'
  ];
  for(const file of distributed) assert.ok((await readFile(path.join(projectRoot,file),'utf8')).includes(release.entrypointPolicy),file);
  const invalid=structuredClone(config);
  invalid.operations.find(item=>item.operation==='release').entrypointPolicy=42;
  assert.ok(operationConfigIssues(invalid).some(issue=>issue.includes('entrypointPolicy')));
});

test('4.6.0 template adds team workflow, policy allowlist, per-execution logs and keeps the 4.5.5 hash',async()=>{
  const bundle=path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap');
  const text=await readFile(path.join(bundle,'AGENTS.md'),'utf8');
  assert.match(text,/^## 10\. Team workflow/m);
  assert.match(text,/^### 10\.5 /m);
  assert.match(text,/`\.agrimap-agent\/policy\/\*\*`/);
  assert.match(text,/`\.agrimap-agent\/local\/\*\*` เป็นความจำเฉพาะเครื่อง/);
  assert.match(text,/logs\/YYYY-MM\/YYYY-MM-DD\/<RUN_ID>\.jsonl/);
  assert.match(text,/^\| `integrate`: /m);
  assert.match(await readFile(path.join(bundle,'AGENTS.release.md'),'utf8'),/\| `integrate` \|/);
  const manifest=JSON.parse(await readFile(path.join(bundle,'manifest.json'),'utf8'));
  const previous=manifest.files.find(f=>f.source==='AGENTS.md').previous;
  assert.deepEqual(previous.find(p=>p.version==='4.5.5'),{version:'4.5.5',sha256:'195f3134fc9e6eb1c0ae707b6f7762f87b3508a8046cdb8722da373d3742d5f6'});
});

test('instruction diet: core AGENTS.md at most 24,000 chars; core + release keep every heading; release file frozen (AC28)',async()=>{
  const bundle=path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap');
  const core=await readFile(path.join(bundle,'AGENTS.md'),'utf8');
  const release=await readFile(path.join(bundle,'AGENTS.release.md'),'utf8');
  assert.ok(core.length<=24000,String(core.length));
  const manifest=JSON.parse(await readFile(path.join(bundle,'manifest.json'),'utf8'));
  assert.ok(release.includes(`<!-- AGRIMAP BOOTSTRAP VERSION: ${manifest.version} -->`));
  const entry=manifest.files.find(f=>f.source==='AGENTS.release.md');
  assert.equal(entry.target,'AGENTS.release.md');assert.equal(entry.sha256,createHash('sha256').update(release).digest('hex'));
  const frozen=release.replace(/<!-- AGRIMAP BOOTSTRAP VERSION: [^>]+ -->/,'<!-- AGRIMAP BOOTSTRAP VERSION: 3.6.1 -->');
  assert.equal(createHash('sha256').update(frozen).digest('hex'),'804c0fb5421fc0184920cd0eeb14b69e7f3c111d8ea0c0a13f510e77467ad1f5');
  const headings=['## 1.','## 2.','### 2.1','### 2.2','### 2.3','## 3.','## 4.','## 5.','### 5.1','### 5.2','## 6.','### 6.1','### 6.2','### 6.3','## 7.','## 8.','### 8.1','## 9.','### 9.1','### 9.5','## 10.','### 10.5','## Bootstrap contract freshness'];
  const all=(core+'\n'+release).split('\n');
  for(const h of headings)assert.ok(all.some(line=>line.startsWith(h)),h);
  assert.match(core,/อ่าน `AGENTS\.release\.md` ทั้งไฟล์ก่อนเริ่ม/);
  for(const moved of ['## 4.','## 5.','## 6.','## 7.','## 8.'])assert.ok(!core.split('\n').some(line=>line.startsWith(moved)),moved);
});

test('upgrade from the 4.7.0 template: unmodified AGENTS.md updates, edited one needs a scoped merge, release file is created',async t=>{
  const {createHarness}=await import('../helpers/harness.mjs');
  const {planBootstrap}=await import('../../skills/agrimap-agent-skills/scripts/project-bootstrap.mjs');
  const {writeFile}=await import('node:fs/promises');
  const h=await createHarness('agm-diet-');t.after(()=>h.cleanup());
  const old=await readFile(path.join(projectRoot,'tests/fixtures/bootstrap-4.7.0/AGENTS.md'));
  await writeFile(path.join(h.temp,'AGENTS.md'),old);
  let plan=await planBootstrap({target:h.temp,kind:'be-main'});
  const status=target=>plan.entries.find(e=>e.target===target).status;
  assert.equal(status('AGENTS.md'),'update');assert.equal(status('AGENTS.release.md'),'create');
  assert.equal(plan.entries.find(e=>e.target==='AGENTS.md').previousVersion,'4.7.0');
  await writeFile(path.join(h.temp,'AGENTS.md'),Buffer.concat([old,Buffer.from('\nProject rule: keep custom naming.\n')]));
  plan=await planBootstrap({target:h.temp,kind:'be-main'});
  assert.equal(status('AGENTS.md'),'conflict');assert.equal(status('AGENTS.release.md'),'create');
});
