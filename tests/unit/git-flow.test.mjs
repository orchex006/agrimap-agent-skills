import assert from 'node:assert/strict';
import test from 'node:test';
import {cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {createGitFixture,cloneRemote,gitIn} from '../helpers/git-fixture.mjs';
import {defaultRun} from '../../skills/agrimap-agent-skills/scripts/run-command.mjs';
import {compareUrl,planIntegration,applyIntegration,prDecision} from '../../skills/agrimap-agent-skills/scripts/git-flow.mjs';
import {initPolicy,loadPolicy} from '../../skills/agrimap-agent-skills/scripts/workflow-policy.mjs';

const present=p=>stat(p).then(()=>true,()=>false);
async function fixture(t){const h=await createHarness('agm-flow-');t.after(()=>h.cleanup());return h;}

// A product repository on develop with AGENTS.md and a confirmed policy pushed.
async function project(h,{name='repo',method='pull-request',files={},changelog=false}={}){
  const f=await createGitFixture(h,{name,files:{'AGENTS.md':'# Rules\n',...(changelog?{'CHANGELOG.md':'# Changelog\n'}:{}),...files}});
  f.git(['switch','-q','develop']);
  await initPolicy(f.repo,'gitflow',{integration:{method}},'owner');
  f.git(['add','--','.agrimap-agent']);f.git(['commit','-q','-m','chore: workflow policy']);f.git(['push','-q','origin','develop']);
  return bind(h,f.repo,f.remote);
}
function bind(h,repo,remote){
  const cli=(args,cwd=repo)=>JSON.parse(h.spawn(h.scripts.workspace,[...args,'--cwd',repo],undefined,cwd).stdout);
  const ack=session=>{const c=cli(['context','--session',session]);return cli(['context','--session',session,'--ack',c.chain.filter(e=>c.readRequired.includes(e.relative)).map(e=>e.sha12).join(',')]);};
  return {repo,remote,git:args=>gitIn(repo,args),cli,ack};
}
async function startWork(p,{session='s1',slug='order-export',title='Add order export',type='feature'}={}){
  p.ack(session);
  const started=p.cli(['start','--operation','execute','--session',session,'--requested-by','Tester','--title',title]);
  assert.equal(started.ok,true,JSON.stringify(started));
  const plan=p.cli(['branch','plan','--session',session,'--type',type,'--slug',slug]);
  const applied=p.cli(['branch','apply','--session',session,'--type',type,'--slug',slug,'--plan-hash',plan.planHash]);
  assert.equal(applied.ok,true,JSON.stringify(applied));
  return {executionId:started.activeTask.executionId,plan,applied};
}
function verify(p,session,executionId,status='passed'){
  return p.cli(['checkpoint','--session',session,'--execution',executionId,'--event','verified','--summary','tests run','--status',status]);
}
function deliver(p,session,extra=[]){
  const plan=p.cli(['deliver','plan','--session',session,...extra]);
  if(!plan.planHash)return {plan};
  return {plan,applied:p.cli(['deliver','apply','--session',session,'--plan-hash',plan.planHash,...extra])};
}

test('develop -> feature branch -> commit + push with remote verified; develop untouched (AC3, git-flow 1/10)',async t=>{
  const h=await fixture(t);const p=await project(h);
  const developBefore=p.git(['rev-parse','develop']);const remoteDevelop=p.git(['rev-parse','origin/develop']);
  const {executionId,plan}=await startWork(p);
  assert.equal(plan.action,'create');assert.equal(plan.baseSha,remoteDevelop);
  assert.equal(p.git(['branch','--show-current']),'feature/order-export');
  await writeFile(path.join(p.repo,'export.js'),'export const csv = () => "";\n');
  verify(p,'s1',executionId);
  const {plan:dplan,applied}=deliver(p,'s1');
  assert.equal(applied.ok,true,JSON.stringify(applied));
  assert.match(dplan.message.header,/^feature: \S.*$/u,'team commit style: <type>: <plain description>, no scope');
  const body=p.git(['log','-1','--format=%B']);
  assert.match(body,new RegExp(`AGM-Execution: ${executionId}`));
  assert.equal(applied.remoteSha,p.git(['rev-parse','HEAD']));assert.equal(applied.remoteVerified,true);
  assert.equal(p.git(['rev-parse','develop']),developBefore);
  assert.equal(gitIn(p.remote,['rev-parse','develop']),remoteDevelop);
  // Idempotent: only audit logs changed since, so no second commit.
  const again=deliver(p,'s1');
  assert.equal(again.plan.commit,false);
  assert.equal(p.git(['rev-parse','HEAD']),applied.commit);
});

test('dirty base carries files, pre-existing dirt is never delivered, mixed asks, runtime excluded (AC4, git-flow 2/6)',async t=>{
  const h=await fixture(t);const p=await project(h,{files:{'notes.md':'a\n','shared.md':'a\n'}});
  await writeFile(path.join(p.repo,'notes.md'),'local edit\n');
  await writeFile(path.join(p.repo,'shared.md'),'before start\n');
  p.ack('s1');
  const started=p.cli(['start','--operation','execute','--session','s1','--requested-by','Tester','--title','Add export']);
  assert.deepEqual(started.activeTask.preexistingDirty.map(e=>e.path).sort(),['notes.md','shared.md']);
  const plan=p.cli(['branch','plan','--session','s1','--type','feature','--slug','export']);
  assert.equal(plan.action,'create-carry');assert.ok(plan.warnings.some(w=>w.code==='BASE_NOT_REFRESHED_DIRTY'));
  p.cli(['branch','apply','--session','s1','--type','feature','--slug','export','--plan-hash',plan.planHash]);
  assert.equal(await readFile(path.join(p.repo,'notes.md'),'utf8'),'local edit\n');
  await writeFile(path.join(p.repo,'export.js'),'x\n');
  await writeFile(path.join(p.repo,'shared.md'),'before start\nand this work\n');
  verify(p,'s1',started.activeTask.executionId);
  const mixed=p.cli(['deliver','plan','--session','s1']);
  assert.equal(mixed.card.topic,'git/delivery-mixed');assert.equal(mixed.planHash,null);
  const {plan:dplan,applied}=deliver(p,'s1',['--mixed','exclude']);
  assert.equal(applied.ok,true,JSON.stringify(applied));
  const committed=p.git(['show','--name-only','--format=','HEAD']).split('\n');
  assert.ok(committed.includes('export.js'));
  assert.ok(!committed.includes('notes.md')&&!committed.includes('shared.md'));
  assert.ok(!committed.some(f=>f.startsWith('.agrimap-agent/runtime/')||f.startsWith('.agrimap-agent/memory/current/')));
  assert.ok(committed.some(f=>/^\.agrimap-agent\/logs\/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}\/\d+\.jsonl$/.test(f)));
  assert.ok(dplan.paths.foreign.includes('notes.md'));
});

