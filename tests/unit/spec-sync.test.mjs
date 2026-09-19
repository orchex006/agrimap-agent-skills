import assert from 'node:assert/strict';
import test from 'node:test';
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {createGitFixture} from '../helpers/git-fixture.mjs';
import {PROJECT_PATH,projectDefaults} from '../../skills/agrimap-agent-skills/scripts/project-profile.mjs';
import {applySpecSync,chooseStatusValue,planSpecSync,specCheck,specContext,specSemanticCard} from '../../skills/agrimap-agent-skills/scripts/spec-sync.mjs';
import {adapterFor} from '../../skills/agrimap-agent-skills/scripts/spec-adapters.mjs';

const FIXTURE=path.join(projectRoot,'tests','fixtures','spec-pack-morynth');
const PACK='specs/pack';
const TASKS=`${PACK}/06-agent/TASKS.yaml`;
const lines=text=>text.split('\n');
const changedLines=(before,after)=>{const a=lines(before),b=lines(after);return b.filter((line,index)=>line!==a[index]);};

// A spec-first repository whose spec pack lives inside the repo (kind repo).
async function specRepo(t,{statusMap=null,edit=null}={}){
  const h=await createHarness('agm-spec-');t.after(()=>h.cleanup());
  const {repo}=await createGitFixture(h,{name:'console-web',remote:false});
  await cp(FIXTURE,path.join(repo,PACK),{recursive:true});
  if(edit){const file=path.join(repo,TASKS);await writeFile(file,edit(await readFile(file,'utf8')));}
  const profile={...projectDefaults('spec-first'),confirmedBy:'owner',confirmedAt:'2026-09-19'};
  profile.specs.sources=[{id:'demo-console',kind:'repo',path:PACK,format:'morynth-context-index@1',...(statusMap?{statusMap}:{})}];
  profile.specs.scopes=[{source:'demo-console',covers:['src/**']}];
  await mkdir(path.join(repo,'.agrimap-agent','policy'),{recursive:true});
  await writeFile(path.join(repo,PROJECT_PATH),JSON.stringify(profile,null,2));
  return {h,repo,read:rel=>readFile(path.join(repo,rel),'utf8')};
}
const active={executionId:'e1',verificationStatus:'passed',requestedBy:'Tester'};
const sync=async(repo,options={})=>{
  const base={root:repo,active,date:'2026-09-19',...options};
  const plan=await planSpecSync(base);
  assert.equal(plan.ok,true,JSON.stringify(plan));
  return {plan,applied:await applySpecSync({...base,planHash:plan.planHash})};
};

test('spec context returns at most 8 files with goals first, items and blocking questions (19.19 #1/#2)',async t=>{
  const {repo}=await specRepo(t);
  const byTask=await specContext({root:repo,tasks:['FE-002']});
  assert.equal(byTask.ok,true);assert.ok(byTask.readFirst.length<=8);
  assert.ok(byTask.items.some(item=>item.id==='FE-002'&&item.status==='planned'));
  assert.ok(byTask.items.some(item=>item.id==='AC-REG-001'&&item.kind==='acceptance'));
  assert.deepEqual(byTask.blockingQuestions.map(q=>q.id),['OQ-001']);
  assert.equal(byTask.next.action,'ask');
  const byQuery=await specContext({root:repo,query:'login form'});
  assert.equal(byQuery.readFirst[0].file,'goals/login/README.md');
  assert.equal(byQuery.readFirst[0].path,`${PACK}/goals/login/README.md`);
  assert.deepEqual(byQuery.record.sources,['demo-console']);
});

