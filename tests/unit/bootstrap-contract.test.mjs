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
  // 4.9.3: owner-requested §0 skill-first routing, §10.6 team commit style and release §8.2 Release Description.
  // 4.9.5: owner-requested intent x lane routing; §0 is generated from assets/skill-routing.json, heading renamed,
  // host recording example compacted to stay within the 24,000-character diet.
  // 4.9.6: owner-requested mandatory §10.6 team commit style for every Agent commit (guard G7).
  // 4.9.8: owner-requested Thai commit descriptions (§10.6) and the --flash read scope in §2.
  // 4.9.9: owner-requested non-blocking bootstrap auto-merge and technical terms kept as-is in §10.6.
  // Package bumps only change the generated version marker; freeze every other byte.
  const sourceBytes=Buffer.from(bytes.toString('utf8').replace(/<!-- AGRIMAP BOOTSTRAP VERSION: [^>]+ -->/,'<!-- AGRIMAP BOOTSTRAP VERSION: 3.6.1 -->'));
  assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),'ec81abd2af7d35997df67e434558363c52564d8a58198083314ac2bf2aa2e527');
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
  // 4.9.6 owner request: release gathers finished work branches into develop (M) instead of leaving them out.
  assert.match(workflow,/### Finished work branches \(M\)/);
  assert.match(steps,/\| release production \| R → M → I → P/);
  assert.doesNotMatch(workflow,/do not automatically commit\/push feature/);
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
  assert.equal(createHash('sha256').update(frozen).digest('hex'),'f3dd7b9fa55cfbab71367ea310638f7ed041412f1a8092c04943c0d195797cd7');
  const headings=['## 0.','## 1.','## 2.','### 2.1','### 2.2','### 2.3','## 3.','## 4.','## 5.','### 5.1','### 5.2','## 6.','### 6.1','### 6.2','### 6.3','## 7.','## 8.','### 8.1','## 9.','### 9.1','### 9.5','## 10.','### 10.5','## Bootstrap contract freshness'];
  const all=(core+'\n'+release).split('\n');
  for(const h of headings)assert.ok(all.some(line=>line.startsWith(h)),h);
  assert.match(core,/อ่าน `AGENTS\.release\.md` ทั้งไฟล์ก่อนเริ่ม/);
  for(const moved of ['## 4.','## 5.','## 6.','## 7.','## 8.'])assert.ok(!core.split('\n').some(line=>line.startsWith(moved)),moved);
});

test('upgrade from the 4.7.0 template: unmodified AGENTS.md updates, an edited one merges automatically (4.9.9), release file is created',async t=>{
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
  assert.equal(status('AGENTS.md'),'merge');assert.equal(status('AGENTS.release.md'),'create');assert.equal(plan.ok,true);
  assert.equal(plan.entries.find(e=>e.target==='AGENTS.md').autoMerge.preserved,1);
});

test('managed bootstrap tool file is always replaced with a backup, never a merge conflict (4.9.3)',async t=>{
  const {createHarness}=await import('../helpers/harness.mjs');
  const {planBootstrap,applyBootstrap}=await import('../../skills/agrimap-agent-skills/scripts/project-bootstrap.mjs');
  const {mkdir,writeFile}=await import('node:fs/promises');
  const h=await createHarness('agm-managed-');t.after(()=>h.cleanup());
  const target='tools/agrimap/release-notify.mjs';
  await mkdir(path.join(h.temp,'tools/agrimap'),{recursive:true});
  await writeFile(path.join(h.temp,target),'// local edit\n');
  const plan=await planBootstrap({target:h.temp,kind:'be-main'});
  assert.equal(plan.entries.find(e=>e.target===target).status,'update');
  const applied=await applyBootstrap({target:h.temp,kind:'be-main'});
  assert.equal(applied.applied,true);
  const bundle=await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/release-notify.mjs'));
  assert.deepEqual(await readFile(path.join(h.temp,target)),bundle);
  const beforeHash=plan.entries.find(e=>e.target===target).beforeHash;
  assert.equal((await readFile(path.join(h.temp,'.agrimap-agent/runtime/bootstrap-backups',beforeHash,target),'utf8')),'// local edit\n');
});