test('host branches push under the team name or rename; collisions get a suffix; stale plans refuse (git-flow 3/4/5)',async t=>{
  const h=await fixture(t);const p=await project(h);
  p.git(['switch','-q','-c','claude/abc']);
  p.ack('s1');p.cli(['start','--operation','execute','--session','s1','--requested-by','Tester','--title','x']);
  let plan=p.cli(['branch','plan','--session','s1','--type','feature','--slug','host-work']);
  assert.equal(plan.action,'host-keep');assert.equal(plan.remoteBranch,'feature/host-work');assert.deepEqual(plan.commands,[]);
  p.cli(['policy','set','--key','branching.hostWorktreeBranch','--value','rename','--requested-by','owner']);
  plan=p.cli(['branch','plan','--session','s1','--type','feature','--slug','host-work']);
  assert.deepEqual(plan.commands,[['git','branch','-m','feature/host-work']]);
  p.git(['switch','-q','develop']);p.git(['branch','feature/taken']);
  plan=p.cli(['branch','plan','--session','s1','--type','feature','--slug','taken']);
  assert.equal(plan.branch,'feature/taken-2');
  await writeFile(path.join(p.repo,'new.txt'),'x\n');
  const stale=p.cli(['branch','apply','--session','s1','--type','feature','--slug','taken','--plan-hash',plan.planHash]);
  assert.equal(stale.code,'PLAN_STALE');
});

test('delivery gates: protected branch, missing ack, secrets without values, changelog, local path leak (git-flow 7/8/9)',async t=>{
  const h=await fixture(t);const p=await project(h,{changelog:true});
  p.ack('s1');
  const started=p.cli(['start','--operation','execute','--session','s1','--requested-by','Tester','--title','Fix it']);
  await writeFile(path.join(p.repo,'a.js'),'x\n');
  assert.equal(p.cli(['deliver','plan','--session','s1']).code,'PROTECTED_BRANCH');
  assert.equal(p.cli(['deliver','plan','--session','other']).code,'NO_ACTIVE_EXECUTION');
  const plan=p.cli(['branch','plan','--session','s1','--type','fix','--slug','gates']);
  p.cli(['branch','apply','--session','s1','--type','fix','--slug','gates','--plan-hash',plan.planHash]);
  await writeFile(path.join(p.repo,'AGENTS.md'),'# Rules changed\n');
  assert.equal(p.cli(['deliver','plan','--session','s1']).code,'INSTRUCTIONS_NOT_ACKNOWLEDGED');
  gitIn(p.repo,['checkout','--','AGENTS.md']);
  const secret='SyntheticSecret'+'Value123';
  await writeFile(path.join(p.repo,'config.js'),`const password = "${secret}";\n`);
  const suspected=p.cli(['deliver','plan','--session','s1']);
  assert.equal(suspected.code,'SECRET_SUSPECTED');assert.equal(suspected.card.risk,'R3');
  assert.ok(!JSON.stringify(suspected).includes(secret));
  assert.deepEqual(suspected.findings,[{path:'config.js',line:1,kind:'CREDENTIAL'}]);
  assert.equal(p.cli(['deliver','plan','--session','s1','--exclude-paths','config.js']).code,'CHANGELOG_REQUIRED');
  const na=p.cli(['deliver','plan','--session','s1','--exclude-paths','config.js','--changelog-na','internal refactor']);
  assert.equal(na.ok,true);assert.ok(!na.paths.own.includes('config.js'));
  // Local memory paths never reach committed files; force-added local memory is excluded.
  const external=path.join(h.temp,'orders-spec');await mkdir(external);
  p.cli(['local','set-path','--kind','repo','--id','orders-spec','--path',external]);
  await writeFile(path.join(p.repo,'doc.md'),`see ${external.replaceAll('\\','/')}\n`);
  const leak=p.cli(['deliver','plan','--session','s1','--exclude-paths','config.js','--changelog-na','x']);
  assert.equal(leak.code,'LOCAL_PATH_LEAK');assert.deepEqual(leak.leaks,[{path:'doc.md',line:1}]);
  await writeFile(path.join(p.repo,'doc.md'),'see spec orders-spec\n');
  gitIn(p.repo,['add','-f','--','.agrimap-agent/local/memory.md']);
  const ok=p.cli(['deliver','plan','--session','s1','--exclude-paths','config.js','--changelog-na','x']);
  assert.ok(!ok.paths.own.some(f=>f.startsWith('.agrimap-agent/local/')));
  assert.ok(ok.warnings.some(w=>w.code==='LOCAL_MEMORY_TRACKED'));
  assert.equal(started.ok,true);
});

