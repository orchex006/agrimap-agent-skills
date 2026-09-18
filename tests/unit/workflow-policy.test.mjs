import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../helpers/harness.mjs';
import {createGitFixture,initRepo} from '../helpers/git-fixture.mjs';
import {PROFILES,validatePolicy,inferPolicy,initPolicy,setPolicyValue,loadPolicy,isProtected,POLICY_PATH} from '../../skills/agrimap-agent-skills/scripts/workflow-policy.mjs';

async function fixture(t){const h=await createHarness('agm-policy-');t.after(()=>h.cleanup());return h;}
const confirmed=p=>({...structuredClone(p),status:'confirmed',confirmedBy:'t',confirmedAt:'2026-09-18'});

test('all three profiles validate; ff-only promotion and push-without-commit are rejected',()=>{
  for(const profile of Object.values(PROFILES))assert.deepEqual(validatePolicy(confirmed(profile)).details,[]);
  const bad=confirmed(PROFILES['agrimap-jenkins']);bad.branching.workTypes.hotfix.base='jenkins-release';
  assert.ok(validatePolicy(bad).details.some(d=>d.code==='POLICY_HOTFIX_BASE_BREAKS_FF_PROMOTION'));
  const v5=confirmed(PROFILES.gitflow);v5.delivery.commitOnComplete=false;
  assert.equal(validatePolicy(v5).ok,false);
  assert.equal(isProtected(PROFILES.gitflow,'release/4.6.0'),true);
  assert.equal(isProtected(PROFILES.gitflow,'feature/x'),false);
});

test('inference: jenkins high, develop+main gitflow, main-only trunk, no remote low; prefixes counted',async t=>{
  const h=await fixture(t);
  const jenkins=await createGitFixture(h,{name:'jk',branches:['develop','jenkins','jenkins-release','feature/a','feature/b','feature/c'],jenkins:true});
  const j=await inferPolicy(jenkins.repo);
  assert.equal(j.proposal.profile,'agrimap-jenkins');assert.equal(j.confidence,'high');
  assert.ok(j.evidence.some(e=>/^feature\/\* \d+ branches$/.test(e)));
  assert.equal(j.card.recordAs,'policy:init');
  assert.equal((await inferPolicy((await createGitFixture(h,{name:'gf'})).repo)).proposal.profile,'gitflow');
  assert.equal((await inferPolicy((await createGitFixture(h,{name:'tr',branches:[]})).repo)).proposal.profile,'trunk');
  const none=await inferPolicy(await initRepo(path.join(h.temp,'solo')));
  assert.equal(none.confidence,'low');assert.equal(none.proposal.delivery.pushOnComplete,false);
});

test('init writes policy, decision and project fact; set keeps unknown keys and refuses invalid values without writing',async t=>{
  const h=await fixture(t);const {repo}=await createGitFixture(h,{name:'r'});
  const init=await initPolicy(repo,'gitflow',{custom:{keep:true}},'owner');
  assert.equal(init.ok,true);
  const policy=JSON.parse(await readFile(path.join(repo,POLICY_PATH),'utf8'));
  assert.equal(policy.status,'confirmed');assert.equal(policy.confirmedBy,'owner');assert.deepEqual(policy.custom,{keep:true});
  assert.match(await readFile(path.join(repo,'.agrimap-agent/memory/project.md'),'utf8'),/## Facts\n- Workflow policy:/);
  const before=await readFile(path.join(repo,POLICY_PATH),'utf8');
  const bad=await setPolicyValue(repo,'integration.method','teleport','owner');
  assert.equal(bad.code,'POLICY_INVALID');
  assert.equal(await readFile(path.join(repo,POLICY_PATH),'utf8'),before);
  const good=await setPolicyValue(repo,'integration.method','local-merge','owner');
  assert.equal(good.ok,true);assert.deepEqual(good.policy.custom,{keep:true});
  const decisions=await readdir(path.join(repo,'.agrimap-agent/decisions',(await readdir(path.join(repo,'.agrimap-agent/decisions')))[0]));
  assert.equal(decisions.length,2);
  assert.match((await loadPolicy(repo)).policy.decisionRef,/^decisions\/\d{4}-\d{2}\/\d{8}-git-workflow-policy(-2)?\.md$/);
});