test('release-notify: short Release Description payload with related projects; unhealthy never POSTs; healthy send posts once (4.9.3)',async t=>{
  const {createHarness}=await import('../helpers/harness.mjs');
  const {spawn}=await import('node:child_process');
  const {mkdir,writeFile}=await import('node:fs/promises');
  const http=await import('node:http');
  const h=await createHarness('agm-notify-');t.after(()=>h.cleanup());
  const script=path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/release-notify.mjs');
  const repo=path.join(h.temp,'agmwa-demo-ng');await mkdir(repo);
  await writeFile(path.join(repo,'desc.md'),['# agmwa-demo-ng / 1.4.2','','- เพิ่มการเข้าสู่ระบบด้วย ThaiD','- ปรับขั้นตอนเข้าสู่ระบบ (เกี่ยวข้อง: agmws-identity-netcore, @agrimap/auth-client)','- '+'ก'.repeat(600)].join(String.fromCharCode(10)));
  const env={...process.env,NOTIFY_WEBHOOK_URL:'',NOTIFY_HEALTH_URL:'',HOME:h.temp,USERPROFILE:h.temp};
  // Async spawn: the in-process test server must keep serving while the script runs.
  const run=(args,extra={})=>new Promise(resolve=>{const child=spawn(process.execPath,[script,...args],{cwd:repo,env:{...env,...extra}});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('close',status=>resolve({status,stdout,stderr}));});
  const preview=await run(['send','--description','desc.md','--environment','Production','--preview']);
  assert.equal(preview.status,0,preview.stdout+preview.stderr);
  const payload=JSON.parse(preview.stdout).payload;
  assert.deepEqual(Object.keys(payload).sort(),['environment','items','projectName','version']);
  assert.equal(payload.projectName,'agmwa-demo-ng');assert.equal(payload.version,'1.4.2');assert.equal(payload.items.length,3);
  assert.deepEqual(payload.items[0],{text:'เพิ่มการเข้าสู่ระบบด้วย ThaiD',relatedProjects:[]});
  assert.deepEqual(payload.items[1],{text:'ปรับขั้นตอนเข้าสู่ระบบ',relatedProjects:['agmws-identity-netcore','@agrimap/auth-client']});
  assert.equal(payload.items[2].text.length,500,'items are clipped to the service limit');
  // 4.9.9: a machine without the URL gets a ready question, standard URL first (Windows reads the user registry, so check off Windows).
  if(process.platform!=='win32'){
    const missing=await run(['send','--description','desc.md']);
    assert.equal(missing.status,2);const question=JSON.parse(missing.stdout).question;
    assert.equal(question.options[0].description,'https://appserv2.cdg.co.th/agrimap-notify/release-description');
    assert.match(question.options[0].command,/set-url https:\/\/appserv2\.cdg\.co\.th\/agrimap-notify\/release-description$/);
  }
  assert.match(await readFile(script,'utf8'),/question: missingUrlQuestion/);
  let healthy=false;const posts=[];
  const server=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
    if(req.method==='POST')posts.push({url:req.url,body:JSON.parse(body)});
    res.statusCode=req.url.endsWith('/healthz')?(healthy?200:503):200;res.end('{"status":"accepted_by_webhook"}');});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port+'/agrimap-notify/release-description';
  const unhealthy=await run(['send','--description','desc.md','--url',url]);
  assert.equal(unhealthy.status,3);assert.equal(JSON.parse(unhealthy.stdout).sent,false);assert.deepEqual(posts,[]);
  assert.ok(JSON.parse(unhealthy.stdout).health.healthUrl.endsWith('/agrimap-notify/healthz'));
  healthy=true;
  const sent=await run(['send','--description','desc.md','--url',url]);
  assert.equal(sent.status,0,sent.stdout);assert.equal(JSON.parse(sent.stdout).sent,true);
  assert.equal(posts.length,1);assert.equal(posts[0].url,'/agrimap-notify/release-description');assert.equal(posts[0].body.items.length,3);
});