test('failed verification still delivers the work branch with a trailer and offers no merge (AC22, git-flow 7)',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge'});
  const {executionId}=await startWork(p,{slug:'unverified'});
  await writeFile(path.join(p.repo,'b.js'),'x\n');
  verify(p,'s1',executionId,'failed');
  const {plan,applied}=deliver(p,'s1');
  assert.ok(plan.warnings.some(w=>w.code==='DELIVERED_UNVERIFIED'));
  assert.equal(applied.ok,true);assert.equal(applied.remoteVerified,true);
  assert.match(p.git(['log','-1','--format=%B']),/AGM-Verification: failed/);
  const options=p.cli(['integrate','options','--session','s1']);
  assert.equal(options.card.options[0].value,'continue');
  assert.ok(!options.card.options.some(o=>o.value==='integrate'));
  const merge=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  assert.equal(merge.card.topic,'git/integrate-unverified');
});

test('remote work branch ahead is REMOTE_AHEAD (git-flow 11)',async t=>{
  const h=await fixture(t);const p=await project(h);
  const {executionId}=await startWork(p,{slug:'ahead'});
  await writeFile(path.join(p.repo,'c.js'),'x\n');verify(p,'s1',executionId);
  const first=deliver(p,'s1').applied;assert.equal(first.ok,true);
  const other=await cloneRemote(h,p.remote,'other');
  gitIn(other,['switch','-q','feature/ahead']);await writeFile(path.join(other,'d.js'),'y\n');
  gitIn(other,['add','--','d.js']);gitIn(other,['commit','-q','-m','feat: other']);gitIn(other,['push','-q','origin','feature/ahead']);
  await writeFile(path.join(p.repo,'c.js'),'x2\n');
  const again=deliver(p,'s1',['--input',await messageFile(h)]).applied;
  assert.equal(again.code,'REMOTE_AHEAD');
});
async function messageFile(h){const f=path.join(h.temp,'message.json');await writeFile(f,JSON.stringify({type:'feat',scope:'orders',subject:'follow-up change'}));return f;}

async function deliveredBranch(p,{session,slug,file,content='x\n'}){
  const {executionId}=await startWork(p,{session,slug,title:`Work ${slug}`});
  await writeFile(path.join(p.repo,file),content);verify(p,session,executionId);
  const {applied}=deliver(p,session);assert.equal(applied.ok,true,JSON.stringify(applied));
  p.cli(['complete','--session',session,'--execution',executionId]);
  return applied;
}

test('short reply "1" then local merge: merge commit on origin/develop, branch tree, no checkout of develop (AC5, git-flow 12)',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge'});
  const applied=await deliveredBranch(p,{session:'s1',slug:'merge-me',file:'m.js'});
  const options=p.cli(['integrate','options','--session','s1']);
  assert.equal(options.card.options[0].value,'integrate');
  const hook=h.run(h.scripts.hook,['--provider','claude'],{cwd:p.repo,session_id:'s1',hook_event_name:'UserPromptSubmit',prompt:'1'});
  assert.match(hook.hookSpecificOutput.additionalContext,/selects option 1/);
  const oldDevelop=p.git(['rev-parse','origin/develop']);
  const plan=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  assert.equal(plan.needsMerge,false);assert.equal(plan.verificationRequired,false);
  const result=p.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',plan.planHash]);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.remoteVerified,true);
  const merge=gitIn(p.remote,['rev-parse','develop']);
  assert.equal(gitIn(p.remote,['rev-parse',`${merge}^1`]),oldDevelop);
  assert.equal(gitIn(p.remote,['rev-parse',`${merge}^2`]),applied.commit);
  assert.equal(gitIn(p.remote,['rev-parse',`${merge}^{tree}`]),p.git(['rev-parse',`${applied.commit}^{tree}`]));
  assert.equal(p.git(['branch','--show-current']),'feature/merge-me');
  assert.equal(result.card?.card?.topic||result.card?.topic,'git/delete-branch');
});

test('audit written after delivery rides with the next delivery instead of becoming preexisting (R1, AC24)',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge'});
  const first=await deliveredBranch(p,{session:'s1',slug:'residue',file:'one.js'});
  const plan=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  assert.equal(p.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',plan.planHash]).ok,true);
  const residue=p.git(['status','--porcelain','--untracked-files=all']).match(/\.agrimap-agent\/logs\/\S+/g)||[];
  assert.ok(residue.length,'integrate/complete leave audit dirty');
  p.ack('s2');
  const started=p.cli(['start','--operation','execute','--session','s2','--requested-by','Tester','--title','Second change']);
  assert.ok(!started.activeTask.preexistingDirty.some(e=>e.path.startsWith('.agrimap-agent/logs/')));
  const bplan=p.cli(['branch','plan','--session','s2','--type','feature','--slug','residue','--mode','current']);
  p.cli(['branch','apply','--session','s2','--type','feature','--slug','residue','--mode','current','--plan-hash',bplan.planHash]);
  await writeFile(path.join(p.repo,'two.js'),'y'+String.fromCharCode(10));verify(p,'s2',started.activeTask.executionId);
  const {applied}=deliver(p,'s2');
  assert.equal(applied.ok,true,JSON.stringify(applied));assert.notEqual(applied.commit,first.commit);
  const committed=p.git(['show','--name-only','--format=','HEAD']).split(String.fromCharCode(10));
  for(const file of residue)assert.ok(committed.includes(file),`${file} committed`);
});