test('sync changes one status line, adds evidence, changelog and manifest; check is clean after (19.19 #3/#4/#5, AC25)',async t=>{
  const {repo,read}=await specRepo(t);
  const before={tasks:await read(TASKS),manifest:await read(`${PACK}/manifest.sha256`)};
  const {plan,applied}=await sync(repo,{tasks:['FE-002'],evidence:['AC-REG-001=src/registry/summary.spec.ts']});
  assert.equal(applied.ok,true,JSON.stringify(applied));
  assert.deepEqual(changedLines(before.tasks,await read(TASKS)),['    status: delivered']);
  const trace=await read(`${PACK}/00-source-of-truth/TRACEABILITY.md`);
  assert.match(trace,/## Implementation evidence\n\n\| ID \| Evidence \| Execution \| Date \|\n\| --- \| --- \| --- \| --- \|\n\| AC-REG-001 \| src\/registry\/summary\.spec\.ts \| e1 \| 2026-09-19 \|/);
  assert.match(await read(`${PACK}/CHANGELOG.md`),/## 2026-09-19\n\n- FE-002 → delivered; evidence 1; \(AGM-Execution e1\)\n\n## 2026-09-01/);
  const manifest=await read(`${PACK}/manifest.sha256`);
  const order=text=>lines(text).filter(Boolean).map(line=>line.split('  ')[1]);
  assert.deepEqual(order(manifest),order(before.manifest));
  const changed=lines(manifest).filter((line,index)=>line!==lines(before.manifest)[index]).map(line=>line.split('  ')[1]).sort();
  assert.deepEqual(changed,['00-source-of-truth/TRACEABILITY.md','06-agent/TASKS.yaml','CHANGELOG.md']);
  assert.equal(plan.specLine,'- Spec: FE-002 → delivered · evidence 1 · manifest updated');
  const check=await specCheck({root:repo});
  assert.ok(!check.findings.some(item=>item.code==='MANIFEST_MISMATCH'),JSON.stringify(check.findings));
  assert.ok(check.findings.some(item=>item.code==='EVIDENCE_MISSING'),'evidence file does not exist in the repo yet');
  assert.ok(check.findings.some(item=>item.code==='DONE_WITHOUT_EVIDENCE'&&/FE-001/.test(item.subject)));
  const again=await planSpecSync({root:repo,active,tasks:['FE-002'],date:'2026-09-19'});
  assert.equal(again.files.length,0,'second sync is a no-op');
});

test('absolute evidence paths are refused',async t=>{
  const {repo}=await specRepo(t);
  for(const value of ['AC-REG-001=D:/work/x.spec.ts','AC-REG-001=/home/u/x.ts','AC-REG-001=../outside.ts']){
    const plan=await planSpecSync({root:repo,active,tasks:['FE-002'],evidence:[value],date:'2026-09-19'});
    assert.equal(plan.code,'EVIDENCE_PATH_INVALID');assert.ok(!JSON.stringify(plan).includes('home/u'));
  }
});

test('status words follow the file, statusMap wins, new words warn but apply (19.7.1)',async t=>{
  const done=await specRepo(t,{edit:text=>text.replace('status: delivered # shipped in 0.9','status: done # shipped in 0.9')});
  assert.equal((await sync(done.repo,{tasks:['FE-002']})).applied.updated[0].value,'done');
  const mapped=await specRepo(t,{statusMap:{done:'completed'}});
  assert.equal((await sync(mapped.repo,{tasks:['FE-002']})).applied.updated[0].value,'completed');
  const fresh=await specRepo(t);
  const {plan,applied}=await sync(fresh.repo,{tasks:['FE-002'],status:'inProgress'});
  assert.equal(applied.ok,true);assert.equal(applied.updated[0].value,'in-progress');
  assert.ok(plan.warnings.some(w=>w.code==='STATUS_VALUE_NEW'));
  assert.match(await fresh.read(TASKS),/id: FE-002\n {4}title: Registry summary totals\n {4}status: in-progress/);
});

test('unknown status is left alone; a block without status gets a line (19.19 #3)',async t=>{
  const {repo,read}=await specRepo(t,{edit:text=>text.replace('    status: planned','    status: review')});
  const before=await read(TASKS);
  const {plan}=await sync(repo,{tasks:['FE-002','FE-003']});
  assert.ok(plan.warnings.some(w=>w.code==='STATUS_VALUE_UNKNOWN'&&/FE-002: review/.test(w.subject)));
  assert.ok(plan.warnings.some(w=>w.code==='TASK_STATUS_LINE_ADDED'&&/FE-003/.test(w.subject)));
  const after=await read(TASKS);
  assert.match(after,/status: review/);
  assert.match(after,/ {2}- id: FE-003\n {4}status: delivered\n {4}title: Export registry to CSV/);
  assert.equal(lines(after).length,lines(before).length+1);
});

test('chooseStatusValue covers all five semantics',()=>{
  const observed=['planned','Done','done','done','blocked','wontfix'];
  assert.deepEqual(chooseStatusValue('planned',observed).value,'planned');
  assert.deepEqual(chooseStatusValue('done',observed).value,'done');
  assert.deepEqual(chooseStatusValue('blocked',observed).value,'blocked');
  assert.deepEqual(chooseStatusValue('dropped',observed).value,'wontfix');
  const next=chooseStatusValue('inProgress',observed);
  assert.equal(next.value,'in-progress');assert.equal(next.warning.code,'STATUS_VALUE_NEW');
  assert.equal(chooseStatusValue('inProgress',observed,{inProgress:'doing'}).value,'doing');
  assert.equal(chooseStatusValue('review',observed).warning.code,'STATUS_SEMANTIC_INVALID');
});

test('semantic change waits for its R2 card while mechanical sync applies (19.19 #6)',async t=>{
  const {repo,read}=await specRepo(t);
  const card=specSemanticCard({ids:['FE-002'],finding:'totals exclude archived rows'});
  assert.equal(card.risk,'R2');assert.equal(card.options.length,3);
  const {plan,applied}=await sync(repo,{tasks:['FE-002'],pendingCards:[{cardId:'e1-contract-1'}]});
  assert.ok(plan.warnings.some(w=>w.code==='SPEC_DECISION_PENDING'&&w.subject==='e1-contract-1'));
  assert.equal(applied.ok,true);assert.match(await read(TASKS),/status: delivered\n {4}requirements: \[REG-001\]/);
});

test('unparseable YAML warns and still returns the entry (19.19 #8)',async t=>{
  const {repo}=await specRepo(t,{edit:text=>text.replace('    title: Export registry to CSV','\ttitle: Export registry to CSV')});
  const context=await specContext({root:repo,tasks:['FE-002']});
  assert.equal(context.ok,true);
  assert.ok(context.readFirst.some(entry=>entry.file==='06-agent/AGENT-START-HERE.md'));
  assert.ok(context.warnings.some(w=>w.code==='ADAPTER_PARSE_FAILED'));
  const plan=await planSpecSync({root:repo,active,tasks:['FE-002'],date:'2026-09-19'});
  assert.equal(plan.ok,true);assert.equal(plan.files.length,0);
  assert.ok(plan.warnings.some(w=>w.code==='ADAPTER_PARSE_FAILED'));
});

test('spec-kit, kiro and openspec layouts fall back to generic markdown with a warning',async t=>{
  const h=await createHarness('agm-spec-fallback-');t.after(()=>h.cleanup());
  const dir=path.join(h.temp,'pack');
  await mkdir(path.join(dir,'.specify'),{recursive:true});
  await writeFile(path.join(dir,'README.md'),'# Pack\n\n- [ ] FE-010 Build list\n');
  const {adapter,warnings}=await adapterFor(dir,'generic-markdown');
  assert.equal(adapter.format,'generic-markdown');assert.equal(warnings[0].code,'SPEC_FORMAT_FALLBACK');
  const declared=await adapterFor(dir,'morynth-context-index@1');
  assert.equal(declared.adapter.format,'generic-markdown');assert.equal(declared.warnings[0].code,'SPEC_FORMAT_FALLBACK');
  const found=await adapter.findItems(dir,{ids:['FE-010']});
  assert.equal(found.items[0].status,'planned');
});

test('generic markdown: a Status line in the item section is read and updated',async t=>{
  const h=await createHarness('agm-spec-generic-');t.after(()=>h.cleanup());
  const dir=path.join(h.temp,'pack');await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'README.md'),'# Pack\n\n## REQ-010 Export\n\nStatus: planned\n\n## REQ-011 Import\n\nStatus: done\n');
  const {Overlay}=await import('../../skills/agrimap-agent-skills/scripts/spec-adapters.mjs');
  const {adapter}=await adapterFor(dir,'generic-markdown');
  const found=await adapter.findItems(dir,{ids:['REQ-010']});
  assert.equal(found.items[0].status,'planned');assert.equal(found.items[0].kind,'task');
  const overlay=new Overlay(dir);
  const result=await adapter.planStatus(overlay,'REQ-010','done');
  assert.equal(result.value,'done');
  assert.deepEqual(overlay.plan()[0].edits,[{line:5,before:'Status: planned',after:'Status: done'}]);
});