test('release production/full and promote always push the Production tag and send the Release Description (4.9.8)',async()=>{
  const bundle=path.join(projectRoot,'skills/agrimap-agent-skills');
  const release=await readFile(path.join(bundle,'assets/bootstrap/AGENTS.release.md'),'utf8');
  const section=(from,to)=>release.slice(release.indexOf(from),release.indexOf(to,release.indexOf(from)));
  assert.match(release,/`release production`, `release full` และ `promote` เทียบเท่า `Version \+ Tags` เสมอ/);
  assert.match(section('## 7. Production annotated tag','## 8.'),/คำสั่ง agm-release `release production`, `release full`, `promote`/);
  const notify=section('### 8.2','- **Release Description**');
  assert.match(notify,/`promote` ทุกครั้งที่ Production tag checkpoint ผ่าน/);
  assert.doesNotMatch(notify,/`promote` และกลุ่ม A\/B ไม่ส่ง/);
  assert.match(release,/bootstrap ที่ใหม่กว่า\*\*ไม่ขวาง\*\* promote\/tag\/notify/);
  const steps=await readFile(path.join(bundle,'references/release-steps.md'),'utf8');
  assert.match(steps,/\| promote \| R → V → check recorded D\/J → Q → C → T → M → F → N \|/);
  assert.match(await readFile(path.join(bundle,'references/release-notify.md'),'utf8'),/and `promote`, every time the Production tag checkpoint/);
  const operations=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8')).operations;
  assert.equal(operations.find(item=>item.name==='agm-release').conditionalReferences.find(item=>item.path==='release-notify.md').when,'release production|full or promote');
});

test('a customized AGENTS.md merges automatically: template updated, project rules kept, idempotent, never blocking (4.9.9)',async t=>{
  const {createHarness}=await import('../helpers/harness.mjs');
  const {planBootstrap,applyBootstrap,mergeTemplate}=await import('../../skills/agrimap-agent-skills/scripts/project-bootstrap.mjs');
  const {writeFile}=await import('node:fs/promises');
  const h=await createHarness('agm-merge-');t.after(()=>h.cleanup());
  const old=(await readFile(path.join(projectRoot,'tests/fixtures/bootstrap-4.7.0/AGENTS.md'),'utf8')).replaceAll('\r\n','\n');
  const heading=old.split('\n').find(line=>line.startsWith('## 10.'));
  const custom=old.replace(heading,heading+'\n\n- กติกาของทีม: ตั้งชื่อ endpoint เป็น kebab-case')+'\n## กติกาเฉพาะ project\n\n- deploy วันศุกร์ต้องแจ้งหัวหน้าทีม\n';
  await writeFile(path.join(h.temp,'AGENTS.md'),custom);
  const plan=await planBootstrap({target:h.temp,kind:'be-main'});
  const entry=plan.entries.find(e=>e.target==='AGENTS.md');
  assert.equal(entry.status,'merge');assert.equal(plan.ok,true);
  const applied=await applyBootstrap({target:h.temp,kind:'be-main'});
  assert.equal(applied.applied,true);assert.deepEqual(applied.pending,[]);
  const merged=await readFile(path.join(h.temp,'AGENTS.md'),'utf8');
  const template=await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md'),'utf8');
  const manifest=JSON.parse(await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/manifest.json'),'utf8'));
  assert.ok(merged.includes(`<!-- AGRIMAP BOOTSTRAP VERSION: ${manifest.version} -->`),'marker is the new version');
  assert.ok(merged.includes('ตั้งชื่อ endpoint เป็น kebab-case'));assert.ok(merged.includes('deploy วันศุกร์ต้องแจ้งหัวหน้าทีม'));
  assert.ok(merged.includes('## 10.6'),'new template sections arrive');
  assert.equal(merged.split('BEGIN PROJECT CUSTOM').length-1,2);
  assert.equal(mergeTemplate(merged,template,new Set(JSON.parse(await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/template-lines.json'),'utf8')).files['AGENTS.md'])).content,merged,'idempotent');
  const again=await planBootstrap({target:h.temp,kind:'be-main'});
  assert.equal(again.entries.find(e=>e.target==='AGENTS.md').status,'unchanged');
  const backups=await readFile(path.join(h.temp,'.agrimap-agent/runtime/bootstrap-backups',entry.beforeHash,'AGENTS.md'),'utf8');
  assert.equal(backups,custom,'backup kept');
});