test('two branches delivered the same day merge into develop without .agrimap-agent conflicts (AC7, git-flow 13)',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge'});
  // Second developer works in another clone on the same day.
  const clone=await cloneRemote(h,p.remote,'dev-two');gitIn(clone,['switch','-q','develop']);
  const q=bind(h,clone,p.remote);
  await deliveredBranch(p,{session:'s1',slug:'first',file:'one.js'});
  // Execution ids are second-resolution run ids; two real developers do not
  // start in the same second, fast CI runners can.
  await new Promise(resolve=>setTimeout(resolve,1100));
  await deliveredBranch(q,{session:'s2',slug:'second',file:'two.js'});
  let plan=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  assert.equal(p.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',plan.planHash]).ok,true);
  plan=q.cli(['integrate','plan','--session','s2','--intent','integrate']);
  assert.equal(plan.needsMerge,true);assert.equal(plan.verificationRequired,true);
  const staged=q.cli(['integrate','apply','--session','s2','--intent','integrate','--plan-hash',plan.planHash]);
  assert.equal(staged.ok,true,JSON.stringify(staged));assert.equal(staged.next.action,'run-verification');
  const final=q.cli(['integrate','apply','--session','s2','--intent','integrate','--stage','push']);
  assert.equal(final.ok,true,JSON.stringify(final));
  const files=gitIn(p.remote,['ls-tree','-r','--name-only','develop']).split('\n');
  assert.ok(files.includes('one.js')&&files.includes('two.js'));
  assert.equal(await present(path.join(clone,'.git','MERGE_HEAD')),false);
});

test('conflicts abort cleanly and a moved target is REMOTE_TARGET_ADVANCED with local refs unchanged (git-flow 14/15)',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge',files:{'shared.js':'base\n'}});
  await deliveredBranch(p,{session:'s1',slug:'conflict',file:'shared.js',content:'mine\n'});
  const other=await cloneRemote(h,p.remote,'other');
  gitIn(other,['switch','-q','develop']);await writeFile(path.join(other,'shared.js'),'theirs\n');
  gitIn(other,['commit','-q','-am','fix: theirs']);gitIn(other,['push','-q','origin','develop']);
  const plan=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  const conflict=p.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',plan.planHash]);
  assert.equal(conflict.code,'MERGE_CONFLICT');assert.deepEqual(conflict.conflicts,['shared.js']);
  assert.equal(await present(path.join(p.repo,'.git','MERGE_HEAD')),false);

  const q=await project(h,{name:'race',method:'local-merge'});
  await deliveredBranch(q,{session:'s1',slug:'race',file:'r.js'});
  const racePlan=q.cli(['integrate','plan','--session','s1','--intent','integrate']);
  const racer=await cloneRemote(h,q.remote,'racer');
  gitIn(racer,['switch','-q','develop']);await writeFile(path.join(racer,'z.js'),'z\n');
  gitIn(racer,['add','--','z.js']);gitIn(racer,['commit','-q','-m','feat: race']);gitIn(racer,['push','-q','origin','develop']);
  const before=[q.git(['rev-parse','feature/race']),q.git(['rev-parse','develop']),q.git(['rev-parse','origin/develop'])];
  const raced=q.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',racePlan.planHash]);
  assert.equal(raced.code,'REMOTE_TARGET_ADVANCED');
  assert.deepEqual([q.git(['rev-parse','feature/race']),q.git(['rev-parse','develop']),q.git(['rev-parse','origin/develop'])],before);
});

test('open-pr without a forge CLI returns a manual compare URL; URLs are correct for GitHub and GitLab (git-flow 16)',async t=>{
  const h=await fixture(t);const p=await project(h);
  await deliveredBranch(p,{session:'s1',slug:'manual',file:'x.js'});
  const plan=p.cli(['integrate','plan','--session','s1','--intent','open-pr']);
  assert.equal(plan.status,'manual-pr');
  assert.equal(compareUrl('auto','https://github.com/o/r.git','feature/x','develop'),'https://github.com/o/r/compare/develop...feature/x?expand=1');
  assert.equal(compareUrl('auto','git@github.com:o/r.git','feature/x','develop'),'https://github.com/o/r/compare/develop...feature/x?expand=1');
  assert.equal(compareUrl('auto','git@gitlab.example.com:g/r.git','feature/x','develop'),'https://gitlab.example.com/g/r/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Fx&merge_request%5Btarget_branch%5D=develop');
});

