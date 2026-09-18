import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../helpers/harness.mjs';
import {createGitFixture,gitIn} from '../helpers/git-fixture.mjs';
import {inferProject,validateProject,projectDefaults,PROJECT_PATH} from '../../skills/agrimap-agent-skills/scripts/project-profile.mjs';
import {storeCard,recordChoice} from '../../skills/agrimap-agent-skills/scripts/decision-card.mjs';

async function fixture(t){const h=await createHarness('agm-project-');t.after(()=>h.cleanup());return h;}
function commits(repo,count){for(let i=0;i<count;i+=1)gitIn(repo,['commit','-q','--allow-empty','-m',`chore: history ${i}`]);}

test('spec tooling in the repository infers spec-first with high confidence and no card',async t=>{
  const h=await fixture(t);
  const {repo}=await createGitFixture(h,{name:'orders',files:{'specs/001-export/spec.md':'# Export\n## Acceptance\n- AC-ORD-001\n','specs/002-list/spec.md':'# List\n','specs/003-auth/spec.md':'# Auth\n','.specify/memory/constitution.md':'# Constitution\n'}});
  const r=await inferProject(repo);
  assert.equal(r.proposal.developmentMode,'spec-first');assert.equal(r.confidence,'high');
  assert.equal(r.proposal.status,'inferred');assert.equal(r.card,null);assert.match(r.planLine,/AI-First/);
});

test('a long history without specs infers code-first with high confidence',async t=>{
  const h=await fixture(t);const {repo}=await createGitFixture(h,{name:'legacy-service',files:{'src/app.cs':'class A {}\n'}});
  commits(repo,60);
  const r=await inferProject(repo);
  assert.equal(r.proposal.developmentMode,'code-first');assert.equal(r.confidence,'high');assert.equal(r.card,null);
});

test('long history plus a matching sibling spec pack is low confidence and asks with three options',async t=>{
  const h=await fixture(t);const {repo}=await createGitFixture(h,{name:'agmwa-license-management-ng',files:{'src/main.ts':'x\n'}});
  commits(repo,60);
  await mkdir(path.join(h.temp,'agrimap-license-management-spec-v1.0.0','06-agent'),{recursive:true});
  await writeFile(path.join(h.temp,'agrimap-license-management-spec-v1.0.0','06-agent','CONTEXT-INDEX.yaml'),'project:\n  id: agrimap-license-management\n  version: 1.0.0\n');
  const r=await inferProject(repo);
  assert.equal(r.confidence,'low');
  assert.equal(r.card.options.length,3);assert.equal(r.card.recordAs,'project:developmentMode');
  assert.equal(r.card.options[0].value,'spec-first');
});

test('external sources are referenced by id only',()=>{
  const profile={...projectDefaults('spec-first'),confirmedBy:'t',confirmedAt:'2026-09-18'};
  profile.specs.sources=[{id:'ops-spec',kind:'external',path:'D:/x'}];
  assert.ok(validateProject(profile).details.some(d=>d.code==='PROJECT_PROFILE_INVALID'&&/path/.test(d.field)));
});

test('decide record with project:developmentMode writes project.json and a decision',async t=>{
  const h=await fixture(t);const {repo}=await createGitFixture(h,{name:'svc'});
  const state=path.join(repo,'.agrimap-agent');
  const inferred=await inferProject(repo);
  const card=inferred.card||{kind:'project',topic:'project/development-mode',risk:'R2',confidence:'low',question:'โปรเจกต์นี้พัฒนาแบบไหน',impact:'ยึด code หรือ spec',checked:['x'],
    options:[{id:'1',label:'AI-First',effect:'spec',value:'spec-first'},{id:'2',label:'Not AI-First',effect:'code',value:'code-first'}],recommended:'1',recommendedReason:'r',blocking:true,default:null,recordAs:'project:developmentMode'};
  const stored=await storeCard(state,'s',card);
  const chosen=card.options.find(o=>o.value==='code-first');
  const optionId=String(card.options.filter(o=>o.id===card.recommended).concat(card.options.filter(o=>o.id!==card.recommended)).indexOf(chosen)+1);
  const result=await recordChoice(state,{session:'s',cardId:stored.cardId,choice:optionId,requestedBy:'owner'});
  assert.equal(result.ok,true,JSON.stringify(result));
  const profile=JSON.parse(await readFile(path.join(repo,PROJECT_PATH),'utf8'));
  assert.equal(profile.developmentMode,'code-first');assert.equal(profile.status,'confirmed');
  const period=(await readdir(path.join(state,'decisions')))[0];
  assert.ok((await readdir(path.join(state,'decisions',period))).some(f=>f.endsWith('-development-mode.md')));
});
