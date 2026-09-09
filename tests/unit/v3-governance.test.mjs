import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,readFile,readdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {selectWorkflow,classifyRequest,instructionProfile,verificationDecision,sqlContextToolAllowed,validateReadQuery} from '../../skills/agrimap-agent-skills/scripts/governance-policy.mjs';
import {normalizeIdentity,confirmationExpiry} from '../../skills/agrimap-agent-skills/scripts/identity.mjs';
import {createPromptVersion} from '../../skills/agrimap-agent-skills/scripts/agm-prompt-version.mjs';
import {planBootstrap,applyBootstrap} from '../../skills/agrimap-agent-skills/scripts/project-bootstrap.mjs';

const present = p => stat(p).then(()=>true,()=>false);
async function fixture(t){const h=await createHarness('agrimap-v3-');t.after(()=>h.cleanup());return h;}
const body = detail => `# Prompt Result\n\n## Main Assignment\n${detail}\n\n## Subagent Assignments\nNone — Main owns all work\n\n## Acceptance Criteria\nObserved requested outcome.\n\n## Deviation and Handoff Contract\nPreserve scope.\n`;

test('questions do not initialize a workspace, require identity, or create tasks',async t=>{
 const h=await fixture(t);
 for(const operation of ['analyze','history','qa','design']){
  if(operation==='history')continue;
  const result=h.run(h.scripts.workspace,['start','--operation',operation,'--title','Explain this code']);
  assert.equal(result.started,false);
 }
 assert.equal(await present(path.join(h.temp,'.agrimap-agent')),false);
});
test('risk and real tracking select depth; model scaffolding is independent',()=>{
 assert.equal(selectWorkflow({operation:'analyze'}).depth,null);
 assert.equal(selectWorkflow({operation:'execute'}).depth,'light');
 assert.equal(selectWorkflow({operation:'execute',tracking:true}).depth,'standard');
 assert.equal(selectWorkflow({operation:'execute',risk:'public-contract-change'}).depth,'regulated');
 assert.throws(()=>selectWorkflow({operation:'execute',depth:'regulated'}),/WORKFLOW_DEPTH_REASON_MISMATCH/);
 assert.throws(()=>selectWorkflow({operation:'execute',tracking:true,depth:'light'}),/WORKFLOW_DEPTH_REASON_MISMATCH/);
 assert.deepEqual(instructionProfile({model:'unknown-new-model'}),{profile:'guided',model:'unknown-new-model',changesAuthority:false});
 assert.equal(verificationDecision({kind:'discussion'}),'none');
 assert.equal(verificationDecision({kind:'docs'}),'structure-and-links');
 assert.equal(verificationDecision({behaviorChanged:true,evidenceMatches:true}),'reuse-matching-evidence');
});
test('identity remains confirmed without daily expiry and is reused only locally',async t=>{
 const h=await fixture(t);
 const saved=h.run(h.scripts.workspace,['identify','--session','one','--owner','006006','--model','actual-model','--provider','codex']);
 assert.equal(saved.identity.expiresAt,null);
 assert.equal(confirmationExpiry(new Date().toISOString()),null);
 assert.equal(normalizeIdentity(saved.identity,{nowMs:Date.now()+365*86400000}).expired,false);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/tasks')),false);
 const started=h.run(h.scripts.workspace,['start','--session','two','--operation','execute','--title','Bounded fix']);
 assert.equal(started.activeTask.requestedBy,'006006');
 assert.equal(started.activeTask.taskId,null);
 assert.equal(started.activeTask.requesterAuthority,'unknown');
});
test('light completion derives null taskId and creates no report or task tree',async t=>{
 const h=await fixture(t);
 h.run(h.scripts.workspace,['identify','--session','one','--owner','006006']);
 const a=h.run(h.scripts.workspace,['start','--session','one','--operation','execute','--title','Bounded fix']).activeTask;
 h.run(h.scripts.workspace,['checkpoint','--session','one','--execution',a.executionId,'--event','verified','--summary','Observed expected behavior','--verification','targeted assertion passed']);
 const result=h.run(h.scripts.workspace,['complete','--session','one','--execution',a.executionId]);
 assert.equal(result.ok,true);assert.equal(result.report,null);
 assert.equal(h.run(h.scripts.workspace,['validate','--execution',a.executionId]).ok,true);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/tasks')),false);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/reports')),false);
});
test('tracked work uses one useful task and rejects premature/failed closure',async t=>{
 const h=await fixture(t);
 h.run(h.scripts.workspace,['identify','--session','one','--owner','006006']);
 const a=h.run(h.scripts.workspace,['start','--session','one','--operation','execute','--tracking','--title','Implement two dependent slices']).activeTask;
 const dir=path.join(h.temp,'.agrimap-agent',a.taskPath);
 assert.deepEqual(await readdir(dir),['task.md']);
 assert.equal(h.spawn(h.scripts.workspace,['complete','--session','one','--execution',a.executionId]).status,1);
 await writeFile(path.join(dir,'task.md'),'# Task\n- [x] Both slices verified\n\n## Result\nImplemented and verified both requested slices.\n');
 await writeFile(path.join(dir,'result.md'),'# Requested optional result\nEvidence for a real consumer.\n');
 h.run(h.scripts.workspace,['checkpoint','--session','one','--execution',a.executionId,'--event','verified','--status','failed','--summary','Regression fails']);
 assert.equal(h.spawn(h.scripts.workspace,['complete','--session','one','--execution',a.executionId]).status,1);
 h.run(h.scripts.workspace,['checkpoint','--session','one','--execution',a.executionId,'--event','verified','--status','passed','--summary','Regression passes after correction','--verification','targeted regression passed']);
 const done=h.run(h.scripts.workspace,['complete','--session','one','--execution',a.executionId]);assert.equal(done.ok,true);
 assert.equal(h.run(h.scripts.workspace,['validate','--execution',a.executionId]).ok,true);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/tasks/complete',a.period,a.taskId,'task.md')),true);
 const history=h.run(h.scripts.workspace,['history','--requester','006006']);assert.equal(history.ok,true);
});
test('unrelated conversation and quoted aliases are not activation',()=>{
 assert.equal(classifyRequest({recognized:true,prompt:'วันนี้กินอะไรดี'}).active,false);
 assert.equal(classifyRequest({recognized:true,prompt:'ช่วยวิเคราะห์โค้ด service นี้'}).active,true);
 assert.equal(classifyRequest({recognized:false,prompt:'ช่วยวิเคราะห์โค้ด service นี้'}).active,false);
 assert.equal(classifyRequest({recognized:false,prompt:'อธิบาย `$agm-be`'}).active,false);
 assert.equal(classifyRequest({recognized:true,prompt:'What is a release in music?'}).active,false);
 for(const prompt of ['What does customer service mean?','What is a branch?','Explain SQL joins','What is a dress code?']) assert.equal(classifyRequest({recognized:true,prompt}).active,false,prompt);
 assert.equal(classifyRequest({recognized:true,prompt:'Example: $agm-be'}).active,false);
});
test('hooks stay silent for SessionStart and unrelated prompts despite active state',async t=>{
 const h=await fixture(t);const root=path.join(h.temp,'agrimap-example');await mkdir(root);
 await mkdir(path.join(root,'.agrimap-agent/runtime/active'),{recursive:true});
 await writeFile(path.join(root,'.agrimap-agent/runtime/active/one.json'),JSON.stringify({executionId:'old',requestedBy:'006006'}));
 for(const input of [{hook_event_name:'SessionStart'}, ...['วันนี้กินอะไรดี','What is a release in music?','What does customer service mean?','Explain SQL joins','Example: $agm-be'].map(prompt=>({hook_event_name:'UserPromptSubmit',prompt}))]){
  const result=h.run(h.scripts.hook,['--provider','codex'],{...input,cwd:root,session_id:'one'});
  assert.equal(result.hookSpecificOutput,undefined);
 }
 assert.equal(await present(path.join(root,'.agrimap-agent/prompts')),false);
});
test('relevant Gemini submit retries archive once without mixing AI output',async t=>{
 const h=await fixture(t);const root=path.join(h.temp,'agrimap-example');await mkdir(root);
 const input={cwd:root,session_id:'one',hook_event_name:'BeforeAgent',prompt:'ช่วยอธิบายโค้ดในโครงการ',prompt_id:'submit-1'};
 h.run(h.scripts.hook,['--provider','gemini'],input);h.run(h.scripts.hook,['--provider','gemini'],input);
 const periods=await readdir(path.join(root,'.agrimap-agent/prompts'));
 const text=await readFile(path.join(root,'.agrimap-agent/prompts',periods[0],'one/history.md'),'utf8');
 assert.equal(text.split(input.prompt).length-1,1);assert.equal(text.includes('Confirmed requester'),false);
});
test('prompt explanation/no-op does not create versions; revisions need source evidence',async t=>{
 const h=await fixture(t);const opts={cwd:h.temp,conversationId:'one',context:'feature',requester:'006006',provider:'codex',model:'actual'};
 assert.equal((await createPromptVersion({...opts,intent:'explain'})).created,false);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent')),false);
 const first=await createPromptVersion({...opts,body:body('Add bounded feature')});
 await assert.rejects(()=>createPromptVersion({...opts,intent:'typo',body:body('Wrong intent')}),{code:'INVALID_PROMPT_INTENT'});
 const approval=await createPromptVersion({...opts,intent:'approve'});
 assert.equal(approval.created,false);assert.equal(approval.path,first.path);assert.equal(approval.sha256,first.sha256);assert.equal(approval.approvalRecorded,false);
 const before=await readFile(path.join(h.temp,first.path));
 assert.equal((await createPromptVersion({...opts,body:body('Add bounded feature')})).created,false);
 await assert.rejects(()=>createPromptVersion({...opts,body:body('Add feature and retries')}),{code:'PROMPT_CHANGE_EVIDENCE_REQUIRED'});
 const second=await createPromptVersion({...opts,body:body('Add feature and retries'),changeSummary:'Add retry bound',sourceEvidence:'Requester: retry at most three times'});
 assert.equal(second.version,2);assert.deepEqual(await readFile(path.join(h.temp,first.path)),before);
 assert.equal((await readdir(path.dirname(path.join(h.temp,first.path)))).filter(f=>f.endsWith('.md')).length,2);
});
test('SQL adapter allows bounded reads but rejects every database mutation route',()=>{
 assert.equal(sqlContextToolAllowed('sqlctx_query_data'),true);
 for(const tool of ['sqlctx_apply_routine_deployment','sqlctx_sync_context_index','sqlctx_apply_folder_classification','sqlctx_resolve_context_index'])assert.equal(sqlContextToolAllowed(tool),false);
 assert.equal(validateReadQuery('SELECT TOP (10) ID FROM dbo.T').ok,true);
 for(const sql of ['CREATE TABLE T (id int)','INSERT INTO T VALUES(1)','UPDATE T SET id=2','DELETE FROM T','DROP TABLE T','ALTER PROCEDURE p AS SELECT 1','EXEC p','SELECT * INTO X FROM T','SELECT 1; DELETE FROM T','SELECT * FROM OPENQUERY(server, \'DELETE\')'])assert.equal(validateReadQuery(sql).ok,false,sql);
});
test('bootstrap is exact, scoped, idempotent and preserves README/versions',async t=>{
 const h=await fixture(t);
 await writeFile(path.join(h.temp,'README.md'),'# Existing project\n\n## Swagger\nExisting API documentation.\n');
 await writeFile(path.join(h.temp,'Jenkinsfile'),"PROJECT_VERSION = '1.0.42'\n");
 const opts={target:h.temp,kind:'be-main'};const plan=await planBootstrap(opts);assert.equal(plan.ok,true);
 assert.equal(await present(path.join(h.temp,'AGENTS.md')),false);
 assert.equal((await applyBootstrap(opts)).applied,true);
 for(const file of ['AGENTS.md','GEMINI.md','CLAUDE.md','CURSOR.md','release-notes/README.md'])assert.deepEqual(await readFile(path.join(h.temp,file)),await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap',file)));
 const readme=await readFile(path.join(h.temp,'README.md'),'utf8');assert.ok(readme.includes('Existing API documentation.'));
 assert.match(readme,/push `jenkins` สำหรับ Inhouse/);
 assert.match(readme,/push `jenkins-release` สำหรับ Production/);
 const again=await applyBootstrap(opts);assert.ok(again.entries.every(e=>e.status==='unchanged'));
 assert.equal(await readFile(path.join(h.temp,'README.md'),'utf8'),readme);
 assert.equal(await readFile(path.join(h.temp,'Jenkinsfile'),'utf8'),"PROJECT_VERSION = '1.0.42'\n");
 for(const file of ['.gitignore','changelog.md','Jenkinsfile_Production','release-notes/1.0.0.md'])assert.equal(await present(path.join(h.temp,file)),false);
});
test('bootstrap conflicts do not overwrite or partially install',async t=>{
 const h=await fixture(t);await writeFile(path.join(h.temp,'AGENTS.md'),'User instructions\n');
 const r=await applyBootstrap({target:h.temp,kind:'be-main'});assert.equal(r.applied,false);
 assert.equal(await readFile(path.join(h.temp,'AGENTS.md'),'utf8'),'User instructions\n');
 assert.equal(await present(path.join(h.temp,'CLAUDE.md')),false);
 await assert.rejects(()=>planBootstrap({target:projectRoot,kind:'be-main'}),/PACKAGE_PRODUCT_BOOTSTRAP_FORBIDDEN/);
});
test('init only installs project documents on explicit bootstrap',async t=>{
 const h=await fixture(t);h.run(h.scripts.workspace,['init']);
 assert.equal(await present(path.join(h.temp,'AGENTS.md')),false);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/tasks')),false);
 h.run(h.scripts.workspace,['init','--bootstrap','--kind','fe-main']);
 assert.equal(await present(path.join(h.temp,'AGENTS.md')),true);
});


test('legacy 3.2.2 bootstrap upgrades with backup and preserves surrounding README',async t=>{
 const h=await fixture(t);
 const legacy=await readFile(path.join(projectRoot,'tests/fixtures/bootstrap-3.2.2/AGENTS.md'),'utf8');
 const block=await readFile(path.join(projectRoot,'tests/fixtures/bootstrap-3.2.2/deployment.md'),'utf8');
 await writeFile(path.join(h.temp,'AGENTS.md'),legacy.replaceAll('\n','\r\n'));
 await writeFile(path.join(h.temp,'README.md'),'# Custom title\n\n<!-- BEGIN AGRIMAP DEPLOYMENT -->\n'+block.trimEnd()+'\n<!-- END AGRIMAP DEPLOYMENT -->\n\n## Custom instructions\nKeep this.\n');
 const opts={target:h.temp,kind:'be-main'};
 const plan=await planBootstrap(opts);
 assert.equal(plan.installedVersion,null); assert.equal(plan.freshness,'update-required'); assert.equal(plan.ok,true);
 assert.equal(plan.entries.find(e=>e.target==='AGENTS.md').status,'update');
 const result=await applyBootstrap(opts);assert.equal(result.applied,true);
 const old=result.entries.find(e=>e.target==='AGENTS.md');
 assert.equal(await readFile(path.join(h.temp,'.agrimap-agent/runtime/bootstrap-backups',old.beforeHash,'AGENTS.md'),'utf8'),legacy.replaceAll('\n','\r\n'));
 const text=await readFile(path.join(h.temp,'AGENTS.md'),'utf8');assert.ok(text.includes('AGRIMAP BOOTSTRAP VERSION: '+result.version));
 const readme=await readFile(path.join(h.temp,'README.md'),'utf8');assert.ok(readme.startsWith('# Custom title'));assert.ok(readme.endsWith('Keep this.\n'));
 assert.equal((await planBootstrap(opts)).freshness,'current');
 const receipt=JSON.parse(await readFile(path.join(h.temp,'.agrimap-agent/runtime/bootstrap.json'),'utf8'));assert.equal(receipt.version,result.version);
});

test('modified legacy contract is preserved and not falsely marked current',async t=>{
 const h=await fixture(t);
 const legacy=await readFile(path.join(projectRoot,'tests/fixtures/bootstrap-3.2.2/AGENTS.md'),'utf8');
 const custom=legacy+'\nOwner-specific build rule.\n';await writeFile(path.join(h.temp,'AGENTS.md'),custom);
 const result=await applyBootstrap({target:h.temp,kind:'be-main'});
 assert.equal(result.applied,false);assert.equal(result.freshness,'update-required');
 assert.equal(await readFile(path.join(h.temp,'AGENTS.md'),'utf8'),custom);
 assert.equal(await present(path.join(h.temp,'.agrimap-agent/runtime/bootstrap.json')),false);
});


test('explicit upgrade replaces only contract targets with backups and stays idempotent',async t=>{
 const h=await fixture(t);
 await writeFile(path.join(h.temp,'AGENTS.md'),'Custom old contract\n');
 await writeFile(path.join(h.temp,'README.md'),'# Product\n<!-- BEGIN AGRIMAP DEPLOYMENT -->\nCustom old deployment\n<!-- END AGRIMAP DEPLOYMENT -->\nKeep footer.\n');
 await writeFile(path.join(h.temp,'Jenkinsfile'),"PROJECT_VERSION = '1.0.8'\n");
 const opts={target:h.temp,kind:'be-main',upgrade:true};
 const plan=await planBootstrap(opts);assert.equal(plan.ok,true);assert.equal(plan.upgrade,true);
 assert.equal(await readFile(path.join(h.temp,'AGENTS.md'),'utf8'),'Custom old contract\n');
 const result=await applyBootstrap(opts);assert.equal(result.applied,true);
 for(const e of result.entries.filter(e=>e.status==='update')) assert.equal(await present(path.join(h.temp,'.agrimap-agent/runtime/bootstrap-backups',e.beforeHash,e.target)),true);
 assert.deepEqual(await readFile(path.join(h.temp,'AGENTS.md')),await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md')));
 const readme=await readFile(path.join(h.temp,'README.md'),'utf8');assert.ok(readme.startsWith('# Product'));assert.ok(readme.endsWith('Keep footer.\n'));assert.ok(!readme.includes('Custom old deployment'));
 assert.equal(await readFile(path.join(h.temp,'Jenkinsfile'),'utf8'),"PROJECT_VERSION = '1.0.8'\n");
 assert.equal((await planBootstrap(opts)).freshness,'current');
});

test('upgrade refuses ambiguous README blocks without partial writes',async t=>{
 const h=await fixture(t);await writeFile(path.join(h.temp,'AGENTS.md'),'Keep old contract');
 await writeFile(path.join(h.temp,'README.md'),'<!-- BEGIN AGRIMAP DEPLOYMENT -->\nOne\n<!-- END AGRIMAP DEPLOYMENT -->\n<!-- BEGIN AGRIMAP DEPLOYMENT -->\nTwo\n<!-- END AGRIMAP DEPLOYMENT -->');
 assert.equal((await applyBootstrap({target:h.temp,kind:'be-main',upgrade:true})).applied,false);
 assert.equal(await readFile(path.join(h.temp,'AGENTS.md'),'utf8'),'Keep old contract');
});