test('stubbed gh: CLEAN merges, BLOCKED stops, pending asks, never --admin (git-flow 17)',async t=>{
  const h=await fixture(t);const p=await project(h);
  await deliveredBranch(p,{session:'s1',slug:'pr-flow',file:'y.js'});
  const delivery=JSON.parse(await readFile(path.join(p.repo,'.agrimap-agent/runtime/sessions/s1.json'),'utf8')).lastDelivery;
  const policy=(await loadPolicy(p.repo)).policy;
  const calls=[];
  const stub=view=>(command,args,options)=>{
    if(command==='gh'){
      calls.push(args);
      if(args[0]==='auth')return {ok:true,stdout:'',stderr:''};
      if(args[1]==='list')return {ok:true,stdout:JSON.stringify([{number:7,url:'https://github.com/o/r/pull/7'}]),stderr:''};
      if(args[1]==='view')return {ok:true,stdout:JSON.stringify(view),stderr:''};
      if(args[1]==='merge')return {ok:true,stdout:'',stderr:''};
    }
    if(command==='git'&&args.join(' ')==='remote get-url origin')return {ok:true,stdout:'https://github.com/o/r.git\n',stderr:''};
    return defaultRun(command,args,options);
  };
  const base={root:p.repo,state:path.join(p.repo,'.agrimap-agent'),policy,delivery,intent:'integrate',ackRequired:[],fetch:false};
  const clean=stub({mergeStateStatus:'CLEAN',reviewDecision:'APPROVED',statusCheckRollup:[{status:'COMPLETED',conclusion:'SUCCESS'}],url:'u'});
  const plan=await planIntegration({...base,run:clean});
  await applyIntegration({...base,run:clean,planHash:plan.planHash});
  assert.ok(calls.some(a=>a.join(' ')==='pr merge 7 --merge'));
  const blocked=await planIntegration({...base,run:stub({mergeStateStatus:'BLOCKED',reviewDecision:'REVIEW_REQUIRED',statusCheckRollup:[]})});
  assert.equal(blocked.code,'PR_BLOCKED');
  const pending=await planIntegration({...base,run:stub({mergeStateStatus:'BLOCKED',statusCheckRollup:[{status:'IN_PROGRESS'}]})});
  assert.equal(pending.card.topic,'git/pr-pending');
  assert.equal(prDecision({mergeStateStatus:'BLOCKED',statusCheckRollup:[{status:'IN_PROGRESS'}]},{whenGreen:true}).decision,'auto-merge');
  assert.ok(!calls.flat().includes('--admin'));
});

test('scripts never force push, add all, stash, reset, clone or check out (AC8)',async()=>{
  for(const file of ['git-flow.mjs','governance-commands.mjs','workflow-policy.mjs','instruction-chain.mjs','project-profile.mjs','spec-sync.mjs','spec-adapters.mjs','yaml-lines.mjs']){
    const source=await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/scripts',file),'utf8');
    for(const forbidden of ['"--force"','"-f"','"--force-with-lease"','"--mirror"','"-A"','"--all"','"stash"','"reset"','"clone"','"checkout"','"worktree", "add"','"--admin"','execSync(','shell: true']){
      assert.ok(!source.includes(forbidden),`${file} contains ${forbidden}`);
    }
    assert.ok(!/"add", "\."/.test(source),`${file} stages everything`);
  }
});

// ------------------------------------------------------------ spec sync gate (P2)

const PACK_FIXTURE=path.join(projectRoot,'tests','fixtures','spec-pack-morynth');
async function writeProfile(repo,profile){
  await mkdir(path.join(repo,'.agrimap-agent','policy'),{recursive:true});
  await writeFile(path.join(repo,'.agrimap-agent','policy','project.json'),JSON.stringify({schemaVersion:1,status:'confirmed',confirmedBy:'owner',confirmedAt:'2026-09-19',decisionRef:null,inference:null,hybrid:{newWork:'spec-first'},...profile},null,2));
}
// Spec-first product repo whose pack lives in specs/pack (kind repo).
async function specFirst(h,{enforcement='warn',mode='spec-first',sync='auto',tasksEdit=null}={}){
  const p=await project(h,{name:`web-${mode}-${enforcement}`});
  await cp(PACK_FIXTURE,path.join(p.repo,'specs','pack'),{recursive:true});
  if(tasksEdit){const f=path.join(p.repo,'specs/pack/06-agent/TASKS.yaml');await writeFile(f,tasksEdit(await readFile(f,'utf8')));}
  await writeProfile(p.repo,{developmentMode:mode,specs:{sources:[{id:'demo-console',kind:'repo',path:'specs/pack',format:'morynth-context-index@1'}],scopes:[{source:'demo-console',covers:['src/**']}],sync,enforcement}});
  p.git(['add','--','specs','.agrimap-agent']);p.git(['commit','-q','-m','docs: spec pack']);p.git(['push','-q','origin','develop']);
  return p;
}

test('spec-first delivery self-fixes SPEC_NOT_SYNCED, then commits code and spec together (AC18, 19.19 #7)',async t=>{
  const h=await fixture(t);const p=await specFirst(h);
  const {executionId}=await startWork(p,{slug:'registry-summary'});
  const context=p.cli(['spec','context','--session','s1','--tasks','FE-002']);
  assert.equal(context.ok,true);assert.ok(context.readFirst.length<=8);
  await mkdir(path.join(p.repo,'src'),{recursive:true});await writeFile(path.join(p.repo,'src','summary.js'),'export const total = 1;\n');
  verify(p,'s1',executionId);
  const gate=p.cli(['deliver','plan','--session','s1']);
  assert.equal(gate.code,'SPEC_NOT_SYNCED');assert.equal(gate.severity,'self-fix');assert.match(gate.next.command,/spec sync plan/);
  const plan=p.cli(['spec','sync','plan','--session','s1','--evidence','AC-REG-001=src/summary.js']);
  assert.equal(plan.ok,true,JSON.stringify(plan));
  const applied=p.cli(['spec','sync','apply','--session','s1','--evidence','AC-REG-001=src/summary.js','--plan-hash',plan.planHash]);
  assert.equal(applied.ok,true,JSON.stringify(applied));
  const {applied:delivered}=deliver(p,'s1');
  assert.equal(delivered.ok,true,JSON.stringify(delivered));
  assert.equal(delivered.specLine,'- Spec: FE-002 → delivered · evidence 1 · manifest updated');
  const committed=p.git(['show','--name-only','--format=','HEAD']).split('\n');
  for(const file of ['src/summary.js','specs/pack/06-agent/TASKS.yaml','specs/pack/00-source-of-truth/TRACEABILITY.md','specs/pack/CHANGELOG.md','specs/pack/manifest.sha256'])assert.ok(committed.includes(file),file);
  assert.match(p.git(['show','HEAD','--','.agrimap-agent/logs']),/"milestone":"spec-sync"/);
});

