import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../helpers/harness.mjs';
import {createGitFixture} from '../helpers/git-fixture.mjs';
import {validateCard,renderCard,normalizeOptions,storeCard,loadLastCard,recordChoice} from '../../skills/agrimap-agent-skills/scripts/decision-card.mjs';
import {resolveShortIntent} from '../../skills/agrimap-agent-skills/scripts/governance-policy.mjs';
import {initPolicy,POLICY_PATH} from '../../skills/agrimap-agent-skills/scripts/workflow-policy.mjs';

async function fixture(t){const h=await createHarness('agm-card-');t.after(()=>h.cleanup());return h;}
const card=(extra={})=>({kind:'workflow',topic:'git/hotfix-base',risk:'R2',confidence:'medium',question:'hotfix นี้ควรแตกจาก branch ไหน',impact:'กำหนด base/target',
  checked:['policy: ไม่มี hotfix base'],options:[{id:'a',label:'jenkins-release',effect:'ff-only รอบหน้าจะ diverge',value:'jenkins-release'},{id:'b',label:'develop',effect:'promote ผ่าน jenkins ตาม ff-only',value:'develop'}],
  recommended:'b',recommendedReason:'promotion เป็น --ff-only',blocking:true,default:null,recordAs:'policy:branching.workTypes.hotfix.base',paths:[],expiresHours:24,...extra});

test('card validation enforces option count, recommendation, R3 blocking and recordAs schema',()=>{
  assert.equal(validateCard(card()).ok,true);
  assert.equal(validateCard(card({options:[card().options[0]]})).code,'CARD_INVALID');
  const five=Array.from({length:5},(_,i)=>({id:String(i+1),label:`o${i}`,effect:`e${i}`}));
  assert.equal(validateCard(card({options:five,recommended:'1'})).ok,false);
  assert.equal(validateCard(card({recommended:'z'})).ok,false);
  assert.equal(validateCard(card({risk:'R3',blocking:true,default:'a'})).ok,false);
  assert.equal(validateCard(card({recordAs:'policy:no.such.path'})).ok,false);
  assert.equal(validateCard(card({question:'x'.repeat(161)})).ok,false);
});

test('render moves the recommendation to option 1 and marks it',()=>{
  const c=card();const r=renderCard({...c,options:normalizeOptions(c)});
  assert.match(r.markdown,/^1\. develop \(แนะนำ\) — promote/m);
  assert.match(r.markdown,/^2\. jenkins-release — /m);
  assert.match(r.markdown,/รอคำตอบก่อนทำส่วนนี้/);
});

test('stored card answers short replies; expired cards do not',async t=>{
  const h=await fixture(t);const state=path.join(h.temp,'.agrimap-agent');
  const stored=await storeCard(state,'sess-1',card());
  const lastCard=await loadLastCard(state,'sess-1');
  for(const reply of ['2','ข้อ 2','option 2'])assert.equal(resolveShortIntent(reply,{lastCard}).option,'2');
  assert.equal(resolveShortIntent('2',{lastCard,now:Date.parse(lastCard.expiresAt)+1}).intent,'none');
  assert.match(stored.cardId,/^sess-1-workflow-1$/);
});

test('recordChoice applies policy: paths with a decision, and none only closes the card',async t=>{
  const h=await fixture(t);const {repo}=await createGitFixture(h);
  await initPolicy(repo,'gitflow',{},'owner');
  const state=path.join(repo,'.agrimap-agent');
  const stored=await storeCard(state,'s',card());
  const result=await recordChoice(state,{session:'s',cardId:stored.cardId,choice:'1',requestedBy:'owner'});
  assert.equal(result.ok,true);assert.equal(result.recommendedChosen,true);
  assert.equal(JSON.parse(await readFile(path.join(repo,POLICY_PATH),'utf8')).branching.workTypes.hotfix.base,'develop');
  assert.equal(await loadLastCard(state,'s'),null);
  const period=(await readdir(path.join(state,'decisions')))[0];
  const count=(await readdir(path.join(state,'decisions',period))).length;
  const none=await storeCard(state,'s',card({recordAs:'none'}));
  const closed=await recordChoice(state,{session:'s',cardId:none.cardId,choice:'2'});
  assert.equal(closed.applied,'none');assert.deepEqual(closed.written,[]);
  assert.equal((await readdir(path.join(state,'decisions',period))).length,count);
  assert.equal((await recordChoice(state,{session:'s',cardId:'missing',choice:'1'})).code,'CARD_NOT_FOUND');
});