test('spec-na passes, enforcement block stops, code-first is not checked (19.19 #7)',async t=>{
  const h=await fixture(t);
  const warn=await specFirst(h);
  const w=await startWork(warn,{slug:'na'});
  await mkdir(path.join(warn.repo,'src'),{recursive:true});await writeFile(path.join(warn.repo,'src','a.js'),'x\n');verify(warn,'s1',w.executionId);
  const na=warn.cli(['deliver','plan','--session','s1','--spec-na','formatting only']);
  assert.equal(na.ok,true,JSON.stringify(na));assert.equal(na.specLine,'- Spec: ไม่เกี่ยว (formatting only)');
  const block=await specFirst(h,{enforcement:'block'});
  const b=await startWork(block,{slug:'block'});
  await mkdir(path.join(block.repo,'src'),{recursive:true});await writeFile(path.join(block.repo,'src','b.js'),'x\n');verify(block,'s1',b.executionId);
  const stopped=block.cli(['deliver','plan','--session','s1']);
  assert.equal(stopped.code,'SPEC_SYNC_REQUIRED');assert.equal(stopped.severity,'stop');
  const code=await specFirst(h,{mode:'code-first',sync:'off'});
  const c=await startWork(code,{slug:'legacy'});
  await mkdir(path.join(code.repo,'src'),{recursive:true});await writeFile(path.join(code.repo,'src','c.js'),'x\n');verify(code,'s1',c.executionId);
  const free=code.cli(['deliver','plan','--session','s1']);
  assert.equal(free.ok,true,JSON.stringify(free));assert.equal(free.specLine,'- Spec: ไม่เกี่ยว (code-first)');
  const refused=code.cli(['spec','sync','plan','--session','s1','--tasks','FE-002']);
  assert.equal(refused.code,'SPEC_SYNC_OFF');
  assert.equal(await readFile(path.join(code.repo,'specs/pack/06-agent/TASKS.yaml'),'utf8'),await readFile(path.join(PACK_FIXTURE,'06-agent/TASKS.yaml'),'utf8'));
});

test('an unparseable TASKS.yaml still delivers with warnings under the warning contract (AC21, 19.19 #8)',async t=>{
  const h=await fixture(t);const p=await specFirst(h,{tasksEdit:text=>text.replace('    title: Export registry to CSV','\ttitle: Export registry to CSV')});
  const {executionId}=await startWork(p,{slug:'broken-yaml'});
  p.cli(['spec','context','--session','s1','--tasks','FE-002']);
  await mkdir(path.join(p.repo,'src'),{recursive:true});await writeFile(path.join(p.repo,'src','d.js'),'x\n');verify(p,'s1',executionId);
  assert.equal(p.cli(['deliver','plan','--session','s1']).code,'SPEC_NOT_SYNCED');
  const attempt=p.cli(['spec','sync','plan','--session','s1']);
  assert.ok(attempt.warnings.some(w=>w.code==='ADAPTER_PARSE_FAILED'));
  const {plan,applied}=deliver(p,'s1');
  assert.equal(applied?.ok,true,JSON.stringify(plan));
  assert.ok(applied.warnings.some(w=>w.code==='SPEC_NOT_SYNCED'));assert.ok(applied.warnings.some(w=>w.code==='ADAPTER_PARSE_FAILED'));
  assert.ok(applied.warnings.every(w=>w.code&&w.fix),'each warning has code and fix');
  assert.equal(applied.remoteVerified,true);
});

test('a separate spec repository gets its own commit; two commits are reported (AC23)',async t=>{
  const h=await fixture(t);
  const spec=await createGitFixture(h,{name:'demo-console-spec',files:{}});
  await cp(PACK_FIXTURE,spec.repo,{recursive:true});
  spec.git(['add','--','.']);spec.git(['commit','-q','-m','docs: import pack']);spec.git(['push','-q','origin','main']);
  spec.git(['switch','-q','-c','docs/sync-fe-002']);
  const p=await project(h,{name:'demo-console-web'});
  await writeProfile(p.repo,{developmentMode:'spec-first',specs:{sources:[{id:'demo-console',kind:'external',format:'morynth-context-index@1',fingerprint:{file:'06-agent/CONTEXT-INDEX.yaml',contains:'id: demo-console'}}],scopes:[{source:'demo-console',covers:['src/**']}],sync:'auto',enforcement:'warn'}});
  p.git(['add','--','.agrimap-agent']);p.git(['commit','-q','-m','docs: project profile']);p.git(['push','-q','origin','develop']);
  const {executionId}=await startWork(p,{slug:'external-spec'});
  const set=p.cli(['local','set-path','--kind','spec','--id','demo-console','--path',spec.repo]);
  assert.equal(set.ok,true,JSON.stringify(set));
  p.cli(['spec','context','--session','s1','--tasks','FE-002']);
  await mkdir(path.join(p.repo,'src'),{recursive:true});await writeFile(path.join(p.repo,'src','e.js'),'x\n');verify(p,'s1',executionId);
  const plan=p.cli(['spec','sync','plan','--session','s1']);
  const applied=p.cli(['spec','sync','apply','--session','s1','--plan-hash',plan.planHash]);
  assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(applied.linkedRoots.length,1);
  const s=bind(h,spec.repo,spec.remote);
  const message=await messageFile(h);
  const splan=s.cli(['deliver','plan','--session','s1','--explicit','push','--input',message]);
  assert.equal(splan.ok,true,JSON.stringify(splan));
  const sapplied=s.cli(['deliver','apply','--session','s1','--explicit','push','--input',message,'--plan-hash',splan.planHash]);
  assert.equal(sapplied.ok,true,JSON.stringify(sapplied));assert.equal(sapplied.remoteVerified,true);
  assert.ok(spec.git(['show','--name-only','--format=','HEAD']).split('\n').includes('06-agent/TASKS.yaml'));
  const {applied:code}=deliver(p,'s1');
  assert.equal(code.ok,true,JSON.stringify(code));
  assert.deepEqual(code.commits.map(c=>c.root),['code','spec:demo-console']);
  assert.ok(code.commits.every(c=>c.remoteVerified));
  assert.ok(!p.git(['show','HEAD']).includes(spec.repo.replaceAll('\\','/')),'no absolute spec path committed');
});

test('a non-Git external spec pack is updated locally with SPEC_SOURCE_NOT_GIT on delivery',async t=>{
  const h=await fixture(t);
  const pack=path.join(h.temp,'demo-console-spec-v1.0.0');await cp(PACK_FIXTURE,pack,{recursive:true});
  const p=await project(h,{name:'demo-console-app'});
  await writeProfile(p.repo,{developmentMode:'spec-first',specs:{sources:[{id:'demo-console',kind:'external',format:'morynth-context-index@1',fingerprint:{file:'06-agent/CONTEXT-INDEX.yaml',contains:'id: demo-console'}}],scopes:[],sync:'auto',enforcement:'warn'}});
  p.git(['add','--','.agrimap-agent']);p.git(['commit','-q','-m','docs: project profile']);p.git(['push','-q','origin','develop']);
  const {executionId}=await startWork(p,{slug:'local-pack'});
  p.cli(['local','set-path','--kind','spec','--id','demo-console','--path',pack]);
  p.cli(['spec','context','--session','s1','--tasks','FE-002']);
  await writeFile(path.join(p.repo,'f.js'),'x\n');verify(p,'s1',executionId);
  const plan=p.cli(['spec','sync','plan','--session','s1']);
  const applied=p.cli(['spec','sync','apply','--session','s1','--plan-hash',plan.planHash]);
  assert.equal(applied.ok,true,JSON.stringify(applied));assert.match(applied.specLine,/local only/);
  assert.match(await readFile(path.join(pack,'06-agent','TASKS.yaml'),'utf8'),/id: FE-002\n.*\n {4}status: delivered/);
  const {applied:delivered}=deliver(p,'s1');
  assert.equal(delivered.ok,true,JSON.stringify(delivered));
  assert.ok(delivered.warnings.some(w=>w.code==='SPEC_SOURCE_NOT_GIT'));
});

test('code-first "update the spec too" becomes a standing rule without a card (AC19, AC26; owner answer Q-4.7.0-03)',async t=>{
  const h=await fixture(t);const p=await specFirst(h,{mode:'code-first',sync:'off'});
  const {executionId}=await startWork(p,{slug:'expiry-fix',type:'fix'});
  await mkdir(path.join(p.repo,'src','license'),{recursive:true});await writeFile(path.join(p.repo,'src','license','expiry.js'),'x\n');verify(p,'s1',executionId);
  const once=p.cli(['spec','sync','plan','--session','s1','--once','--tasks','FE-002']);
  assert.equal(once.ok,true,JSON.stringify(once));
  const standing=p.cli(['spec','standing','--session','s1','--paths','src/license/expiry.js','--requested-by','owner']);
  assert.equal(standing.ok,true,JSON.stringify(standing));assert.equal(standing.card,undefined);
  assert.match(standing.decidedForYou,/ทุกงาน/);
  const profile=JSON.parse(await readFile(path.join(p.repo,'.agrimap-agent','policy','project.json'),'utf8'));
  assert.equal(profile.developmentMode,'hybrid');assert.equal(profile.specs.sync,'auto');
  assert.ok(profile.specs.scopes.some(scope=>scope.covers.includes('src/license/**')));
  assert.match(profile.decisionRef,/development-mode\.md$/);
  const next=p.cli(['spec','sync','plan','--session','s1','--tasks','FE-002']);
  assert.equal(next.ok,true,'no --once needed afterwards');
});

test('first context of a session in spec-first scope reports open spec drift once (warning contract 4)',async t=>{
  const h=await fixture(t);const p=await specFirst(h);
  const first=p.cli(['context','--session','s9']);
  assert.ok(first.openWarnings.count>=1);assert.ok(first.openWarnings.lines.length<=5);
  assert.ok(first.openWarnings.lines.some(line=>/DONE_WITHOUT_EVIDENCE: demo-console: FE-001/.test(line)));
  p.cli(['context','--session','s9','--ack',first.chain.filter(e=>first.readRequired.includes(e.relative)).map(e=>e.sha12).join(',')]);
  assert.equal(p.cli(['context','--session','s9']).openWarnings,undefined);
});

test('4.6.0 configs with the unused specSync:false default are switched on once; a later explicit false stays (Q-4.7.0-01)',async t=>{
  const h=await fixture(t);const p=await project(h,{name:'migrated'});
  const file=path.join(p.repo,'.agrimap-agent','config.json');
  await writeFile(file,JSON.stringify({governance:{workflowPolicy:true,delivery:true,decisionMemory:false,guards:false,projectMode:true,specSync:false}},null,2));
  p.cli(['init']);
  let after=JSON.parse(await readFile(file,'utf8')).governance;
  assert.equal(after.specSync,true);assert.equal(after.specSyncDefault,'4.7.0');
  await writeFile(file,JSON.stringify({...JSON.parse(await readFile(file,'utf8')),governance:{...after,specSync:false}},null,2));
  p.cli(['init']);
  after=JSON.parse(await readFile(file,'utf8')).governance;
  assert.equal(after.specSync,false);
});

test('stubbed glab uses flags verified against glab 1.115 --help (R2)',async t=>{
  const h=await fixture(t);const p=await project(h);
  await deliveredBranch(p,{session:'s1',slug:'mr-flow',file:'g.js'});
  const delivery=JSON.parse(await readFile(path.join(p.repo,'.agrimap-agent/runtime/sessions/s1.json'),'utf8')).lastDelivery;
  const policy=(await loadPolicy(p.repo)).policy;
  const calls=[];let created=false;
  const run=(command,args,options)=>{
    if(command==='glab'){
      calls.push(args);
      if(args[0]==='auth')return {ok:true,stdout:'',stderr:''};
      if(args[1]==='list')return {ok:true,stdout:JSON.stringify(created?[{iid:3,web_url:'https://gitlab.example.com/g/r/-/merge_requests/3'}]:[]),stderr:''};
      if(args[1]==='create'){created=true;return {ok:true,stdout:'https://gitlab.example.com/g/r/-/merge_requests/3\n',stderr:''};}
      if(args[1]==='view')return {ok:true,stdout:JSON.stringify({web_url:'u',detailed_merge_status:'mergeable',head_pipeline:{status:'success'}}),stderr:''};
      if(args[1]==='merge')return {ok:true,stdout:'',stderr:''};
    }
    if(command==='git'&&args.join(' ')==='remote get-url origin')return {ok:true,stdout:'git@gitlab.example.com:g/r.git\n',stderr:''};
    return defaultRun(command,args,options);
  };
  const base={root:p.repo,state:path.join(p.repo,'.agrimap-agent'),policy,delivery,intent:'integrate',ackRequired:[],fetch:false,run};
  const plan=await planIntegration(base);
  const result=await applyIntegration({...base,planHash:plan.planHash});
  assert.equal(result.ok,true,JSON.stringify(result));
  const create=calls.find(a=>a[1]==='create');
  for(const flag of ['--source-branch','--target-branch','--title','--description-file','--yes'])assert.ok(create.includes(flag),flag);
  assert.ok(calls.find(a=>a[1]==='list').includes('-F'));
  assert.deepEqual(calls.find(a=>a[1]==='merge'),['mr','merge','3','--yes','--auto-merge=false']);
});

test('a merge git refuses before conflicts (local file would be overwritten) is MERGE_FAILED with stderr and a clean state',async t=>{
  const h=await fixture(t);const p=await project(h,{method:'local-merge'});
  await deliveredBranch(p,{session:'s1',slug:'refused',file:'r.js'});
  const other=await cloneRemote(h,p.remote,'other');
  gitIn(other,['switch','-q','develop']);
  await mkdir(path.join(other,'.agrimap-agent','reports'),{recursive:true});
  await writeFile(path.join(other,'.agrimap-agent','reports','shared.md'),'theirs\n');
  gitIn(other,['add','--','.agrimap-agent/reports/shared.md']);gitIn(other,['commit','-q','-m','docs: report']);gitIn(other,['push','-q','origin','develop']);
  await mkdir(path.join(p.repo,'.agrimap-agent','reports'),{recursive:true});
  await writeFile(path.join(p.repo,'.agrimap-agent','reports','shared.md'),'mine, not committed\n');
  const before=p.git(['rev-parse','HEAD']);
  const plan=p.cli(['integrate','plan','--session','s1','--intent','integrate']);
  const result=p.cli(['integrate','apply','--session','s1','--intent','integrate','--plan-hash',plan.planHash]);
  assert.equal(result.code,'MERGE_FAILED',JSON.stringify(result));assert.equal(result.card,null);
  assert.match(result.stderr,/would be overwritten/);
  assert.equal(await present(path.join(p.repo,'.git','MERGE_HEAD')),false);
  assert.equal(p.git(['rev-parse','HEAD']),before);
  assert.equal(await readFile(path.join(p.repo,'.agrimap-agent','reports','shared.md'),'utf8'),'mine, not committed\n');
});

test('team commit style: feature|fix|comment for work, bump|audit|ci for agm-release, Thai headers (4.9.3)',async()=>{
  const {TEAM_HEADER}=await import('../../skills/agrimap-agent-skills/scripts/git-flow.mjs');
  for(const header of ['feature: เพิ่มรับ User หลายช่องทาง','fix: แก้ dynamic form เพิ่มวันที่ ช่วงเวลา','comment: ปรับโทนสีปุ่มเป็นสีม่วง','bump: Production 1.4.2','audit: บันทึกประวัติ release 1.4.2','ci: อัปเดต bootstrap 4.9.3'])assert.match(header,TEAM_HEADER,header);
  for(const header of ['feat(orders): add export','Feature: เพิ่ม','fix:ไม่มีช่องว่าง','docs: update'])assert.doesNotMatch(header,TEAM_HEADER,header);
});
